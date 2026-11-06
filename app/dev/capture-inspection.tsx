import { useState } from 'react';
import { Stack } from 'expo-router';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthSnapshot } from '@/core/auth/auth-provider';
import {
  AuthPage,
  Action,
  Body,
} from '@/design-system/components/auth-controls';
import { inspectNativeCapture } from '@/testing/native-capture-inspection';
export default function CaptureInspection() {
  const identity = useAuthSnapshot();
  const { t: translate } = useTranslation();
  const [report, setReport] = useState<{
    workerId: string;
    generation: number;
    text: string;
  } | null>(null);
  if (
    !__DEV__ ||
    process.env.EXPO_PUBLIC_ASSESSMENT_MODE !== '1' ||
    !identity.selectedWorker
  )
    return <Body>{translate('unavailable')}</Body>;
  const workerId = identity.selectedWorker.workerId,
    generation = identity.generation;
  return (
    <AuthPage>
      <Stack.Screen options={{ title: translate('capture.inspectionTitle') }} />
      <Action
        label={translate('capture.inspect')}
        onPress={() => {
          void inspectNativeCapture(workerId).then(
            (text) => setReport({ workerId, generation, text }),
            () =>
              setReport({
                workerId,
                generation,
                text: translate('capture.inspectionFailed'),
              }),
          );
        }}
      />
      {report?.workerId === workerId && report.generation === generation ? (
        <Text selectable>{report.text}</Text>
      ) : null}
    </AuthPage>
  );
}
