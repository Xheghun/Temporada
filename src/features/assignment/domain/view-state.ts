import type {
  WorkerViewData,
  OutboxAction,
} from '../../../core/offline/domain/types.ts';
export type TermsStatus =
  'unconfirmed' | 'pending_sync' | 'accepted' | 'update_required' | 'failed';
const active = (action: OutboxAction) =>
  ['queued', 'sending', 'retry_wait'].includes(action.status);
export function assignmentFacts(data: WorkerViewData) {
  const version = data.assignment?.terms.termsVersionId;
  const terms = data.actions.filter(
    (a) => a.payload.kind === 'terms_acceptance',
  );
  const current = terms.filter(
    (a) =>
      a.payload.kind === 'terms_acceptance' &&
      a.payload.termsVersionId === version &&
      a.status !== 'superseded',
  );
  const latest = current.at(-1);
  const latestTerms = terms.filter((a) => a.status !== 'superseded').at(-1);
  const failedPredecessor = terms.find((a) => a.status === 'failed_permanent');
  const stale = current.some((a) => a.status === 'stale');
  const status: TermsStatus = stale
    ? 'update_required'
    : latest && active(latest)
      ? 'pending_sync'
      : data.assignment?.terms.serverAcceptanceStatus === 'accepted'
        ? 'accepted'
        : latest?.status === 'failed_permanent'
          ? 'failed'
          : 'unconfirmed';
  return {
    termsStatus: status,
    needsReconfirmation:
      terms.some((a) => a.status === 'stale') && status === 'unconfirmed',
    pendingCount: data.actions.filter(active).length,
    attentionCount:
      data.actions.filter((a) => a.status === 'failed_permanent').length +
      (latestTerms?.status === 'stale' ? 1 : 0),
    replacementActionId: failedPredecessor?.id ?? null,
    canConfirm: !!version && (status === 'unconfirmed' || status === 'failed'),
  };
}
