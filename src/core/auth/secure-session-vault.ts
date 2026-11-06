import * as SecureStore from 'expo-secure-store';
import type { SessionVault } from './auth-service.ts';
const key = 'seasonal-worker-session-v1';
const options = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
export const secureSessionVault: SessionVault = {
  async read() {
    const value = await SecureStore.getItemAsync(key, options);
    return value === null ? null : (JSON.parse(value) as unknown);
  },
  async write(session) {
    await SecureStore.setItemAsync(key, JSON.stringify(session), options);
  },
  async clear() {
    await SecureStore.deleteItemAsync(key, options);
  },
};
