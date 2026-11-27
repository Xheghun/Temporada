import { useContext, useState } from 'react';
import { Stack } from 'expo-router';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthSnapshot } from '@/core/auth/auth-provider';
import {
  AuthPage,
  Action,
  Body,
} from '@/design-system/components/auth-controls';
import { NativeInspectionContext } from '@/testing/native-inspection-context';
import { isNativeInspectionAllowed } from '@/core/config/native-runtime-policy';
export default function CaptureInspection() {
  const identity = useAuthSnapshot();
  const inspect = useContext(NativeInspectionContext);
  const { t: translate } = useTranslation();
  const [report, setReport] = useState<{
    workerId: string;
    generation: number;
    text: string;
  } | null>(null);
  if (!isNativeInspectionAllowed() || !inspect || !identity.selectedWorker)
    return <Body>{translate('unavailable')}</Body>;
  const workerId = identity.selectedWorker.workerId,
    generation = identity.generation;
  return (
    <AuthPage>
      <Stack.Screen options={{ title: translate('capture.inspectionTitle') }} />
      <Action
        testID="capture-inspect"
        label={translate('capture.inspect')}
        onPress={() => {
          void inspect().then(
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
        <Text
          testID="capture-inspection-report"
          accessible
          accessibilityLabel={report.text}
          selectable
        >
          {report.text}
        </Text>
      ) : null}
    </AuthPage>
  );
}
