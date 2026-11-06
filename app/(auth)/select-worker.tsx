import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth, useAuthSnapshot } from '@/core/auth/auth-provider';
import {
  AuthPage,
  Heading,
  Body,
  Action,
  ErrorNotice,
} from '@/design-system/components/auth-controls';
export default function SelectWorker() {
  const { t } = useTranslation(),
    auth = useAuth(),
    state = useAuthSnapshot();
  if (state.phase === 'ready') return <Redirect href="/(worker)/home" />;
  if (state.phase !== 'worker_selection')
    return <Redirect href="/(auth)/sign-in" />;
  return (
    <AuthPage>
      <Stack.Screen
        options={{ title: t('pickTitle'), headerBackVisible: false }}
      />
      <Heading>{t('pickTitle')}</Heading>
      <Body>{t('pickIntro')}</Body>
      <ErrorNotice code={state.error} />
      {state.workers.map((worker) => (
        <Action
          key={worker.workerId}
          label={t('selectWorker', { name: worker.displayName })}
          disabled={state.busy}
          onPress={() => {
            void auth.perform(() => auth.selectWorker(worker.workerId));
          }}
        />
      ))}
      <Action
        secondary
        label={t('logout')}
        disabled={state.busy}
        onPress={() => {
          void auth.perform(() => auth.logout());
        }}
      />
    </AuthPage>
  );
}
