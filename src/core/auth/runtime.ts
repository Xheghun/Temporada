import { fetch as expoFetch } from 'expo/fetch';
import { randomUUID } from 'expo-crypto';
import { AuthService } from './auth-service.ts';
import { createAuthApi } from './auth-api.ts';
import { secureSessionVault } from './secure-session-vault.ts';
import {
  workerRepository,
  openWorkerDatabase,
} from '../database/expo-database.ts';
import { SyncRepository } from '../database/repositories/sync-repository.ts';
import { createApiTransport } from '../api/client.ts';
import { uploadResolver } from '../files/upload-resolver.ts';
import { SyncEngine } from '../sync/sync-engine.ts';
import { nativeClock, nativeSignals } from '../sync/native-signals.ts';
import { attachSyncTriggers } from '../sync/sync-triggers.ts';
import { retryDelay } from '../sync/retry-policy.ts';
import i18n from '../i18n/index.ts';
import { CaptureService } from '../../features/capture/capture-service.ts';
import { documentViews } from '../../features/documents/domain/document-view.ts';
import { UploadFileStore } from '../files/upload-file-store.ts';
import { nativeCaptureStorage } from '../files/native-capture-storage.ts';
import { chooseImage } from '../files/native-image-picker.ts';
import { DocumentsService } from '../../features/documents/documents-service.ts';
import { AssignmentService } from '../../features/assignment/assignment-service.ts';
import { isFeatureEnabled } from '../config/feature-flags.ts';

export async function workerAppEnabled(
  name = 'worker_authentication',
): Promise<boolean> {
  if (__DEV__ && process.env.EXPO_PUBLIC_ASSESSMENT_MODE === '1') return true;
  return isFeatureEnabled(name, {
    async load() {
      const url = process.env.EXPO_PUBLIC_FLAGS_URL;
      if (!url?.startsWith('https://')) return {};
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await expoFetch(url, { signal: controller.signal });
        if (!response.ok) return {};
        return await response.json();
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}
export async function createWorkerRuntime() {
  const enabled = await workerAppEnabled();
  if (!enabled) return null;
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (
    !base ||
    !/^https?:\/\//.test(base) ||
    (!__DEV__ && !base.startsWith('https://'))
  )
    throw new Error('api_configuration_missing');
  const homeEnabled = await workerAppEnabled('worker_home_and_terms');
  const documentsEnabled =
    homeEnabled && (await workerAppEnabled('worker_document_corrections'));
  const captureEnabled =
    documentsEnabled && (await workerAppEnabled('worker_document_capture'));
  const database = await openWorkerDatabase();
  const preference = await database.first<{ language: string }>(
    'SELECT language FROM app_settings WHERE id=1',
  );
  await i18n.changeLanguage(preference?.language === 'en' ? 'en' : 'es');
  const auth = new AuthService(
    createAuthApi(base, expoFetch),
    secureSessionVault,
  );
  const api = createApiTransport(base, uploadResolver, expoFetch);
  const enqueueListeners = new Set<() => void>();
  const syncSignals = nativeSignals(auth.subscribeSession, (listener) => {
    enqueueListeners.add(listener);
    return () => {
      enqueueListeners.delete(listener);
    };
  });
  const repositories = new Map<string, SyncRepository>();
  const persistence = (workerId: string) => {
    let repository = repositories.get(workerId);
    if (!repository) {
      repository = new SyncRepository(database, workerId, {
        uuid: randomUUID,
        now: Date.now,
      });
      repositories.set(workerId, repository);
    }
    return repository;
  };
  const files = new UploadFileStore(nativeCaptureStorage, {
    actions: (workerId) => workerRepository(database, workerId).listActions(),
    fail: (workerId, actionId, code) =>
      workerRepository(database, workerId).failUploadFile(actionId, code),
  });
  const viewListeners = new Set<(workerId: string) => void>();
  const engine = new SyncEngine({
    persistence,
    api,
    session: auth,
    connectivity: syncSignals.connectivity,
    clock: nativeClock,
    retryDelay,
    enabled: () => enabled,
    report: (event) => {
      const workerId = event.workerId;
      if (workerId) {
        viewListeners.forEach((notify) => notify(workerId));
        if (captureEnabled)
          void files
            .reconcile(workerId)
            .then(() => viewListeners.forEach((notify) => notify(workerId)))
            .catch(() => {
              if (auth.current()?.workerId === workerId)
                auth.reportIssue('capture_cleanup_failed');
            });
      }
      if (event.type === 'error' && event.workerId === auth.current()?.workerId)
        auth.reportIssue('sync_unavailable');
    },
  });
  async function setLanguage(language: 'en' | 'es') {
    await database.run('UPDATE app_settings SET language=? WHERE id=1', [
      language,
    ]);
    await i18n.changeLanguage(language);
  }
  const assignment = new AssignmentService({
    enabled: () => homeEnabled,
    session: auth,
    repository: (workerId) => workerRepository(database, workerId),
    online: syncSignals.connectivity.online,
    subscribeNetwork: syncSignals.signals.connectivity,
    subscribeData(listener) {
      viewListeners.add(listener);
      return () => {
        viewListeners.delete(listener);
      };
    },
    notifyEnqueued() {
      enqueueListeners.forEach((notify) => notify());
    },
    async refresh(session) {
      if (!auth.isCurrent(session)) return;
      await persistence(session.workerId).requestRefresh();
      if (auth.isCurrent(session)) await engine.manualRetry();
    },
    setLanguage,
  });
  const documents = new DocumentsService({
    enabled: () => documentsEnabled,
    session: auth,
    repository: (workerId) => workerRepository(database, workerId),
    online: syncSignals.connectivity.online,
    subscribeNetwork: syncSignals.signals.connectivity,
    subscribeData(listener) {
      viewListeners.add(listener);
      return () => {
        viewListeners.delete(listener);
      };
    },
    notifyEnqueued(workerId) {
      viewListeners.forEach((notify) => notify(workerId));
      enqueueListeners.forEach((notify) => notify());
    },
    async refresh(session) {
      if (!auth.isCurrent(session)) return;
      await persistence(session.workerId).requestRefresh();
      if (auth.isCurrent(session)) await engine.manualRetry();
    },
  });
  const capture = new CaptureService({
    enabled: () => captureEnabled,
    session: auth,
    files,
    choose: chooseImage,
    validate(selection) {
      const data = documents.getSnapshot();
      if (
        data.workerId !== selection.workerId ||
        data.generation !== selection.generation ||
        !data.data
      )
        return false;
      const document = documentViews(data.data).find(
        (candidate) => candidate.documentType === selection.documentType,
      );
      return (
        !!document?.canSubmit &&
        (document.current?.id ?? null) === selection.expectedSubmissionId
      );
    },
    async submit(selection, file) {
      return (
        (
          await documents.submit(
            selection.documentType,
            file,
            selection.generation,
            selection.expectedSubmissionId,
          )
        )?.id ?? null
      );
    },
    reportCleanupFailure() {
      auth.reportIssue('capture_cleanup_failed');
    },
  });
  const stopFileForeground = syncSignals.signals.foreground(() => {
    const workerId = auth.current()?.workerId;
    if (workerId && captureEnabled)
      void files
        .reconcile(workerId)
        .then(() => viewListeners.forEach((notify) => notify(workerId)))
        .catch(() => auth.reportIssue('capture_cleanup_failed'));
  });
  let selectedGeneration = -1;
  const prepareSelection = auth.subscribeSession(() => {
    const session = auth.current();
    if (session && selectedGeneration !== session.generation) {
      selectedGeneration = session.generation;
      const worker = auth.getSnapshot().selectedWorker;
      if (!worker) return;
      void workerRepository(database, session.workerId)
        .ensureWorkerIdentity(worker.displayName)
        .then(() => engine.request())
        .then(() =>
          captureEnabled ? files.reconcile(session.workerId) : undefined,
        )
        .then(() => viewListeners.forEach((notify) => notify(session.workerId)))
        .then(() => persistence(session.workerId).requestRefresh())
        .then(() => engine.request())
        .catch(() => {
          if (auth.isCurrent(session)) auth.reportIssue('sync_unavailable');
        });
    }
  });
  const detach = attachSyncTriggers(engine, syncSignals.signals);
  await auth.restore();
  return {
    auth,
    setLanguage,
    assignment,
    documents,
    capture,
    database,
    notifyEnqueued() {
      enqueueListeners.forEach((notify) => notify());
    },
    async dispose() {
      prepareSelection();
      stopFileForeground();
      capture.dispose();
      assignment.dispose();
      documents.dispose();
      detach();
      syncSignals.dispose();
      await engine.settled();
      await files.settled();
      await auth.settled();
      await database.close();
    },
  };
}
export type WorkerRuntime = NonNullable<
  Awaited<ReturnType<typeof createWorkerRuntime>>
>;
