import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiTransport } from '../../src/core/api/client.ts';
import { syncFixture } from './sync-fixture.mts';

test('malformed success is retried with same ID; malformed auth error still pauses the session', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    const action = await testContext.worker().enqueueTerms('v2');
    let status = 201;
    const bodies: string[] = [];
    const api = createApiTransport(
      'https://fictional.invalid',
      { resolve: async (action) => testContext.blob(action) },
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
    testContext.api.send = (session, queued) => api.send(session, queued);
    testContext.online = true;
    await engine.start();
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'retry_wait',
    );
    status = 401;
    await engine.manualRetry();
    assert.equal(testContext.session, null);
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'queued',
    );
    assert.ok(
      bodies.every((body) => JSON.parse(body).clientActionId === action.id),
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});

test('action ID conflict is permanent; manual retry cannot resend it', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    await testContext.worker().enqueueTerms('v2');
    let calls = 0;
    testContext.api.send = async () => {
      calls++;
      return { status: 409, code: 'action_id_conflict' };
    };
    testContext.online = true;
    await engine.start();
    await engine.manualRetry();
    assert.equal(calls, 1);
    assert.equal(
      (await testContext.worker().listActions())[0]?.lastErrorCode,
      'action_id_conflict',
    );
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'failed_permanent',
    );
  } finally {
    engine.stop();
    await testContext.close();
  }
});
