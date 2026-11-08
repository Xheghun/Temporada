import { HomeSyncSummary, HomeProgress } from './home-overview-content';
import { homeOverview, type HomeOverview } from '../domain/home-overview';
import { formatSeasonDate } from './season-date';
import {
  BrandHeader,
  ContextHeader,
  Eyebrow,
  InformationPanel,
  TextAction,
} from '../../../design-system/components/screen-chrome';
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
  WorkerAvatar,
} from '../../../design-system/components/worker-controls';
import type { NextAction } from '../domain/next-action';
import { tokens } from '../../../design-system/tokens';
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
function Status({
  text,
  needsAttention = false,
}: {
  text: string;
  needsAttention?: boolean;
}) {
  return (
    <Text
      selectable
      accessibilityLiveRegion="polite"
      style={[styles.status, needsAttention && { color: '#9B4E31' }]}
    >
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
  overview: suppliedOverview,
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
  overview?: HomeOverview;
  nextAction?: NextAction;
  documentRows?: { title: string; status: string }[];
  footer?: React.ReactNode;
}) {
  const { t: translate, i18n } = useTranslation();
  const language = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const locale = language === 'es' ? 'es-MX' : 'en-US';
  const overview =
    suppliedOverview ??
    homeOverview(state.error === 'local_data_error' ? null : state.data, null);
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
      contentGap={0}
      footer={footer}
      header={
        <BrandHeader
          showLanguage
          trailing={
            onProfile ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate('ui.profile')}
                onPress={onProfile}
                style={{
                  minWidth: 48,
                  minHeight: 48,
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                }}
              >
                <WorkerAvatar name={workerName} />
              </Pressable>
            ) : null
          }
        />
      }
    >
      <Heading>{translate('ui.greeting', { name: workerName })}</Heading>
      <View style={{ marginTop: 12 }}>
        <Body>{translate('ui.subtitle')}</Body>
      </View>
      <HomeSyncSummary
        online={state.online}
        overview={overview}
        loading={state.loading}
      />
      <ErrorNotice code={state.error} />
      {assignment ? (
        <>
          <View style={[styles.featured, { marginTop: 20 }]}>
            <Text style={styles.taskEyebrow}>
              {translate('reference.upNext')}
            </Text>
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
              <View style={{ marginTop: 8 }}>
                <Action
                  compact
                  arrow
                  highlighted
                  secondary
                  label={translate(
                    nextAction === 'terms'
                      ? 'ui.reviewTerms'
                      : needsDocuments
                        ? 'home.openDocuments'
                        : 'home.refresh',
                  )}
                  onPress={onNext}
                  busy={nextAction === 'refresh' && state.refreshing}
                />
              </View>
            ) : null}
          </View>
          <View style={{ marginTop: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                minHeight: 48,
              }}
            >
              <SectionHeading>
                {translate('reference.yourDocuments')}
              </SectionHeading>
              {onDocuments ? (
                <TextAction
                  label={translate('reference.viewAll')}
                  onPress={onDocuments}
                />
              ) : null}
            </View>
            {documentRows.map((document, index) => (
              <ListRow
                key={document.title}
                number={index + 1}
                title={document.title}
                detail={document.status}
                onPress={onDocuments}
              />
            ))}
            {!onDocuments ? (
              <Body>{translate('home.documentsUnavailable')}</Body>
            ) : null}
          </View>
          <View style={{ marginTop: 24 }}>
            <InformationPanel>
              <Eyebrow>{translate('ui.job')}</Eyebrow>
              <ListRow
                title={assignment.assignment.employer}
                detail={assignment.assignment.worksite}
                onPress={onJob}
              />
              <Body>
                {translate('home.season', {
                  start: formatSeasonDate(
                    assignment.assignment.seasonStart,
                    locale,
                  ),
                  end: formatSeasonDate(
                    assignment.assignment.seasonEnd,
                    locale,
                  ),
                })}
              </Body>
              <Body>
                {translate('home.order', { id: assignment.assignment.orderId })}
              </Body>
            </InformationPanel>
          </View>
          <View style={styles.termsSection}>
            <SectionHeading>{translate('home.terms')}</SectionHeading>
            <Body>
              {translate('terms.version', {
                version: assignment.terms.termsVersionId,
              })}
            </Body>
            <Body>
              {translate(
                overview.termsStatus
                  ? `terms.status.${overview.termsStatus}`
                  : 'home.progressUnavailable',
              )}
            </Body>
            <Body>{assignment.terms.summary[language]}</Body>
            <TextAction label={translate('home.openTerms')} onPress={onTerms} />
          </View>
          <HomeProgress overview={overview} />
          {state.data?.refreshNeeded ? (
            <View style={{ marginTop: 16 }}>
              <Body>
                {translate(
                  state.data.refreshError
                    ? 'home.refreshFailed'
                    : 'home.refreshPending',
                )}
              </Body>
            </View>
          ) : null}
        </>
      ) : (
        <View style={{ marginTop: 24 }}>
          <CacheState state={state} onRefresh={onRefresh} />
        </View>
      )}
    </AuthPage>
  );
}
export function TermsContent({
  state,
  onConfirm,
  onRefresh,
  onHome,
  onBack,
}: {
  state: AssignmentState;
  onConfirm(
    version: string,
    generation: number,
    replacesActionId?: string,
  ): void;
  onRefresh(): void;
  onHome(): void;
  onBack?: () => void;
}) {
  const { t: translate, i18n } = useTranslation();
  const data = state.data,
    assignment = data?.assignment;
  const header = (
    <ContextHeader
      context={translate('reference.context.terms')}
      onBack={onBack ?? onHome}
    />
  );
  if (!assignment || !data)
    return (
      <AuthPage header={header} headerGap={24} contentGap={0}>
        <Heading>{translate('reference.beforeBegin')}</Heading>
        <View style={{ marginTop: 24 }}>
          <CacheState state={state} onRefresh={onRefresh} />
        </View>
      </AuthPage>
    );
  const facts = assignmentFacts(data),
    language = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
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
    <AuthPage header={header} headerGap={24} contentGap={0}>
      <Heading>{translate('reference.beforeBegin')}</Heading>
      <View style={{ marginTop: 12 }}>
        <Body>{translate('reference.termsIntro')}</Body>
      </View>
      <View style={styles.version}>
        <Eyebrow>{translate('reference.currentVersion')}</Eyebrow>
        <Text selectable style={styles.versionValue}>
          {translate('terms.version', {
            version: assignment.terms.termsVersionId,
          })}
        </Text>
        <Status
          needsAttention={
            facts.canConfirm || facts.termsStatus === 'update_required'
          }
          text={translate(`terms.status.${facts.termsStatus}`)}
        />
      </View>
      <View style={styles.termsSection}>
        <Text accessibilityRole="header" style={styles.section}>
          {translate('reference.assignmentTitle')}
        </Text>
        <Body>
          {translate('reference.assignmentSummary', {
            employer: assignment.assignment.employer,
            worksite: assignment.assignment.worksite,
            start: formatSeasonDate(
              assignment.assignment.seasonStart,
              language === 'es' ? 'es-MX' : 'en-US',
            ),
            end: formatSeasonDate(
              assignment.assignment.seasonEnd,
              language === 'es' ? 'es-MX' : 'en-US',
            ),
          })}
        </Body>
      </View>
      <View style={styles.termsSection}>
        <Text accessibilityRole="header" style={styles.section}>
          {translate('reference.termsSummary')}
        </Text>
        <Body>{assignment.terms.summary[language]}</Body>
      </View>
      {facts.needsReconfirmation ? (
        <View style={{ marginTop: 16 }}>
          <Body>{translate('terms.reconfirm')}</Body>
        </View>
      ) : null}
      {facts.termsStatus === 'update_required' ? (
        <View style={{ marginTop: 16 }}>
          <Body>{translate('terms.updateRequired')}</Body>
        </View>
      ) : null}
      {facts.termsStatus === 'failed' || facts.replacementActionId ? (
        <View style={{ marginTop: 16 }}>
          <Body>{translate('terms.failedHint')}</Body>
        </View>
      ) : null}
      <View style={{ marginTop: 20 }}>
        <InformationPanel>
          <Body>{translate('reference.termsOffline')}</Body>
        </InformationPanel>
      </View>
      <ErrorNotice code={state.error} />
      <View style={{ marginTop: 20 }}>
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
      </View>
      {data.refreshNeeded ||
      facts.termsStatus === 'update_required' ||
      facts.termsStatus === 'failed' ? (
        <TextAction
          label={translate('home.refresh')}
          disabled={state.refreshing}
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
      <TextAction label={translate('terms.backHome')} onPress={onHome} />
    </AuthPage>
  );
}
const styles = StyleSheet.create({
  featured: {
    padding: 20,
    gap: 12,
    borderRadius: 16,
    backgroundColor: tokens.colors.primary,
  },
  featuredTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  featuredBody: { fontSize: 14, lineHeight: 22, color: '#D1DED3' },
  taskEyebrow: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#D1DED3',
  },
  card: {
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
  },
  version: {
    marginTop: 24,
    paddingBottom: 24,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
  },
  versionValue: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  termsSection: {
    paddingVertical: 24,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
  },
  section: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  overline: { fontSize: 16, fontWeight: '600', color: tokens.colors.muted },
  status: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    color: tokens.colors.primary,
  },
});
