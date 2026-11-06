import { Redirect } from 'expo-router';
import { useAuthSnapshot } from '@/core/auth/auth-provider';
export default function Index() {
  const state = useAuthSnapshot();
  return (
    <Redirect
      href={
        state.phase === 'ready'
          ? '/(worker)/home'
          : state.phase === 'worker_selection'
            ? '/(auth)/select-worker'
            : state.phase === 'code_sent'
              ? '/(auth)/verify'
              : '/(auth)/sign-in'
      }
    />
  );
}
