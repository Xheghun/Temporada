import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthSnapshot } from '@/core/auth/auth-provider';
export default function WorkerLayout() {
  const state = useAuthSnapshot();
  const { t: translate } = useTranslation();
  if (state.phase === 'worker_selection')
    return <Redirect href="/(auth)/select-worker" />;
  return state.phase === 'ready' ? (
    <Stack key={state.generation}>
      <Stack.Screen
        name="home"
        options={{ title: translate('home.title'), headerBackVisible: false }}
      />
      <Stack.Screen
        name="terms"
        options={{
          title: translate('home.terms'),
          headerBackVisible: true,
          headerBackTitle: translate('home.title'),
        }}
      />
      <Stack.Screen
        name="documents"
        options={{
          title: translate('documents.title'),
          headerBackTitle: translate('home.title'),
        }}
      />
      <Stack.Screen
        name="identity"
        options={{ title: translate('identityTitle') }}
      />
    </Stack>
  ) : (
    <Redirect href="/(auth)/sign-in" />
  );
}
