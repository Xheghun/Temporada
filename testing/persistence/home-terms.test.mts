import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncFixture } from './sync-fixture.mts';
import { AssignmentService } from '../../src/features/assignment/assignment-service.ts';
import type { AssignmentReader } from '../../src/features/assignment/assignment-service.ts';
import { assignmentFacts } from '../../src/features/assignment/domain/view-state.ts';
import { assignmentFixture } from '../../src/testing/persistence-fixtures.ts';
import type { SyncSession } from '../../src/core/sync/types.ts';

async function fixture() {
  const syncContext = await syncFixture();
  let selected: SyncSession | null = {
    workerId: 'ana',
    token: 'fictional',
    generation: 1,
  };
  let online = false,
    signals = 0;
  let enabled = true;
  const listeners = new Set<() => void>();
  const events = new Set<(workerId: string) => void>();
  let read: (workerId: string) => AssignmentReader = (workerId) =>
    syncContext.worker(workerId);
  const service = new AssignmentService({
    enabled: () => enabled,
    session: {
      current: () => selected,
      invalidate: () => {},
      subscribeSession(callback) {
        listeners.add(callback);
        return () => {
          listeners.delete(callback);
        };
      },
    },
    repository: (workerId) => read(workerId),
    online: () => online,
    subscribeNetwork: () => () => {},
    subscribeData(callback) {
      events.add(callback);
      return () => {
        events.delete(callback);
      };
    },
    notifyEnqueued() {
      signals++;
    },
    refresh: async () => {},
    setLanguage: async () => {},
  });
  await service.reload();
  return {
    syncContext,
    service,
    setSession(session: SyncSession | null) {
      selected = session;
      listeners.forEach((callback) => callback());
    },
    set reader(value: (workerId: string) => AssignmentReader) {
      read = value;
    },
    set enabled(value: boolean) {
      enabled = value;
    },
    emit(workerId: string) {
      events.forEach((callback) => callback(workerId));
    },
    get signals() {
      return signals;
    },
    async close() {
      service.dispose();
      await syncContext.close();
    },
  };
}

test('cached offline Home and confirmation persist immediately, survive reopen, and suppress duplicate pending confirmations', async () => {
  const testContext = await fixture();
  try {
    assert.equal(testContext.service.getSnapshot().online, false);
    assert.equal(
      testContext.service.getSnapshot().data?.assignment?.assignment.orderId,
      'JO-2026-0142',
    );
    await Promise.all([
      testContext.service.confirm('v2', 1),
      testContext.service.confirm('v2', 1),
    ]);
    const state = testContext.service.getSnapshot();
    assert.ok(state.savedActionId);
    assert.ok(state.data);
    assert.equal(assignmentFacts(state.data).termsStatus, 'pending_sync');
    assert.equal(testContext.signals, 1);
    const original = (await testContext.syncContext.worker().listActions())[0];
    assert.ok(original);
    await testContext.syncContext.reopen();
    await testContext.service.reload();
    assert.equal(
      (await testContext.syncContext.worker().listActions())[0]?.id,
      original.id,
    );
    await testContext.service.confirm('v2', 1);
    assert.equal(
      (await testContext.syncContext.worker().listActions()).length,
      1,
    );
  } finally {
    await testContext.close();
  }
});

test('stale v2 is blocked only while displayed; new v3 stays unaccepted and explicitly queues without superseding v2', async () => {
  const testContext = await fixture();
  try {
    await testContext.service.confirm('v2', 1);
    const previousAction = (
      await testContext.syncContext.worker().listActions()
    )[0];
    assert.ok(previousAction);
    await testContext.syncContext.store().claimAction(previousAction.id, 100);
    await testContext.syncContext
      .store()
      .finish(previousAction, { kind: 'stale' }, 100);
    await testContext.service.reload();
    const before = testContext.service.getSnapshot().data;
    assert.ok(before);
    assert.equal(assignmentFacts(before).termsStatus, 'update_required');
    assert.equal(assignmentFacts(before).canConfirm, false);
    await testContext.service.confirm('v2', 1);
    assert.equal(
      (await testContext.syncContext.worker().listActions()).length,
      1,
    );
    const snapshot = assignmentFixture('ana');
    snapshot.serverRevision = 3;
    snapshot.terms.termsVersionId = 'v3';
    await testContext.syncContext.worker().cacheAssignment(snapshot);
    await testContext.service.reload();
    const fresh = testContext.service.getSnapshot().data;
    assert.ok(fresh);
    assert.equal(assignmentFacts(fresh).needsReconfirmation, true);
    assert.equal(assignmentFacts(fresh).canConfirm, true);
    assert.equal(
      fresh.assignment?.terms.serverAcceptanceStatus,
      'not_confirmed',
    );
    await testContext.service.confirm('v3', 1);
    assert.deepEqual(
      (await testContext.syncContext.worker().listActions()).map(
        (action) => action.status,
      ),
      ['stale', 'queued'],
    );
    const after = testContext.service.getSnapshot().data;
    assert.ok(after);
    assert.equal(assignmentFacts(after).pendingCount, 1);
    assert.equal(assignmentFacts(after).attentionCount, 0);
  } finally {
    await testContext.close();
  }
});

test('background v3 refresh never substitutes the v2 version actually displayed by the confirmation callback', async () => {
  const testContext = await fixture();
  try {
    const snapshot = assignmentFixture('ana');
    snapshot.terms.termsVersionId = 'v3';
    snapshot.serverRevision = 3;
    await testContext.syncContext.worker().cacheAssignment(snapshot);
    await testContext.service.confirm('v2', 1);
    const action = (await testContext.syncContext.worker().listActions())[0];
    assert.ok(action);
    assert.equal(
      action.payload.kind === 'terms_acceptance' &&
        action.payload.termsVersionId,
      'v2',
    );
  } finally {
    await testContext.close();
  }
});

test('worker switch clears cached views immediately and delayed old reads never reappear', async () => {
  const testContext = await fixture();
  try {
    await testContext.syncContext
      .worker('bruno')
      .cacheAssignment(assignmentFixture('bruno'));
    let release!: (
      value: Awaited<ReturnType<AssignmentReader['readView']>>,
    ) => void;
    const previousView = await testContext.syncContext.worker().readView();
    testContext.reader = (workerId) =>
      workerId === 'ana'
        ? {
            readView: () =>
              new Promise((resolve) => {
                release = resolve;
              }),
            enqueueTerms: (version) =>
              testContext.syncContext.worker().enqueueTerms(version),
          }
        : testContext.syncContext.worker(workerId);
    const pending = testContext.service.reload();
    testContext.setSession({
      workerId: 'bruno',
      token: 'shared-fictional',
      generation: 2,
    });
    assert.equal(testContext.service.getSnapshot().data, null);
    assert.equal(testContext.service.getSnapshot().workerId, 'bruno');
    release(previousView);
    await pending;
    await testContext.service.reload();
    assert.equal(
      testContext.service.getSnapshot().data?.assignment?.worker.workerId,
      'bruno',
    );
    await testContext.service.confirm('v2', 1);
    assert.equal(
      (await testContext.syncContext.worker('bruno').listActions()).length,
      0,
    );
  } finally {
    await testContext.close();
  }
});

test('failed local enqueue surfaces an error and never claims saved intent; disabled feature performs no enqueue', async () => {
  const testContext = await fixture();
  try {
    await testContext.syncContext.database.exec(
      "CREATE TRIGGER reject_terms BEFORE INSERT ON terms_intents BEGIN SELECT RAISE(ABORT,'test_enqueue_failure'); END",
    );
    await testContext.service.confirm('v2', 1);
    assert.equal(testContext.service.getSnapshot().error, 'save_failed');
    assert.equal(testContext.service.getSnapshot().savedActionId, null);
    assert.equal(
      (await testContext.syncContext.worker().listActions()).length,
      0,
    );
    assert.equal(testContext.signals, 0);
    await testContext.syncContext.database.exec('DROP TRIGGER reject_terms');
    testContext.enabled = false;
    await testContext.service.confirm('v2', 1);
    assert.equal(
      (await testContext.syncContext.worker().listActions()).length,
      0,
    );
  } finally {
    await testContext.close();
  }
});

test('language preference survives v2 upgrade/reopen and repeat migrations without deleting queued intent', async () => {
  const testContext = await fixture();
  try {
    const action = await testContext.syncContext.worker().enqueueTerms('v2');
    await testContext.syncContext.database.exec(
      'DROP TABLE app_settings; PRAGMA user_version=2',
    );
    await testContext.syncContext.reopen();
    assert.equal(
      (
        await testContext.syncContext.database.first<{ language: string }>(
          'SELECT language FROM app_settings WHERE id=1',
        )
      )?.language,
      'es',
    );
    await testContext.syncContext.database.run(
      "UPDATE app_settings SET language='en' WHERE id=1",
    );
    await testContext.syncContext.reopen();
    assert.equal(
      (
        await testContext.syncContext.database.first<{ language: string }>(
          'SELECT language FROM app_settings WHERE id=1',
        )
      )?.language,
      'en',
    );
    assert.equal(
      (await testContext.syncContext.worker().listActions())[0]?.id,
      action.id,
    );
  } finally {
    await testContext.close();
  }
});

for (const version of ['v2', 'v3']) {
  test(`explicit replacement of failed v2 with displayed ${version} commits a new ID and delivers without restart`, async () => {
    const testContext = await fixture();
    const engine = testContext.syncContext.engine();
    try {
      await testContext.service.confirm('v2', 1);
      const original = (
        await testContext.syncContext.worker().listActions()
      )[0]!;
      testContext.syncContext.online = true;
      const send = testContext.syncContext.api.send;
      testContext.syncContext.api.send = async () => ({
        status: 422,
        code: 'validation_failed',
      });
      await engine.request();
      assert.equal(
        (await testContext.syncContext.worker().listActions())[0]?.status,
        'failed_permanent',
      );
      testContext.syncContext.api.send = send;
      const snapshot = assignmentFixture('ana');
      snapshot.terms.termsVersionId = version;
      snapshot.serverRevision = 3;
      await testContext.syncContext.worker().cacheAssignment(snapshot);
      await testContext.service.reload();
      const view = testContext.service.getSnapshot().data!;
      assert.equal(assignmentFacts(view).canConfirm, true);
      assert.equal(assignmentFacts(view).replacementActionId, original.id);
      // Ordinary confirmation/refresh cannot silently replace a permanent failure.
      await testContext.service.refresh();
      await testContext.service.confirm(version, 1);
      assert.equal(
        (await testContext.syncContext.worker().listActions()).length,
        1,
      );
      await Promise.all([
        testContext.service.confirm(version, 1, original.id),
        testContext.service.confirm(version, 1, original.id),
      ]);
      const actions = await testContext.syncContext.worker().listActions();
      assert.equal(actions.length, 2);
      assert.equal(actions[0]?.status, 'superseded');
      assert.equal(
        actions[0]?.payload.kind === 'terms_acceptance' &&
          actions[0].payload.termsVersionId,
        'v2',
      );
      const replacement = actions[1]!;
      assert.notEqual(replacement.id, original.id);
      assert.equal(
        replacement.payload.kind === 'terms_acceptance' &&
          replacement.payload.termsVersionId,
        version,
      );
      await engine.request();
      assert.deepEqual(
        testContext.syncContext.attempts.map((action) => action.id),
        [replacement.id],
      );
      assert.equal(
        (await testContext.syncContext.worker().listActions())[1]?.status,
        'delivered',
      );
      assert.equal(
        (await testContext.syncContext.worker().getAssignment())?.terms
          .serverAcceptanceStatus,
        'accepted',
      );
    } finally {
      engine.stop();
      await testContext.close();
    }
  });
}

test('replacement enqueue failure rolls back supersession and preserves failed intent for a later explicit retry', async () => {
  const testContext = await fixture();
  try {
    await testContext.service.confirm('v2', 1);
    const previousAction = (
      await testContext.syncContext.worker().listActions()
    )[0]!;
    await testContext.syncContext.store().claimAction(previousAction.id, 100);
    await testContext.syncContext
      .store()
      .finish(
        previousAction,
        { kind: 'failed', code: 'validation_failed' },
        100,
      );
    await testContext.service.reload();
    await testContext.syncContext.database.exec(
      "CREATE TRIGGER reject_replacement BEFORE UPDATE OF status ON outbox_actions WHEN NEW.status='superseded' BEGIN SELECT RAISE(ABORT,'test_replacement_failure'); END",
    );
    await testContext.service.confirm('v2', 1, previousAction.id);
    assert.equal(testContext.service.getSnapshot().error, 'save_failed');
    assert.equal(testContext.service.getSnapshot().savedActionId, null);
    assert.deepEqual(
      (await testContext.syncContext.worker().listActions()).map((action) => [
        action.id,
        action.status,
      ]),
      [[previousAction.id, 'failed_permanent']],
    );
    await testContext.syncContext.database.exec(
      'DROP TRIGGER reject_replacement',
    );
    await testContext.service.confirm('v2', 1, previousAction.id);
    assert.deepEqual(
      (await testContext.syncContext.worker().listActions()).map(
        (action) => action.status,
      ),
      ['superseded', 'queued'],
    );
  } finally {
    await testContext.close();
  }
});
