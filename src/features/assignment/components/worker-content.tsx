import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AuthPage,
  Heading,
  Body,
  Action,
  ErrorNotice,
} from '../../../design-system/components/auth-controls';
import type { AssignmentState } from '../assignment-service';
import { assignmentFacts } from '../domain/view-state';
import {
  SectionHeading,
  ListRow,
  Disclosure,
  StatusIndicator,
  WorkerAvatar,
} from '../../../design-system/components/worker-controls';
import type { NextAction } from '../domain/next-action';
import { tokens } from '../../../design-system/tokens';
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
function Status({ text }: { text: string }) {
  return (
    <Text selectable accessibilityLiveRegion="polite" style={styles.status}>
      {text}
    </Text>
  );
}
export function CacheState({
  state,
  onRefresh,
}: {
  state: AssignmentState;
  onRefresh(): void;
}) {
  const { t: translate } = useTranslation();
  if (
    (!state.data?.assignment && state.loading) ||
    (!state.data?.assignment &&
      state.online &&
      !state.data?.refreshError &&
      !state.error)
  )
    return (
      <Card>
        <ActivityIndicator accessibilityLabel={translate('loading')} />
        <Body>{translate('home.loading')}</Body>
      </Card>
    );
  return (
    <Card>
      <Body>
        {translate(state.online ? 'home.noData' : 'home.noOfflineData')}
      </Body>
      <ErrorNotice code={state.error} />
      <Action
        label={translate('home.refresh')}
        busy={state.refreshing}
        onPress={onRefresh}
      />
    </Card>
  );
}
export function HomeContent({
  state,
  workerName,
  onTerms,
  onRefresh,
  onDocuments,
  onJob,
  onProfile,
  nextAction = 'refresh',
  documentRows = [],
  footer,
}: {
  state: AssignmentState;
  workerName: string;
  onTerms(): void;
  onRefresh(): void;
  onDocuments?: (() => void) | undefined;
  onJob?: (() => void) | undefined;
  onProfile?: (() => void) | undefined;
  nextAction?: NextAction;
  documentRows?: { title: string; status: string }[];
  footer?: React.ReactNode;
}) {
  const { t: translate } = useTranslation();
  const assignment = state.data?.assignment;
  const needsDocuments = ['correction', 'missing', 'failed'].includes(
    nextAction,
  );
  const onNext =
    nextAction === 'terms'
      ? onTerms
      : needsDocuments
        ? onDocuments
        : nextAction === 'refresh'
          ? onRefresh
          : undefined;
  return (
    <AuthPage
      footer={footer}
      headerTrailing={
        onProfile ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('ui.profile')}
            onPress={onProfile}
          >
            <WorkerAvatar name={workerName} />
          </Pressable>
        ) : null
      }
    >
      <Heading>{translate('ui.greeting', { name: workerName })}</Heading>
      <Body>{translate('ui.subtitle')}</Body>
      {!state.online ? (
        <StatusIndicator>{translate('home.offline')}</StatusIndicator>
      ) : null}
      <ErrorNotice code={state.error} />
      {assignment ? (
        <>
          <View style={styles.featured}>
            <Text accessibilityRole="header" style={styles.featuredTitle}>
              {translate(`ui.next.${nextAction}`)}
            </Text>
            <Text style={styles.featuredBody}>
              {translate(
                needsDocuments
                  ? 'ui.next.documentsHint'
                  : `ui.next.${nextAction}Hint`,
              )}
            </Text>
            {onNext ? (
              <Action
                label={translate(
                  nextAction === 'terms'
                    ? 'ui.reviewTerms'
                    : needsDocuments
                      ? 'home.openDocuments'
                      : 'home.refresh',
                )}
                onPress={onNext}
                busy={nextAction === 'refresh' && state.refreshing}
                highlighted
                secondary
              />
            ) : null}
          </View>
          <View>
            <SectionHeading>{translate('home.documents')}</SectionHeading>
            {documentRows.map((document, index) => (
              <ListRow
                key={index}
                title={document.title}
                detail={document.status}
                onPress={onDocuments}
              />
            ))}
            {!onDocuments ? (
              <Body>{translate('home.documentsUnavailable')}</Body>
            ) : null}
          </View>
          <View>
            <SectionHeading>{translate('ui.job')}</SectionHeading>
            <ListRow
              title={assignment.assignment.employer}
              detail={assignment.assignment.worksite}
              onPress={onJob}
            />
          </View>
          {state.data?.refreshNeeded ? (
            <Body>
              {translate(
                state.data.refreshError
                  ? 'home.refreshFailed'
                  : 'home.refreshPending',
              )}
            </Body>
          ) : null}
        </>
      ) : (
        <CacheState state={state} onRefresh={onRefresh} />
      )}
    </AuthPage>
  );
}
export function TermsContent({
  state,
  onConfirm,
  onRefresh,
  onHome,
}: {
  state: AssignmentState;
  onConfirm(
    version: string,
    generation: number,
    replacesActionId?: string,
  ): void;
  onRefresh(): void;
  onHome(): void;
}) {
  const { t: translate, i18n } = useTranslation();
  const data = state.data,
    assignment = data?.assignment;
  if (!assignment || !data)
    return (
      <AuthPage>
        <Heading>{translate('home.terms')}</Heading>
        <CacheState state={state} onRefresh={onRefresh} />
        <Action
          secondary
          label={translate('terms.backHome')}
          onPress={onHome}
        />
      </AuthPage>
    );
  const facts = assignmentFacts(data),
    language = i18n.resolvedLanguage === 'en' ? 'en' : 'es';
  const staleVersions = [
    ...new Set(
      data.actions
        .filter(
          (action) =>
            action.status === 'stale' &&
            action.payload.kind === 'terms_acceptance',
        )
        .map((action) =>
          action.payload.kind === 'terms_acceptance'
            ? action.payload.termsVersionId
            : '',
        ),
    ),
  ];
  return (
    <AuthPage>
      <Heading>{translate('home.terms')}</Heading>
      <Body>
        {translate('terms.version', {
          version: assignment.terms.termsVersionId,
        })}
      </Body>
      <Status text={translate(`terms.status.${facts.termsStatus}`)} />
      <Body>{translate('ui.termsExplanation')}</Body>
      <Body>{assignment.terms.summary[language]}</Body>
      {facts.needsReconfirmation ? (
        <Body>{translate('terms.reconfirm')}</Body>
      ) : null}
      {facts.termsStatus === 'update_required' ? (
        <Body>{translate('terms.updateRequired')}</Body>
      ) : null}
      {facts.termsStatus === 'failed' || facts.replacementActionId ? (
        <Body>{translate('terms.failedHint')}</Body>
      ) : null}
      <ErrorNotice code={state.error} />
      <Action
        label={translate(
          facts.replacementActionId
            ? 'terms.replaceFailed'
            : facts.needsReconfirmation
              ? 'terms.confirmNew'
              : 'terms.confirm',
          { version: assignment.terms.termsVersionId },
        )}
        disabled={!facts.canConfirm || state.generation === null}
        busy={state.saving}
        onPress={() => {
          if (state.generation !== null)
            onConfirm(
              assignment.terms.termsVersionId,
              state.generation,
              facts.replacementActionId ?? undefined,
            );
        }}
      />
      {data.refreshNeeded ||
      facts.termsStatus === 'update_required' ||
      facts.termsStatus === 'failed' ? (
        <Action
          secondary
          label={translate('home.refresh')}
          busy={state.refreshing}
          onPress={onRefresh}
        />
      ) : null}
      {staleVersions.length ? (
        <Disclosure
          key={`${state.workerId}:${state.generation}`}
          title={translate('terms.history')}
        >
          {staleVersions.map((version) => (
            <Body key={version}>
              {translate('terms.staleHistory', { version })}
            </Body>
          ))}
        </Disclosure>
      ) : null}
      <Action secondary label={translate('terms.backHome')} onPress={onHome} />
    </AuthPage>
  );
}
const styles = StyleSheet.create({
  featured: {
    padding: 24,
    gap: 16,
    borderRadius: 12,
    backgroundColor: tokens.colors.primary,
  },
  featuredTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  featuredBody: { fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
  card: {
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
  },
  section: { fontSize: 21, fontWeight: '700', color: tokens.colors.text },
  overline: { fontSize: 16, fontWeight: '600', color: tokens.colors.muted },
  status: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    color: tokens.colors.primary,
  },
});
