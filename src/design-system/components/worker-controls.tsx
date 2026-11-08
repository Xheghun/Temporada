import { OutlineIcon } from './screen-chrome';
import { useState } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { tokens } from '../tokens';

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
export function WorkerAvatar({
  name,
  size = 36,
}: {
  name: string;
  size?: number;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return (
    <View
      accessible={false}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
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
  number,
  outlined = false,
}: {
  title: string;
  detail?: string | undefined;
  leading?: ReactNode;
  onPress?: (() => void) | undefined;
  label?: string;
  disabled?: boolean;
  number?: number;
  outlined?: boolean;
}) {
  const content = (
    <>
      {number !== undefined ? (
        <Text style={styles.number}>{String(number).padStart(2, '0')}</Text>
      ) : null}
      {leading}
      <View style={styles.rowText}>
        <Text style={styles.label}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
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
      style={({ pressed }) => [
        styles.row,
        outlined && styles.outlined,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[styles.row, outlined && styles.outlined]}>{content}</View>
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
          style={styles.tab}
        >
          <OutlineIcon
            kind={destination}
            color={
              selected === destination
                ? tokens.colors.primary
                : tokens.colors.secondary
            }
          />
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
  heading: { fontSize: 21, fontWeight: '700', color: tokens.colors.text },
  status: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5EAE0',
  },
  initials: { fontSize: 16, fontWeight: '700', color: tokens.colors.primary },
  row: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
  },
  rowText: { flex: 1, gap: 4 },
  detail: { fontSize: 12, lineHeight: 18, color: tokens.colors.secondary },
  number: { width: 20, fontSize: 12, color: tokens.colors.secondary },
  outlined: {
    borderWidth: 1,
    borderRadius: 12,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: 16,
    minHeight: 84,
  },
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
    paddingTop: 0,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },

  tabLabel: { fontSize: 12, color: tokens.colors.muted, textAlign: 'center' },
  activeLabel: { color: tokens.colors.primary, fontWeight: '700' },
});
