import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { AuthService } from '../../src/core/auth/auth-service.ts';
import type {
  StoredSession,
  SessionVault,
} from '../../src/core/auth/auth-service.ts';
import { createAuthApi } from '../../src/core/auth/auth-api.ts';
import { createApiTransport } from '../../src/core/api/client.ts';
import { SyncEngine } from '../../src/core/sync/sync-engine.ts';
import type { SessionProvider } from '../../src/core/sync/types.ts';
import { syncFixture } from './sync-fixture.mts';
import { startMockProcess } from './mock-process.mts';

test('TEST-06 with real auth/HTTP: Carla intent survives logout, Bruno selection and reauthentication; original ID resumes only as Carla', async () => {
  const f = await syncFixture(),
    server = await startMockProcess(join(f.directory, 'server'));
  let saved: StoredSession | null = null;
  const vault: SessionVault = {
    async read() {
      return saved;
    },
    async write(value) {
      saved = structuredClone(value);
    },
    async clear() {
      saved = null;
    },
  };
  let auth = new AuthService(createAuthApi(server.base), vault);
  const session: SessionProvider = {
    current: () => auth.current(),
    invalidate: (s, r) => auth.invalidate(s, r),
  };
  const api = createApiTransport(server.base, {
    resolve: async (action) => f.blob(action),
  });
  const requests: string[] = [];
  const send = api.send;
  api.send = async (s, a) => {
    requests.push(s.workerId);
    return send(s, a);
  };
  const engine = new SyncEngine({
    session,
    api,
    persistence: f.store,
    connectivity: { online: () => true },
    clock: f.clock,
    retryDelay: () => 1000,
    enabled: () => true,
    report: () => {},
  });
  const login = async () => {
    await auth.requestOtp('+52 55 1000 0002');
    await auth.verify('123456');
  };
  try {
    await auth.restore();
    await login();
    assert.equal(auth.current(), null);
    await auth.selectWorker('carla');
    const carla = auth.current();
    assert.ok(carla);
    await f.worker('carla').cacheAssignment(await api.assignment(carla));
    const queued = await f
      .worker('carla')
      .enqueueDocument('passport', f.image('carla'), 'seed-carla-passport');
    await auth.logout();
    assert.equal((await f.worker('carla').listActions())[0]?.id, queued.id);
    auth = new AuthService(createAuthApi(server.base), vault);
    await auth.restore();
    assert.equal(auth.current(), null);
    await login();
    await auth.selectWorker('bruno');
    const bruno = auth.current();
    assert.ok(bruno);
    await f.worker('bruno').cacheAssignment(await api.assignment(bruno));
    await engine.start();
    assert.equal((await f.worker('bruno').listActions()).length, 0);
    assert.equal((await f.worker('carla').listActions())[0]?.status, 'queued');
    assert.deepEqual(requests, []);
    await auth.switchWorker();
    await auth.selectWorker('carla');
    await engine.request();
    assert.equal((await f.worker('carla').listActions())[0]?.id, queued.id);
    assert.equal(
      (await f.worker('carla').listActions())[0]?.status,
      'delivered',
    );
    assert.deepEqual(requests, ['carla']);
  } finally {
    engine.stop();
    await engine.settled();
    await server.kill();
    await f.close();
  }
});

test('real expired token clears vault and selected view before reauthentication resumes original queued ID', async () => {
  const f = await syncFixture(),
    server = await startMockProcess(join(f.directory, 'server'));
  let saved: StoredSession | null = null;
  const vault: SessionVault = {
    async read() {
      return saved;
    },
    async write(value) {
      saved = structuredClone(value);
    },
    async clear() {
      saved = null;
    },
  };
  const auth = new AuthService(createAuthApi(server.base), vault),
    api = createApiTransport(server.base, {
      resolve: async (action) => f.blob(action),
    });
  const engine = new SyncEngine({
    session: auth,
    api,
    persistence: f.store,
    connectivity: { online: () => true },
    clock: f.clock,
    retryDelay: () => 1000,
    enabled: () => true,
    report: () => {},
  });
  const login = async () => {
    await auth.requestOtp('+525510000001');
    await auth.verify('123456');
  };
  try {
    await auth.restore();
    await login();
    const first = auth.current();
    assert.ok(first);
    await f.worker().cacheAssignment(await api.assignment(first));
    const queued = await f.worker().enqueueTerms('v2');
    await fetch(server.base + '/__dev/expire-sessions', { method: 'POST' });
    await engine.start();
    await auth.settled();
    assert.equal(auth.current(), null);
    assert.equal(saved, null);
    assert.equal(auth.getSnapshot().selectedWorker, null);
    assert.equal((await f.worker().listActions())[0]?.status, 'queued');
    await login();
    await engine.request();
    assert.equal((await f.worker().listActions())[0]?.id, queued.id);
    assert.equal((await f.worker().listActions())[0]?.status, 'delivered');
  } finally {
    engine.stop();
    await engine.settled();
    await server.kill();
    await f.close();
  }
});

test('authorized identity bootstrap creates durable refresh intent before an assignment exists', async () => {
  const f = await syncFixture();
  const engine = f.engine();
  try {
    await f.worker('carla').ensureWorkerIdentity('Carla Díaz');
    await f.store('carla').requestRefresh();
    assert.equal(await f.worker('carla').getAssignment(), null);
    assert.equal((await f.store('carla').refreshState()).needed, true);
    f.session = { workerId: 'carla', token: 'fictional', generation: 2 };
    f.online = true;
    await engine.start();
    assert.equal(
      (await f.worker('carla').getAssignment())?.worker.workerId,
      'carla',
    );
    assert.equal((await f.store('carla').refreshState()).needed, false);
  } finally {
    engine.stop();
    await engine.settled();
    await f.close();
  }
});
