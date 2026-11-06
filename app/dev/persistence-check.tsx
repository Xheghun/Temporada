import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { runNativePersistenceCheck } from '@/testing/native-persistence-check';

function DeveloperCheck() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [result, setResult] = useState('Running persistence check…');
  useEffect(() => {
    let visible = true;
    runNativePersistenceCheck(mode ?? 'seed').then(
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
      <Stack.Screen options={{ title: 'Developer persistence check' }} />
      <Text selectable accessibilityRole="header">
        {result}
      </Text>
    </ScrollView>
  );
}
export default function PersistenceCheckRoute() {
  return __DEV__ ? <DeveloperCheck /> : <Redirect href="/" />;
}
