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
  const dir = mkdtempSync(join(tmpdir(), 'worker-api-'));
  let service = createMockService(dir, { controlsEnabled });
  let server = service.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  function url() {
    const a = server.address();
    assert(a && typeof a !== 'string');
    return `http://127.0.0.1:${a.port}`;
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
    id: string = randomUUID(),
    documentType = 'passport',
    bytes = png,
    replaces?: string,
  ) {
    const data = new FormData();
    data.set('clientActionId', id);
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
      server.close((e) => (e ? reject(e) : resolve())),
    );
    service.store.close();
  }
  return {
    dir,
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
      service = createMockService(dir, { controlsEnabled });
      server = service.app.listen(0, '127.0.0.1');
      await once(server, 'listening');
    },
    async close() {
      await stop();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('terms receipt survives restart, v3 and failure controls; changed payload conflicts', async () => {
  const f = await fixture();
  try {
    await f.login();
    const id = randomUUID();
    const payload = { clientActionId: id, termsVersionId: 'v2' };
    const created = await f.post('/me/terms-acceptances', payload);
    assert.equal(created.status, 201);
    const original = await created.json();
    await f.restart();
    assert.equal((await f.post('/__dev/terms', { version: 'v3' })).status, 200);
    await f.post('/__dev/failures', {
      serverErrorRate: 1,
      dropNextResponse: true,
    });
    const replay = await f.post('/me/terms-acceptances', payload);
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), original);
    const conflict = await f.post('/me/terms-acceptances', {
      ...payload,
      termsVersionId: 'v3',
    });
    assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), { code: 'action_id_conflict' });
    await f.post('/__dev/failures', {
      serverErrorRate: 0,
      dropNextResponse: false,
    });
    const stale = await f.post('/me/terms-acceptances', {
      clientActionId: randomUUID(),
      termsVersionId: 'v2',
    });
    assert.equal(stale.status, 409);
    assert.deepEqual(await stale.json(), {
      code: 'stale_terms',
      currentTermsVersionId: 'v3',
    });
    const fresh = await f.post('/me/terms-acceptances', {
      clientActionId: randomUUID(),
      termsVersionId: 'v3',
    });
    assert.equal(fresh.status, 201);
    assert.equal(
      f.service.store.db
        .prepare("SELECT count(*) AS n FROM acceptances WHERE workerId='ana'")
        .get()?.n,
      2,
    );
  } finally {
    await f.close();
  }
});

test('post-commit disconnect and actual reopened database produce one upload effect', async () => {
  const f = await fixture();
  try {
    await f.login();
    const id = randomUUID();
    await f.post('/__dev/failures', { dropNextResponse: true });
    await assert.rejects(f.upload(id));
    await f.restart();
    const replay = await f.upload(id);
    assert.equal(replay.status, 200);
    assert.equal(((await replay.json()) as Result).status, 'pending_review');
    assert.equal(f.service.store.submissions('ana').length, 1);
    assert.equal(readdirSync(f.service.store.uploads).length, 1);
    assert.equal(
      f.service.store.db
        .prepare("SELECT count(*) AS n FROM receipts WHERE workerId='ana'")
        .get()?.n,
      1,
    );
    const conflict = await f.upload(id, 'signed_contract');
    assert.equal(conflict.status, 409);
    const changedBytes = await f.upload(
      id,
      'passport',
      Buffer.concat([png, Buffer.from('changed')]),
    );
    assert.equal(changedBytes.status, 409);
    await f.post('/__dev/failures', { force413: true, serverErrorRate: 1 });
    assert.equal((await f.upload(id)).status, 200);
  } finally {
    await f.close();
  }
});

for (const status of ['approved', 'correction_requested'] as const) {
  test(`original upload receipt stays unchanged after newer ${status} review and refresh`, async () => {
    const f = await fixture();
    try {
      await f.login();
      const id = randomUUID();
      await f.post('/__dev/failures', { dropNextResponse: true });
      await assert.rejects(f.upload(id));
      const submission = f.service.store.submissions('ana')[0];
      assert(submission);
      const review = await f.post('/__dev/review', {
        submissionId: submission.submissionId,
        status,
        correctionReason: 'Foto borrosa, vuelva a tomarla',
      });
      assert.equal(review.status, 200);
      const snapshot = (await (await f.get('/me/assignment')).json()) as {
        documentSubmissions: Result[];
      };
      const decision = snapshot.documentSubmissions[0];
      assert(decision);
      assert.equal(decision.status, status);
      const replay = await f.upload(id);
      assert.equal(replay.status, 200);
      const original = (await replay.json()) as Result;
      assert.equal(original.status, 'pending_review');
      assert(original.serverRevision < decision.serverRevision);
      if (status === 'correction_requested')
        assert.equal(
          decision.correctionReason,
          'Foto borrosa, vuelva a tomarla',
        );
      assert.equal(f.service.store.submissions('ana')[0]?.status, status);
      assert.equal(f.service.store.submissions('ana').length, 1);
    } finally {
      await f.close();
    }
  });
}

test('413/422 reject without receipts/files and unrelated terms can still commit', async () => {
  const f = await fixture();
  try {
    await f.login();
    await f.post('/__dev/failures', { force413: true });
    assert.equal((await f.upload()).status, 413);
    await f.post('/__dev/failures', { force413: false });
    assert.equal((await f.upload(randomUUID(), 'unknown')).status, 422);
    assert.equal(
      (await f.upload(randomUUID(), 'passport', Buffer.alloc(1_500_000)))
        .status,
      413,
    );
    assert.equal(
      (await f.upload(randomUUID(), 'passport', Buffer.alloc(2_000_001)))
        .status,
      413,
    );
    assert.equal(
      (await f.upload(randomUUID(), 'passport', Buffer.from('not an image')))
        .status,
      422,
    );
    assert.equal((await f.upload('invalid-uuid')).status, 422);
    assert.equal(readdirSync(f.service.store.uploads).length, 0);
    assert.equal(f.service.store.submissions('ana').length, 0);
    assert.equal(
      (
        await f.post('/me/terms-acceptances', {
          clientActionId: randomUUID(),
          termsVersionId: 'v2',
        })
      ).status,
      201,
    );
  } finally {
    await f.close();
  }
});

test('corrections preserve history, cross-worker authorization and scoped action IDs', async () => {
  const f = await fixture();
  try {
    await f.login('+525510000002');
    const id = randomUUID();
    const submitted = await f.upload(
      id,
      'passport',
      png,
      'seed-carla-passport',
    );
    assert.equal(submitted.status, 201);
    assert.equal(
      f.service.store.submissions('carla')[0]?.status,
      'correction_requested',
    );
    assert.equal(f.service.store.submissions('carla').length, 2);
    f.headers['x-worker-id'] = 'bruno';
    assert.equal((await f.upload(id)).status, 201);
    assert.equal(f.service.store.submissions('bruno').length, 2);
    f.headers['x-worker-id'] = 'ana';
    assert.equal((await f.upload(id)).status, 403);
    assert.equal((await f.get('/me/assignment')).status, 403);
    await f.login();
    assert.equal(
      (await f.upload(randomUUID(), 'passport', png, 'seed-carla-passport'))
        .status,
      422,
    );
  } finally {
    await f.close();
  }
});

test('concurrent identical actions have one effect even with injected latency', async () => {
  const f = await fixture();
  try {
    await f.login();
    await f.post('/__dev/failures', { latencyMs: 25 });
    const id = randomUUID();
    const responses = await Promise.all([f.upload(id), f.upload(id)]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
    assert.equal(f.service.store.submissions('ana').length, 1);
    assert.equal(readdirSync(f.service.store.uploads).length, 1);
    const tid = randomUUID();
    const p = { clientActionId: tid, termsVersionId: 'v2' };
    const terms = await Promise.all([
      f.post('/me/terms-acceptances', p),
      f.post('/me/terms-acceptances', p),
    ]);
    assert.deepEqual(terms.map((r) => r.status).sort(), [200, 201]);
  } finally {
    await f.close();
  }
});

test('seeded random failures, latency control, token expiry and reauthentication', async () => {
  const f = await fixture();
  try {
    await f.login();
    assert.equal(
      (await f.post('/__dev/failures', { latencyMs: 2000 })).status,
      200,
    );
    assert.equal(f.service.failures.latencyMs, 2000);
    await f.post('/__dev/failures', { latencyMs: 0, serverErrorRate: 1 });
    assert.equal((await f.get('/me/assignment')).status, 500);
    await f.post('/__dev/failures', { serverErrorRate: 0 });
    assert.equal((await f.get('/me/assignment')).status, 200);
    await f.post('/__dev/expire-sessions', {});
    assert.equal((await f.get('/me/assignment')).status, 401);
    await f.login();
    assert.equal((await f.get('/me/assignment')).status, 200);
    assert.equal(
      (await f.post('/__dev/failures', { serverErrorRate: 2 })).status,
      422,
    );
    assert.equal(f.service.failures.serverErrorRate, 0);
    const a = new Failures();
    const b = new Failures();
    a.configure({ serverErrorRate: 0.5, randomSeed: 42 });
    b.configure({ serverErrorRate: 0.5, randomSeed: 42 });
    const sequence = async (v: Failures) => {
      const out = [];
      for (let i = 0; i < 10; i++) {
        try {
          await v.beforeRequest();
          out.push(200);
        } catch {
          out.push(500);
        }
      }
      return out;
    };
    assert.deepEqual(await sequence(a), await sequence(b));
  } finally {
    await f.close();
  }
});

test('DB failure cleans staged upload, startup reconciles only orphans and preserves committed files', async () => {
  const f = await fixture();
  try {
    await f.login();
    await f.upload();
    const committed = readdirSync(f.service.store.uploads);
    f.service.store.db.exec(
      "CREATE TRIGGER reject_receipt BEFORE INSERT ON receipts BEGIN SELECT RAISE(ABORT,'test rollback'); END;",
    );
    assert.equal((await f.upload()).status, 500);
    assert.deepEqual(readdirSync(f.service.store.uploads), committed);
    assert.equal(f.service.store.submissions('ana').length, 1);
    f.service.store.db.exec('DROP TRIGGER reject_receipt');
    writeFileSync(join(f.service.store.uploads, 'orphan.image'), png);
    await f.restart();
    assert.deepEqual(readdirSync(f.service.store.uploads), committed);
    assert.equal(f.service.store.submissions('ana').length, 1);
  } finally {
    await f.close();
  }
});

test('development controls absent by default and in production', async () => {
  const f = await fixture(false);
  try {
    assert.equal(
      (await f.post('/__dev/failures', { force413: true })).status,
      404,
    );
    assert.equal((await f.get('/__dev/state')).status, 404);
  } finally {
    await f.close();
  }
  const prior = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const p = await fixture(true);
  try {
    assert.equal((await p.post('/__dev/terms', { version: 'v3' })).status, 404);
  } finally {
    await p.close();
    if (prior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prior;
  }
});
