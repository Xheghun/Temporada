import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { Store } from './storage.ts';
import { createAuthApp, errors } from './app.ts';

test('OTP, exact seeds, authorized shared phone and persisted sessions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'worker-auth-'));
  let store = new Store(dir);
  const app = createAuthApp(store);
  app.use(errors);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const post = (url: string, body: unknown) =>
    fetch(base + url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await post('/auth/otp/request', { phoneNumber: '+52 55 1000 0001' }))
        .status,
      200,
    );
    assert.equal(
      (await post('/auth/otp/request', { phoneNumber: 'bad' })).status,
      422,
    );
    assert.equal(
      (
        await post('/auth/otp/verify', {
          phoneNumber: '+525510000001',
          otp: '000000',
        })
      ).status,
      401,
    );
    const ana = (await (
      await post('/auth/otp/verify', {
        phoneNumber: '+525510000001',
        otp: '123456',
      })
    ).json()) as {
      token: string;
      workers: { workerId: string; displayName: string }[];
    };
    assert.deepEqual(ana.workers, [
      { workerId: 'ana', displayName: 'Ana López' },
    ]);
    const headers = {
      authorization: `Bearer ${ana.token}`,
      'x-worker-id': 'ana',
    };
    const response = await fetch(base + '/me/assignment', { headers });
    assert.equal(response.status, 200);
    const snapshot = (await response.json()) as {
      assignment: {
        orderId: string;
        employer: string;
        worksite: string;
        seasonStart: string;
        seasonEnd: string;
      };
      terms: { termsVersionId: string; serverAcceptanceStatus: string };
      requiredDocuments: { documentType: string }[];
      documentSubmissions: unknown[];
    };
    assert.deepEqual(snapshot.assignment, {
      orderId: 'JO-2026-0142',
      employer: 'Valle Verde Farms',
      worksite: 'Yuma, Arizona',
      seasonStart: '2026-03-01',
      seasonEnd: '2026-07-31',
    });
    assert.equal(snapshot.terms.termsVersionId, 'v2');
    assert.equal(snapshot.terms.serverAcceptanceStatus, 'not_confirmed');
    assert.deepEqual(snapshot.documentSubmissions, []);
    assert.deepEqual(
      snapshot.requiredDocuments.map((d) => d.documentType),
      ['passport', 'ds160_confirmation', 'signed_contract'],
    );
    assert.equal(
      (
        await fetch(base + '/me/assignment', {
          headers: { ...headers, 'x-worker-id': 'carla' },
        })
      ).status,
      403,
    );
    assert.equal((await fetch(base + '/me/assignment')).status, 401);
    const shared = (await (
      await post('/auth/otp/verify', {
        phoneNumber: '+52 55 1000 0002',
        otp: '123456',
      })
    ).json()) as { token: string; workers: { displayName: string }[] };
    assert.deepEqual(
      shared.workers.map((w) => w.displayName),
      ['Bruno Díaz', 'Carla Díaz'],
    );
    for (const [id, status] of [
      ['bruno', 'approved'],
      ['carla', 'correction_requested'],
    ]) {
      const data = (await (
        await fetch(base + '/me/assignment', {
          headers: {
            authorization: `Bearer ${shared.token}`,
            'x-worker-id': id!,
          },
        })
      ).json()) as {
        terms: { serverAcceptanceStatus: string };
        documentSubmissions: {
          status: string;
          correctionReason: string | null;
        }[];
      };
      assert.equal(data.documentSubmissions[0]?.status, status);
      if (id === 'bruno')
        assert.equal(data.terms.serverAcceptanceStatus, 'accepted');
      else
        assert.equal(
          data.documentSubmissions[0]?.correctionReason,
          'Foto borrosa, vuelva a tomarla',
        );
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
    store = new Store(dir);
    assert.equal(store.phoneWorkers('+525510000002').length, 2);
    assert.equal(
      store.db.prepare('SELECT count(*) AS n FROM sessions').get()?.n,
      2,
    );
    assert.equal(store.submissions('carla').length, 1);
  } finally {
    server.closeAllConnections();
    server.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
