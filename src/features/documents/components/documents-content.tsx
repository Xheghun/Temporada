import type { ReactNode } from 'react';
import { Disclosure } from '../../../design-system/components/worker-controls';
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
import {
  documentViews,
  documentPresentationFacts,
  submissionStatusKey,
} from '../domain/document-view';
import type { DocumentsState } from '../documents-service';
import type { SubmissionView } from '../domain/document-view';
export function DocumentsContent({
  state,
  onRefresh,
  onHome,
  onCapture,
  footer,
}: {
  state: DocumentsState;
  footer?: ReactNode;
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
    <AuthPage footer={footer}>
      <Heading>{translate('documents.title')}</Heading>
      <View style={{ gap: 8 }}>
        <Body>{translate('ui.documentsIntro')}</Body>
        {!state.online ? <Body>{translate('home.offline')}</Body> : null}
        {state.data?.assignment ? (
          <>
            <Body>
              {translate('ui.sentCount', {
                sent: documentPresentationFacts(documents).filter(
                  (document) => document.required && document.isSent,
                ).length,
                total: documents.filter((document) => document.required).length,
              })}
            </Body>
            <Text style={styles.helper}>{translate('ui.sentDefinition')}</Text>
          </>
        ) : null}
      </View>
      <ErrorNotice code={state.error} />
      {state.loading && !state.data?.assignment ? (
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
        <View
          key={`${state.workerId}:${state.generation}:${document.documentType}`}
          style={styles.card}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {document.label[language]}
          </Text>
          <Text style={styles.helper}>
            {translate(
              document.required ? 'documents.required' : 'documents.optional',
            )}
          </Text>
          <Text
            selectable
            accessibilityLiveRegion="polite"
            style={styles.status}
          >
            {translate(submissionStatusKey(document.current))}
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
                secondary
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
            <Disclosure title={translate('documents.history')}>
              {document.history.map((submission) => (
                <View key={submission.id} style={styles.historyItem}>
                  <Text style={styles.status}>
                    {translate(`documents.status.${submission.status}`)}
                  </Text>
                  <SubmissionDetails submission={submission} />
                </View>
              ))}
            </Disclosure>
          ) : null}
        </View>
      ))}
      <Action
        secondary
        label={translate('home.refresh')}
        busy={state.refreshing}
        onPress={onRefresh}
      />
      {!footer ? (
        <Action
          secondary
          label={translate('terms.backHome')}
          onPress={onHome}
        />
      ) : null}
    </AuthPage>
  );
}
function SubmissionDetails({ submission }: { submission: SubmissionView }) {
  const { t: translate } = useTranslation();
  return (
    <>
      {submission.delivery &&
      ['queued', 'sending', 'retry_wait'].includes(submission.delivery) &&
      ['approved', 'correction_requested'].includes(submission.status) ? (
        <Body>
          {translate(
            submission.delivery === 'sending'
              ? 'ui.sending'
              : submission.delivery === 'retry_wait'
                ? 'ui.retry'
                : 'ui.saved',
          )}
        </Body>
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
  helper: { fontSize: 14, lineHeight: 21, color: tokens.colors.muted },
  card: {
    paddingVertical: 20,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: tokens.colors.text },
  status: { fontSize: 14, fontWeight: '700', color: tokens.colors.text },
  history: {
    gap: 12,
    borderTopWidth: 1,
    borderColor: tokens.colors.border,
    paddingTop: 16,
  },
  historyItem: { gap: 8 },
});
