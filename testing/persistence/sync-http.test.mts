import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { syncFixture } from './sync-fixture.mts';
import { startMockProcess } from './mock-process.mts';
import { createApiTransport } from '../../src/core/api/client.ts';
import { TransportError } from '../../src/core/sync/types.ts';

async function fixture() {
  const local = await syncFixture();
  let server = await startMockProcess(join(local.directory, 'backend'));
  const api = () =>
    createApiTransport(server.base, {
      resolve: async (action) => local.blob(action),
    });
  local.api.send = (session, action) => {
    local.attempts.push(action);
    return api().send(session, action);
  };
  local.api.assignment = (session) => api().assignment(session);
  const post = async (path: string, body: unknown) => {
    const response = await fetch(server.base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    return response.json() as Promise<unknown>;
  };
  const login = async () => {
    const result = await post('/auth/otp/verify', {
      phoneNumber: '+525510000001',
      otp: '123456',
    });
    assert.ok(
      result &&
        typeof result === 'object' &&
        'token' in result &&
        typeof result.token === 'string',
    );
    local.session = {
      workerId: 'ana',
      token: result.token,
      generation: (local.session?.generation ?? 0) + 1,
    };
  };
  await login();
  assert.ok(local.session);
  await local
    .worker()
    .cacheAssignment(await local.api.assignment(local.session));
  return {
    local,
    post,
    login,
    async state() {
      return (await (await fetch(server.base + '/__dev/state')).json()) as {
        receipts: { clientActionId: string }[];
        acceptances: { clientActionId: string; workerId: string }[];
        documentSubmissions: { submissionId: string; clientActionId: string }[];
      };
    },
    async restart() {
      await server.kill();
      server = await startMockProcess(join(local.directory, 'backend'));
    },
    async close() {
      await server.kill();
      await local.close();
    },
  };
}

test('TEST-03: engine retries original upload ID after committed disconnect, backend SIGKILL and client reconstruction; one effect', async () => {
  const testContext = await fixture();
  const local = testContext.local;
  let engine = local.engine();
  try {
    const action = await local
      .worker()
      .enqueueDocument('ds160_confirmation', local.image());
    await testContext.post('/__dev/failures', { dropNextResponse: true });
    local.online = true;
    await engine.start();
    assert.equal((await local.worker().listActions())[0]?.status, 'retry_wait');
    assert.equal(
      (await testContext.state()).documentSubmissions.filter(
        (submission) => submission.clientActionId === action.id,
      ).length,
      1,
    );
    engine.stop();
    await testContext.restart();
    await local.reopen();
    engine = local.engine();
    local.clock.advance(1100);
    await engine.start();
    assert.equal((await local.worker().listActions())[0]?.status, 'delivered');
    const state = await testContext.state();
    assert.equal(
      state.documentSubmissions.filter(
        (submission) => submission.clientActionId === action.id,
      ).length,
      1,
    );
    assert.equal(
      state.receipts.filter((receipt) => receipt.clientActionId === action.id)
        .length,
      1,
    );
    assert.deepEqual(
      local.attempts.map((action) => action.id),
      [action.id, action.id],
    );
    assert.equal(
      (await local.worker().listSubmissions())[0]?.serverStatus,
      'pending_review',
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

for (const decision of ['approved', 'correction_requested'] as const) {
  test(`TEST-03R: ${decision} revision/reason survives refresh before original replay acknowledgment`, async () => {
    const testContext = await fixture();
    const local = testContext.local;
    const engine = local.engine();
    try {
      const action = await local
        .worker()
        .enqueueDocument('passport', local.image());
      await testContext.post('/__dev/failures', { dropNextResponse: true });
      local.online = true;
      await engine.start();
      const committed = (await testContext.state()).documentSubmissions.find(
        (submission) => submission.clientActionId === action.id,
      );
      assert.ok(committed);
      await testContext.post('/__dev/review', {
        submissionId: committed.submissionId,
        status: decision,
        ...(decision === 'correction_requested'
          ? { correctionReason: 'Foto borrosa, vuelva a tomarla' }
          : {}),
      });
      assert.ok(local.session);
      await local
        .store()
        .cacheRefresh(await local.api.assignment(local.session));
      const reviewed = (await local.worker().listSubmissions())[0];
      assert.equal(reviewed?.serverStatus, decision);
      // Prevent the post-ack refresh from hiding an incorrect acknowledgment merge.
      local.api.assignment = async () => {
        throw new TransportError(0, 'test_refresh_unavailable');
      };
      local.clock.advance(1100);
      await engine.request();
      const after = (await local.worker().listSubmissions())[0];
      assert.equal(after?.deliveryStatus, 'delivered');
      assert.equal(after?.serverStatus, reviewed?.serverStatus);
      assert.equal(after?.serverRevision, reviewed?.serverRevision);
      assert.equal(after?.correctionReason, reviewed?.correctionReason);
      assert.equal(
        (await testContext.state()).documentSubmissions.filter(
          (submission) => submission.clientActionId === action.id,
        ).length,
        1,
      );
    } finally {
      engine.stop();
      await testContext.close();
    }
  });
}

test('TEST-05: stale v2 resolves ordering; failed refresh survives restart; explicit v3 delivers without superseding v2', async () => {
  const testContext = await fixture();
  const local = testContext.local;
  let engine = local.engine();
  try {
    const previousAcceptance = await local.worker().enqueueTerms('v2');
    await testContext.post('/__dev/terms', { version: 'v3' });
    const assignment = local.api.assignment;
    local.api.assignment = async () => {
      throw new TransportError(0, 'test_offline_refresh');
    };
    local.online = true;
    await engine.start();
    assert.equal((await local.worker().listActions())[0]?.status, 'stale');
    assert.equal(
      (await local.worker().getAssignment())?.terms.serverAcceptanceStatus,
      'not_confirmed',
    );
    assert.equal((await local.store().refreshState()).needed, true);
    engine.stop();
    await local.reopen();
    local.api.assignment = assignment;
    engine = local.engine();
    await engine.start();
    assert.equal(
      (await local.worker().getAssignment())?.terms.termsVersionId,
      'v2',
    );
    local.clock.advance(1100);
    await engine.request();
    assert.equal(
      (await local.worker().getAssignment())?.terms.termsVersionId,
      'v3',
    );
    assert.equal(
      (await local.worker().getAssignment())?.terms.serverAcceptanceStatus,
      'not_confirmed',
    );
    assert.equal(
      (await testContext.state()).acceptances.filter(
        (action) => action.workerId === 'ana',
      ).length,
      0,
    );
    const fresh = await local.worker().enqueueTerms('v3');
    await engine.request();
    assert.deepEqual(
      (await local.worker().listActions()).map((action) => [
        action.id,
        action.status,
      ]),
      [
        [previousAcceptance.id, 'stale'],
        [fresh.id, 'delivered'],
      ],
    );
    assert.equal(
      (await local.worker().getAssignment())?.terms.serverAcceptanceStatus,
      'accepted',
    );
    assert.deepEqual(
      (await testContext.state()).acceptances
        .filter((action) => action.workerId === 'ana')
        .map((action) => action.clientActionId),
      [fresh.id],
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('committed v2 replay after publication of v3 resolves v2 only and never accepts v3', async () => {
  const testContext = await fixture();
  const local = testContext.local;
  const engine = local.engine();
  try {
    const action = await local.worker().enqueueTerms('v2');
    await testContext.post('/__dev/failures', { dropNextResponse: true });
    local.online = true;
    await engine.start();
    await testContext.post('/__dev/terms', { version: 'v3' });
    local.clock.advance(1100);
    await engine.request();
    assert.equal((await local.worker().listActions())[0]?.status, 'delivered');
    const current = await local.worker().getAssignment();
    assert.equal(current?.terms.termsVersionId, 'v3');
    assert.equal(current?.terms.serverAcceptanceStatus, 'not_confirmed');
    assert.deepEqual(
      (await testContext.state()).acceptances
        .filter((action) => action.workerId === 'ana')
        .map((action) => action.clientActionId),
      [action.id],
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('real expired token preserves queue and resumes with reauthentication, same worker/action', async () => {
  const testContext = await fixture();
  const local = testContext.local;
  const engine = local.engine();
  try {
    const action = await local.worker().enqueueTerms('v2');
    await testContext.post('/__dev/expire-sessions', {});
    local.online = true;
    await engine.start();
    assert.equal(local.session, null);
    assert.equal((await local.worker().listActions())[0]?.status, 'queued');
    await testContext.login();
    await engine.request();
    assert.equal((await local.worker().listActions())[0]?.status, 'delivered');
    assert.deepEqual(
      (await testContext.state()).acceptances
        .filter((action) => action.workerId === 'ana')
        .map((action) => action.clientActionId),
      [action.id],
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('local acknowledgment rollback recovers original claim and same-resource successor on manual retry without restart', async () => {
  const testContext = await fixture();
  const local = testContext.local;
  const engine = local.engine();
  try {
    const first = await local
      .worker()
      .enqueueDocument('passport', local.image());
    const next = await local
      .worker()
      .enqueueDocument('passport', local.image());
    await local.database
      .exec(`CREATE TRIGGER fail_local_ack BEFORE UPDATE OF status ON outbox_actions
      WHEN NEW.status='delivered' BEGIN SELECT RAISE(ABORT,'test_local_ack_fault'); END`);
    local.online = true;
    await engine.start();
    const failed = await local.worker().listActions();
    assert.deepEqual(
      failed.map((action) => action.status),
      ['queued', 'queued'],
    );
    assert.equal(failed[0]?.id, first.id);
    assert.deepEqual(failed[0]?.payload, first.payload);
    assert.equal(failed[0]?.fileUri, first.fileUri);
    assert.equal(
      (await local.worker().listSubmissions())[0]?.serverStatus,
      null,
    );
    assert.equal(
      local.events.some(
        (event) => event.code === 'sync_storage_or_integrity_error',
      ),
      true,
    );
    assert.equal(
      (await testContext.state()).documentSubmissions.filter(
        (submission) => submission.clientActionId === first.id,
      ).length,
      1,
    );
    assert.equal(
      (await testContext.state()).documentSubmissions.filter(
        (submission) => submission.clientActionId === next.id,
      ).length,
      0,
    );
    await local.database.exec('DROP TRIGGER fail_local_ack');
    // Same engine, connection and session; no restart or explicit recoverSending call.
    await engine.manualRetry();
    assert.deepEqual(
      (await local.worker().listActions()).map((action) => action.status),
      ['delivered', 'delivered'],
    );
    assert.deepEqual(
      local.attempts.map((action) => action.id),
      [first.id, first.id, next.id],
    );
    assert.deepEqual(
      local.attempts.slice(0, 2).map((action) => action.payload),
      [first.payload, first.payload],
    );
    const state = await testContext.state();
    for (const action of [first, next]) {
      assert.equal(
        state.documentSubmissions.filter(
          (submission) => submission.clientActionId === action.id,
        ).length,
        1,
      );
      assert.equal(
        state.receipts.filter((receipt) => receipt.clientActionId === action.id)
          .length,
        1,
      );
    }
  } finally {
    engine.stop();
    await testContext.close();
  }
});
