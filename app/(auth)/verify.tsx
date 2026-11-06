import { Redirect, Stack } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useAuth, useAuthSnapshot } from '@/core/auth/auth-provider';
import { otpFormSchema } from '@/core/auth/validation';
import {
  AuthPage,
  Heading,
  Body,
  Field,
  Action,
  ErrorNotice,
} from '@/design-system/components/auth-controls';
export default function Verify() {
  const { t } = useTranslation(),
    auth = useAuth(),
    state = useAuthSnapshot();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { otp: '' },
    resolver: zodResolver(otpFormSchema),
  });
  if (state.phase === 'ready') return <Redirect href="/(worker)/identity" />;
  if (state.phase === 'worker_selection')
    return <Redirect href="/(auth)/select-worker" />;
  if (state.phase !== 'code_sent') return <Redirect href="/(auth)/sign-in" />;
  return (
    <AuthPage>
      <Stack.Screen
        options={{ title: t('verifyTitle'), headerBackVisible: false }}
      />
      <Heading>{t('verifyTitle')}</Heading>
      <Body>{t('verifyIntro')}</Body>
      <Controller
        control={control}
        name="otp"
        render={({ field: { value, onChange, onBlur } }) => (
          <Field
            label={t('otp')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
            editable={!state.busy}
            error={errors.otp ? t('errors.invalid_otp') : undefined}
          />
        )}
      />
      {__DEV__ ? <Body>{t('mockOtp')}</Body> : null}
      <ErrorNotice code={state.error} />
      <Action
        label={t('verify')}
        busy={state.busy}
        onPress={() => {
          void handleSubmit(async ({ otp }) => {
            await auth.perform(() => auth.verify(otp));
          })();
        }}
      />
      <Action
        secondary
        label={t('backToSignIn')}
        disabled={state.busy}
        onPress={() => {
          void auth.perform(() => auth.logout());
        }}
      />
    </AuthPage>
  );
}
