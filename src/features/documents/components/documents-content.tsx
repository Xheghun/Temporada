import { Text, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AuthPage,
  Heading,
  Body,
  Action,
  ErrorNotice,
} from '../../../design-system/components/auth-controls';
import { tokens } from '../../../design-system/tokens';
import { documentViews } from '../domain/document-view';
import type { DocumentsState } from '../documents-service';
import type { SubmissionView } from '../domain/document-view';
export function DocumentsContent({
  state,
  onRefresh,
  onHome,
  onCapture,
}: {
  state: DocumentsState;
  onRefresh(): void;
  onHome(): void;
  onCapture?:
    | ((documentType: string, expectedSubmissionId: string | null) => void)
    | undefined;
}) {
  const { t: translate, i18n } = useTranslation();
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'es';
  const documents = state.data ? documentViews(state.data) : [];
  return (
    <AuthPage>
      <Heading>{translate('documents.title')}</Heading>
      <Body>
        {translate(state.online ? 'home.connectionAvailable' : 'home.offline')}
      </Body>
      <ErrorNotice code={state.error} />
      {state.loading ? (
        <Body>{translate('home.loading')}</Body>
      ) : !state.data?.assignment ? (
        <Body>
          {translate(state.online ? 'home.noData' : 'home.noOfflineData')}
        </Body>
      ) : !documents.length ? (
        <Body>{translate('documents.empty')}</Body>
      ) : null}
      {state.data?.refreshNeeded ? (
        <Body>
          {translate(
            state.data.refreshError
              ? 'home.refreshFailed'
              : 'home.refreshPending',
          )}
        </Body>
      ) : null}
      {documents.map((document) => (
        <View key={document.documentType} style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {document.label[language]}
          </Text>
          <Body>
            {translate(
              document.required ? 'documents.required' : 'documents.optional',
            )}
          </Body>
          <Text style={styles.status}>
            {translate(
              `documents.status.${document.current?.status ?? 'not_submitted'}`,
            )}
          </Text>
          {document.current ? (
            <SubmissionDetails submission={document.current} />
          ) : null}
          {document.canSubmit ? (
            <>
              {!onCapture ? (
                <Body>{translate('documents.captureUnavailable')}</Body>
              ) : null}
              <Action
                disabled={!onCapture}
                label={translate(
                  onCapture
                    ? document.current
                      ? 'capture.replaceDocument'
                      : 'capture.addDocument'
                    : document.current
                      ? 'documents.replace'
                      : 'documents.add',
                )}
                onPress={() =>
                  onCapture?.(
                    document.documentType,
                    document.current?.id ?? null,
                  )
                }
              />
            </>
          ) : null}
          {document.history.length ? (
            <View style={styles.history}>
              <Text accessibilityRole="header" style={styles.title}>
                {translate('documents.history')}
              </Text>
              {document.history.map((submission) => (
                <View key={submission.id} style={styles.historyItem}>
                  <Text style={styles.status}>
                    {translate(`documents.status.${submission.status}`)}
                  </Text>
                  <SubmissionDetails submission={submission} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
      <Action
        secondary
        label={translate('home.refresh')}
        busy={state.refreshing}
        onPress={onRefresh}
      />
      <Action secondary label={translate('terms.backHome')} onPress={onHome} />
    </AuthPage>
  );
}
function SubmissionDetails({ submission }: { submission: SubmissionView }) {
  const { t: translate } = useTranslation();
  return (
    <>
      {submission.delivery &&
      ['queued', 'sending', 'retry_wait'].includes(submission.delivery) ? (
        <Body>{translate('documents.deliveryPending')}</Body>
      ) : null}
      {submission.delivery === 'failed_permanent' ? (
        <Body>
          {translate(
            [
              'local_file_missing',
              'local_file_changed',
              'local_file_unreadable',
              'file_ownership_invalid',
            ].includes(submission.errorCode ?? '')
              ? `errors.${submission.errorCode}`
              : submission.errorCode === 'upload_too_large'
                ? 'documents.sizeError'
                : submission.errorCode === 'invalid_upload' ||
                    submission.errorCode === 'unknown_document_type'
                  ? 'documents.validationError'
                  : 'documents.failedError',
          )}
        </Body>
      ) : null}
      {submission.correctionReason ? (
        <Body>
          {translate('documents.reason', {
            reason: submission.correctionReason,
          })}
        </Body>
      ) : null}
    </>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
  },
  title: { fontSize: 21, fontWeight: '700', color: tokens.colors.text },
  status: { fontSize: 18, fontWeight: '700', color: tokens.colors.text },
  history: {
    gap: 12,
    borderTopWidth: 1,
    borderColor: tokens.colors.border,
    paddingTop: 16,
  },
  historyItem: { gap: 8 },
});
