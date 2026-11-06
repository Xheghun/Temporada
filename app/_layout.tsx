import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/core/auth/auth-provider';
export default function RootLayout() {
  const { t } = useTranslation();
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen
          name="(auth)/sign-in"
          options={{ title: t('signIn'), headerBackVisible: false }}
        />
        <Stack.Screen
          name="(auth)/verify"
          options={{ title: t('verifyTitle'), headerBackVisible: false }}
        />
        <Stack.Screen
          name="(auth)/select-worker"
          options={{ title: t('pickTitle'), headerBackVisible: false }}
        />
        <Stack.Screen name="(worker)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
