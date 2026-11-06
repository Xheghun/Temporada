import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncFixture } from './sync-fixture.mts';
import { AssignmentService } from '../../src/features/assignment/assignment-service.ts';
import type { AssignmentReader } from '../../src/features/assignment/assignment-service.ts';
import { assignmentFacts } from '../../src/features/assignment/domain/view-state.ts';
import { assignmentFixture } from '../../src/testing/persistence-fixtures.ts';
import type { SyncSession } from '../../src/core/sync/types.ts';

async function fixture() {
  const f = await syncFixture();
  let selected: SyncSession | null = {
    workerId: 'ana',
    token: 'fictional',
    generation: 1,
  };
  let online = false,
    signals = 0;
  let enabled = true;
  const listeners = new Set<() => void>();
  const events = new Set<(id: string) => void>();
  let read: (workerId: string) => AssignmentReader = (workerId) =>
    f.worker(workerId);
  const service = new AssignmentService({
    enabled: () => enabled,
    session: {
      current: () => selected,
      invalidate: () => {},
      subscribeSession(fn) {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      },
    },
    repository: (id) => read(id),
    online: () => online,
    subscribeNetwork: () => () => {},
    subscribeData(fn) {
      events.add(fn);
      return () => {
        events.delete(fn);
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
    f,
    service,
    setSession(session: SyncSession | null) {
      selected = session;
      listeners.forEach((fn) => fn());
    },
    set reader(value: (id: string) => AssignmentReader) {
      read = value;
    },
    set enabled(value: boolean) {
      enabled = value;
    },
    emit(id: string) {
      events.forEach((fn) => fn(id));
    },
    get signals() {
      return signals;
    },
    async close() {
      service.dispose();
      await f.close();
    },
  };
}

test('cached offline Home and confirmation persist immediately, survive reopen, and suppress duplicate pending confirmations', async () => {
  const x = await fixture();
  try {
    assert.equal(x.service.getSnapshot().online, false);
    assert.equal(
      x.service.getSnapshot().data?.assignment?.assignment.orderId,
      'JO-2026-0142',
    );
    await Promise.all([x.service.confirm('v2', 1), x.service.confirm('v2', 1)]);
    const state = x.service.getSnapshot();
    assert.ok(state.savedActionId);
    assert.ok(state.data);
    assert.equal(assignmentFacts(state.data).termsStatus, 'pending_sync');
    assert.equal(x.signals, 1);
    const original = (await x.f.worker().listActions())[0];
    assert.ok(original);
    await x.f.reopen();
    await x.service.reload();
    assert.equal((await x.f.worker().listActions())[0]?.id, original.id);
    await x.service.confirm('v2', 1);
    assert.equal((await x.f.worker().listActions()).length, 1);
  } finally {
    await x.close();
  }
});

test('stale v2 is blocked only while displayed; new v3 stays unaccepted and explicitly queues without superseding v2', async () => {
  const x = await fixture();
  try {
    await x.service.confirm('v2', 1);
    const old = (await x.f.worker().listActions())[0];
    assert.ok(old);
    await x.f.store().claimAction(old.id, 100);
    await x.f.store().finish(old, { kind: 'stale' }, 100);
    await x.service.reload();
    const before = x.service.getSnapshot().data;
    assert.ok(before);
    assert.equal(assignmentFacts(before).termsStatus, 'update_required');
    assert.equal(assignmentFacts(before).canConfirm, false);
    await x.service.confirm('v2', 1);
    assert.equal((await x.f.worker().listActions()).length, 1);
    const snapshot = assignmentFixture('ana');
    snapshot.serverRevision = 3;
    snapshot.terms.termsVersionId = 'v3';
    await x.f.worker().cacheAssignment(snapshot);
    await x.service.reload();
    const fresh = x.service.getSnapshot().data;
    assert.ok(fresh);
    assert.equal(assignmentFacts(fresh).needsReconfirmation, true);
    assert.equal(assignmentFacts(fresh).canConfirm, true);
    assert.equal(
      fresh.assignment?.terms.serverAcceptanceStatus,
      'not_confirmed',
    );
    await x.service.confirm('v3', 1);
    assert.deepEqual(
      (await x.f.worker().listActions()).map((a) => a.status),
      ['stale', 'queued'],
    );
    const after = x.service.getSnapshot().data;
    assert.ok(after);
    assert.equal(assignmentFacts(after).pendingCount, 1);
    assert.equal(assignmentFacts(after).attentionCount, 0);
  } finally {
    await x.close();
  }
});

test('background v3 refresh never substitutes the v2 version actually displayed by the confirmation callback', async () => {
  const x = await fixture();
  try {
    const snapshot = assignmentFixture('ana');
    snapshot.terms.termsVersionId = 'v3';
    snapshot.serverRevision = 3;
    await x.f.worker().cacheAssignment(snapshot);
    await x.service.confirm('v2', 1);
    const action = (await x.f.worker().listActions())[0];
    assert.ok(action);
    assert.equal(
      action.payload.kind === 'terms_acceptance' &&
        action.payload.termsVersionId,
      'v2',
    );
  } finally {
    await x.close();
  }
});

test('worker switch clears cached views immediately and delayed old reads never reappear', async () => {
  const x = await fixture();
  try {
    await x.f.worker('bruno').cacheAssignment(assignmentFixture('bruno'));
    let release!: (
      value: Awaited<ReturnType<AssignmentReader['readView']>>,
    ) => void;
    const old = await x.f.worker().readView();
    x.reader = (id) =>
      id === 'ana'
        ? {
            readView: () =>
              new Promise((r) => {
                release = r;
              }),
            enqueueTerms: (v) => x.f.worker().enqueueTerms(v),
          }
        : x.f.worker(id);
    const pending = x.service.reload();
    x.setSession({
      workerId: 'bruno',
      token: 'shared-fictional',
      generation: 2,
    });
    assert.equal(x.service.getSnapshot().data, null);
    assert.equal(x.service.getSnapshot().workerId, 'bruno');
    release(old);
    await pending;
    await x.service.reload();
    assert.equal(
      x.service.getSnapshot().data?.assignment?.worker.workerId,
      'bruno',
    );
    await x.service.confirm('v2', 1);
    assert.equal((await x.f.worker('bruno').listActions()).length, 0);
  } finally {
    await x.close();
  }
});

test('failed local enqueue surfaces an error and never claims saved intent; disabled feature performs no enqueue', async () => {
  const x = await fixture();
  try {
    await x.f.db.exec(
      "CREATE TRIGGER reject_terms BEFORE INSERT ON terms_intents BEGIN SELECT RAISE(ABORT,'test_enqueue_failure'); END",
    );
    await x.service.confirm('v2', 1);
    assert.equal(x.service.getSnapshot().error, 'save_failed');
    assert.equal(x.service.getSnapshot().savedActionId, null);
    assert.equal((await x.f.worker().listActions()).length, 0);
    assert.equal(x.signals, 0);
    await x.f.db.exec('DROP TRIGGER reject_terms');
    x.enabled = false;
    await x.service.confirm('v2', 1);
    assert.equal((await x.f.worker().listActions()).length, 0);
  } finally {
    await x.close();
  }
});

test('language preference survives v2 upgrade/reopen and repeat migrations without deleting queued intent', async () => {
  const x = await fixture();
  try {
    const action = await x.f.worker().enqueueTerms('v2');
    await x.f.db.exec('DROP TABLE app_settings; PRAGMA user_version=2');
    await x.f.reopen();
    await x.f.db.run("UPDATE app_settings SET language='en' WHERE id=1");
    await x.f.reopen();
    assert.equal(
      (
        await x.f.db.first<{ language: string }>(
          'SELECT language FROM app_settings WHERE id=1',
        )
      )?.language,
      'en',
    );
    assert.equal((await x.f.worker().listActions())[0]?.id, action.id);
  } finally {
    await x.close();
  }
});

for (const version of ['v2', 'v3']) {
  test(`explicit replacement of failed v2 with displayed ${version} commits a new ID and delivers without restart`, async () => {
    const x = await fixture();
    const engine = x.f.engine();
    try {
      await x.service.confirm('v2', 1);
      const original = (await x.f.worker().listActions())[0]!;
      x.f.online = true;
      const send = x.f.api.send;
      x.f.api.send = async () => ({ status: 422, code: 'validation_failed' });
      await engine.request();
      assert.equal(
        (await x.f.worker().listActions())[0]?.status,
        'failed_permanent',
      );
      x.f.api.send = send;
      const snapshot = assignmentFixture('ana');
      snapshot.terms.termsVersionId = version;
      snapshot.serverRevision = 3;
      await x.f.worker().cacheAssignment(snapshot);
      await x.service.reload();
      const view = x.service.getSnapshot().data!;
      assert.equal(assignmentFacts(view).canConfirm, true);
      assert.equal(assignmentFacts(view).replacementActionId, original.id);
      // Ordinary confirmation/refresh cannot silently replace a permanent failure.
      await x.service.refresh();
      await x.service.confirm(version, 1);
      assert.equal((await x.f.worker().listActions()).length, 1);
      await Promise.all([
        x.service.confirm(version, 1, original.id),
        x.service.confirm(version, 1, original.id),
      ]);
      const actions = await x.f.worker().listActions();
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
        x.f.attempts.map((a) => a.id),
        [replacement.id],
      );
      assert.equal((await x.f.worker().listActions())[1]?.status, 'delivered');
      assert.equal(
        (await x.f.worker().getAssignment())?.terms.serverAcceptanceStatus,
        'accepted',
      );
    } finally {
      engine.stop();
      await x.close();
    }
  });
}

test('replacement enqueue failure rolls back supersession and preserves failed intent for a later explicit retry', async () => {
  const x = await fixture();
  try {
    await x.service.confirm('v2', 1);
    const old = (await x.f.worker().listActions())[0]!;
    await x.f.store().claimAction(old.id, 100);
    await x.f
      .store()
      .finish(old, { kind: 'failed', code: 'validation_failed' }, 100);
    await x.service.reload();
    await x.f.db.exec(
      "CREATE TRIGGER reject_replacement BEFORE UPDATE OF status ON outbox_actions WHEN NEW.status='superseded' BEGIN SELECT RAISE(ABORT,'test_replacement_failure'); END",
    );
    await x.service.confirm('v2', 1, old.id);
    assert.equal(x.service.getSnapshot().error, 'save_failed');
    assert.equal(x.service.getSnapshot().savedActionId, null);
    assert.deepEqual(
      (await x.f.worker().listActions()).map((a) => [a.id, a.status]),
      [[old.id, 'failed_permanent']],
    );
    await x.f.db.exec('DROP TRIGGER reject_replacement');
    await x.service.confirm('v2', 1, old.id);
    assert.deepEqual(
      (await x.f.worker().listActions()).map((a) => a.status),
      ['superseded', 'queued'],
    );
  } finally {
    await x.close();
  }
});
