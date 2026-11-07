import { createContext, useContext, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { tokens } from '../../design-system/tokens';
export const LanguagePreferenceContext = createContext<
  ((language: 'en' | 'es') => Promise<void>) | null
>(null);
export function LanguageControl() {
  const savePreference = useContext(LanguagePreferenceContext);
  const { t: translate, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [hasError, setError] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate('ui.language')}
        accessibilityState={{ disabled: busy || !savePreference }}
        disabled={busy || !savePreference}
        style={{
          minHeight: 48,
          justifyContent: 'center',
          paddingHorizontal: 8,
        }}
        onPress={() => {
          if (!savePreference) return;
          setBusy(true);
          setError(false);
          void savePreference(i18n.resolvedLanguage === 'es' ? 'en' : 'es')
            .catch(() => setError(true))
            .finally(() => setBusy(false));
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: tokens.colors.primary,
          }}
        >
          {i18n.resolvedLanguage === 'es' ? 'English' : 'Español'}
        </Text>
      </Pressable>
      {hasError ? (
        <Text accessibilityRole="alert" style={{ color: tokens.colors.error }}>
          {translate('errors.language_failed')}
        </Text>
      ) : null}
    </View>
  );
}
