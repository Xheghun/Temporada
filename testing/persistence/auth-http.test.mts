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
  const testContext = await syncFixture(),
    server = await startMockProcess(join(testContext.directory, 'server'));
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
    invalidate: (session, receipt) => auth.invalidate(session, receipt),
  };
  const api = createApiTransport(server.base, {
    resolve: async (action) => testContext.blob(action),
  });
  const requests: string[] = [];
  const send = api.send;
  api.send = async (session, action) => {
    requests.push(session.workerId);
    return send(session, action);
  };
  const engine = new SyncEngine({
    session,
    api,
    persistence: testContext.store,
    connectivity: { online: () => true },
    clock: testContext.clock,
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
    await testContext
      .worker('carla')
      .cacheAssignment(await api.assignment(carla));
    const queued = await testContext
      .worker('carla')
      .enqueueDocument(
        'passport',
        testContext.image('carla'),
        'seed-carla-passport',
      );
    await auth.logout();
    assert.equal(
      (await testContext.worker('carla').listActions())[0]?.id,
      queued.id,
    );
    auth = new AuthService(createAuthApi(server.base), vault);
    await auth.restore();
    assert.equal(auth.current(), null);
    await login();
    await auth.selectWorker('bruno');
    const bruno = auth.current();
    assert.ok(bruno);
    await testContext
      .worker('bruno')
      .cacheAssignment(await api.assignment(bruno));
    await engine.start();
    assert.equal((await testContext.worker('bruno').listActions()).length, 0);
    assert.equal(
      (await testContext.worker('carla').listActions())[0]?.status,
      'queued',
    );
    assert.deepEqual(requests, []);
    await auth.switchWorker();
    await auth.selectWorker('carla');
    await engine.request();
    assert.equal(
      (await testContext.worker('carla').listActions())[0]?.id,
      queued.id,
    );
    assert.equal(
      (await testContext.worker('carla').listActions())[0]?.status,
      'delivered',
    );
    assert.deepEqual(requests, ['carla']);
  } finally {
    engine.stop();
    await engine.settled();
    await server.kill();
    await testContext.close();
  }
});

test('real expired token clears vault and selected view before reauthentication resumes original queued ID', async () => {
  const testContext = await syncFixture(),
    server = await startMockProcess(join(testContext.directory, 'server'));
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
      resolve: async (action) => testContext.blob(action),
    });
  const engine = new SyncEngine({
    session: auth,
    api,
    persistence: testContext.store,
    connectivity: { online: () => true },
    clock: testContext.clock,
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
    await testContext.worker().cacheAssignment(await api.assignment(first));
    const queued = await testContext.worker().enqueueTerms('v2');
    await fetch(server.base + '/__dev/expire-sessions', { method: 'POST' });
    await engine.start();
    await auth.settled();
    assert.equal(auth.current(), null);
    assert.equal(saved, null);
    assert.equal(auth.getSnapshot().selectedWorker, null);
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'queued',
    );
    await login();
    await engine.request();
    assert.equal((await testContext.worker().listActions())[0]?.id, queued.id);
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'delivered',
    );
  } finally {
    engine.stop();
    await engine.settled();
    await server.kill();
    await testContext.close();
  }
});

test('authorized identity bootstrap creates durable refresh intent before an assignment exists', async () => {
  const testContext = await syncFixture();
  const engine = testContext.engine();
  try {
    await testContext.worker('carla').ensureWorkerIdentity('Carla Díaz');
    await testContext.store('carla').requestRefresh();
    assert.equal(await testContext.worker('carla').getAssignment(), null);
    assert.equal(
      (await testContext.store('carla').refreshState()).needed,
      true,
    );
    testContext.session = {
      workerId: 'carla',
      token: 'fictional',
      generation: 2,
    };
    testContext.online = true;
    await engine.start();
    assert.equal(
      (await testContext.worker('carla').getAssignment())?.worker.workerId,
      'carla',
    );
    assert.equal(
      (await testContext.store('carla').refreshState()).needed,
      false,
    );
  } finally {
    engine.stop();
    await engine.settled();
    await testContext.close();
  }
});
