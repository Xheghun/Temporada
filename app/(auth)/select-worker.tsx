import { View } from 'react-native';
import {
  BrandHeader,
  InformationPanel,
  TextAction,
} from '@/design-system/components/screen-chrome';
import {
  ListRow,
  WorkerAvatar,
} from '@/design-system/components/worker-controls';
import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth, useAuthSnapshot } from '@/core/auth/auth-provider';
import {
  AuthPage,
  Heading,
  Body,
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
    <AuthPage
      contentGap={0}
      header={
        <BrandHeader context={translate('reference.context.selection')} />
      }
    >
      <Stack.Screen
        options={{ title: translate('pickTitle'), headerShown: false }}
      />
      <Heading>{translate('pickTitle')}</Heading>
      <View style={{ marginTop: 12, marginBottom: 28 }}>
        <Body>{translate('reference.workerIntro')}</Body>
      </View>
      <View style={{ gap: 14 }}>
        <ErrorNotice code={state.error} />
        {state.busy ? <Body>{translate('busy')}</Body> : null}
        {!state.workers.length ? (
          <Body>{translate('ui.noWorkers')}</Body>
        ) : null}
        {state.workers.map((worker) => (
          <ListRow
            outlined
            detail={translate('reference.workerDetail')}
            leading={<WorkerAvatar size={48} name={worker.displayName} />}
            title={worker.displayName}
            key={worker.workerId}
            label={translate('selectWorker', { name: worker.displayName })}
            disabled={state.busy}
            onPress={() => {
              void auth.perform(() => auth.selectWorker(worker.workerId));
            }}
          />
        ))}
      </View>
      <View style={{ marginTop: 20 }}>
        <InformationPanel>
          <Body>{translate('reference.isolation')}</Body>
        </InformationPanel>
      </View>
      <TextAction
        label={translate('logout')}
        disabled={state.busy}
        onPress={() => {
          void auth.perform(() => auth.logout());
        }}
      />
    </AuthPage>
  );
}
