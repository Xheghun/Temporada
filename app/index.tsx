import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/design-system/tokens';

export default function ScaffoldScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, tokens.spacing.page) },
      ]}
    >
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          Bienvenido
        </Text>
        <Text selectable style={styles.body}>
          Aplicación para trabajadores de temporada.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  content: { padding: tokens.spacing.page, gap: tokens.spacing.large },
  card: {
    padding: tokens.spacing.large,
    gap: tokens.spacing.medium,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  title: {
    fontSize: tokens.typography.title,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  body: { fontSize: tokens.typography.body, color: tokens.colors.muted },
});
