import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiTransport } from '../../src/core/api/client.ts';
import { syncFixture } from './sync-fixture.mts';

test('malformed success is retried with same ID; malformed auth error still pauses the session', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    const action = await f.worker().enqueueTerms('v2');
    let status = 201;
    const bodies: string[] = [];
    const api = createApiTransport(
      'https://fictional.invalid',
      { resolve: async (a) => f.blob(a) },
      async (_url, init) => {
        bodies.push(String(init.body));
        return {
          status,
          json: async () => {
            throw new SyntaxError('test_invalid_json');
          },
        };
      },
    );
    f.api.send = (session, queued) => api.send(session, queued);
    f.online = true;
    await engine.start();
    assert.equal((await f.worker().listActions())[0]?.status, 'retry_wait');
    status = 401;
    await engine.manualRetry();
    assert.equal(f.session, null);
    assert.equal((await f.worker().listActions())[0]?.status, 'queued');
    assert.ok(
      bodies.every((body) => JSON.parse(body).clientActionId === action.id),
    );
  } finally {
    engine.stop();
    await f.close();
  }
});

test('action ID conflict is permanent; manual retry cannot resend it', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    await f.worker().enqueueTerms('v2');
    let calls = 0;
    f.api.send = async () => {
      calls++;
      return { status: 409, code: 'action_id_conflict' };
    };
    f.online = true;
    await engine.start();
    await engine.manualRetry();
    assert.equal(calls, 1);
    assert.equal(
      (await f.worker().listActions())[0]?.lastErrorCode,
      'action_id_conflict',
    );
    assert.equal(
      (await f.worker().listActions())[0]?.status,
      'failed_permanent',
    );
  } finally {
    engine.stop();
    await f.close();
  }
});
