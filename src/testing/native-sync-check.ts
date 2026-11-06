import { fetch as expoFetch } from 'expo/fetch';
import { File, Directory, Paths } from 'expo-file-system';
import { CryptoDigestAlgorithm, digest, randomUUID } from 'expo-crypto';
import { openDatabaseAsync, deleteDatabaseAsync } from 'expo-sqlite';
import {
  openWorkerDatabase,
  workerRepository,
} from '../core/database/expo-database.ts';
import { SyncRepository } from '../core/database/repositories/sync-repository.ts';
import { createApiTransport } from '../core/api/client.ts';
import { uploadResolver } from '../core/files/upload-resolver.ts';
import { SyncEngine } from '../core/sync/sync-engine.ts';
import { nativeClock } from '../core/sync/native-signals.ts';
import { TransportError } from '../core/sync/types.ts';
import type { SyncSession } from '../core/sync/types.ts';
import type { OutboxAction } from '../core/offline/domain/types.ts';

const databaseName = 'sync-proof.sqlite';
// Dedicated development backend, reached through adb reverse. Never used by production runtime.
const base = 'http://127.0.0.1:3001';
function check(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}
async function post(path: string, body: unknown): Promise<unknown> {
  const result = await expoFetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  check(result.status === 200, 'proof_control_or_login_failed');
  return result.json();
}
async function login(): Promise<SyncSession> {
  const result = await post('/auth/otp/verify', {
    phoneNumber: '+525510000001',
    otp: '123456',
  });
  check(
    result &&
      typeof result === 'object' &&
      'token' in result &&
      typeof result.token === 'string',
    'proof_login_invalid',
  );
  return { workerId: 'ana', token: result.token, generation: 1 };
}
async function state(): Promise<{
  receipts: { clientActionId: string }[];
  documentSubmissions: { submissionId: string; clientActionId: string }[];
}> {
  const result = await expoFetch(base + '/__dev/state');
  check(result.status === 200, 'proof_state_failed');
  return result.json();
}
async function fixture() {
  const directory = new Directory(Paths.document, 'workers', 'ana', 'uploads');
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, `sync-proof-${randomUUID()}.png`);
  // Valid 1x1 fictional PNG, no worker image.
  const bytes = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=',
    ),
    (character) => character.charCodeAt(0),
  );
  file.create();
  await file.write(bytes);
  const hashed = await digest(CryptoDigestAlgorithm.SHA256, bytes);
  const sha256 = Array.from(new Uint8Array(hashed), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  check(
    file.size > 0 &&
      sha256.length === 64 &&
      file.uri.startsWith('file://') &&
      !/[?#]/.test(file.uri),
    'proof_fixture_invalid',
  );
  return { workerId: 'ana', uri: file.uri, byteSize: file.size, sha256 };
}
export async function runNativeSyncCheck(mode: string): Promise<string> {
  if (!__DEV__) throw new Error('developer_probe_disabled');
  if (mode === 'reset') {
    const database = await openDatabaseAsync(databaseName, {
      useNewConnection: true,
    });
    await database.closeAsync();
    await deleteDatabaseAsync(databaseName);
    return 'RESET_PASSED: dedicated sync proof database only; backend must start with fresh dedicated data for v2 scenarios.';
  }
  const database = await openWorkerDatabase(databaseName);
  const worker = workerRepository(database, 'ana');
  const repository = new SyncRepository(database, 'ana', {
    uuid: randomUUID,
    now: Date.now,
  });
  let session: SyncSession | null = await login();
  const api = createApiTransport(base, uploadResolver, expoFetch);
  let online = false;
  const errors: string[] = [];
  const engine = new SyncEngine({
    persistence: (workerId) => {
      check(workerId === 'ana', 'proof_worker_mismatch');
      return repository;
    },
    api,
    clock: nativeClock,
    retryDelay: () => 60000,
    session: {
      current: () => session,
      invalidate: () => {
        session = null;
      },
    },
    connectivity: { online: () => online },
    enabled: () => __DEV__,
    reportFailure: (error) => {
      errors.push(error instanceof Error ? error.message : 'unknown_failure');
    },
    report: (event) => {
      if (event.type === 'error' || event.type === 'auth_required')
        errors.push(event.code ?? event.type);
    },
  });
  try {
    check(session, 'proof_session_missing');
    if (mode === 'status')
      return JSON.stringify(
        (await worker.listActions()).map((action) => ({
          id: action.id,
          type: action.actionType,
          status: action.status,
          attemptCount: action.attemptCount,
          code: action.lastErrorCode,
        })),
      );
    if (mode === 'files') {
      const original = (await worker.listActions()).find(
        (action) => action.payload.kind === 'document_upload',
      );
      check(
        original && original.payload.kind === 'document_upload',
        'proof_requires_document',
      );
      const image = await fixture();
      const valid = {
        ...original,
        fileUri: image.uri,
        payload: { ...original.payload, sha256: image.sha256 },
      };
      check(
        (await uploadResolver.resolve(valid)).size === image.byteSize,
        'valid_file_rejected',
      );
      const cases = [
        {
          action: {
            ...valid,
            fileUri: image.uri.replace('/workers/ana/', '/workers/bruno/'),
          },
          code: 'file_ownership_invalid',
        },
        {
          action: { ...valid, fileUri: image.uri + '.missing' },
          code: 'local_file_missing',
        },
        {
          action: {
            ...valid,
            payload: { ...valid.payload, sha256: '0'.repeat(64) },
          },
          code: 'local_file_changed',
        },
      ];
      for (const item of cases) {
        let code = '';
        try {
          await uploadResolver.resolve(item.action);
        } catch (error) {
          code =
            error instanceof TransportError ? error.code : 'unexpected_error';
        }
        check(
          code === item.code,
          'file_check_failed:' + item.code + ':' + code,
        );
      }
      const large = new File(image.uri + '.large');
      large.create();
      await large.write(new Uint8Array(1_500_000));
      try {
        let code = '';
        try {
          await uploadResolver.resolve({ ...valid, fileUri: large.uri });
        } catch (error) {
          code =
            error instanceof TransportError ? error.code : 'unexpected_error';
        }
        check(code === 'upload_too_large', 'oversized_file_not_rejected');
      } finally {
        large.delete();
      }
      return 'FILE_INTEGRITY_PASSED: valid bytes accepted; foreign-worker path, missing file, changed digest and 1,500,000-byte file rejected.';
    }
    if (mode === 'seed') {
      const existing = await worker.listActions();
      if (existing.length) {
        const table = await database.first(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='probe_actions'",
        );
        check(table, 'proof_incomplete_reset_required');
        const saved = await database.first<{ value: string }>(
          'SELECT value FROM probe_actions LIMIT 1',
        );
        check(
          saved &&
            JSON.stringify(existing) === saved.value &&
            existing.every((action) => action.status === 'queued'),
          'proof_already_progressed_use_deliver',
        );
        return 'OFFLINE_SEED_PASSED: two durable queued actions already seeded; no duplicate enqueue. Force-stop and reopen mode=deliver.';
      }
      await worker.cacheAssignment(await api.assignment(session));
      check(
        (await worker.getAssignment())?.terms.termsVersionId === 'v2',
        'proof_requires_fresh_v2_backend',
      );
      await worker.enqueueTerms('v2');
      await worker.enqueueDocument('passport', await fixture());
      await engine.start();
      const actions = await worker.listActions();
      check(
        actions.every((action) => action.status === 'queued'),
        'offline_dispatch_occurred',
      );
      await database.exec('CREATE TABLE probe_actions(value TEXT NOT NULL)');
      await database.run('INSERT INTO probe_actions(value) VALUES(?)', [
        JSON.stringify(actions),
      ]);
      return 'OFFLINE_SEED_PASSED: two durable queued actions, zero action sends. Force-stop and reopen mode=deliver.';
    }
    if (mode === 'deliver') {
      const expected = await database.first<{ value: string }>(
        'SELECT value FROM probe_actions LIMIT 1',
      );
      check(expected, 'proof_not_seeded');
      const actions = JSON.parse(expected.value) as OutboxAction[];
      const before = await worker.listActions();
      check(
        before.length === actions.length &&
          before.every(
            (action, index) =>
              action.id === actions[index]?.id &&
              JSON.stringify(action.payload) ===
                JSON.stringify(actions[index]?.payload) &&
              action.fileUri === actions[index]?.fileUri,
          ),
        'restart_intent_changed',
      );
      online = true;
      await engine.start();
      check(
        (await worker.listActions()).every(
          (action) => action.status === 'delivered',
        ),
        'delivery_incomplete:' +
          errors.join(',') +
          ':' +
          (await worker.listActions())
            .map((action) => action.status + '/' + action.lastErrorCode)
            .join(','),
      );
      check(
        (await worker.listSubmissions()).find(
          (submission) => submission.documentType === 'passport',
        )?.serverStatus === 'pending_review',
        'review_not_pending',
      );
      const remote = await state();
      check(
        actions.every(
          (action) =>
            remote.receipts.filter(
              (receipt) => receipt.clientActionId === action.id,
            ).length === 1,
        ),
        'duplicate_or_missing_receipt',
      );
      return 'OFFLINE_DELIVERY_PASSED: same two IDs/payloads/files after restart, one server receipt each; passport Pending Review.';
    }
    if (mode === 'drop-review') {
      online = true;
      for (const decision of ['approved', 'correction_requested'] as const) {
        const action = await worker.enqueueDocument(
          'ds160_confirmation',
          await fixture(),
        );
        await post('/__dev/failures', { dropNextResponse: true });
        // Android's HTTP stack may transparently replay a socket drop. Explicitly discard
        // that successful receipt too, so the engine sees a deterministic lost-ack window.
        const transmit = api.send;
        api.send = async (captured, queued) => {
          const result = await transmit(captured, queued);
          if (queued.id === action.id)
            throw new TransportError(0, 'proof_discarded_ack');
          return result;
        };
        try {
          await engine.request();
        } finally {
          api.send = transmit;
        }
        check(
          (await worker.listActions()).find((action) => action.id === action.id)
            ?.status === 'retry_wait',
          'drop_did_not_retry:' +
            (await worker.listActions())
              .map((action) => action.status + '/' + action.lastErrorCode)
              .join(','),
        );
        const remote = await state();
        const committed = remote.documentSubmissions.find(
          (submission) => submission.clientActionId === action.id,
        );
        check(committed, 'drop_not_committed');
        await post('/__dev/review', {
          submissionId: committed.submissionId,
          status: decision,
          ...(decision === 'correction_requested'
            ? { correctionReason: 'Foto borrosa, vuelva a tomarla' }
            : {}),
        });
        check(session, 'proof_session_missing');
        await repository.cacheRefresh(await api.assignment(session));
        const original = api.assignment;
        api.assignment = async () => {
          throw new TransportError(0, 'proof_refresh_unavailable');
        };
        try {
          await engine.manualRetry();
        } finally {
          api.assignment = original;
        }
        const local = (await worker.listSubmissions()).find(
          (submission) => submission.clientActionId === action.id,
        );
        check(
          local?.serverStatus === decision &&
            local.deliveryStatus === 'delivered',
          'replay_regressed_review',
        );
        if (decision === 'correction_requested')
          check(
            local.correctionReason === 'Foto borrosa, vuelva a tomarla',
            'replay_lost_reason',
          );
        check(
          (await state()).documentSubmissions.filter(
            (submission) => submission.clientActionId === action.id,
          ).length === 1,
          'duplicate_submission',
        );
      }
      return 'DROPPED_REPLAY_PASSED: Approved and Correction Requested/reason survived original replay; one effect each.';
    }
    if (mode === 'stale') {
      await worker.cacheAssignment(await api.assignment(session));
      check(
        (await worker.getAssignment())?.terms.termsVersionId === 'v2',
        'proof_requires_v2_before_publish',
      );
      const previousAcceptance = await worker.enqueueTerms('v2');
      await post('/__dev/terms', { version: 'v3' });
      online = true;
      await engine.start();
      check(
        (await worker.listActions()).find(
          (action) => action.id === previousAcceptance.id,
        )?.status === 'stale',
        'v2_not_stale',
      );
      const current = await worker.getAssignment();
      check(
        current?.terms.termsVersionId === 'v3' &&
          current.terms.serverAcceptanceStatus === 'not_confirmed',
        'v3_autoaccepted_or_missing',
      );
      const fresh = await worker.enqueueTerms('v3');
      await engine.request();
      const actions = await worker.listActions();
      check(
        actions.find((action) => action.id === previousAcceptance.id)
          ?.status === 'stale' &&
          actions.find((action) => action.id === fresh.id)?.status ===
            'delivered',
        'v3_blocked_by_stale',
      );
      return 'STALE_TERMS_PASSED: v2 rejected and retained; v3 displayed unaccepted, then explicit new v3 confirmation delivered.';
    }
    throw new Error('unknown_proof_mode');
  } finally {
    engine.stop();
    await database.close();
  }
}
