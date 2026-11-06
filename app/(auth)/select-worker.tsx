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
  const { t: translate } = useTranslation(),
    auth = useAuth(),
    state = useAuthSnapshot();
  if (state.phase === 'ready') return <Redirect href="/(worker)/home" />;
  if (state.phase !== 'worker_selection')
    return <Redirect href="/(auth)/sign-in" />;
  return (
    <AuthPage>
      <Stack.Screen
        options={{ title: translate('pickTitle'), headerBackVisible: false }}
      />
      <Heading>{translate('pickTitle')}</Heading>
      <Body>{translate('pickIntro')}</Body>
      <ErrorNotice code={state.error} />
      {state.workers.map((worker) => (
        <Action
          key={worker.workerId}
          label={translate('selectWorker', { name: worker.displayName })}
          disabled={state.busy}
          onPress={() => {
            void auth.perform(() => auth.selectWorker(worker.workerId));
          }}
        />
      ))}
      <Action
        secondary
        label={translate('logout')}
        disabled={state.busy}
        onPress={() => {
          void auth.perform(() => auth.logout());
        }}
      />
    </AuthPage>
  );
}
