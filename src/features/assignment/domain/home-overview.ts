import type {
  ReviewStatus,
  WorkerViewData,
} from '../../../core/offline/domain/types.ts';
import { assignmentFacts } from './view-state.ts';

/** Public presentation facts, composed by the route from the same atomic read. */
export interface HomeDocumentFact {
  required: boolean;
  isSent: boolean;
  isPending: boolean;
  hasPermanentFailure: boolean;
  needsRefresh: boolean;
  reviewStatus: ReviewStatus | null;
}

export function homeOverview(
  data: WorkerViewData | null,
  documents: readonly HomeDocumentFact[] | null,
) {
  const assignment = data?.assignment;
  const facts = data ? assignmentFacts(data) : null;
  const currentTermsAction = data?.actions
    .filter(
      (action) =>
        action.payload.kind === 'terms_acceptance' &&
        action.payload.termsVersionId === assignment?.terms.termsVersionId &&
        action.status !== 'superseded',
    )
    .at(-1);
  const required = documents?.filter((document) => document.required);
  const progress =
    assignment &&
    required &&
    !required.some((document) => document.needsRefresh)
      ? {
          total: required.length,
          delivered: required.filter((document) => document.isSent).length,
          pending: required.filter((document) => document.isPending).length,
          failed: required.filter((document) => document.hasPermanentFailure)
            .length,
          approved: required.filter(
            (document) => document.reviewStatus === 'approved',
          ).length,
          awaitingReview: required.filter(
            (document) => document.reviewStatus === 'pending_review',
          ).length,
          corrections: required.filter(
            (document) => document.reviewStatus === 'correction_requested',
          ).length,
          isUpdating: data.refreshNeeded,
        }
      : null;
  return {
    pendingCount: facts?.pendingCount ?? null,
    attentionCount: facts?.attentionCount ?? null,
    termsStatus: assignment ? (facts?.termsStatus ?? null) : null,
    needsReconfirmation: !!assignment && !!facts?.needsReconfirmation,
    termsDelivery: currentTermsAction?.status ?? null,
    documents: progress,
  };
}
export type HomeOverview = ReturnType<typeof homeOverview>;
