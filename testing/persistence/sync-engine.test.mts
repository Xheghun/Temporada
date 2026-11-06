import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncFixture, receipt } from './sync-fixture.mts';
import { assignmentFixture } from '../../src/testing/persistence-fixtures.ts';
import { retryDelay } from '../../src/core/sync/retry-policy.ts';
import { attachSyncTriggers } from '../../src/core/sync/sync-triggers.ts';
import type { SyncSignals } from '../../src/core/sync/sync-triggers.ts';
import { TransportError } from '../../src/core/sync/types.ts';

test('TEST-01/02: offline enqueue, real reopen and connectivity delivery preserve both IDs and truthful review', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    const terms = await f.worker().enqueueTerms('v2');
    const upload = await f.worker().enqueueDocument('passport', f.image());
    await engine.start();
    assert.equal(f.attempts.length, 0);
    engine.stop();
    await f.reopen();
    f.online = true;
    const restarted = f.engine();
    await restarted.start();
    restarted.stop();
    assert.deepEqual(
      f.attempts.map((a) => a.clientActionId),
      [terms.id, upload.id],
    );
    assert.deepEqual(
      (await f.worker().listActions()).map((a) => a.status),
      ['delivered', 'delivered'],
    );
    assert.equal(
      (await f.worker().listSubmissions())[0]?.serverStatus,
      'pending_review',
    );
  } finally {
    engine.stop();
    await f.close();
  }
});

test('single-flight serializes simultaneous triggers and pending successors; unrelated actions bypass delayed/failed resources', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    await f.worker().enqueueTerms('v2');
    await f.worker().enqueueTerms('v2');
    await f.worker().enqueueDocument('passport', f.image());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let active = 0,
      max = 0;
    f.api.send = async (_s, action) => {
      active++;
      max = Math.max(max, active);
      await gate;
      active--;
      f.attempts.push(action);
      return { status: 201, receipt: receipt(action) };
    };
    f.online = true;
    const first = engine.request();
    const second = engine.request();
    release();
    await Promise.all([first, second]);
    assert.equal(max, 1);
    assert.equal(new Set(f.attempts.map((a) => a.id)).size, 3);
  } finally {
    engine.stop();
    await f.close();
  }
});

test('TEST-04: 500 persists bounded backoff, 413/422 stop retrying and unrelated terms deliver', async () => {
  const f = await syncFixture();
  let engine = f.engine();
  try {
    const retry = await f.worker().enqueueDocument('passport', f.image());
    const large = await f
      .worker()
      .enqueueDocument('ds160_confirmation', f.image());
    const invalid = await f
      .worker()
      .enqueueDocument('signed_contract', f.image());
    const terms = await f.worker().enqueueTerms('v2');
    f.api.send = async (_s, action) => {
      f.attempts.push(action);
      if (action.id === retry.id && f.clock.time < 1100)
        return { status: 500, code: 'internal_error' };
      if (action.id === large.id)
        return { status: 413, code: 'upload_too_large' };
      if (action.id === invalid.id)
        return { status: 422, code: 'invalid_image' };
      return { status: 201, receipt: receipt(action) };
    };
    f.online = true;
    await engine.request();
    const actions = await f.worker().listActions();
    assert.deepEqual(
      actions.map((a) => a.status),
      ['retry_wait', 'failed_permanent', 'failed_permanent', 'delivered'],
    );
    assert.equal(actions[0]?.nextAttemptAt, 1100);
    assert.equal(actions[3]?.id, terms.id);
    engine.stop();
    await f.reopen();
    engine = f.engine();
    await engine.start();
    assert.equal(f.attempts.filter((a) => a.id === retry.id).length, 1);
    f.clock.advance(1100);
    await engine.request();
    assert.equal((await f.worker().listActions())[0]?.status, 'delivered');
    assert.equal(f.attempts.filter((a) => a.id === large.id).length, 1);
    assert.equal(f.attempts.filter((a) => a.id === invalid.id).length, 1);
    for (const attempt of [1, 2, 8, 10000]) {
      const cap = Math.min(60000, 1000 * 2 ** Math.min(16, attempt - 1));
      assert.equal(
        retryDelay(attempt, () => 0),
        cap / 2,
      );
      assert.equal(
        retryDelay(attempt, () => 1),
        cap,
      );
    }
  } finally {
    engine.stop();
    await f.close();
  }
});

test('401 pauses without discarding intent, new authorized generation resumes; permanent manual retry is prohibited', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    const action = await f.worker().enqueueTerms('v2');
    f.online = true;
    f.api.send = async () => ({ status: 401, code: 'session_expired' });
    await engine.start();
    assert.equal(f.session, null);
    assert.equal((await f.worker().listActions())[0]?.status, 'queued');
    await engine.request();
    assert.equal((await f.worker().listActions())[0]?.attemptCount, 1);
    f.session = {
      workerId: 'ana',
      token: 'new-fictional-session',
      generation: 2,
    };
    f.api.send = async (_s, a) => ({ status: 201, receipt: receipt(a) });
    await engine.request();
    assert.equal((await f.worker().listActions())[0]?.id, action.id);
    assert.equal((await f.worker().listActions())[0]?.status, 'delivered');
  } finally {
    engine.stop();
    await f.close();
  }
});

test('TEST-06: switching workers during a send prevents further old dispatch and late response stays scoped', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    await f.worker('carla').cacheAssignment(assignmentFixture('carla'));
    await f.worker('bruno').cacheAssignment(assignmentFixture('bruno'));
    const carla = await f.worker('carla').enqueueTerms('v2');
    await f.worker('carla').enqueueDocument('passport', f.image('carla'));
    await f.worker('bruno').enqueueTerms('v2');
    f.session = { workerId: 'carla', token: 'shared-fictional', generation: 2 };
    f.online = true;
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((r) => {
      entered = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    f.api.send = async (_s, a) => {
      f.attempts.push(a);
      if (a.id === carla.id) {
        entered();
        await gate;
      }
      return { status: 201, receipt: receipt(a) };
    };
    const running = engine.request();
    await started;
    f.session = { workerId: 'bruno', token: 'shared-fictional', generation: 3 };
    const changed = engine.request();
    release();
    await Promise.all([running, changed]);
    assert.deepEqual(
      f.attempts.map((a) => a.workerId),
      ['carla', 'bruno'],
    );
    assert.equal((await f.worker('carla').listActions())[1]?.status, 'queued');
    assert.equal((await f.worker('bruno').listActions()).length, 1);
    f.session = { workerId: 'carla', token: 'shared-fictional', generation: 4 };
    await engine.request();
    assert.equal(
      (await f.worker('carla').listActions())[1]?.status,
      'delivered',
    );
  } finally {
    engine.stop();
    await f.close();
  }
});

test('explicit failed-document supersession is atomic, worker/resource scoped and survives reopen', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    const old = await f.worker().enqueueDocument('passport', f.image());
    f.api.send = async () => ({ status: 413, code: 'upload_too_large' });
    f.online = true;
    await engine.start();
    await engine.manualRetry();
    assert.equal((await f.worker().listActions())[0]?.attemptCount, 1);
    await assert.rejects(
      f.store('carla').replaceFailedDocument(old.id, f.image('carla')),
      /supersession_not_allowed/,
    );
    await f.db.exec(
      "CREATE TRIGGER reject_replacement BEFORE UPDATE OF status ON outbox_actions WHEN NEW.status='superseded' BEGIN SELECT RAISE(ABORT,'test_replacement_failure'); END",
    );
    await assert.rejects(
      f.store().replaceFailedDocument(old.id, f.image()),
      /test_replacement_failure/,
    );
    assert.equal((await f.worker().listActions()).length, 1);
    assert.equal(
      (await f.worker().listActions())[0]?.status,
      'failed_permanent',
    );
    await f.db.exec('DROP TRIGGER reject_replacement');
    const replacement = await f
      .store()
      .replaceFailedDocument(old.id, f.image());
    await f.reopen();
    assert.deepEqual(
      (await f.worker().listActions()).map((a) => a.status),
      ['superseded', 'queued'],
    );
    assert.notEqual(old.id, replacement.id);
    assert.equal((await f.worker().listSubmissions()).length, 2);
    f.api.send = async (_s, a) => ({ status: 201, receipt: receipt(a) });
    await engine.request();
    assert.equal((await f.worker().listActions())[1]?.status, 'delivered');
    await assert.rejects(
      f.store().replaceFailedDocument(replacement.id, f.image()),
      /supersession_not_allowed/,
    );
  } finally {
    engine.stop();
    await f.close();
  }
});

test('all lifecycle signals request work; detach unsubscribes and stops future requests', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    const callbacks = new Map<string, () => void>();
    let detached = 0;
    const subscribe = (name: string) => (fn: () => void) => {
      callbacks.set(name, fn);
      return () => {
        detached++;
        callbacks.delete(name);
      };
    };
    const signals: SyncSignals = {
      foreground: subscribe('foreground'),
      connectivity: subscribe('connectivity'),
      session: subscribe('session'),
      enqueue: subscribe('enqueue'),
    };
    const detach = attachSyncTriggers(engine, signals);
    await engine.request();
    await f.worker().enqueueTerms('v2');
    f.online = true;
    callbacks.get('connectivity')?.();
    await engine.request();
    assert.equal(f.attempts.length, 1);
    for (const callback of callbacks.values()) callback();
    await engine.request();
    assert.equal(f.attempts.length, 1);
    detach();
    assert.equal(detached, 4);
    await f.worker().enqueueTerms('v2');
    await engine.request();
    assert.equal(f.attempts.length, 1);
  } finally {
    engine.stop();
    await f.close();
  }
});

test('network exception retries, file integrity failure is terminal, and 403 invalidates selection', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    const missing = await f.worker().enqueueDocument('passport', f.image());
    const terms = await f.worker().enqueueTerms('v2');
    f.online = true;
    f.api.send = async (_s, a) => {
      if (a.id === missing.id)
        throw new TransportError(422, 'local_file_missing');
      throw new TransportError(0, 'network_unavailable');
    };
    await engine.start();
    assert.deepEqual(
      (await f.worker().listActions()).map((a) => a.status),
      ['failed_permanent', 'retry_wait'],
    );
    f.api.send = async () => ({ status: 403, code: 'worker_forbidden' });
    await engine.manualRetry();
    assert.equal(f.session, null);
    assert.equal(
      (await f.worker().listActions()).find((a) => a.id === terms.id)?.status,
      'queued',
    );
  } finally {
    engine.stop();
    await f.close();
  }
});

test('process-wide guard protects two runtime instances, including repeated startup recovery', async () => {
  const f = await syncFixture();
  const first = f.engine(),
    second = f.engine();
  try {
    await f.worker().enqueueTerms('v2');
    await f.worker().enqueueDocument('passport', f.image());
    let active = 0,
      max = 0;
    f.api.send = async (_s, a) => {
      active++;
      max = Math.max(max, active);
      await Promise.resolve();
      f.attempts.push(a);
      active--;
      return { status: 201, receipt: receipt(a) };
    };
    f.online = true;
    await Promise.all([first.start(), second.start(), first.start()]);
    assert.equal(max, 1);
    assert.equal(f.attempts.length, 2);
  } finally {
    first.stop();
    second.stop();
    await f.close();
  }
});

test('manual retry advances transient deadline only; same-resource successor waits and unrelated actions continue', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    const blocked = await f.worker().enqueueDocument('passport', f.image());
    const successor = await f.worker().enqueueDocument('passport', f.image());
    const terms = await f.worker().enqueueTerms('v2');
    f.api.send = async (_s, a) => {
      f.attempts.push(a);
      return a.id === blocked.id
        ? { status: 500, code: 'internal_error' }
        : { status: 201, receipt: receipt(a) };
    };
    f.online = true;
    await engine.start();
    assert.deepEqual(
      f.attempts.map((a) => a.id),
      [blocked.id, terms.id],
    );
    assert.equal((await f.worker().listActions())[1]?.status, 'queued');
    f.api.send = async (_s, a) => {
      f.attempts.push(a);
      return { status: 201, receipt: receipt(a) };
    };
    await engine.manualRetry();
    assert.deepEqual(
      f.attempts.slice(2).map((a) => a.id),
      [blocked.id, successor.id],
    );
  } finally {
    engine.stop();
    await f.close();
  }
});

test('failed terms replacement is explicit and atomic; stale history cannot be superseded', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    const old = await f.worker().enqueueTerms('v2');
    f.api.send = async () => ({ status: 422, code: 'invalid_request' });
    f.online = true;
    await engine.start();
    await assert.rejects(
      f.store('carla').replaceFailedTerms(old.id, 'v2'),
      /terms_not_cached|supersession_not_allowed/,
    );
    const replacement = await f.store().replaceFailedTerms(old.id, 'v2');
    await f.reopen();
    assert.deepEqual(
      (await f.worker().listActions()).map((a) => a.status),
      ['superseded', 'queued'],
    );
    f.api.send = async () => ({ status: 409, code: 'stale_terms' });
    await engine.request();
    await assert.rejects(
      f.store().replaceFailedTerms(replacement.id, 'v2'),
      /supersession_not_allowed/,
    );
  } finally {
    engine.stop();
    await f.close();
  }
});

test('permanent refresh error is persisted and paused until explicit resolution', async () => {
  const f = await syncFixture();
  let engine = f.engine();
  try {
    await f.store().requestRefresh();
    let calls = 0;
    f.api.assignment = async () => {
      calls++;
      throw new TransportError(422, 'invalid_request');
    };
    f.online = true;
    await engine.start();
    assert.equal(calls, 1);
    assert.equal((await f.store().refreshState()).blocked, true);
    engine.stop();
    await f.reopen();
    engine = f.engine();
    f.clock.advance(100000);
    await engine.start();
    assert.equal(calls, 1);
    assert.equal(f.clock.callbacks.size, 0);
    await engine.manualRetry();
    assert.equal(calls, 2);
  } finally {
    engine.stop();
    await f.close();
  }
});

test('offline startup recovers interrupted sending locally before any network opportunity', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    const action = await f.worker().enqueueTerms('v2');
    await f.store().claimAction(action.id, 100);
    await f.reopen();
    await engine.start();
    assert.equal(f.attempts.length, 0);
    assert.equal((await f.worker().listActions())[0]?.status, 'queued');
    f.online = true;
    await engine.request();
    assert.equal((await f.worker().listActions())[0]?.status, 'delivered');
  } finally {
    engine.stop();
    await f.close();
  }
});
