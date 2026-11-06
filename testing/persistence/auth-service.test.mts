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
  const f = fixture();
  await f.auth.restore();
  await f.auth.requestOtp('+52 55 1000 0001');
  await assert.rejects(f.auth.verify('000000'), /invalid_otp/);
  assert.equal(f.saved, null);
  assert.equal(f.auth.getSnapshot().error, 'invalid_otp');
  await f.auth.verify('123456');
  assert.equal(f.auth.current()?.workerId, 'ana');
  assert.equal(f.auth.getSnapshot().selectedWorker?.displayName, 'Ana López');
  assert.equal(
    JSON.stringify(f.auth.getSnapshot()).includes('fictional-token'),
    false,
  );
  const restored = new AuthService(f.api, f.vault);
  await restored.restore();
  assert.equal(restored.current()?.workerId, 'ana');
});

test('shared phone requires selection; switching clears view immediately and invalid worker cannot be selected', async () => {
  const f = fixture(true);
  await f.auth.restore();
  await login(f.auth);
  assert.equal(f.auth.getSnapshot().phase, 'worker_selection');
  assert.equal(f.auth.current(), null);
  await assert.rejects(f.auth.selectWorker('ana'), /worker_forbidden/);
  await f.auth.selectWorker('carla');
  const before = f.auth.current();
  assert.ok(before);
  const switching = f.auth.switchWorker();
  assert.equal(f.auth.getSnapshot().selectedWorker, null);
  assert.equal(f.auth.current(), null);
  assert.equal(f.auth.isCurrent(before), false);
  await switching;
  await f.auth.selectWorker('bruno');
  assert.equal(f.auth.current()?.workerId, 'bruno');
  assert.equal(f.auth.isCurrent(before), false);
});

test('logout invalidates late OTP verification and serialized vault writes cannot resurrect a session', async () => {
  const f = fixture();
  await f.auth.restore();
  await f.auth.requestOtp('+525510000001');
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const verify = f.api.verify;
  f.api.verify = async (...args) => {
    await gate;
    return verify(...args);
  };
  const pending = f.auth.verify('123456');
  await f.auth.logout();
  release();
  await pending;
  assert.equal(f.auth.current(), null);
  assert.equal(f.saved, null);
  f.api.verify = verify;
  await f.auth.requestOtp('+525510000001');
  const write = f.vault.write;
  let entered!: () => void;
  const started = new Promise<void>((r) => {
    entered = r;
  });
  let unblock!: () => void;
  const waiting = new Promise<void>((r) => {
    unblock = r;
  });
  f.vault.write = async (record) => {
    entered();
    await waiting;
    await write(record);
  };
  const save = f.auth.verify('123456');
  await started;
  const logout = f.auth.logout();
  assert.equal(f.auth.getSnapshot().selectedWorker, null);
  unblock();
  await Promise.all([save, logout]);
  assert.equal(f.saved, null);
  assert.equal(f.auth.current(), null);
});

test('vault failure fails closed and retry can recover; expired generation cannot invalidate a newer session', async () => {
  const f = fixture();
  await f.auth.restore();
  await f.auth.requestOtp('+525510000001');
  const write = f.vault.write;
  f.vault.write = async () => {
    throw new Error('test_storage_failure');
  };
  await assert.rejects(f.auth.verify('123456'));
  assert.equal(f.auth.current(), null);
  assert.equal(f.auth.getSnapshot().error, 'secure_storage');
  f.vault.write = write;
  await f.auth.verify('123456');
  const old = f.auth.current();
  assert.ok(old);
  await f.auth.logout();
  await login(f.auth);
  f.auth.invalidate(old, 'reauthenticate');
  assert.equal(f.auth.current()?.workerId, 'ana');
  const current = f.auth.current();
  assert.ok(current);
  f.auth.invalidate(current, 'reauthenticate');
  assert.equal(f.auth.current(), null);
  assert.equal(f.auth.getSnapshot().selectedWorker, null);
  await f.auth.settled();
  assert.equal(f.saved, null);
  const restarted = new AuthService(f.api, f.vault);
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
  const f = fixture();
  let release!: (value: unknown) => void;
  f.vault.read = () =>
    new Promise((r) => {
      release = r;
    });
  const pending = f.auth.restore();
  await f.auth.logout();
  release({
    token: 'fictional',
    workers: [{ workerId: 'ana', displayName: 'Ana López' }],
    selectedWorkerId: 'ana',
  });
  await pending;
  assert.equal(f.auth.current(), null);
});

test('network failure remains actionable and a subsequent phone request succeeds', async () => {
  const f = fixture();
  await f.auth.restore();
  const request = f.api.requestOtp;
  f.api.requestOtp = async () => {
    throw new AuthError('network');
  };
  await assert.rejects(f.auth.requestOtp('+525510000001'), /network/);
  assert.equal(f.auth.getSnapshot().error, 'network');
  assert.equal(f.auth.current(), null);
  f.api.requestOtp = request;
  await login(f.auth);
  assert.equal(f.auth.current()?.workerId, 'ana');
});
