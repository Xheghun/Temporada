import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { openTestDatabase } from './node-database.mts';
import { WorkerRepository } from '../../src/core/database/repositories/worker-repository.ts';
import { SyncRepository } from '../../src/core/database/repositories/sync-repository.ts';
import { SyncEngine } from '../../src/core/sync/sync-engine.ts';
import { retryDelay } from '../../src/core/sync/retry-policy.ts';
import { assignmentFixture } from '../../src/testing/persistence-fixtures.ts';
import type {
  ApiTransport,
  SyncSession,
  SyncEvent,
  SyncClock,
  DeliveryReceipt,
} from '../../src/core/sync/types.ts';
import type { OutboxAction } from '../../src/core/offline/domain/types.ts';

export class FakeClock implements SyncClock {
  time = 100;
  callbacks = new Map<number, () => void>();
  now = () => this.time;
  schedule(at: number, callback: () => void) {
    this.callbacks.set(at, callback);
    return () => {
      this.callbacks.delete(at);
    };
  }
  advance(time: number) {
    this.time = time;
    for (const [at, callback] of this.callbacks)
      if (at <= time) {
        this.callbacks.delete(at);
        callback();
      }
  }
}
export function receipt(action: OutboxAction, revision = 2): DeliveryReceipt {
  if (action.payload.kind === 'terms_acceptance')
    return {
      kind: 'terms_acceptance',
      clientActionId: action.clientActionId,
      termsVersionId: action.payload.termsVersionId,
      serverRevision: revision,
    };
  return {
    kind: 'document_upload',
    clientActionId: action.clientActionId,
    documentType: action.payload.documentType,
    submissionId: 'server-' + action.clientActionId,
    status: 'pending_review',
    correctionReason: null,
    serverRevision: revision,
  };
}
export async function syncFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'worker-sync-'));
  const path = join(directory, 'local.sqlite');
  let db = await openTestDatabase(path);
  const clock = new FakeClock();
  const identity = { uuid: randomUUID, now: clock.now };
  let session: SyncSession | null = {
    workerId: 'ana',
    token: 'fictional-local-session',
    generation: 1,
  };
  let online = false;
  const events: SyncEvent[] = [];
  const attempts: OutboxAction[] = [];
  const api: ApiTransport = {
    async send(_session, action) {
      attempts.push(action);
      return { status: 201, receipt: receipt(action) };
    },
    async assignment(s) {
      return { ...assignmentFixture(s.workerId), serverRevision: 2 };
    },
  };
  const worker = (id = 'ana') => new WorkerRepository(db, id, identity);
  const store = (id = 'ana') => new SyncRepository(db, id, identity);
  await worker().cacheAssignment(assignmentFixture('ana'));
  const engine = () =>
    new SyncEngine({
      persistence: store,
      api,
      clock,
      retryDelay: (attempt) => retryDelay(attempt, () => 1),
      connectivity: { online: () => online },
      enabled: () => true,
      session: {
        current: () => session,
        invalidate: (old) => {
          if (
            session?.generation === old.generation &&
            session.workerId === old.workerId
          )
            session = null;
        },
      },
      report: (event) => events.push(event),
    });
  return {
    directory,
    path,
    get db() {
      return db;
    },
    clock,
    worker,
    store,
    api,
    events,
    attempts,
    engine,
    set online(value: boolean) {
      online = value;
    },
    set session(value: SyncSession | null) {
      session = value;
    },
    get session() {
      return session;
    },
    async reopen() {
      await db.close();
      db = await openTestDatabase(path);
    },
    image(workerId = 'ana') {
      const file = join(directory, `${workerId}-${randomUUID()}.png`);
      const bytes = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=',
        'base64',
      );
      writeFileSync(file, bytes);
      return {
        workerId,
        uri: pathToFileURL(file).href,
        byteSize: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
    },
    blob(action: OutboxAction) {
      if (!action.fileUri) throw new Error('missing_file');
      return new Blob([readFileSync(new URL(action.fileUri))], {
        type: 'image/png',
      });
    },
    async close() {
      await db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
