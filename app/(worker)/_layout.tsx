import { Redirect, Slot } from 'expo-router';
import { useAuthSnapshot } from '@/core/auth/auth-provider';
export default function WorkerLayout() {
  const state = useAuthSnapshot();
  if (state.phase === 'worker_selection')
    return <Redirect href="/(auth)/select-worker" />;
  return state.phase === 'ready' ? (
    <Slot key={state.generation} />
  ) : (
    <Redirect href="/(auth)/sign-in" />
  );
}
