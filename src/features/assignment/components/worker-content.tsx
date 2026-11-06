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
  const { t: translate } = useTranslation();
  if (
    state.loading ||
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
  const { t: translate, i18n } = useTranslation();
  const data = state.data,
    assignment = data?.assignment,
    facts = data ? assignmentFacts(data) : null;
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'es-MX';
  return (
    <AuthPage>
      <Heading>{workerName}</Heading>
      <Status
        text={translate(
          state.online ? 'home.connectionAvailable' : 'home.offline',
        )}
      />
      {assignment && facts ? (
        <>
          <Card>
            <Text style={styles.overline}>{translate('home.assignment')}</Text>
            <Heading>{assignment.assignment.employer}</Heading>
            <Body>
              {translate('home.order', { id: assignment.assignment.orderId })}
            </Body>
            <Body>{assignment.assignment.worksite}</Body>
            <Body>
              {translate('home.season', {
                start: formatSeasonDate(
                  assignment.assignment.seasonStart,
                  locale,
                ),
                end: formatSeasonDate(assignment.assignment.seasonEnd, locale),
              })}
            </Body>
          </Card>
          <Card>
            <Text style={styles.section}>{translate('home.syncTitle')}</Text>
            <Status
              text={translate('home.pending', { count: facts.pendingCount })}
            />
            <Body>
              {translate('home.attention', { count: facts.attentionCount })}
            </Body>
            {data.cachedAt !== null ? (
              <Body>
                {translate('home.cachedAt', {
                  date: new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(data.cachedAt)),
                })}
              </Body>
            ) : null}
            {data.refreshNeeded ? (
              <Body>
                {translate(
                  data.refreshError
                    ? 'home.refreshFailed'
                    : 'home.refreshPending',
                )}
              </Body>
            ) : null}
            <ErrorNotice code={state.error} />
            <Action
              secondary
              label={translate('home.refresh')}
              busy={state.refreshing}
              onPress={onRefresh}
            />
          </Card>
          <Card>
            <Text style={styles.section}>{translate('home.terms')}</Text>
            <Body>
              {translate('terms.version', {
                version: assignment.terms.termsVersionId,
              })}
            </Body>
            <Status text={translate(`terms.status.${facts.termsStatus}`)} />
            <Body>
              {
                assignment.terms.summary[
                  i18n.resolvedLanguage === 'en' ? 'en' : 'es'
                ]
              }
            </Body>
            <Action label={translate('home.openTerms')} onPress={onTerms} />
          </Card>
          <Card>
            <Text style={styles.section}>{translate('home.timeline')}</Text>
            <Body>{translate('home.sessionFact')}</Body>
            <Body>{translate('home.assignmentFact')}</Body>
            <Body>
              {translate('home.termsFact', {
                status: translate(`terms.status.${facts.termsStatus}`),
              })}
            </Body>
            <Body>
              {translate('home.catalogFact', {
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
        <Text style={styles.section}>{translate('home.documents')}</Text>
        <Body>{translate('home.documentsUnavailable')}</Body>
        <Action
          disabled
          secondary
          label={translate('home.documentsSoon')}
          onPress={onTerms}
        />
      </Card>
      <Action
        secondary
        label={translate('home.changeLanguage')}
        onPress={onLanguage}
      />
      {shared ? (
        <Action
          secondary
          label={translate('switchWorker')}
          onPress={onSwitch}
        />
      ) : null}
      <Action secondary label={translate('logout')} onPress={onLogout} />
      <Body>{translate('logoutHint')}</Body>
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
      <Body>{assignment.terms.summary[language]}</Body>
      {facts.needsReconfirmation ? (
        <Body>{translate('terms.reconfirm')}</Body>
      ) : null}
      {facts.termsStatus === 'update_required' ? (
        <Body>{translate('terms.updateRequired')}</Body>
      ) : null}
      {facts.termsStatus === 'pending_sync' ? (
        <Body>{translate('terms.pendingHint')}</Body>
      ) : null}
      {facts.termsStatus === 'failed' || facts.replacementActionId ? (
        <Body>{translate('terms.failedHint')}</Body>
      ) : null}
      <ErrorNotice code={state.error} />
      {data.actions.some(
        (action) =>
          action.id === state.savedActionId &&
          action.payload.kind === 'terms_acceptance' &&
          action.payload.termsVersionId === assignment.terms.termsVersionId &&
          !['stale', 'failed_permanent'].includes(action.status),
      ) ? (
        <Text accessibilityRole="alert" style={styles.status}>
          {translate('terms.saved')}
        </Text>
      ) : null}
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
        <Card>
          <Text style={styles.section}>{translate('terms.history')}</Text>
          {staleVersions.map((version) => (
            <Body key={version}>
              {translate('terms.staleHistory', { version })}
            </Body>
          ))}
        </Card>
      ) : null}
      <Action secondary label={translate('terms.backHome')} onPress={onHome} />
    </AuthPage>
  );
}
function formatSeasonDate(value: string, locale: string) {
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
