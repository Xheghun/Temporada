import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { tokens } from '../tokens';
import { LanguageControl } from '../../core/i18n/language-control';
export function AuthPage({
  children,
  footer,
  headerTrailing,
}: PropsWithChildren<{ footer?: ReactNode; headerTrailing?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.page,
        { paddingTop: insets.top, paddingBottom: footer ? 0 : insets.bottom },
      ]}
    >
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(16 - insets.top, 0),
            paddingBottom: 24,
          },
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <Text style={styles.brand}>Temporada</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <LanguageControl />
            {headerTrailing}
          </View>
        </View>
        <View style={styles.stack}>{children}</View>
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: 8,
            paddingBottom: Math.max(insets.bottom, 8),
            backgroundColor: tokens.colors.background,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
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
  highlighted = false,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  highlighted?: boolean;
}) {
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        highlighted && {
          backgroundColor: tokens.colors.highlighted,
          borderWidth: 0,
        },
        (disabled || busy) && { opacity: 0.65 },
        pressed &&
          !disabled &&
          !busy && {
            backgroundColor: secondary
              ? tokens.colors.secondaryPressed
              : tokens.colors.primaryPressed,
          },
      ]}
    >
      {busy ? (
        <ActivityIndicator
          accessible={false}
          importantForAccessibility="no"
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
      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={error ?? props.accessibilityHint}
        style={styles.input}
      />
      {error ? (
        <Text
          selectable
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
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
    <Text
      selectable
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={styles.error}
    >
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
    fontWeight: '700',
  },
  stack: { gap: 24 },
  heading: { color: tokens.colors.text, fontSize: 28, fontWeight: '700' },
  body: { fontSize: 16, color: tokens.colors.muted, lineHeight: 24 },
  label: { color: tokens.colors.text, fontSize: 16, fontWeight: '600' },
  input: {
    minHeight: 56,
    fontSize: 18,
    color: tokens.colors.text,
    borderWidth: 1,
    borderColor: tokens.colors.muted,
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  button: {
    minHeight: 56,
    padding: 16,
    backgroundColor: tokens.colors.primary,
    borderRadius: 8,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flexShrink: 1,
    textAlign: 'center',
  },
  error: { color: tokens.colors.error, fontSize: 16, lineHeight: 25 },
});
