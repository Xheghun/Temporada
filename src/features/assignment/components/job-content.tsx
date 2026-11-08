import type { ReactNode } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AuthPage,
  Heading,
  Body,
  Action,
  ErrorNotice,
} from '../../../design-system/components/auth-controls';
import {
  BrandHeader,
  Eyebrow,
} from '../../../design-system/components/screen-chrome';
import { tokens } from '../../../design-system/tokens';
import type { AssignmentState } from '../assignment-service';
import { CacheState } from './worker-content';
import { formatSeasonDate } from './season-date';
export { formatSeasonDate } from './season-date';
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
  const locale = i18n.resolvedLanguage === 'es' ? 'es-MX' : 'en-US';
  return (
    <AuthPage
      contentGap={0}
      footer={footer}
      header={<BrandHeader context={translate('reference.context.job')} />}
    >
      <Heading>{translate('ui.job')}</Heading>
      <View style={{ marginTop: 12 }}>
        <Body>{translate('reference.jobIntro')}</Body>
      </View>
      <ErrorNotice code={state.error} />
      {assignment ? (
        <>
          <View style={styles.summary}>
            <Eyebrow>{translate('reference.seasonalAssignment')}</Eyebrow>
            <Text accessibilityRole="header" style={styles.employer}>
              {assignment.employer}
            </Text>
            <Body>{assignment.worksite}</Body>
          </View>
          <View>
            {[
              { label: translate('ui.reference'), value: assignment.orderId },
              {
                label: translate('ui.start'),
                value: formatSeasonDate(assignment.seasonStart, locale),
              },
              {
                label: translate('ui.end'),
                value: formatSeasonDate(assignment.seasonEnd, locale),
              },
              {
                label: translate('reference.location'),
                value: assignment.worksite,
              },
            ].map((detail) => (
              <View key={detail.label} style={styles.detail}>
                <Eyebrow>{detail.label}</Eyebrow>
                <Text selectable style={styles.value}>
                  {detail.value}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 16 }}>
            <Action
              arrow
              label={translate('home.openTerms')}
              onPress={onTerms}
            />
          </View>
          {!state.online ? (
            <View style={{ marginTop: 16 }}>
              <Body>{translate('home.offline')}</Body>
            </View>
          ) : null}
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
const styles = StyleSheet.create({
  summary: {
    marginTop: 28,
    padding: 24,
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#E5EAE0',
  },
  employer: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  detail: {
    minHeight: 78,
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
  },
  value: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.text,
  },
});
