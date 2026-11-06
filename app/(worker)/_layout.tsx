import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthSnapshot } from '@/core/auth/auth-provider';
export default function WorkerLayout() {
  const state = useAuthSnapshot();
  const { t } = useTranslation();
  if (state.phase === 'worker_selection')
    return <Redirect href="/(auth)/select-worker" />;
  return state.phase === 'ready' ? (
    <Stack key={state.generation}>
      <Stack.Screen
        name="home"
        options={{ title: t('home.title'), headerBackVisible: false }}
      />
      <Stack.Screen
        name="terms"
        options={{
          title: t('home.terms'),
          headerBackVisible: true,
          headerBackTitle: t('home.title'),
        }}
      />
      <Stack.Screen name="identity" options={{ title: t('identityTitle') }} />
    </Stack>
  ) : (
    <Redirect href="/(auth)/sign-in" />
  );
}
