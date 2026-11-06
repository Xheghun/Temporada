import { createContext, useContext, useSyncExternalStore } from 'react';
import type { AuthService } from './auth-service';
export const AuthContext = createContext<AuthService | null>(null);
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('auth_provider_missing');
  return auth;
}
export function useAuthSnapshot() {
  const auth = useAuth();
  return useSyncExternalStore(
    auth.subscribe,
    auth.getSnapshot,
    auth.getSnapshot,
  );
}
