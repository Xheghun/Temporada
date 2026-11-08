import {
  ContextHeader,
  Eyebrow,
  TextAction,
} from '@/design-system/components/screen-chrome';
import { tokens } from '@/design-system/tokens';
import { useEffect } from 'react';
import { BackHandler, View, Text } from 'react-native';
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
    <AuthPage
      contentGap={0}
      headerGap={24}
      header={
        <ContextHeader
          context={translate('reference.context.verify')}
          disabled={state.busy}
          onBack={() => {
            void auth.perform(() => auth.logout());
          }}
        />
      }
    >
      <Stack.Screen options={{ headerShown: false }} />
      <Heading>{translate('verifyTitle')}</Heading>
      <View style={{ marginTop: 12 }}>
        <Body>{translate('reference.verifyIntro')}</Body>
      </View>
      <View style={{ gap: 8, marginTop: 28, marginBottom: 24 }}>
        <Eyebrow>{translate('phone')}</Eyebrow>
        <Text
          selectable
          style={{
            fontSize: 16,
            lineHeight: 22,
            fontWeight: '700',
            color: tokens.colors.text,
          }}
        >
          {state.verificationPhone}
        </Text>
      </View>
      <View style={{ gap: 20 }}>
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
              style={{ letterSpacing: 4 }}
              editable={!state.busy}
              error={errors.otp ? translate('errors.invalid_otp') : undefined}
            />
          )}
        />
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
      </View>
      <View style={{ marginTop: 20 }}>
        {__DEV__ ? <Body>{translate('mockOtp')}</Body> : null}
        <TextAction
          label={translate('backToSignIn')}
          disabled={state.busy}
          onPress={() => {
            void auth.perform(() => auth.logout());
          }}
        />
      </View>
    </AuthPage>
  );
}
