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
import { isFeatureEnabled } from '../config/feature-flags.ts';

export async function workerAppEnabled(): Promise<boolean> {
  if (__DEV__ && process.env.EXPO_PUBLIC_ASSESSMENT_MODE === '1') return true;
  return isFeatureEnabled('worker_authentication', {
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
  const db = await openWorkerDatabase();
  const auth = new AuthService(
    createAuthApi(base, expoFetch),
    secureSessionVault,
  );
  const api = createApiTransport(base, uploadResolver, expoFetch);
  const enqueueListeners = new Set<() => void>();
  const native = nativeSignals(auth.subscribeSession, (listener) => {
    enqueueListeners.add(listener);
    return () => {
      enqueueListeners.delete(listener);
    };
  });
  const repositories = new Map<string, SyncRepository>();
  const persistence = (workerId: string) => {
    let repository = repositories.get(workerId);
    if (!repository) {
      repository = new SyncRepository(db, workerId, {
        uuid: randomUUID,
        now: Date.now,
      });
      repositories.set(workerId, repository);
    }
    return repository;
  };
  const engine = new SyncEngine({
    persistence,
    api,
    session: auth,
    connectivity: native.connectivity,
    clock: nativeClock,
    retryDelay,
    enabled: () => enabled,
    report: (event) => {
      if (event.type === 'error') auth.reportIssue('sync_unavailable');
    },
  });
  let selectedGeneration = -1;
  const prepareSelection = auth.subscribeSession(() => {
    const session = auth.current();
    if (session && selectedGeneration !== session.generation) {
      selectedGeneration = session.generation;
      const worker = auth.getSnapshot().selectedWorker;
      if (!worker) return;
      void workerRepository(db, session.workerId)
        .ensureWorkerIdentity(worker.displayName)
        .then(() => persistence(session.workerId).requestRefresh())
        .then(() => engine.request())
        .catch(() => {
          if (auth.isCurrent(session)) auth.reportIssue('sync_unavailable');
        });
    }
  });
  const detach = attachSyncTriggers(engine, native.signals);
  await auth.restore();
  return {
    auth,
    db,
    notifyEnqueued() {
      enqueueListeners.forEach((notify) => notify());
    },
    async dispose() {
      prepareSelection();
      detach();
      native.dispose();
      await engine.settled();
      await auth.settled();
      await db.close();
    },
  };
}
export type WorkerRuntime = NonNullable<
  Awaited<ReturnType<typeof createWorkerRuntime>>
>;
