import type { ReactNode } from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AuthPage,
  Heading,
  Body,
  ErrorNotice,
} from '../../../design-system/components/auth-controls';
import {
  ContextHeader,
  Eyebrow,
  InformationPanel,
  TextAction,
} from '../../../design-system/components/screen-chrome';
import { Disclosure } from '../../../design-system/components/worker-controls';
import { tokens } from '../../../design-system/tokens';
import {
  documentViews,
  documentPresentationFacts,
  submissionStatusKey,
} from '../domain/document-view';
import type { SubmissionView } from '../domain/document-view';
import type { DocumentsState } from '../documents-service';
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
  const language = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const documents = state.data ? documentViews(state.data) : [];
  const required = documentPresentationFacts(documents).filter(
      (document) => document.required,
    ),
    sent = required.filter((document) => document.isSent).length;
  return (
    <AuthPage
      contentGap={0}
      headerGap={24}
      footer={footer}
      header={
        <ContextHeader
          context={translate('reference.context.documents')}
          onBack={onHome}
        />
      }
    >
      <Heading>{translate('documents.title')}</Heading>
      <View style={{ marginTop: 12, minHeight: 44 }}>
        <Body>{translate('ui.documentsIntro')}</Body>
      </View>
      {state.data?.assignment ? (
        <View style={styles.summary}>
          <Eyebrow>{translate('reference.submitted')}</Eyebrow>
          <View style={styles.countRow}>
            <Text
              accessibilityLabel={translate('ui.sentCount', {
                sent,
                total: required.length,
              })}
              style={styles.count}
            >
              {sent} / {required.length}
            </Text>
            <View style={{ flex: 1 }}>
              <Body>
                {translate('reference.sentExplanation', {
                  remaining: required.length - sent,
                })}
              </Body>
            </View>
          </View>
        </View>
      ) : null}
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
      <View style={{ marginTop: 20 }}>
        {documents.map((document, index) => {
          const actionLabel = translate(
            onCapture
              ? document.current
                ? 'capture.replaceDocument'
                : 'capture.addDocument'
              : document.current
                ? 'documents.replace'
                : 'documents.add',
          );
          const row = (
            <>
              <Text style={styles.number}>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text accessibilityRole="header" style={styles.title}>
                  {document.label[language]}
                </Text>
                <Text
                  selectable
                  accessibilityLiveRegion="polite"
                  style={styles.status}
                >
                  {translate(submissionStatusKey(document.current))}
                </Text>
              </View>
              <Text accessible={false} style={styles.cue}>
                {document.canSubmit ? '↗' : '✓'}
              </Text>
            </>
          );
          return (
            <View
              key={`${state.workerId}:${state.generation}:${document.documentType}`}
              style={styles.document}
            >
              {document.canSubmit ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={actionLabel}
                  accessibilityState={{ disabled: !onCapture }}
                  disabled={!onCapture}
                  onPress={() =>
                    onCapture?.(
                      document.documentType,
                      document.current?.id ?? null,
                    )
                  }
                  style={styles.row}
                >
                  {row}
                </Pressable>
              ) : (
                <View style={styles.row}>{row}</View>
              )}
              {document.current ? (
                <View style={{ gap: 8, paddingLeft: 34 }}>
                  <SubmissionDetails submission={document.current} />
                </View>
              ) : null}
              {document.canSubmit && !onCapture ? (
                <Body>{translate('documents.captureUnavailable')}</Body>
              ) : null}
              {document.history.length ? (
                <Disclosure title={translate('documents.history')}>
                  {document.history.map((submission) => (
                    <View key={submission.id} style={{ gap: 8 }}>
                      <Text style={styles.status}>
                        {translate(`documents.status.${submission.status}`)}
                      </Text>
                      <SubmissionDetails submission={submission} />
                    </View>
                  ))}
                </Disclosure>
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={{ marginTop: 20 }}>
        <InformationPanel>
          <Text style={styles.noteTitle}>
            {translate('reference.offlineTitle')}
          </Text>
          <Body>{translate('reference.documentsOffline')}</Body>
        </InformationPanel>
      </View>
      <TextAction
        disabled={state.refreshing}
        label={translate('home.refresh')}
        onPress={onRefresh}
      />
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
  summary: {
    marginTop: 28,
    paddingBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
    gap: 16,
  },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  count: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  document: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
  },
  row: {
    minHeight: 74,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  number: { width: 20, fontSize: 12, color: tokens.colors.secondary },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  status: { fontSize: 12, lineHeight: 18, color: tokens.colors.secondary },
  cue: { fontSize: 22, fontWeight: '700', color: tokens.colors.secondary },
  noteTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
});
