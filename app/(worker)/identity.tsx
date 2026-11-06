import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth, useAuthSnapshot } from '@/core/auth/auth-provider';
import {
  AuthPage,
  Heading,
  Body,
  Action,
  ErrorNotice,
} from '@/design-system/components/auth-controls';
export default function WorkerIdentity() {
  const { t } = useTranslation(),
    auth = useAuth(),
    state = useAuthSnapshot();
  return (
    <AuthPage>
      <Stack.Screen
        options={{ title: t('identityTitle'), headerBackVisible: false }}
      />
      <Body>{t('signedInAs')}</Body>
      <Heading>{state.selectedWorker?.displayName}</Heading>
      <Body>{t('sessionReady')}</Body>
      <ErrorNotice code={state.error} />
      {state.workers.length > 1 ? (
        <Action
          secondary
          label={t('switchWorker')}
          onPress={() => {
            void auth.perform(() => auth.switchWorker());
          }}
        />
      ) : null}
      <Action
        label={t('logout')}
        onPress={() => {
          void auth.perform(() => auth.logout());
        }}
      />
      <Body>{t('logoutHint')}</Body>
    </AuthPage>
  );
}
