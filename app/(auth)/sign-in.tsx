import { Text, View } from 'react-native';
import { BrandHeader } from '@/design-system/components/screen-chrome';
import { tokens } from '@/design-system/tokens';
import { Redirect, Stack } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useAuth, useAuthSnapshot } from '@/core/auth/auth-provider';
import { phoneFormSchema } from '@/core/auth/validation';
import {
  AuthPage,
  Body,
  Field,
  Action,
  ErrorNotice,
} from '@/design-system/components/auth-controls';
export default function SignIn() {
  const { t: translate } = useTranslation(),
    auth = useAuth(),
    state = useAuthSnapshot();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { phone: '' },
    resolver: zodResolver(phoneFormSchema),
  });
  if (state.phase === 'ready') return <Redirect href="/(worker)/home" />;
  if (state.phase === 'worker_selection')
    return <Redirect href="/(auth)/select-worker" />;
  if (state.phase === 'code_sent') return <Redirect href="/(auth)/verify" />;
  return (
    <AuthPage
      header={<BrandHeader showLanguage />}
      headerGap={88}
      contentGap={0}
    >
      <Stack.Screen
        options={{ title: translate('signIn'), headerShown: false }}
      />
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 36,
          lineHeight: 42,
          fontWeight: '700',
          color: tokens.colors.text,
        }}
      >
        {translate('reference.signInTitle')}
      </Text>
      <View style={{ marginTop: 24, marginBottom: 36 }}>
        <Body>{translate('reference.signInIntro')}</Body>
      </View>
      <View style={{ gap: 20 }}>
        <Controller
          control={control}
          name="phone"
          render={({ field: { value, onChange, onBlur } }) => (
            <Field
              label={translate('phone')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              autoCapitalize="none"
              placeholder="+52 55 1000 0001"
              editable={!state.busy}
              error={
                errors.phone ? translate('errors.invalid_phone') : undefined
              }
            />
          )}
        />
        <Action
          label={translate('requestCode')}
          busy={state.busy}
          onPress={() => {
            void handleSubmit(async ({ phone }) => {
              await auth.perform(() => auth.requestOtp(phone));
            })();
          }}
        />
      </View>
      <View style={{ marginTop: 20 }}>
        <Body>{translate('reference.signInHelper')}</Body>
      </View>
      <ErrorNotice code={state.error} />
    </AuthPage>
  );
}
