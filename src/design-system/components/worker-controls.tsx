import { useState } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { tokens } from '../tokens';
import { Body } from './auth-controls';

export function SectionHeading({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}
export function StatusIndicator({ children }: PropsWithChildren) {
  return (
    <Text selectable accessibilityLiveRegion="polite" style={styles.status}>
      {children}
    </Text>
  );
}
export function WorkerAvatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return (
    <View accessible={false} style={styles.avatar}>
      <Text style={styles.initials}>{initials}</Text>
    </View>
  );
}
export function ListRow({
  title,
  detail,
  leading,
  onPress,
  label,
  disabled = false,
}: {
  title: string;
  detail?: string | undefined;
  leading?: ReactNode;
  onPress?: (() => void) | undefined;
  label?: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      {leading}
      <View style={styles.rowText}>
        <Text style={styles.label}>{title}</Text>
        {detail ? <Body>{detail}</Body> : null}
      </View>
      {onPress ? (
        <Text accessible={false} style={styles.chevron}>
          ›
        </Text>
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}
export function Disclosure({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  const [isExpanded, setExpanded] = useState(false);
  return (
    <View style={styles.disclosure}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: isExpanded }}
        onPress={() => setExpanded(!isExpanded)}
        style={styles.toggle}
      >
        <Text style={styles.label}>{title}</Text>
        <Text accessible={false}>{isExpanded ? '−' : '+'}</Text>
      </Pressable>
      {isExpanded ? <View style={styles.history}>{children}</View> : null}
    </View>
  );
}
export function BottomNavigation({
  selected,
  onNavigate,
  documentsEnabled,
}: {
  selected: 'home' | 'documents' | 'job';
  onNavigate(destination: 'home' | 'documents' | 'job'): void;
  documentsEnabled: boolean;
}) {
  const { t: translate } = useTranslation();
  const destinations = documentsEnabled
    ? (['home', 'documents', 'job'] as const)
    : (['home', 'job'] as const);
  return (
    <View style={styles.navigation}>
      {destinations.map((destination) => (
        <Pressable
          key={destination}
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === destination }}
          onPress={() => onNavigate(destination)}
          style={[styles.tab, selected === destination && styles.activeTab]}
        >
          <Text
            style={[
              styles.tabLabel,
              selected === destination && styles.activeLabel,
            ]}
          >
            {translate(`ui.nav.${destination}`)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', color: tokens.colors.text },
  status: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.information,
  },
  initials: { fontSize: 16, fontWeight: '700', color: tokens.colors.primary },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
  },
  rowText: { flex: 1, gap: 4 },
  label: { fontSize: 16, fontWeight: '600', color: tokens.colors.text },
  chevron: { fontSize: 24, color: tokens.colors.primary },
  pressed: { backgroundColor: tokens.colors.information },
  disclosure: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
  },
  toggle: {
    minHeight: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  history: { gap: 16, paddingBottom: 16 },
  navigation: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: tokens.colors.border,
    paddingTop: 8,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  activeTab: { backgroundColor: tokens.colors.information, borderRadius: 8 },
  tabLabel: { fontSize: 14, color: tokens.colors.muted, textAlign: 'center' },
  activeLabel: { color: tokens.colors.primary, fontWeight: '700' },
});
