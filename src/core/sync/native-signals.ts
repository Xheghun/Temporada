import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { SyncSignals } from './sync-triggers.ts';
import type { ConnectivityProvider, SyncClock } from './types.ts';

export function nativeSignals(
  session: SyncSignals['session'],
  enqueue: SyncSignals['enqueue'],
): {
  signals: SyncSignals;
  connectivity: ConnectivityProvider;
  dispose(): void;
} {
  let online = false;
  const listeners = new Set<() => void>();
  const stop = NetInfo.addEventListener((state) => {
    const next =
      state.isConnected === true && state.isInternetReachable !== false;
    const changed = next !== online;
    online = next;
    if (changed) listeners.forEach((notify) => notify());
  });
  return {
    connectivity: { online: () => online },
    signals: {
      session,
      enqueue,
      foreground(callback) {
        const subscription = AppState.addEventListener('change', (state) => {
          if (state === 'active') callback();
        });
        return () => subscription.remove();
      },
      connectivity(callback) {
        listeners.add(callback);
        return () => {
          listeners.delete(callback);
        };
      },
    },
    dispose() {
      stop();
      listeners.clear();
    },
  };
}
export const nativeClock: SyncClock = {
  now: Date.now,
  schedule(at, callback) {
    const timer = setTimeout(callback, Math.max(0, at - Date.now()));
    return () => clearTimeout(timer);
  },
};
