import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { BrandHeader } from './screen-chrome';
export function AuthPage({
  children,
  footer,
  headerTrailing,
  header,
  contentGap = 24,
  headerGap = 28,
}: PropsWithChildren<{
  footer?: ReactNode;
  headerTrailing?: ReactNode;
  header?: ReactNode;
  contentGap?: number;
  headerGap?: number;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            paddingTop: 36,
            gap: headerGap,
            paddingBottom: 24,
          },
        ]}
      >
        {header ?? <BrandHeader showLanguage trailing={headerTrailing} />}
        <View style={[styles.stack, { gap: contentGap }]}>{children}</View>
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: 0,
            paddingBottom: Math.max(insets.bottom, 8),
            backgroundColor: tokens.colors.background,
          }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
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
  arrow = false,
  compact = false,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  highlighted?: boolean;
  arrow?: boolean;
  compact?: boolean;
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
        compact && { minHeight: 48, paddingVertical: 12 },
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
          color={secondary || highlighted ? tokens.colors.primary : '#FFFFFF'}
        />
      ) : null}
      <Text
        style={[
          styles.buttonText,
          (secondary || highlighted) && { color: tokens.colors.primary },
          arrow && { textAlign: 'left', flex: 1 },
          compact && { fontSize: 14, lineHeight: 20 },
        ]}
      >
        {label}
      </Text>
      {arrow ? (
        <Text
          accessible={false}
          style={{
            fontSize: 22,
            lineHeight: 22,
            color: secondary || highlighted ? tokens.colors.primary : '#FFFFFF',
          }}
        >
          ↗
        </Text>
      ) : null}
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
        style={[styles.input, props.style]}
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
  heading: {
    color: tokens.colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
  },
  body: { fontSize: 14, color: tokens.colors.muted, lineHeight: 22 },
  label: {
    color: tokens.colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  input: {
    minHeight: 56,
    fontSize: 18,
    color: tokens.colors.text,
    borderWidth: 1,
    borderColor: tokens.colors.secondary,
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  button: {
    minHeight: 54,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: tokens.colors.primary,
    borderRadius: 10,
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
