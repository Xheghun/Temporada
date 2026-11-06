import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
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
import { tokens } from '../../../design-system/tokens';
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
function Status({ text }: { text: string }) {
  return (
    <Text selectable style={styles.status}>
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
  const { t } = useTranslation();
  if (
    state.loading ||
    (!state.data?.assignment &&
      state.online &&
      !state.data?.refreshError &&
      !state.error)
  )
    return (
      <Card>
        <ActivityIndicator accessibilityLabel={t('loading')} />
        <Body>{t('home.loading')}</Body>
      </Card>
    );
  return (
    <Card>
      <Body>{t(state.online ? 'home.noData' : 'home.noOfflineData')}</Body>
      <ErrorNotice code={state.error} />
      <Action
        label={t('home.refresh')}
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
  onLanguage,
  onSwitch,
  onLogout,
  shared,
}: {
  state: AssignmentState;
  workerName: string;
  onTerms(): void;
  onRefresh(): void;
  onLanguage(): void;
  onSwitch(): void;
  onLogout(): void;
  shared: boolean;
}) {
  const { t, i18n } = useTranslation();
  const data = state.data,
    assignment = data?.assignment,
    facts = data ? assignmentFacts(data) : null;
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'es-MX';
  return (
    <AuthPage>
      <Heading>{workerName}</Heading>
      <Status
        text={t(state.online ? 'home.connectionAvailable' : 'home.offline')}
      />
      {assignment && facts ? (
        <>
          <Card>
            <Text style={styles.overline}>{t('home.assignment')}</Text>
            <Heading>{assignment.assignment.employer}</Heading>
            <Body>
              {t('home.order', { id: assignment.assignment.orderId })}
            </Body>
            <Body>{assignment.assignment.worksite}</Body>
            <Body>
              {t('home.season', {
                start: date(assignment.assignment.seasonStart, locale),
                end: date(assignment.assignment.seasonEnd, locale),
              })}
            </Body>
          </Card>
          <Card>
            <Text style={styles.section}>{t('home.syncTitle')}</Text>
            <Status text={t('home.pending', { count: facts.pendingCount })} />
            <Body>{t('home.attention', { count: facts.attentionCount })}</Body>
            {data.cachedAt !== null ? (
              <Body>
                {t('home.cachedAt', {
                  date: new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(data.cachedAt)),
                })}
              </Body>
            ) : null}
            {data.refreshNeeded ? (
              <Body>
                {t(
                  data.refreshError
                    ? 'home.refreshFailed'
                    : 'home.refreshPending',
                )}
              </Body>
            ) : null}
            <ErrorNotice code={state.error} />
            <Action
              secondary
              label={t('home.refresh')}
              busy={state.refreshing}
              onPress={onRefresh}
            />
          </Card>
          <Card>
            <Text style={styles.section}>{t('home.terms')}</Text>
            <Body>
              {t('terms.version', { version: assignment.terms.termsVersionId })}
            </Body>
            <Status text={t(`terms.status.${facts.termsStatus}`)} />
            <Body>
              {
                assignment.terms.summary[
                  i18n.resolvedLanguage === 'en' ? 'en' : 'es'
                ]
              }
            </Body>
            <Action label={t('home.openTerms')} onPress={onTerms} />
          </Card>
          <Card>
            <Text style={styles.section}>{t('home.timeline')}</Text>
            <Body>{t('home.sessionFact')}</Body>
            <Body>{t('home.assignmentFact')}</Body>
            <Body>
              {t('home.termsFact', {
                status: t(`terms.status.${facts.termsStatus}`),
              })}
            </Body>
            <Body>
              {t('home.catalogFact', {
                count: assignment.requiredDocuments.filter(
                  (document) => document.required,
                ).length,
              })}
            </Body>
          </Card>
        </>
      ) : (
        <CacheState state={state} onRefresh={onRefresh} />
      )}
      <Card>
        <Text style={styles.section}>{t('home.documents')}</Text>
        <Body>{t('home.documentsUnavailable')}</Body>
        <Action
          disabled
          secondary
          label={t('home.documentsSoon')}
          onPress={onTerms}
        />
      </Card>
      <Action secondary label={t('home.changeLanguage')} onPress={onLanguage} />
      {shared ? (
        <Action secondary label={t('switchWorker')} onPress={onSwitch} />
      ) : null}
      <Action secondary label={t('logout')} onPress={onLogout} />
      <Body>{t('logoutHint')}</Body>
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
  const { t, i18n } = useTranslation();
  const data = state.data,
    assignment = data?.assignment;
  if (!assignment || !data)
    return (
      <AuthPage>
        <Heading>{t('home.terms')}</Heading>
        <CacheState state={state} onRefresh={onRefresh} />
        <Action secondary label={t('terms.backHome')} onPress={onHome} />
      </AuthPage>
    );
  const facts = assignmentFacts(data),
    language = i18n.resolvedLanguage === 'en' ? 'en' : 'es';
  const staleVersions = [
    ...new Set(
      data.actions
        .filter(
          (a) => a.status === 'stale' && a.payload.kind === 'terms_acceptance',
        )
        .map((a) =>
          a.payload.kind === 'terms_acceptance' ? a.payload.termsVersionId : '',
        ),
    ),
  ];
  return (
    <AuthPage>
      <Heading>{t('home.terms')}</Heading>
      <Body>
        {t('terms.version', { version: assignment.terms.termsVersionId })}
      </Body>
      <Status text={t(`terms.status.${facts.termsStatus}`)} />
      <Body>{assignment.terms.summary[language]}</Body>
      {facts.needsReconfirmation ? <Body>{t('terms.reconfirm')}</Body> : null}
      {facts.termsStatus === 'update_required' ? (
        <Body>{t('terms.updateRequired')}</Body>
      ) : null}
      {facts.termsStatus === 'pending_sync' ? (
        <Body>{t('terms.pendingHint')}</Body>
      ) : null}
      {facts.termsStatus === 'failed' || facts.replacementActionId ? (
        <Body>{t('terms.failedHint')}</Body>
      ) : null}
      <ErrorNotice code={state.error} />
      {data.actions.some(
        (a) =>
          a.id === state.savedActionId &&
          a.payload.kind === 'terms_acceptance' &&
          a.payload.termsVersionId === assignment.terms.termsVersionId &&
          !['stale', 'failed_permanent'].includes(a.status),
      ) ? (
        <Text accessibilityRole="alert" style={styles.status}>
          {t('terms.saved')}
        </Text>
      ) : null}
      <Action
        label={t(
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
          label={t('home.refresh')}
          busy={state.refreshing}
          onPress={onRefresh}
        />
      ) : null}
      {staleVersions.length ? (
        <Card>
          <Text style={styles.section}>{t('terms.history')}</Text>
          {staleVersions.map((version) => (
            <Body key={version}>{t('terms.staleHistory', { version })}</Body>
          ))}
        </Card>
      ) : null}
      <Action secondary label={t('terms.backHome')} onPress={onHome} />
    </AuthPage>
  );
}
function date(value: string, locale: string) {
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(parsed);
}
const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    backgroundColor: tokens.colors.surface,
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
