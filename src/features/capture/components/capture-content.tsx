import { Image } from 'expo-image';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AuthPage,
  Heading,
  Body,
  Action,
  ErrorNotice,
} from '../../../design-system/components/auth-controls';
import {
  ContextHeader,
  InformationPanel,
  TextAction,
} from '../../../design-system/components/screen-chrome';
import { StatusIndicator } from '../../../design-system/components/worker-controls';
import { tokens } from '../../../design-system/tokens';
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
  label: string;
  onChoose(source: 'camera' | 'gallery'): void;
  onSave(): void;
  onBack(): void;
  onSettings(): void;
  savedStatus?: string | undefined;
}) {
  const { t: translate } = useTranslation();
  const { height } = useWindowDimensions();
  const placeholderHeight = height < 750 ? 180 : 240;
  const busy = ['choosing', 'preparing', 'saving'].includes(state.phase);
  return (
    <AuthPage
      contentGap={0}
      headerGap={24}
      header={
        <ContextHeader
          context={translate('reference.context.capture')}
          onBack={onBack}
        />
      }
    >
      <Heading>{label}</Heading>
      <View style={{ marginTop: 12 }}>
        <Body>{translate('reference.captureGuidance')}</Body>
      </View>
      <ErrorNotice code={state.error} />
      {busy ? (
        <View style={{ marginTop: 16, gap: 8 }}>
          <ActivityIndicator
            accessibilityLabel={translate(`capture.${state.phase}`)}
          />
          <Body>{translate(`capture.${state.phase}`)}</Body>
        </View>
      ) : null}
      {state.phase === 'saved' ? (
        <View style={{ gap: 20, marginTop: 28 }}>
          <InformationPanel>
            <StatusIndicator>
              {savedStatus ?? translate('capture.saved')}
            </StatusIndicator>
          </InformationPanel>
          <Action label={translate('capture.back')} onPress={onBack} />
        </View>
      ) : (
        <>
          <View style={{ marginTop: 28 }}>
            {state.preview ? (
              <Image
                accessible
                accessibilityRole="image"
                source={{ uri: state.preview.uri }}
                recyclingKey={state.preview.uri}
                cachePolicy="none"
                contentFit="contain"
                accessibilityLabel={translate('capture.preview')}
                style={{ width: '100%', height: placeholderHeight }}
              />
            ) : (
              <View style={[styles.empty, { minHeight: placeholderHeight }]}>
                <View accessible={false} style={styles.document}>
                  {[0, 1, 2, 3].map((line) => (
                    <View
                      key={line}
                      style={{
                        height: 2,
                        backgroundColor: '#63806C',
                        width: line > 1 ? '65%' : '100%',
                      }}
                    />
                  ))}
                </View>
                <Text style={styles.emptyTitle}>
                  {translate('reference.choosePhoto')}
                </Text>
                <Text style={styles.helper}>
                  {translate('reference.photoHelper')}
                </Text>
              </View>
            )}
          </View>
          <View style={{ gap: 16, marginTop: 16 }}>
            {state.preview ? (
              <Action
                label={translate('capture.save')}
                busy={state.phase === 'saving'}
                disabled={busy}
                onPress={onSave}
              />
            ) : null}
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
          </View>
          <View style={{ marginTop: 20 }}>
            <InformationPanel>
              <Body>{translate('reference.photoStorage')}</Body>
            </InformationPanel>
          </View>
          {state.error === 'capture_camera_denied' ? (
            <TextAction
              label={translate('capture.settings')}
              onPress={onSettings}
            />
          ) : null}
          <TextAction label={translate('capture.back')} onPress={onBack} />
        </>
      )}
    </AuthPage>
  );
}
const styles = StyleSheet.create({
  empty: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#8D9F8B',
    borderRadius: 16,
    backgroundColor: tokens.colors.information,
  },
  document: {
    width: 42,
    height: 62,
    borderWidth: 2,
    borderColor: '#63806C',
    borderRadius: 4,
    padding: 8,
    gap: 8,
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  helper: {
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.secondary,
    textAlign: 'center',
  },
});
