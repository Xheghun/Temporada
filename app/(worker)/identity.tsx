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
  const { t: translate } = useTranslation(),
    auth = useAuth(),
    state = useAuthSnapshot();
  return (
    <AuthPage>
      <Stack.Screen
        options={{
          title: translate('identityTitle'),
          headerBackVisible: false,
        }}
      />
      <Body>{translate('signedInAs')}</Body>
      <Heading>{state.selectedWorker?.displayName}</Heading>
      <Body>{translate('sessionReady')}</Body>
      <ErrorNotice code={state.error} />
      {state.workers.length > 1 ? (
        <Action
          secondary
          label={translate('switchWorker')}
          onPress={() => {
            void auth.perform(() => auth.switchWorker());
          }}
        />
      ) : null}
      <Action
        label={translate('logout')}
        onPress={() => {
          void auth.perform(() => auth.logout());
        }}
      />
      <Body>{translate('logoutHint')}</Body>
    </AuthPage>
  );
}
