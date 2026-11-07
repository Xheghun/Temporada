import { StatusIndicator } from '../../../design-system/components/worker-controls';
import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AuthPage,
  Heading,
  Body,
  Action,
  ErrorNotice,
} from '../../../design-system/components/auth-controls';
import type { CaptureState } from '../capture-service';
export function CaptureContent({
  state,
  label,
  onChoose,
  onSave,
  onBack,
  onSettings,
  savedStatus,
}: {
  state: CaptureState;
  savedStatus?: string | undefined;
  label: string;
  onChoose(source: 'camera' | 'gallery'): void;
  onSave(): void;
  onBack(): void;
  onSettings(): void;
}) {
  const { t: translate } = useTranslation();
  const busy = ['choosing', 'preparing', 'saving'].includes(state.phase);
  return (
    <AuthPage>
      <Heading>{label}</Heading>
      <Body>{translate('capture.guidance')}</Body>
      <ErrorNotice code={state.error} />
      {busy ? (
        <>
          <ActivityIndicator
            accessibilityLabel={translate(`capture.${state.phase}`)}
          />
          <Body>{translate(`capture.${state.phase}`)}</Body>
        </>
      ) : null}
      {state.phase === 'saved' ? (
        <>
          <StatusIndicator>
            {savedStatus ?? translate('capture.saved')}
          </StatusIndicator>
          <Action label={translate('capture.back')} onPress={onBack} />
        </>
      ) : (
        <>
          {state.preview ? (
            <>
              <Image
                accessible
                accessibilityRole="image"
                source={{ uri: state.preview.uri }}
                recyclingKey={state.preview.uri}
                cachePolicy="none"
                contentFit="contain"
                accessibilityLabel={translate('capture.preview')}
                style={styles.preview}
              />

              <Action
                label={translate('capture.save')}
                busy={state.phase === 'saving'}
                disabled={busy}
                onPress={onSave}
              />
            </>
          ) : (
            <View style={styles.empty}>
              <Body>{translate('ui.photoEmpty')}</Body>
            </View>
          )}
          <Action
            label={translate(
              state.preview ? 'capture.retake' : 'capture.camera',
            )}
            secondary={!!state.preview}
            disabled={busy || !state.selection}
            onPress={() => onChoose('camera')}
          />
          <Action
            secondary
            label={translate('capture.gallery')}
            disabled={busy || !state.selection}
            onPress={() => onChoose('gallery')}
          />
          {state.error === 'capture_camera_denied' ? (
            <Action
              secondary
              label={translate('capture.settings')}
              onPress={onSettings}
            />
          ) : null}
          <Action
            secondary
            label={translate('capture.back')}
            onPress={onBack}
          />
        </>
      )}
    </AuthPage>
  );
}
const styles = StyleSheet.create({
  empty: {
    minHeight: 140,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#EFEEE5',
    borderRadius: 8,
  },
  preview: { width: '100%', aspectRatio: 0.8, maxHeight: 280 },
});
