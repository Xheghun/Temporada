import { useEffect } from 'react';
import { BackHandler, Pressable, Text } from 'react-native';
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
  const { t: translate } = useTranslation(),
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
  useEffect(() => {
    if (state.phase !== 'code_sent') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!state.busy) void auth.perform(() => auth.logout());
      return true;
    });
    return () => listener.remove();
  }, [auth, state.phase, state.busy]);
  if (state.phase === 'ready') return <Redirect href="/(worker)/home" />;
  if (state.phase === 'worker_selection')
    return <Redirect href="/(auth)/select-worker" />;
  if (state.phase !== 'code_sent') return <Redirect href="/(auth)/sign-in" />;
  return (
    <AuthPage>
      <Stack.Screen
        options={{
          title: '',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate('ui.back')}
              accessibilityState={{ disabled: state.busy }}
              disabled={state.busy}
              onPress={() => {
                void auth.perform(() => auth.logout());
              }}
              style={{ minHeight: 48, minWidth: 48, justifyContent: 'center' }}
            >
              <Text>{translate('ui.back')}</Text>
            </Pressable>
          ),
        }}
      />
      <Heading>{translate('verifyTitle')}</Heading>
      <Body>
        {translate('verifyIntro', { phone: state.verificationPhone })}
      </Body>
      <Controller
        control={control}
        name="otp"
        render={({ field: { value, onChange, onBlur } }) => (
          <Field
            label={translate('otp')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
            editable={!state.busy}
            error={errors.otp ? translate('errors.invalid_otp') : undefined}
          />
        )}
      />
      {__DEV__ ? <Body>{translate('mockOtp')}</Body> : null}
      <ErrorNotice code={state.error} />
      <Action
        label={translate('verify')}
        busy={state.busy}
        onPress={() => {
          void handleSubmit(async ({ otp }) => {
            await auth.perform(() => auth.verify(otp));
          })();
        }}
      />
      <Action
        secondary
        label={translate('backToSignIn')}
        disabled={state.busy}
        onPress={() => {
          void auth.perform(() => auth.logout());
        }}
      />
    </AuthPage>
  );
}
