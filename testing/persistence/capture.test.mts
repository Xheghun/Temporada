import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  copyFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { syncFixture } from './sync-fixture.mts';
import {
  UploadFileStore,
  CaptureError,
} from '../../src/core/files/upload-file-store.ts';
import type {
  CaptureStorage,
  SelectedImage,
} from '../../src/core/files/upload-file-store.ts';
import { CaptureService } from '../../src/features/capture/capture-service.ts';

async function fixture() {
  const context = await syncFixture();
  const root = (workerId: string) =>
    join(context.directory, 'private', workerId);
  const removed: string[] = [];
  const storage: CaptureStorage = {
    owns: (workerId, uri) =>
      uri.startsWith(pathToFileURL(root(workerId)).href + '/') &&
      !uri.includes('..'),
    async prepare(workerId, image) {
      mkdirSync(root(workerId), { recursive: true });
      const uri = pathToFileURL(
        join(root(workerId), 'capture-' + randomUUID() + '.jpg'),
      ).href;
      copyFileSync(new URL(image.uri), new URL(uri));
      return { workerId, uri, ...(await storage.inspect(workerId, uri)) };
    },
    async inspect(workerId, uri) {
      if (!storage.owns(workerId, uri))
        throw new CaptureError('file_ownership_invalid');
      if (!existsSync(new URL(uri)))
        throw new CaptureError('local_file_missing');
      const bytes = readFileSync(new URL(uri));
      return {
        byteSize: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
    },
    async list(workerId) {
      return existsSync(root(workerId))
        ? readdirSync(root(workerId)).map(
            (name) => pathToFileURL(join(root(workerId), name)).href,
          )
        : [];
    },
    async remove(workerId, uri) {
      if (!storage.owns(workerId, uri))
        throw new CaptureError('file_ownership_invalid');
      removed.push(uri);
      if (existsSync(new URL(uri))) unlinkSync(new URL(uri));
    },
    async discardSelectedImage() {},
    async recoverTemporaryFiles() {},
  };
  const references = {
    actions: (workerId: string) => context.worker(workerId).listActions(),
    fail: (workerId: string, actionId: string, code: string) =>
      context.worker(workerId).failUploadFile(actionId, code),
  };
  const files = new UploadFileStore(storage, references);
  const image = (): SelectedImage => ({
    uri: context.image().uri,
    width: 100,
    height: 100,
  });
  return {
    context,
    storage,
    references,
    files,
    image,
    removed,
    async close() {
      await files.settled();
      await context.close();
    },
  };
}

test('private preview lease survives reconciliation; enqueue bytes and ID survive restart until acknowledgment cleanup', async () => {
  const testContext = await fixture();
  const engine = testContext.context.engine();
  try {
    const file = await testContext.files.prepare('ana', testContext.image());
    await testContext.files.reconcile('ana');
    assert.equal(existsSync(new URL(file.uri)), true);
    const actionId = await testContext.files.commit(
      file,
      async () =>
        (await testContext.context.worker().enqueueDocument('passport', file))
          .id,
    );
    await testContext.context.reopen();
    const restarted = new UploadFileStore(
      testContext.storage,
      testContext.references,
    );
    await restarted.reconcile('ana');
    assert.equal(existsSync(new URL(file.uri)), true);
    assert.equal(
      (await testContext.context.worker().listActions())[0]?.id,
      actionId,
    );
    testContext.context.online = true;
    await engine.request();
    await restarted.reconcile('ana');
    assert.equal(existsSync(new URL(file.uri)), false);
    assert.equal(
      (await testContext.context.worker().listActions())[0]?.status,
      'delivered',
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('DB failure compensates unreferenced copy; ambiguous committed result keeps original bytes and action', async () => {
  const testContext = await fixture();
  try {
    const file = await testContext.files.prepare('ana', testContext.image());
    await testContext.context.database.exec(
      "CREATE TRIGGER reject_image BEFORE INSERT ON document_submissions BEGIN SELECT RAISE(ABORT,'test_db_failure'); END",
    );
    await assert.rejects(
      testContext.files.commit(
        file,
        async () =>
          (await testContext.context.worker().enqueueDocument('passport', file))
            .id,
      ),
    );
    assert.equal(existsSync(new URL(file.uri)), false);
    assert.equal((await testContext.context.worker().listActions()).length, 0);
    await testContext.context.database.exec('DROP TRIGGER reject_image');
    const replacement = await testContext.files.prepare(
      'ana',
      testContext.image(),
    );
    let originalId = '';
    const resolved = await testContext.files.commit(replacement, async () => {
      originalId = (
        await testContext.context
          .worker()
          .enqueueDocument('passport', replacement)
      ).id;
      throw new Error('lost_local_result');
    });
    assert.equal(resolved, originalId);
    assert.equal(existsSync(new URL(replacement.uri)), true);
  } finally {
    await testContext.close();
  }
});

test('post-copy process death removes orphan; missing/changed queued bytes become actionable failures and are never silently deleted', async () => {
  const testContext = await fixture();
  try {
    const orphan = await testContext.files.prepare('ana', testContext.image());
    const queued = await testContext.files.prepare('ana', testContext.image());
    await testContext.files.commit(
      queued,
      async () =>
        (await testContext.context.worker().enqueueDocument('passport', queued))
          .id,
    );
    const changed = await testContext.files.prepare('ana', testContext.image());
    await testContext.files.commit(
      changed,
      async () =>
        (
          await testContext.context
            .worker()
            .enqueueDocument('ds160_confirmation', changed)
        ).id,
    );
    unlinkSync(new URL(queued.uri));
    writeFileSync(new URL(changed.uri), 'changed');
    const restarted = new UploadFileStore(
      testContext.storage,
      testContext.references,
    );
    await restarted.reconcile('ana');
    assert.equal(existsSync(new URL(orphan.uri)), false);
    assert.equal(existsSync(new URL(changed.uri)), true);
    assert.deepEqual(
      (await testContext.context.worker().listActions()).map((action) => [
        action.status,
        action.lastErrorCode,
      ]),
      [
        ['failed_permanent', 'local_file_missing'],
        ['failed_permanent', 'local_file_changed'],
      ],
    );
  } finally {
    await testContext.close();
  }
});

test('measured threshold and digest/ownership are enforced again at commit before any database intent', async () => {
  const testContext = await fixture();
  try {
    const file = await testContext.files.prepare('ana', testContext.image());
    writeFileSync(new URL(file.uri), Buffer.alloc(1_500_000));
    let enqueued = false;
    await assert.rejects(
      testContext.files.commit(file, async () => {
        enqueued = true;
        return 'impossible';
      }),
      /upload_too_large/,
    );
    assert.equal(enqueued, false);
    const other = await testContext.files.prepare('ana', testContext.image());
    await assert.rejects(
      testContext.files.commit(
        { ...other, workerId: 'bruno' },
        async () => 'impossible',
      ),
      /file_ownership_invalid/,
    );
    assert.equal(existsSync(new URL(other.uri)), true);
  } finally {
    await testContext.close();
  }
});

test('reconciliation waits for in-progress enqueue and keeps failed files until an explicit replacement resolves them', async () => {
  const testContext = await fixture();
  try {
    const file = await testContext.files.prepare('ana', testContext.image());
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const committing = testContext.files.commit(file, async () => {
      entered();
      await barrier;
      return (
        await testContext.context.worker().enqueueDocument('passport', file)
      ).id;
    });
    await started;
    const cleanup = testContext.files.reconcile('ana');
    assert.equal(existsSync(new URL(file.uri)), true);
    release();
    const actionId = await committing;
    await cleanup;
    await testContext.context.worker().claimAction(actionId, 100);
    const action = (await testContext.context.worker().listActions())[0]!;
    await testContext.context
      .store()
      .finish(action, { kind: 'failed', code: 'upload_too_large' }, 100);
    await testContext.files.reconcile('ana');
    assert.equal(existsSync(new URL(file.uri)), true);
    const replacement = await testContext.files.prepare(
      'ana',
      testContext.image(),
    );
    await testContext.files.commit(
      replacement,
      async () =>
        (
          await testContext.context
            .worker()
            .enqueueDocument('passport', replacement, undefined, actionId)
        ).id,
    );
    await testContext.files.reconcile('ana');
    assert.equal(existsSync(new URL(file.uri)), false);
    assert.equal(existsSync(new URL(replacement.uri)), true);
  } finally {
    await testContext.close();
  }
});

test('database read failure retains unreferenced bytes rather than risking an ambiguous committed upload', async () => {
  const testContext = await fixture();
  try {
    const file = await testContext.files.prepare('ana', testContext.image());
    const references = {
      ...testContext.references,
      actions: async () => {
        throw new Error('database_unavailable');
      },
    };
    const uncertain = new UploadFileStore(testContext.storage, references);
    await assert.rejects(
      uncertain.commit(file, async () => null),
      /database_unavailable/,
    );
    assert.equal(existsSync(new URL(file.uri)), true);
  } finally {
    await testContext.close();
  }
});

async function controllerFixture() {
  const testContext = await fixture();
  const listeners = new Set<() => void>();
  let enabled = true;
  let choose: () => Promise<SelectedImage | null> = async () =>
    testContext.image();
  const service = new CaptureService({
    enabled: () => enabled,
    validate: () => true,
    session: {
      current: () => testContext.context.session,
      invalidate: () => {},
      subscribeSession(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    files: testContext.files,
    choose: () => choose(),
    submit: async (selection, file) =>
      (
        await testContext.context
          .worker(selection.workerId)
          .enqueueDocument(selection.documentType, file)
      ).id,
    reportCleanupFailure: () => {},
  });
  service.open({
    workerId: 'ana',
    generation: 1,
    documentType: 'passport',
    expectedSubmissionId: null,
  });
  return {
    ...testContext,
    service,
    get choose() {
      return choose;
    },
    set choose(value: () => Promise<SelectedImage | null>) {
      choose = value;
    },
    get enabled() {
      return enabled;
    },
    set enabled(value: boolean) {
      enabled = value;
    },
    switchWorker() {
      testContext.context.session = {
        workerId: 'bruno',
        generation: 2,
        token: 'fictional-bruno',
      };
      listeners.forEach((listener) => listener());
    },
    async close() {
      service.dispose();
      await testContext.close();
    },
  };
}

test('capture permission denial recovers via gallery; duplicate saves persist one stable action, not a claimed staff approval', async () => {
  const testContext = await controllerFixture();
  try {
    testContext.choose = async () => {
      throw new CaptureError('capture_camera_denied');
    };
    await testContext.service.choose('camera');
    assert.equal(
      testContext.service.getSnapshot().error,
      'capture_camera_denied',
    );
    testContext.choose = async () => testContext.image();
    await testContext.service.choose('gallery');
    assert.ok(testContext.service.getSnapshot().preview);
    await Promise.all([testContext.service.save(), testContext.service.save()]);
    assert.equal(testContext.service.getSnapshot().phase, 'saved');
    assert.equal((await testContext.context.worker().listActions()).length, 1);
    assert.equal(
      (await testContext.context.worker().listActions())[0]?.status,
      'queued',
    );
  } finally {
    await testContext.close();
  }
});

test('late picker/compression and worker switch never reveal another worker preview or queue', async () => {
  const testContext = await controllerFixture();
  try {
    let release!: (image: SelectedImage) => void;
    testContext.choose = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const pending = testContext.service.choose('gallery');
    testContext.switchWorker();
    release(testContext.image());
    await pending;
    assert.equal(testContext.service.getSnapshot().preview, null);
    assert.equal(testContext.service.getSnapshot().selection, null);
    assert.equal((await testContext.context.worker().listActions()).length, 0);
  } finally {
    await testContext.close();
  }
});

test('journal IO failure is reported after database-aware reconciliation preserves pending files and removes orphan files', async () => {
  const testContext = await fixture();
  try {
    const pending = await testContext.files.prepare('ana', testContext.image());
    await testContext.files.commit(
      pending,
      async () =>
        (
          await testContext.context
            .worker()
            .enqueueDocument('passport', pending)
        ).id,
    );
    const orphan = await testContext.files.prepare('ana', testContext.image());
    testContext.storage.recoverTemporaryFiles = async () => {
      throw new CaptureError('capture_cleanup_failed');
    };
    const restarted = new UploadFileStore(
      testContext.storage,
      testContext.references,
    );
    await assert.rejects(restarted.reconcile('ana'), /capture_cleanup_failed/);
    assert.equal(existsSync(new URL(pending.uri)), true);
    assert.equal(existsSync(new URL(orphan.uri)), false);
    assert.equal(
      (await testContext.context.worker().listActions())[0]?.status,
      'queued',
    );
  } finally {
    await testContext.close();
  }
});
