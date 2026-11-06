import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncFixture, receipt } from './sync-fixture.mts';
import { DocumentsService } from '../../src/features/documents/documents-service.ts';
import type { DocumentsReader } from '../../src/features/documents/documents-service.ts';
import { documentViews } from '../../src/features/documents/domain/document-view.ts';
import { assignmentFixture } from '../../src/testing/persistence-fixtures.ts';

async function fixture(workerId = 'carla') {
  const context = await syncFixture();
  context.session = { workerId, token: 'fictional-documents', generation: 1 };
  await context.worker(workerId).cacheAssignment(assignmentFixture(workerId));
  const listeners = new Set<() => void>();
  let reader = (id: string): DocumentsReader => context.worker(id);
  let enabled = true;
  const notifications: string[] = [];
  const service = new DocumentsService({
    enabled: () => enabled,
    session: {
      current: () => context.session,
      invalidate: () => {},
      subscribeSession(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    repository: (id) => reader(id),
    online: () => false,
    subscribeNetwork: () => () => {},
    subscribeData: () => () => {},
    notifyEnqueued: (id) => notifications.push(id),
    refresh: async () => {},
  });
  await service.reload();
  return {
    context,
    service,
    notifications,
    set enabled(value: boolean) {
      enabled = value;
    },
    set reader(value: (id: string) => DocumentsReader) {
      reader = value;
    },
    switchWorker(id: string) {
      context.session = {
        workerId: id,
        token: 'fictional-shared',
        generation: (context.session?.generation ?? 0) + 1,
      };
      listeners.forEach((listener) => listener());
    },
    async close() {
      service.dispose();
      await context.close();
    },
  };
}
function passport(service: DocumentsService) {
  const data = service.getSnapshot().data;
  assert.ok(data);
  const document = documentViews(data).find(
    (document) => document.documentType === 'passport',
  );
  assert.ok(document);
  return document;
}

test('Carla correction creates new durable intent, preserves history, survives reopen and becomes Pending Review after acknowledgment', async () => {
  const testContext = await fixture();
  const engine = testContext.context.engine();
  try {
    const before = passport(testContext.service);
    assert.equal(before.current?.status, 'correction_requested');
    assert.equal(
      before.current.correctionReason,
      'Foto borrosa, vuelva a tomarla',
    );
    const image = testContext.context.image('carla');
    await Promise.all([
      testContext.service.submit('passport', image, 1, before.current.id),
      testContext.service.submit('passport', image, 1, before.current.id),
    ]);
    const actions = await testContext.context.worker('carla').listActions();
    assert.equal(actions.length, 1);
    assert.equal(passport(testContext.service).current?.status, 'pending_sync');
    assert.equal(
      passport(testContext.service).history[0]?.status,
      'correction_requested',
    );
    assert.equal(testContext.notifications[0], 'carla');
    assert.equal(
      actions[0]?.payload.kind === 'document_upload' &&
        actions[0].payload.replacesSubmissionId,
      'seed-carla-passport',
    );
    await testContext.context.reopen();
    await testContext.service.reload();
    assert.equal(passport(testContext.service).current?.id, actions[0]?.id);
    testContext.context.online = true;
    await engine.request();
    await testContext.service.reload();
    assert.equal(
      passport(testContext.service).current?.status,
      'pending_review',
    );
    assert.equal(
      passport(testContext.service).history[0]?.correctionReason,
      before.current.correctionReason,
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('higher-revision decision on the older passport never replaces newer queued or acknowledged submission', async () => {
  const testContext = await fixture();
  const engine = testContext.context.engine();
  try {
    await testContext.service.submit(
      'passport',
      testContext.context.image('carla'),
      1,
      'seed-carla-passport',
    );
    const snapshot = assignmentFixture('carla');
    snapshot.serverRevision = 9;
    snapshot.documentSubmissions[0]!.serverRevision = 9;
    snapshot.documentSubmissions[0]!.correctionReason =
      'Earlier image rejected again';
    await testContext.context.worker('carla').cacheAssignment(snapshot);
    await testContext.service.reload();
    assert.equal(passport(testContext.service).current?.status, 'pending_sync');
    assert.equal(
      passport(testContext.service).history[0]?.correctionReason,
      'Earlier image rejected again',
    );
    testContext.context.online = true;
    await engine.request();
    await testContext.service.reload();
    const currentId = passport(testContext.service).current?.id;
    assert.equal(
      passport(testContext.service).current?.status,
      'pending_review',
    );
    snapshot.serverRevision = 10;
    snapshot.documentSubmissions[0]!.serverRevision = 10;
    snapshot.documentSubmissions[0]!.status = 'approved';
    snapshot.documentSubmissions[0]!.correctionReason = null;
    await testContext.context.worker('carla').cacheAssignment(snapshot);
    await testContext.service.reload();
    assert.equal(passport(testContext.service).current?.id, currentId);
    assert.equal(
      passport(testContext.service).current?.status,
      'pending_review',
    );
    assert.equal(passport(testContext.service).history[0]?.status, 'approved');
  } finally {
    engine.stop();
    await testContext.close();
  }
});

for (const status of ['approved', 'correction_requested'] as const)
  test(`TEST-03R projection preserves ${status} before and after original replay receipt`, async () => {
    const testContext = await fixture('ana');
    try {
      await testContext.service.submit(
        'passport',
        testContext.context.image(),
        1,
        null,
      );
      const action = (await testContext.context.worker().listActions())[0]!;
      await testContext.context.store().claimAction(action.id, 100);
      const snapshot = assignmentFixture('ana');
      snapshot.serverRevision = 4;
      snapshot.documentSubmissions = [
        {
          submissionId: 'server-' + action.id,
          clientActionId: action.id,
          documentType: 'passport',
          status,
          correctionReason:
            status === 'correction_requested' ? 'Server text unchanged' : null,
          serverRevision: 4,
          createdAt: 100,
        },
      ];
      await testContext.context.worker().cacheAssignment(snapshot);
      await testContext.service.reload();
      assert.equal(passport(testContext.service).current?.status, status);
      await testContext.context
        .store()
        .finish(
          action,
          { kind: 'delivered', receipt: receipt(action, 2) },
          100,
        );
      await testContext.service.reload();
      assert.equal(passport(testContext.service).current?.status, status);
      assert.equal(
        passport(testContext.service).current?.correctionReason,
        snapshot.documentSubmissions[0]!.correctionReason,
      );
      assert.equal(passport(testContext.service).history.length, 0);
    } finally {
      await testContext.close();
    }
  });

test('failed replacement is explicit, atomically supersedes old action and delivers', async () => {
  const testContext = await fixture();
  const engine = testContext.context.engine();
  try {
    await testContext.service.submit(
      'passport',
      testContext.context.image('carla'),
      1,
      'seed-carla-passport',
    );
    const old = (await testContext.context.worker('carla').listActions())[0]!;
    await testContext.context.store('carla').claimAction(old.id, 100);
    await testContext.context
      .store('carla')
      .finish(old, { kind: 'failed', code: 'upload_too_large' }, 100);
    await testContext.service.reload();
    assert.equal(passport(testContext.service).current?.status, 'failed');
    await testContext.service.submit(
      'passport',
      testContext.context.image('carla'),
      1,
      old.id,
    );
    const actions = await testContext.context.worker('carla').listActions();
    assert.deepEqual(
      actions.map((action) => action.status),
      ['superseded', 'queued'],
    );
    assert.notEqual(actions[0]?.id, actions[1]?.id);
    testContext.context.online = true;
    await engine.request();
    assert.deepEqual(
      (await testContext.context.worker('carla').listActions()).map(
        (action) => action.status,
      ),
      ['superseded', 'delivered'],
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('worker switch clears data, rejects delayed reads and stale submissions, and keeps Carla intent isolated', async () => {
  const testContext = await fixture();
  try {
    const bruno = assignmentFixture('bruno');
    bruno.documentSubmissions = [
      {
        submissionId: 'seed-bruno-passport',
        clientActionId: 'seed-bruno-passport',
        documentType: 'passport',
        status: 'approved',
        correctionReason: null,
        serverRevision: 1,
        createdAt: 1,
      },
    ];
    await testContext.context.worker('bruno').cacheAssignment(bruno);
    await testContext.service.submit(
      'passport',
      testContext.context.image('carla'),
      1,
      'seed-carla-passport',
    );
    const oldView = await testContext.context.worker('carla').readView();
    let release!: (view: typeof oldView) => void;
    testContext.reader = (id) =>
      id === 'carla'
        ? {
            readView: () =>
              new Promise((resolve) => {
                release = resolve;
              }),
            enqueueDocument: (...args) =>
              testContext.context.worker(id).enqueueDocument(...args),
          }
        : testContext.context.worker(id);
    const pending = testContext.service.reload();
    testContext.switchWorker('bruno');
    assert.equal(testContext.service.getSnapshot().data, null);
    release(oldView);
    await pending;
    await testContext.service.reload();
    assert.equal(passport(testContext.service).current?.status, 'approved');
    await testContext.service.submit(
      'passport',
      testContext.context.image('carla'),
      1,
      'seed-carla-passport',
    );
    assert.equal(
      (await testContext.context.worker('bruno').listActions()).length,
      0,
    );
    testContext.reader = (workerId) => testContext.context.worker(workerId);
    testContext.switchWorker('carla');
    await testContext.service.reload();
    assert.equal(passport(testContext.service).current?.status, 'pending_sync');
    assert.equal(
      (await testContext.context.worker('carla').listActions()).length,
      1,
    );
  } finally {
    await testContext.close();
  }
});

test('failed local enqueue never reports saved; disabled feature and stale document selection cannot enqueue', async () => {
  const testContext = await fixture();
  try {
    await testContext.context.database.exec(
      "CREATE TRIGGER reject_document BEFORE INSERT ON document_submissions BEGIN SELECT RAISE(ABORT,'test_enqueue_failure'); END",
    );
    await testContext.service.submit(
      'passport',
      testContext.context.image('carla'),
      1,
      'seed-carla-passport',
    );
    assert.equal(
      testContext.service.getSnapshot().error,
      'document_save_failed',
    );
    assert.equal(testContext.service.getSnapshot().savedActionId, null);
    assert.equal(
      (await testContext.context.worker('carla').listActions()).length,
      0,
    );
    await testContext.context.database.exec('DROP TRIGGER reject_document');
    await testContext.service.submit(
      'passport',
      testContext.context.image('carla'),
      1,
      'wrong-submission',
    );
    assert.equal(
      (await testContext.context.worker('carla').listActions()).length,
      0,
    );
    testContext.enabled = false;
    await testContext.service.submit(
      'passport',
      testContext.context.image('carla'),
      1,
      'seed-carla-passport',
    );
    assert.equal(
      (await testContext.context.worker('carla').listActions()).length,
      0,
    );
  } finally {
    await testContext.close();
  }
});
