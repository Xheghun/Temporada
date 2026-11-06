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
  const f = await fixture();
  const l = f.local;
  let engine = l.engine();
  try {
    const action = await l
      .worker()
      .enqueueDocument('ds160_confirmation', l.image());
    await f.post('/__dev/failures', { dropNextResponse: true });
    l.online = true;
    await engine.start();
    assert.equal((await l.worker().listActions())[0]?.status, 'retry_wait');
    assert.equal(
      (await f.state()).documentSubmissions.filter(
        (s) => s.clientActionId === action.id,
      ).length,
      1,
    );
    engine.stop();
    await f.restart();
    await l.reopen();
    engine = l.engine();
    l.clock.advance(1100);
    await engine.start();
    assert.equal((await l.worker().listActions())[0]?.status, 'delivered');
    const state = await f.state();
    assert.equal(
      state.documentSubmissions.filter((s) => s.clientActionId === action.id)
        .length,
      1,
    );
    assert.equal(
      state.receipts.filter((r) => r.clientActionId === action.id).length,
      1,
    );
    assert.deepEqual(
      l.attempts.map((a) => a.id),
      [action.id, action.id],
    );
    assert.equal(
      (await l.worker().listSubmissions())[0]?.serverStatus,
      'pending_review',
    );
  } finally {
    engine.stop();
    await f.close();
  }
});

for (const decision of ['approved', 'correction_requested'] as const) {
  test(`TEST-03R: ${decision} revision/reason survives refresh before original replay acknowledgment`, async () => {
    const f = await fixture();
    const l = f.local;
    const engine = l.engine();
    try {
      const action = await l.worker().enqueueDocument('passport', l.image());
      await f.post('/__dev/failures', { dropNextResponse: true });
      l.online = true;
      await engine.start();
      const committed = (await f.state()).documentSubmissions.find(
        (s) => s.clientActionId === action.id,
      );
      assert.ok(committed);
      await f.post('/__dev/review', {
        submissionId: committed.submissionId,
        status: decision,
        ...(decision === 'correction_requested'
          ? { correctionReason: 'Foto borrosa, vuelva a tomarla' }
          : {}),
      });
      assert.ok(l.session);
      await l.store().cacheRefresh(await l.api.assignment(l.session));
      const reviewed = (await l.worker().listSubmissions())[0];
      assert.equal(reviewed?.serverStatus, decision);
      // Prevent the post-ack refresh from hiding an incorrect acknowledgment merge.
      l.api.assignment = async () => {
        throw new TransportError(0, 'test_refresh_unavailable');
      };
      l.clock.advance(1100);
      await engine.request();
      const after = (await l.worker().listSubmissions())[0];
      assert.equal(after?.deliveryStatus, 'delivered');
      assert.equal(after?.serverStatus, reviewed?.serverStatus);
      assert.equal(after?.serverRevision, reviewed?.serverRevision);
      assert.equal(after?.correctionReason, reviewed?.correctionReason);
      assert.equal(
        (await f.state()).documentSubmissions.filter(
          (s) => s.clientActionId === action.id,
        ).length,
        1,
      );
    } finally {
      engine.stop();
      await f.close();
    }
  });
}

test('TEST-05: stale v2 resolves ordering; failed refresh survives restart; explicit v3 delivers without superseding v2', async () => {
  const f = await fixture();
  const l = f.local;
  let engine = l.engine();
  try {
    const old = await l.worker().enqueueTerms('v2');
    await f.post('/__dev/terms', { version: 'v3' });
    const assignment = l.api.assignment;
    l.api.assignment = async () => {
      throw new TransportError(0, 'test_offline_refresh');
    };
    l.online = true;
    await engine.start();
    assert.equal((await l.worker().listActions())[0]?.status, 'stale');
    assert.equal(
      (await l.worker().getAssignment())?.terms.serverAcceptanceStatus,
      'not_confirmed',
    );
    assert.equal((await l.store().refreshState()).needed, true);
    engine.stop();
    await l.reopen();
    l.api.assignment = assignment;
    engine = l.engine();
    await engine.start();
    assert.equal(
      (await l.worker().getAssignment())?.terms.termsVersionId,
      'v2',
    );
    l.clock.advance(1100);
    await engine.request();
    assert.equal(
      (await l.worker().getAssignment())?.terms.termsVersionId,
      'v3',
    );
    assert.equal(
      (await l.worker().getAssignment())?.terms.serverAcceptanceStatus,
      'not_confirmed',
    );
    assert.equal(
      (await f.state()).acceptances.filter((a) => a.workerId === 'ana').length,
      0,
    );
    const fresh = await l.worker().enqueueTerms('v3');
    await engine.request();
    assert.deepEqual(
      (await l.worker().listActions()).map((a) => [a.id, a.status]),
      [
        [old.id, 'stale'],
        [fresh.id, 'delivered'],
      ],
    );
    assert.equal(
      (await l.worker().getAssignment())?.terms.serverAcceptanceStatus,
      'accepted',
    );
    assert.deepEqual(
      (await f.state()).acceptances
        .filter((a) => a.workerId === 'ana')
        .map((a) => a.clientActionId),
      [fresh.id],
    );
  } finally {
    engine.stop();
    await f.close();
  }
});

test('committed v2 replay after publication of v3 resolves v2 only and never accepts v3', async () => {
  const f = await fixture();
  const l = f.local;
  const engine = l.engine();
  try {
    const action = await l.worker().enqueueTerms('v2');
    await f.post('/__dev/failures', { dropNextResponse: true });
    l.online = true;
    await engine.start();
    await f.post('/__dev/terms', { version: 'v3' });
    l.clock.advance(1100);
    await engine.request();
    assert.equal((await l.worker().listActions())[0]?.status, 'delivered');
    const current = await l.worker().getAssignment();
    assert.equal(current?.terms.termsVersionId, 'v3');
    assert.equal(current?.terms.serverAcceptanceStatus, 'not_confirmed');
    assert.deepEqual(
      (await f.state()).acceptances
        .filter((a) => a.workerId === 'ana')
        .map((a) => a.clientActionId),
      [action.id],
    );
  } finally {
    engine.stop();
    await f.close();
  }
});

test('real expired token preserves queue and resumes with reauthentication, same worker/action', async () => {
  const f = await fixture();
  const l = f.local;
  const engine = l.engine();
  try {
    const action = await l.worker().enqueueTerms('v2');
    await f.post('/__dev/expire-sessions', {});
    l.online = true;
    await engine.start();
    assert.equal(l.session, null);
    assert.equal((await l.worker().listActions())[0]?.status, 'queued');
    await f.login();
    await engine.request();
    assert.equal((await l.worker().listActions())[0]?.status, 'delivered');
    assert.deepEqual(
      (await f.state()).acceptances
        .filter((a) => a.workerId === 'ana')
        .map((a) => a.clientActionId),
      [action.id],
    );
  } finally {
    engine.stop();
    await f.close();
  }
});
