import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Body } from '../../../design-system/components/auth-controls';
import {
  SectionHeading,
  StatusIndicator,
} from '../../../design-system/components/worker-controls';
import { tokens } from '../../../design-system/tokens';
import type { HomeOverview } from '../domain/home-overview';

export function HomeSyncSummary({
  online,
  overview,
  loading,
}: {
  online: boolean;
  overview: HomeOverview;
  loading: boolean;
}) {
  const { t: translate } = useTranslation();
  return (
    <View style={styles.sync}>
      <StatusIndicator>
        {translate(online ? 'home.online' : 'home.offline')}
      </StatusIndicator>
      <Text accessibilityLiveRegion="polite" style={styles.syncCount}>
        {overview.pendingCount === null
          ? translate(loading ? 'home.queueLoading' : 'home.queueUnavailable')
          : translate('home.pending', { count: overview.pendingCount })}
      </Text>
      {overview.attentionCount ? (
        <Body>
          {translate('home.attention', { count: overview.attentionCount })}
        </Body>
      ) : null}
    </View>
  );
}

export function HomeProgress({ overview }: { overview: HomeOverview }) {
  const { t: translate } = useTranslation();
  const documents = overview.documents;
  const termsStatus = overview.termsStatus;
  const termsDelivery = overview.termsDelivery;
  return (
    <View style={styles.progress}>
      <SectionHeading>{translate('home.timeline')}</SectionHeading>
      <Milestone number="01" title={translate('home.terms')}>
        <Body>
          {translate(
            termsStatus
              ? `terms.status.${termsStatus}`
              : 'home.progressUnavailable',
          )}
        </Body>
        {overview.needsReconfirmation ? (
          <Body>{translate('terms.reconfirm')}</Body>
        ) : null}
        {termsStatus === 'pending_sync' &&
        (termsDelivery === 'sending' || termsDelivery === 'retry_wait') ? (
          <Body>
            {translate(termsDelivery === 'sending' ? 'ui.sending' : 'ui.retry')}
          </Body>
        ) : null}
      </Milestone>
      <Milestone number="02" title={translate('home.deliveryTitle')}>
        <Body>
          {translate(
            !documents
              ? 'home.progressUnavailable'
              : documents.total === 0
                ? 'home.noRequired'
                : 'home.delivered',
            { count: documents?.delivered, total: documents?.total },
          )}
        </Body>
        {documents?.pending ? (
          <Body>
            {translate('home.documentPending', { count: documents.pending })}
          </Body>
        ) : null}
        {documents?.failed ? (
          <Body>
            {translate('home.documentFailed', { count: documents.failed })}
          </Body>
        ) : null}
      </Milestone>
      <Milestone number="03" title={translate('home.reviewTitle')}>
        <Body>
          {translate(
            !documents
              ? 'home.progressUnavailable'
              : documents.total === 0
                ? 'home.noReviewRequired'
                : 'home.reviewCounts',
            {
              approved: documents?.approved,
              awaiting: documents?.awaitingReview,
              corrections: documents?.corrections,
            },
          )}
        </Body>
        {documents && documents.total > 0 ? (
          <Body>{translate('home.reviewHint')}</Body>
        ) : null}
      </Milestone>
      {documents?.isUpdating ? (
        <Body>{translate('home.refreshPending')}</Body>
      ) : null}
    </View>
  );
}
function Milestone({
  number,
  title,
  children,
}: React.PropsWithChildren<{ number: string; title: string }>) {
  return (
    <View style={styles.milestone}>
      <Text accessible={false} style={styles.marker}>
        {number}
      </Text>
      <View style={styles.milestoneText}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  sync: {
    marginTop: 20,
    gap: 4,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border,
  },
  syncCount: { fontSize: 12, lineHeight: 18, color: tokens.colors.muted },
  progress: { marginTop: 24, gap: 16 },
  milestone: { flexDirection: 'row', gap: 16 },
  marker: {
    fontSize: 12,
    lineHeight: 20,
    color: tokens.colors.secondary,
    width: 22,
  },
  milestoneText: {
    flex: 1,
    borderLeftWidth: 1,
    borderColor: tokens.colors.border,
    paddingLeft: 16,
    paddingBottom: 16,
    gap: 6,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
});
