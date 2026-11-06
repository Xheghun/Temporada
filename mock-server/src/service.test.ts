import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMockService } from './service.ts';
import { Failures } from './failure-injection.ts';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=',
  'base64',
);
interface Result {
  submissionId?: string;
  acceptanceId?: string;
  serverRevision: number;
  status?: string;
  correctionReason?: string | null;
}
async function fixture(controlsEnabled = true) {
  const directory = mkdtempSync(join(tmpdir(), 'worker-api-'));
  let service = createMockService(directory, { controlsEnabled });
  let server = service.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  function url() {
    const serverAddress = server.address();
    assert(serverAddress && typeof serverAddress !== 'string');
    return `http://127.0.0.1:${serverAddress.port}`;
  }
  const headers: Record<string, string> = {};
  const post = (
    path: string,
    body: unknown,
    extra: Record<string, string> = {},
  ) =>
    fetch(url() + path, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json', ...extra },
      body: JSON.stringify(body),
    });
  async function login(number = '+525510000001') {
    const body = (await (
      await post('/auth/otp/verify', { phoneNumber: number, otp: '123456' })
    ).json()) as { token: string };
    headers.authorization = `Bearer ${body.token}`;
    headers['x-worker-id'] = number.endsWith('1') ? 'ana' : 'carla';
  }
  async function upload(
    clientActionId: string = randomUUID(),
    documentType = 'passport',
    bytes = png,
    replaces?: string,
  ) {
    const data = new FormData();
    data.set('clientActionId', clientActionId);
    data.set('documentType', documentType);
    data.set(
      'image',
      new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
      'passport.png',
    );
    if (replaces) data.set('replacesSubmissionId', replaces);
    return fetch(url() + '/me/documents', {
      method: 'POST',
      headers,
      body: data,
    });
  }
  async function stop() {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    service.store.close();
  }
  return {
    directory,
    headers,
    post,
    upload,
    login,
    get service() {
      return service;
    },
    get: (path: string) => fetch(url() + path, { headers }),
    async restart() {
      await stop();
      service = createMockService(directory, { controlsEnabled });
      server = service.app.listen(0, '127.0.0.1');
      await once(server, 'listening');
    },
    async close() {
      await stop();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('terms receipt survives restart, v3 and failure controls; changed payload conflicts', async () => {
  const testContext = await fixture();
  try {
    await testContext.login();
    const clientActionId = randomUUID();
    const payload = { clientActionId: clientActionId, termsVersionId: 'v2' };
    const created = await testContext.post('/me/terms-acceptances', payload);
    assert.equal(created.status, 201);
    const original = await created.json();
    await testContext.restart();
    assert.equal(
      (await testContext.post('/__dev/terms', { version: 'v3' })).status,
      200,
    );
    await testContext.post('/__dev/failures', {
      serverErrorRate: 1,
      dropNextResponse: true,
    });
    const replay = await testContext.post('/me/terms-acceptances', payload);
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), original);
    const conflict = await testContext.post('/me/terms-acceptances', {
      ...payload,
      termsVersionId: 'v3',
    });
    assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), { code: 'action_id_conflict' });
    await testContext.post('/__dev/failures', {
      serverErrorRate: 0,
      dropNextResponse: false,
    });
    const stale = await testContext.post('/me/terms-acceptances', {
      clientActionId: randomUUID(),
      termsVersionId: 'v2',
    });
    assert.equal(stale.status, 409);
    assert.deepEqual(await stale.json(), {
      code: 'stale_terms',
      currentTermsVersionId: 'v3',
    });
    const newAcceptance = await testContext.post('/me/terms-acceptances', {
      clientActionId: randomUUID(),
      termsVersionId: 'v3',
    });
    assert.equal(newAcceptance.status, 201);
    assert.equal(
      testContext.service.store.database
        .prepare("SELECT count(*) AS n FROM acceptances WHERE workerId='ana'")
        .get()?.n,
      2,
    );
  } finally {
    await testContext.close();
  }
});

test('post-commit disconnect and actual reopened database produce one upload effect', async () => {
  const testContext = await fixture();
  try {
    await testContext.login();
    const clientActionId = randomUUID();
    await testContext.post('/__dev/failures', { dropNextResponse: true });
    await assert.rejects(testContext.upload(clientActionId));
    await testContext.restart();
    const replay = await testContext.upload(clientActionId);
    assert.equal(replay.status, 200);
    assert.equal(((await replay.json()) as Result).status, 'pending_review');
    assert.equal(testContext.service.store.submissions('ana').length, 1);
    assert.equal(readdirSync(testContext.service.store.uploads).length, 1);
    assert.equal(
      testContext.service.store.database
        .prepare("SELECT count(*) AS n FROM receipts WHERE workerId='ana'")
        .get()?.n,
      1,
    );
    const conflict = await testContext.upload(
      clientActionId,
      'signed_contract',
    );
    assert.equal(conflict.status, 409);
    const changedBytes = await testContext.upload(
      clientActionId,
      'passport',
      Buffer.concat([png, Buffer.from('changed')]),
    );
    assert.equal(changedBytes.status, 409);
    await testContext.post('/__dev/failures', {
      force413: true,
      serverErrorRate: 1,
    });
    assert.equal((await testContext.upload(clientActionId)).status, 200);
  } finally {
    await testContext.close();
  }
});

for (const status of ['approved', 'correction_requested'] as const) {
  test(`original upload receipt stays unchanged after newer ${status} review and refresh`, async () => {
    const testContext = await fixture();
    try {
      await testContext.login();
      const clientActionId = randomUUID();
      await testContext.post('/__dev/failures', { dropNextResponse: true });
      await assert.rejects(testContext.upload(clientActionId));
      const submission = testContext.service.store.submissions('ana')[0];
      assert(submission);
      const review = await testContext.post('/__dev/review', {
        submissionId: submission.submissionId,
        status,
        correctionReason: 'Foto borrosa, vuelva a tomarla',
      });
      assert.equal(review.status, 200);
      const snapshot = (await (
        await testContext.get('/me/assignment')
      ).json()) as {
        documentSubmissions: Result[];
      };
      const decision = snapshot.documentSubmissions[0];
      assert(decision);
      assert.equal(decision.status, status);
      const replay = await testContext.upload(clientActionId);
      assert.equal(replay.status, 200);
      const original = (await replay.json()) as Result;
      assert.equal(original.status, 'pending_review');
      assert(original.serverRevision < decision.serverRevision);
      if (status === 'correction_requested')
        assert.equal(
          decision.correctionReason,
          'Foto borrosa, vuelva a tomarla',
        );
      assert.equal(
        testContext.service.store.submissions('ana')[0]?.status,
        status,
      );
      assert.equal(testContext.service.store.submissions('ana').length, 1);
    } finally {
      await testContext.close();
    }
  });
}

test('413/422 reject without receipts/files and unrelated terms can still commit', async () => {
  const testContext = await fixture();
  try {
    await testContext.login();
    await testContext.post('/__dev/failures', { force413: true });
    assert.equal((await testContext.upload()).status, 413);
    await testContext.post('/__dev/failures', { force413: false });
    assert.equal(
      (await testContext.upload(randomUUID(), 'unknown')).status,
      422,
    );
    assert.equal(
      (
        await testContext.upload(
          randomUUID(),
          'passport',
          Buffer.alloc(1_500_000),
        )
      ).status,
      413,
    );
    assert.equal(
      (
        await testContext.upload(
          randomUUID(),
          'passport',
          Buffer.alloc(2_000_001),
        )
      ).status,
      413,
    );
    assert.equal(
      (
        await testContext.upload(
          randomUUID(),
          'passport',
          Buffer.from('not an image'),
        )
      ).status,
      422,
    );
    assert.equal((await testContext.upload('invalid-uuid')).status, 422);
    assert.equal(readdirSync(testContext.service.store.uploads).length, 0);
    assert.equal(testContext.service.store.submissions('ana').length, 0);
    assert.equal(
      (
        await testContext.post('/me/terms-acceptances', {
          clientActionId: randomUUID(),
          termsVersionId: 'v2',
        })
      ).status,
      201,
    );
  } finally {
    await testContext.close();
  }
});

test('corrections preserve history, cross-worker authorization and scoped action IDs', async () => {
  const testContext = await fixture();
  try {
    await testContext.login('+525510000002');
    const clientActionId = randomUUID();
    const submitted = await testContext.upload(
      clientActionId,
      'passport',
      png,
      'seed-carla-passport',
    );
    assert.equal(submitted.status, 201);
    assert.equal(
      testContext.service.store.submissions('carla')[0]?.status,
      'correction_requested',
    );
    assert.equal(testContext.service.store.submissions('carla').length, 2);
    testContext.headers['x-worker-id'] = 'bruno';
    assert.equal((await testContext.upload(clientActionId)).status, 201);
    assert.equal(testContext.service.store.submissions('bruno').length, 2);
    testContext.headers['x-worker-id'] = 'ana';
    assert.equal((await testContext.upload(clientActionId)).status, 403);
    assert.equal((await testContext.get('/me/assignment')).status, 403);
    await testContext.login();
    assert.equal(
      (
        await testContext.upload(
          randomUUID(),
          'passport',
          png,
          'seed-carla-passport',
        )
      ).status,
      422,
    );
  } finally {
    await testContext.close();
  }
});

test('concurrent identical actions have one effect even with injected latency', async () => {
  const testContext = await fixture();
  try {
    await testContext.login();
    await testContext.post('/__dev/failures', { latencyMs: 25 });
    const clientActionId = randomUUID();
    const responses = await Promise.all([
      testContext.upload(clientActionId),
      testContext.upload(clientActionId),
    ]);
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [200, 201],
    );
    assert.equal(testContext.service.store.submissions('ana').length, 1);
    assert.equal(readdirSync(testContext.service.store.uploads).length, 1);
    const termsActionId = randomUUID();
    const termsPayload = {
      clientActionId: termsActionId,
      termsVersionId: 'v2',
    };
    const terms = await Promise.all([
      testContext.post('/me/terms-acceptances', termsPayload),
      testContext.post('/me/terms-acceptances', termsPayload),
    ]);
    assert.deepEqual(
      terms.map((response) => response.status).sort(),
      [200, 201],
    );
  } finally {
    await testContext.close();
  }
});

test('seeded random failures, latency control, token expiry and reauthentication', async () => {
  const testContext = await fixture();
  try {
    await testContext.login();
    assert.equal(
      (await testContext.post('/__dev/failures', { latencyMs: 2000 })).status,
      200,
    );
    assert.equal(testContext.service.failures.latencyMs, 2000);
    await testContext.post('/__dev/failures', {
      latencyMs: 0,
      serverErrorRate: 1,
    });
    assert.equal((await testContext.get('/me/assignment')).status, 500);
    await testContext.post('/__dev/failures', { serverErrorRate: 0 });
    assert.equal((await testContext.get('/me/assignment')).status, 200);
    await testContext.post('/__dev/expire-sessions', {});
    assert.equal((await testContext.get('/me/assignment')).status, 401);
    await testContext.login();
    assert.equal((await testContext.get('/me/assignment')).status, 200);
    assert.equal(
      (await testContext.post('/__dev/failures', { serverErrorRate: 2 }))
        .status,
      422,
    );
    assert.equal(testContext.service.failures.serverErrorRate, 0);
    const firstPolicy = new Failures();
    const secondPolicy = new Failures();
    firstPolicy.configure({ serverErrorRate: 0.5, randomSeed: 42 });
    secondPolicy.configure({ serverErrorRate: 0.5, randomSeed: 42 });
    const sequence = async (policy: Failures) => {
      const outcomes = [];
      for (let attemptIndex = 0; attemptIndex < 10; attemptIndex++) {
        try {
          await policy.beforeRequest();
          outcomes.push(200);
        } catch {
          outcomes.push(500);
        }
      }
      return outcomes;
    };
    assert.deepEqual(await sequence(firstPolicy), await sequence(secondPolicy));
  } finally {
    await testContext.close();
  }
});

test('DB failure cleans staged upload, startup reconciles only orphans and preserves committed files', async () => {
  const testContext = await fixture();
  try {
    await testContext.login();
    await testContext.upload();
    const committed = readdirSync(testContext.service.store.uploads);
    testContext.service.store.database.exec(
      "CREATE TRIGGER reject_receipt BEFORE INSERT ON receipts BEGIN SELECT RAISE(ABORT,'test rollback'); END;",
    );
    assert.equal((await testContext.upload()).status, 500);
    assert.deepEqual(readdirSync(testContext.service.store.uploads), committed);
    assert.equal(testContext.service.store.submissions('ana').length, 1);
    testContext.service.store.database.exec('DROP TRIGGER reject_receipt');
    writeFileSync(join(testContext.service.store.uploads, 'orphan.image'), png);
    await testContext.restart();
    assert.deepEqual(readdirSync(testContext.service.store.uploads), committed);
    assert.equal(testContext.service.store.submissions('ana').length, 1);
  } finally {
    await testContext.close();
  }
});

test('development controls absent by default and in production', async () => {
  const testContext = await fixture(false);
  try {
    assert.equal(
      (await testContext.post('/__dev/failures', { force413: true })).status,
      404,
    );
    assert.equal((await testContext.get('/__dev/state')).status, 404);
  } finally {
    await testContext.close();
  }
  const prior = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const enabledControlsContext = await fixture(true);
  try {
    assert.equal(
      (await enabledControlsContext.post('/__dev/terms', { version: 'v3' }))
        .status,
      404,
    );
  } finally {
    await enabledControlsContext.close();
    if (prior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prior;
  }
});
