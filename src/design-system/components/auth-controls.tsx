import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ComponentProps, PropsWithChildren } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { tokens } from '../tokens';
export function AuthPage({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.page}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, 24) },
      ]}
    >
      <Text style={styles.brand}>Temporada</Text>
      <View style={styles.card}>{children}</View>
    </ScrollView>
  );
}
export function Heading({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}
export function Body({ children }: PropsWithChildren) {
  return (
    <Text selectable style={styles.body}>
      {children}
    </Text>
  );
}
export function Action({
  label,
  onPress,
  disabled = false,
  busy = false,
  secondary = false,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (disabled || busy || pressed) && { opacity: 0.65 },
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={secondary ? tokens.colors.primary : '#FFFFFF'}
        />
      ) : null}
      <Text
        style={[
          styles.buttonText,
          secondary && { color: tokens.colors.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: ComponentProps<typeof TextInput> & {
  label: string;
  error?: string | undefined;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} style={styles.input} />
      {error ? (
        <Text selectable accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
export function ErrorNotice({ code }: { code: string | null }) {
  const { t: translate, i18n } = useTranslation();
  if (!code) return null;
  const key = `errors.${code}`;
  return (
    <Text selectable accessibilityRole="alert" style={styles.error}>
      {translate(i18n.exists(key) ? key : 'errors.generic')}
    </Text>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colors.background },
  content: { padding: 24, gap: 24, flexGrow: 1 },
  brand: {
    color: tokens.colors.primary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 24,
    gap: 20,
  },
  heading: { color: tokens.colors.text, fontSize: 30, fontWeight: '700' },
  body: { fontSize: 18, color: tokens.colors.muted, lineHeight: 27 },
  label: { color: tokens.colors.text, fontSize: 17, fontWeight: '600' },
  input: {
    minHeight: 56,
    fontSize: 20,
    color: tokens.colors.text,
    borderWidth: 1,
    borderColor: tokens.colors.muted,
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  button: {
    minHeight: 56,
    padding: 16,
    backgroundColor: tokens.colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.primary,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flexShrink: 1,
    textAlign: 'center',
  },
  error: { color: '#9B2525', fontSize: 17, lineHeight: 25 },
});
