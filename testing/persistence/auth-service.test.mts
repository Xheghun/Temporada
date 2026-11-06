import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthService,
  AuthError,
  decodeSession,
} from '../../src/core/auth/auth-service.ts';
import type {
  AuthApi,
  StoredSession,
  SessionVault,
} from '../../src/core/auth/auth-service.ts';

function fixture(shared = false) {
  let saved: StoredSession | null = null;
  const vault: SessionVault = {
    async read() {
      return saved && structuredClone(saved);
    },
    async write(record) {
      saved = structuredClone(record);
    },
    async clear() {
      saved = null;
    },
  };
  const api: AuthApi = {
    async requestOtp() {},
    async verify(_phone, otp) {
      if (otp !== '123456') throw new AuthError('invalid_otp');
      return {
        token: 'fictional-token',
        workers: shared
          ? [
              { workerId: 'bruno', displayName: 'Bruno Díaz' },
              { workerId: 'carla', displayName: 'Carla Díaz' },
            ]
          : [{ workerId: 'ana', displayName: 'Ana López' }],
      };
    },
  };
  return {
    api,
    vault,
    auth: new AuthService(api, vault),
    get saved() {
      return saved;
    },
  };
}
async function login(auth: AuthService) {
  await auth.requestOtp('+52 55 1000 0001');
  await auth.verify('123456');
}

test('invalid OTP creates no session; single worker selects automatically and tokens never enter UI snapshots', async () => {
  const testContext = fixture();
  await testContext.auth.restore();
  await testContext.auth.requestOtp('+52 55 1000 0001');
  await assert.rejects(testContext.auth.verify('000000'), /invalid_otp/);
  assert.equal(testContext.saved, null);
  assert.equal(testContext.auth.getSnapshot().error, 'invalid_otp');
  await testContext.auth.verify('123456');
  assert.equal(testContext.auth.current()?.workerId, 'ana');
  assert.equal(
    testContext.auth.getSnapshot().selectedWorker?.displayName,
    'Ana López',
  );
  assert.equal(
    JSON.stringify(testContext.auth.getSnapshot()).includes('fictional-token'),
    false,
  );
  const restored = new AuthService(testContext.api, testContext.vault);
  await restored.restore();
  assert.equal(restored.current()?.workerId, 'ana');
});

test('shared phone requires selection; switching clears view immediately and invalid worker cannot be selected', async () => {
  const testContext = fixture(true);
  await testContext.auth.restore();
  await login(testContext.auth);
  assert.equal(testContext.auth.getSnapshot().phase, 'worker_selection');
  assert.equal(testContext.auth.current(), null);
  await assert.rejects(
    testContext.auth.selectWorker('ana'),
    /worker_forbidden/,
  );
  await testContext.auth.selectWorker('carla');
  const before = testContext.auth.current();
  assert.ok(before);
  const switching = testContext.auth.switchWorker();
  assert.equal(testContext.auth.getSnapshot().selectedWorker, null);
  assert.equal(testContext.auth.current(), null);
  assert.equal(testContext.auth.isCurrent(before), false);
  await switching;
  await testContext.auth.selectWorker('bruno');
  assert.equal(testContext.auth.current()?.workerId, 'bruno');
  assert.equal(testContext.auth.isCurrent(before), false);
});

test('logout invalidates late OTP verification and serialized vault writes cannot resurrect a session', async () => {
  const testContext = fixture();
  await testContext.auth.restore();
  await testContext.auth.requestOtp('+525510000001');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const verify = testContext.api.verify;
  testContext.api.verify = async (...args) => {
    await gate;
    return verify(...args);
  };
  const pending = testContext.auth.verify('123456');
  await testContext.auth.logout();
  release();
  await pending;
  assert.equal(testContext.auth.current(), null);
  assert.equal(testContext.saved, null);
  testContext.api.verify = verify;
  await testContext.auth.requestOtp('+525510000001');
  const write = testContext.vault.write;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let unblock!: () => void;
  const waiting = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  testContext.vault.write = async (record) => {
    entered();
    await waiting;
    await write(record);
  };
  const save = testContext.auth.verify('123456');
  await started;
  const logout = testContext.auth.logout();
  assert.equal(testContext.auth.getSnapshot().selectedWorker, null);
  unblock();
  await Promise.all([save, logout]);
  assert.equal(testContext.saved, null);
  assert.equal(testContext.auth.current(), null);
});

test('vault failure fails closed and retry can recover; expired generation cannot invalidate a newer session', async () => {
  const testContext = fixture();
  await testContext.auth.restore();
  await testContext.auth.requestOtp('+525510000001');
  const write = testContext.vault.write;
  testContext.vault.write = async () => {
    throw new Error('test_storage_failure');
  };
  await assert.rejects(testContext.auth.verify('123456'));
  assert.equal(testContext.auth.current(), null);
  assert.equal(testContext.auth.getSnapshot().error, 'secure_storage');
  testContext.vault.write = write;
  await testContext.auth.verify('123456');
  const previousSession = testContext.auth.current();
  assert.ok(previousSession);
  await testContext.auth.logout();
  await login(testContext.auth);
  testContext.auth.invalidate(previousSession, 'reauthenticate');
  assert.equal(testContext.auth.current()?.workerId, 'ana');
  const current = testContext.auth.current();
  assert.ok(current);
  testContext.auth.invalidate(current, 'reauthenticate');
  assert.equal(testContext.auth.current(), null);
  assert.equal(testContext.auth.getSnapshot().selectedWorker, null);
  await testContext.auth.settled();
  assert.equal(testContext.saved, null);
  const restarted = new AuthService(testContext.api, testContext.vault);
  await restarted.restore();
  assert.equal(restarted.current(), null);
});

test('restore rejects unauthorized selected identities and stale reads after logout', async () => {
  assert.throws(
    () =>
      decodeSession({
        token: 'fictional',
        workers: [{ workerId: 'ana', displayName: 'Ana López' }],
        selectedWorkerId: 'carla',
      }),
    /invalid_stored_session/,
  );
  const testContext = fixture();
  let release!: (value: unknown) => void;
  testContext.vault.read = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const pending = testContext.auth.restore();
  await testContext.auth.logout();
  release({
    token: 'fictional',
    workers: [{ workerId: 'ana', displayName: 'Ana López' }],
    selectedWorkerId: 'ana',
  });
  await pending;
  assert.equal(testContext.auth.current(), null);
});

test('network failure remains actionable and a subsequent phone request succeeds', async () => {
  const testContext = fixture();
  await testContext.auth.restore();
  const request = testContext.api.requestOtp;
  testContext.api.requestOtp = async () => {
    throw new AuthError('network');
  };
  await assert.rejects(testContext.auth.requestOtp('+525510000001'), /network/);
  assert.equal(testContext.auth.getSnapshot().error, 'network');
  assert.equal(testContext.auth.current(), null);
  testContext.api.requestOtp = request;
  await login(testContext.auth);
  assert.equal(testContext.auth.current()?.workerId, 'ana');
});
