import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { tokens } from '../tokens';
import { LanguageControl } from '../../core/i18n/language-control';

export function Wordmark() {
  return (
    <Text accessibilityLabel="Temporada" style={styles.wordmark}>
      temporada<Text style={{ color: tokens.colors.accent }}>.</Text>
    </Text>
  );
}
export function BrandHeader({
  context,
  trailing,
  showLanguage = false,
}: {
  context?: string;
  trailing?: ReactNode;
  showLanguage?: boolean;
}) {
  return (
    <View style={styles.header}>
      <Wordmark />
      {context ? (
        <Text style={styles.context}>{context}</Text>
      ) : (
        <View style={styles.trailing}>
          {showLanguage ? <LanguageControl /> : null}
          {trailing}
        </View>
      )}
    </View>
  );
}
export function ContextHeader({
  context,
  onBack,
  disabled = false,
}: {
  context: string;
  onBack(): void;
  disabled?: boolean;
}) {
  const { t: translate } = useTranslation();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate('ui.back')}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onBack}
        style={styles.back}
      >
        <Text accessible={false} style={styles.arrow}>
          ←
        </Text>
      </Pressable>
      <Text style={[styles.context, styles.center]}>{context}</Text>
      <View style={styles.back} />
    </View>
  );
}
export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}
export function InformationPanel({ children }: PropsWithChildren) {
  return <View style={styles.information}>{children}</View>;
}
export function OutlineIcon({
  kind,
  color = tokens.colors.primary,
}: {
  kind: 'home' | 'documents' | 'job';
  color?: string;
}) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.icon}
    >
      {kind === 'home' ? (
        <>
          <View style={[styles.roof, { borderColor: color }]} />
          <View style={[styles.house, { borderColor: color }]} />
        </>
      ) : kind === 'job' ? (
        <View style={[styles.diamond, { borderColor: color }]} />
      ) : (
        <View style={[styles.document, { borderColor: color }]}>
          {[0, 1, 2, 3].map((line) => (
            <View key={line} style={{ height: 1, backgroundColor: color }} />
          ))}
        </View>
      )}
    </View>
  );
}
export function TextAction({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 48, justifyContent: 'center' }}
    >
      <Text
        style={{
          fontSize: 12,
          lineHeight: 18,
          fontWeight: '700',
          color: tokens.colors.primary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  wordmark: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: tokens.colors.text,
  },
  context: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: tokens.colors.secondary,
    flexShrink: 1,
  },
  center: { flex: 1, textAlign: 'center' },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { width: 48, minHeight: 48, justifyContent: 'center' },
  arrow: { fontSize: 25, color: tokens.colors.text },
  eyebrow: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: tokens.colors.secondary,
  },
  information: {
    padding: 16,
    gap: 4,
    borderRadius: 12,
    backgroundColor: tokens.colors.information,
  },
  icon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roof: {
    position: 'absolute',
    top: 1,
    width: 10,
    height: 10,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  house: {
    position: 'absolute',
    bottom: 1,
    width: 10,
    height: 9,
    borderWidth: 1,
    borderTopWidth: 0,
  },
  diamond: {
    width: 13,
    height: 13,
    borderWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  document: { width: 14, height: 16, borderWidth: 1.5, padding: 2, gap: 2 },
});
