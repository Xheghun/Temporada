import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AuthPage,
  Heading,
  Body,
  Action,
  ErrorNotice,
} from '../../../design-system/components/auth-controls';
import { ListRow } from '../../../design-system/components/worker-controls';
import type { AssignmentState } from '../assignment-service';
import { CacheState } from './worker-content';
export function formatSeasonDate(value: string, locale: string) {
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(parsed);
}
export function JobContent({
  state,
  onTerms,
  onRefresh,
  footer,
}: {
  state: AssignmentState;
  onTerms(): void;
  onRefresh(): void;
  footer?: ReactNode;
}) {
  const { t: translate, i18n } = useTranslation();
  const assignment = state.data?.assignment?.assignment;
  return (
    <AuthPage footer={footer}>
      <Heading>{translate('ui.job')}</Heading>
      {!state.online ? <Body>{translate('home.offline')}</Body> : null}
      <ErrorNotice code={state.error} />
      {assignment ? (
        <>
          <View>
            <ListRow
              title={translate('ui.employer')}
              detail={assignment.employer}
            />
            <ListRow
              title={translate('ui.worksite')}
              detail={assignment.worksite}
            />
            <ListRow
              title={translate('ui.reference')}
              detail={assignment.orderId}
            />
            <ListRow
              title={translate('ui.start')}
              detail={formatSeasonDate(
                assignment.seasonStart,
                i18n.resolvedLanguage === 'es' ? 'es-MX' : 'en-US',
              )}
            />
            <ListRow
              title={translate('ui.end')}
              detail={formatSeasonDate(
                assignment.seasonEnd,
                i18n.resolvedLanguage === 'es' ? 'es-MX' : 'en-US',
              )}
            />
          </View>
          <Action label={translate('home.openTerms')} onPress={onTerms} />
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
