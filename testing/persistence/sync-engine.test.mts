import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncFixture, receipt } from './sync-fixture.mts';
import { assignmentFixture } from '../../src/testing/persistence-fixtures.ts';
import { retryDelay } from '../../src/core/sync/retry-policy.ts';
import { attachSyncTriggers } from '../../src/core/sync/sync-triggers.ts';
import type { SyncSignals } from '../../src/core/sync/sync-triggers.ts';
import { TransportError } from '../../src/core/sync/types.ts';

test('TEST-01/02: offline enqueue, real reopen and connectivity delivery preserve both IDs and truthful review', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    const terms = await testContext.worker().enqueueTerms('v2');
    const upload = await testContext
      .worker()
      .enqueueDocument('passport', testContext.image());
    await engine.start();
    assert.equal(testContext.attempts.length, 0);
    engine.stop();
    await testContext.reopen();
    testContext.online = true;
    const restarted = testContext.engine();
    await restarted.start();
    restarted.stop();
    assert.deepEqual(
      testContext.attempts.map((action) => action.clientActionId),
      [terms.id, upload.id],
    );
    assert.deepEqual(
      (await testContext.worker().listActions()).map((action) => action.status),
      ['delivered', 'delivered'],
    );
    assert.equal(
      (await testContext.worker().listSubmissions())[0]?.serverStatus,
      'pending_review',
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('single-flight serializes simultaneous triggers and pending successors; unrelated actions bypass delayed/failed resources', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    await testContext.worker().enqueueTerms('v2');
    await testContext.worker().enqueueTerms('v2');
    await testContext.worker().enqueueDocument('passport', testContext.image());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let active = 0,
      maximumConcurrentSends = 0;
    testContext.api.send = async (_s, action) => {
      active++;
      maximumConcurrentSends = Math.max(maximumConcurrentSends, active);
      await gate;
      active--;
      testContext.attempts.push(action);
      return { status: 201, receipt: receipt(action) };
    };
    testContext.online = true;
    const first = engine.request();
    const second = engine.request();
    release();
    await Promise.all([first, second]);
    assert.equal(maximumConcurrentSends, 1);
    assert.equal(
      new Set(testContext.attempts.map((action) => action.id)).size,
      3,
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('TEST-04: 500 persists bounded backoff, 413/422 stop retrying and unrelated terms deliver', async () => {
  const testContext = await syncFixture();
  let engine = testContext.engine();
  try {
    const retry = await testContext
      .worker()
      .enqueueDocument('passport', testContext.image());
    const large = await testContext
      .worker()
      .enqueueDocument('ds160_confirmation', testContext.image());
    const invalid = await testContext
      .worker()
      .enqueueDocument('signed_contract', testContext.image());
    const terms = await testContext.worker().enqueueTerms('v2');
    testContext.api.send = async (_s, action) => {
      testContext.attempts.push(action);
      if (action.id === retry.id && testContext.clock.time < 1100)
        return { status: 500, code: 'internal_error' };
      if (action.id === large.id)
        return { status: 413, code: 'upload_too_large' };
      if (action.id === invalid.id)
        return { status: 422, code: 'invalid_image' };
      return { status: 201, receipt: receipt(action) };
    };
    testContext.online = true;
    await engine.request();
    const actions = await testContext.worker().listActions();
    assert.deepEqual(
      actions.map((action) => action.status),
      ['retry_wait', 'failed_permanent', 'failed_permanent', 'delivered'],
    );
    assert.equal(actions[0]?.nextAttemptAt, 1100);
    assert.equal(actions[3]?.id, terms.id);
    engine.stop();
    await testContext.reopen();
    engine = testContext.engine();
    await engine.start();
    assert.equal(
      testContext.attempts.filter((action) => action.id === retry.id).length,
      1,
    );
    testContext.clock.advance(1100);
    await engine.request();
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'delivered',
    );
    assert.equal(
      testContext.attempts.filter((action) => action.id === large.id).length,
      1,
    );
    assert.equal(
      testContext.attempts.filter((action) => action.id === invalid.id).length,
      1,
    );
    for (const attempt of [1, 2, 8, 10000]) {
      const maximumDelay = Math.min(
        60000,
        1000 * 2 ** Math.min(16, attempt - 1),
      );
      assert.equal(
        retryDelay(attempt, () => 0),
        maximumDelay / 2,
      );
      assert.equal(
        retryDelay(attempt, () => 1),
        maximumDelay,
      );
    }
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('401 pauses without discarding intent, new authorized generation resumes; permanent manual retry is prohibited', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    const action = await testContext.worker().enqueueTerms('v2');
    testContext.online = true;
    testContext.api.send = async () => ({
      status: 401,
      code: 'session_expired',
    });
    await engine.start();
    assert.equal(testContext.session, null);
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'queued',
    );
    await engine.request();
    assert.equal(
      (await testContext.worker().listActions())[0]?.attemptCount,
      1,
    );
    testContext.session = {
      workerId: 'ana',
      token: 'new-fictional-session',
      generation: 2,
    };
    testContext.api.send = async (_s, action) => ({
      status: 201,
      receipt: receipt(action),
    });
    await engine.request();
    assert.equal((await testContext.worker().listActions())[0]?.id, action.id);
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'delivered',
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('TEST-06: switching workers during a send prevents further old dispatch and late response stays scoped', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    await testContext
      .worker('carla')
      .cacheAssignment(assignmentFixture('carla'));
    await testContext
      .worker('bruno')
      .cacheAssignment(assignmentFixture('bruno'));
    const carla = await testContext.worker('carla').enqueueTerms('v2');
    await testContext
      .worker('carla')
      .enqueueDocument('passport', testContext.image('carla'));
    await testContext.worker('bruno').enqueueTerms('v2');
    testContext.session = {
      workerId: 'carla',
      token: 'shared-fictional',
      generation: 2,
    };
    testContext.online = true;
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    testContext.api.send = async (_s, action) => {
      testContext.attempts.push(action);
      if (action.id === carla.id) {
        entered();
        await gate;
      }
      return { status: 201, receipt: receipt(action) };
    };
    const running = engine.request();
    await started;
    testContext.session = {
      workerId: 'bruno',
      token: 'shared-fictional',
      generation: 3,
    };
    const changed = engine.request();
    release();
    await Promise.all([running, changed]);
    assert.deepEqual(
      testContext.attempts.map((action) => action.workerId),
      ['carla', 'bruno'],
    );
    assert.equal(
      (await testContext.worker('carla').listActions())[1]?.status,
      'queued',
    );
    assert.equal((await testContext.worker('bruno').listActions()).length, 1);
    testContext.session = {
      workerId: 'carla',
      token: 'shared-fictional',
      generation: 4,
    };
    await engine.request();
    assert.equal(
      (await testContext.worker('carla').listActions())[1]?.status,
      'delivered',
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('explicit failed-document supersession is atomic, worker/resource scoped and survives reopen', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    const previousAction = await testContext
      .worker()
      .enqueueDocument('passport', testContext.image());
    testContext.api.send = async () => ({
      status: 413,
      code: 'upload_too_large',
    });
    testContext.online = true;
    await engine.start();
    await engine.manualRetry();
    assert.equal(
      (await testContext.worker().listActions())[0]?.attemptCount,
      1,
    );
    await assert.rejects(
      testContext
        .store('carla')
        .replaceFailedDocument(previousAction.id, testContext.image('carla')),
      /supersession_not_allowed/,
    );
    await testContext.database.exec(
      "CREATE TRIGGER reject_replacement BEFORE UPDATE OF status ON outbox_actions WHEN NEW.status='superseded' BEGIN SELECT RAISE(ABORT,'test_replacement_failure'); END",
    );
    await assert.rejects(
      testContext
        .store()
        .replaceFailedDocument(previousAction.id, testContext.image()),
      /test_replacement_failure/,
    );
    assert.equal((await testContext.worker().listActions()).length, 1);
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'failed_permanent',
    );
    await testContext.database.exec('DROP TRIGGER reject_replacement');
    const replacement = await testContext
      .store()
      .replaceFailedDocument(previousAction.id, testContext.image());
    await testContext.reopen();
    assert.deepEqual(
      (await testContext.worker().listActions()).map((action) => action.status),
      ['superseded', 'queued'],
    );
    assert.notEqual(previousAction.id, replacement.id);
    assert.equal((await testContext.worker().listSubmissions()).length, 2);
    testContext.api.send = async (_s, action) => ({
      status: 201,
      receipt: receipt(action),
    });
    await engine.request();
    assert.equal(
      (await testContext.worker().listActions())[1]?.status,
      'delivered',
    );
    await assert.rejects(
      testContext
        .store()
        .replaceFailedDocument(replacement.id, testContext.image()),
      /supersession_not_allowed/,
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('all lifecycle signals request work; detach unsubscribes and stops future requests', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    const callbacks = new Map<string, () => void>();
    let detached = 0;
    const subscribe = (name: string) => (callback: () => void) => {
      callbacks.set(name, callback);
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
    await testContext.worker().enqueueTerms('v2');
    testContext.online = true;
    callbacks.get('connectivity')?.();
    await engine.request();
    assert.equal(testContext.attempts.length, 1);
    for (const callback of callbacks.values()) callback();
    await engine.request();
    assert.equal(testContext.attempts.length, 1);
    detach();
    assert.equal(detached, 4);
    await testContext.worker().enqueueTerms('v2');
    await engine.request();
    assert.equal(testContext.attempts.length, 1);
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('network exception retries, file integrity failure is terminal, and 403 invalidates selection', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    const missing = await testContext
      .worker()
      .enqueueDocument('passport', testContext.image());
    const terms = await testContext.worker().enqueueTerms('v2');
    testContext.online = true;
    testContext.api.send = async (_s, action) => {
      if (action.id === missing.id)
        throw new TransportError(422, 'local_file_missing');
      throw new TransportError(0, 'network_unavailable');
    };
    await engine.start();
    assert.deepEqual(
      (await testContext.worker().listActions()).map((action) => action.status),
      ['failed_permanent', 'retry_wait'],
    );
    testContext.api.send = async () => ({
      status: 403,
      code: 'worker_forbidden',
    });
    await engine.manualRetry();
    assert.equal(testContext.session, null);
    assert.equal(
      (await testContext.worker().listActions()).find(
        (action) => action.id === terms.id,
      )?.status,
      'queued',
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('process-wide guard protects two runtime instances, including repeated startup recovery', async () => {
  const testContext = await syncFixture();
  const first = testContext.engine(),
    second = testContext.engine();
  try {
    await testContext.worker().enqueueTerms('v2');
    await testContext.worker().enqueueDocument('passport', testContext.image());
    let active = 0,
      maximumConcurrentSends = 0;
    testContext.api.send = async (_s, action) => {
      active++;
      maximumConcurrentSends = Math.max(maximumConcurrentSends, active);
      await Promise.resolve();
      testContext.attempts.push(action);
      active--;
      return { status: 201, receipt: receipt(action) };
    };
    testContext.online = true;
    await Promise.all([first.start(), second.start(), first.start()]);
    assert.equal(maximumConcurrentSends, 1);
    assert.equal(testContext.attempts.length, 2);
  } finally {
    first.stop();
    second.stop();
    await testContext.close();
  }
});

test('manual retry advances transient deadline only; same-resource successor waits and unrelated actions continue', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    const blocked = await testContext
      .worker()
      .enqueueDocument('passport', testContext.image());
    const successor = await testContext
      .worker()
      .enqueueDocument('passport', testContext.image());
    const terms = await testContext.worker().enqueueTerms('v2');
    testContext.api.send = async (_s, action) => {
      testContext.attempts.push(action);
      return action.id === blocked.id
        ? { status: 500, code: 'internal_error' }
        : { status: 201, receipt: receipt(action) };
    };
    testContext.online = true;
    await engine.start();
    assert.deepEqual(
      testContext.attempts.map((action) => action.id),
      [blocked.id, terms.id],
    );
    assert.equal(
      (await testContext.worker().listActions())[1]?.status,
      'queued',
    );
    testContext.api.send = async (_s, action) => {
      testContext.attempts.push(action);
      return { status: 201, receipt: receipt(action) };
    };
    await engine.manualRetry();
    assert.deepEqual(
      testContext.attempts.slice(2).map((action) => action.id),
      [blocked.id, successor.id],
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('failed terms replacement is explicit and atomic; stale history cannot be superseded', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    const previousAction = await testContext.worker().enqueueTerms('v2');
    testContext.api.send = async () => ({
      status: 422,
      code: 'invalid_request',
    });
    testContext.online = true;
    await engine.start();
    await assert.rejects(
      testContext.store('carla').replaceFailedTerms(previousAction.id, 'v2'),
      /terms_not_cached|supersession_not_allowed/,
    );
    const replacement = await testContext
      .store()
      .replaceFailedTerms(previousAction.id, 'v2');
    await testContext.reopen();
    assert.deepEqual(
      (await testContext.worker().listActions()).map((action) => action.status),
      ['superseded', 'queued'],
    );
    testContext.api.send = async () => ({ status: 409, code: 'stale_terms' });
    await engine.request();
    await assert.rejects(
      testContext.store().replaceFailedTerms(replacement.id, 'v2'),
      /supersession_not_allowed/,
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('permanent refresh error is persisted and paused until explicit resolution', async () => {
  const testContext = await syncFixture();
  let engine = testContext.engine();
  try {
    await testContext.store().requestRefresh();
    let calls = 0;
    testContext.api.assignment = async () => {
      calls++;
      throw new TransportError(422, 'invalid_request');
    };
    testContext.online = true;
    await engine.start();
    assert.equal(calls, 1);
    assert.equal((await testContext.store().refreshState()).blocked, true);
    engine.stop();
    await testContext.reopen();
    engine = testContext.engine();
    testContext.clock.advance(100000);
    await engine.start();
    assert.equal(calls, 1);
    assert.equal(testContext.clock.callbacks.size, 0);
    await engine.manualRetry();
    assert.equal(calls, 2);
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('offline startup recovers interrupted sending locally before any network opportunity', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    const action = await testContext.worker().enqueueTerms('v2');
    await testContext.store().claimAction(action.id, 100);
    await testContext.reopen();
    await engine.start();
    assert.equal(testContext.attempts.length, 0);
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'queued',
    );
    testContext.online = true;
    await engine.request();
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'delivered',
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('completion and claim-release write faults preserve targeted recovery until manual retry after storage clears', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    const first = await testContext.worker().enqueueTerms('v2');
    const next = await testContext.worker().enqueueTerms('v2');
    await testContext.database
      .exec(`CREATE TRIGGER fail_completion BEFORE UPDATE OF status ON outbox_actions
      WHEN NEW.status='delivered' BEGIN SELECT RAISE(ABORT,'test_completion_fault'); END;
      CREATE TRIGGER fail_release BEFORE UPDATE OF status ON outbox_actions
      WHEN OLD.status='sending' AND NEW.status='queued' BEGIN SELECT RAISE(ABORT,'test_release_fault'); END;`);
    testContext.online = true;
    await engine.start();
    assert.deepEqual(
      (await testContext.worker().listActions()).map((action) => action.status),
      ['sending', 'queued'],
    );
    assert.deepEqual(
      testContext.attempts.map((action) => action.id),
      [first.id],
    );
    await engine.manualRetry();
    assert.deepEqual(
      testContext.attempts.map((action) => action.id),
      [first.id],
    );
    assert.equal(testContext.clock.callbacks.size, 0);
    await testContext.database.exec(
      'DROP TRIGGER fail_completion; DROP TRIGGER fail_release',
    );
    await engine.manualRetry();
    assert.deepEqual(
      (await testContext.worker().listActions()).map((action) => action.status),
      ['delivered', 'delivered'],
    );
    assert.deepEqual(
      testContext.attempts.map((action) => action.id),
      [first.id, first.id, next.id],
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});
