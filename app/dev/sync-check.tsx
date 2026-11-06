import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { runNativeSyncCheck } from '@/testing/native-sync-check';
function DeveloperCheck() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [result, setResult] = useState('Running sync check…');
  useEffect(() => {
    let visible = true;
    runNativeSyncCheck(mode ?? 'seed').then(
      (value) => {
        if (visible) setResult(value);
      },
      (error) => {
        if (visible)
          setResult(
            `FAILED: ${error instanceof Error ? error.message : 'unknown_error'}`,
          );
      },
    );
    return () => {
      visible = false;
    };
  }, [mode]);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 24 }}
    >
      <Stack.Screen options={{ title: 'Developer sync check' }} />
      <Text selectable>{result}</Text>
    </ScrollView>
  );
}
export default function SyncCheckRoute() {
  return __DEV__ ? <DeveloperCheck /> : <Redirect href="/" />;
}
