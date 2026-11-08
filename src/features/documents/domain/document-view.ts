import type {
  WorkerViewData,
  DeliveryStatus,
  ReviewStatus,
} from '../../../core/offline/domain/types.ts';
export type DocumentStatus =
  | ReviewStatus
  | 'not_submitted'
  | 'pending_sync'
  | 'failed'
  | 'superseded'
  | 'needs_refresh';
export interface SubmissionView {
  id: string;
  actionId: string | null;
  serverId: string | null;
  replacesId: string | null;
  status: DocumentStatus;
  delivery: DeliveryStatus | null;
  correctionReason: string | null;
  errorCode: string | null;
  createdAt: number;
  sequence: number;
}
export function documentViews(data: WorkerViewData) {
  const assignment = data.assignment;
  if (!assignment) return [];
  return assignment.requiredDocuments.map((catalogDocument) => {
    const actions = data.actions.filter(
      (action) =>
        action.payload.kind === 'document_upload' &&
        action.payload.documentType === catalogDocument.documentType,
    );
    const history: SubmissionView[] = assignment.documentSubmissions
      .filter(
        (submission) =>
          submission.documentType === catalogDocument.documentType,
      )
      .map((submission) => {
        const action = actions.find(
          (candidate) => candidate.clientActionId === submission.clientActionId,
        );
        return {
          id: submission.submissionId,
          serverId: submission.submissionId,
          actionId: action?.id ?? null,
          replacesId:
            submission.replacesSubmissionId ??
            (action?.payload.kind === 'document_upload'
              ? action.payload.replacesSubmissionId
              : null),
          // M4: a refresh is authoritative evidence of review even before the original receipt is replayed.
          status: submission.status,
          delivery: action?.status ?? null,
          correctionReason: submission.correctionReason,
          errorCode: action?.lastErrorCode ?? null,
          createdAt: submission.createdAt,
          sequence: action?.sequence ?? 0,
        };
      });
    for (const action of actions) {
      if (history.some((submission) => submission.actionId === action.id))
        continue;
      history.push({
        id: action.id,
        actionId: action.id,
        serverId: null,
        replacesId:
          action.payload.kind === 'document_upload'
            ? action.payload.replacesSubmissionId
            : null,
        status:
          action.status === 'failed_permanent'
            ? 'failed'
            : action.status === 'superseded'
              ? 'superseded'
              : ['queued', 'sending', 'retry_wait'].includes(action.status)
                ? 'pending_sync'
                : 'needs_refresh',
        delivery: action.status,
        correctionReason: null,
        errorCode: action.lastErrorCode,
        createdAt: action.createdAt,
        sequence: action.sequence,
      });
    }
    // M8: replacement identity, never review revision, determines which submission is current.
    const replacedIds = new Set(
      history
        .map((submission) => submission.replacesId)
        .filter((id) => id !== null),
    );
    const candidates = history.filter(
      (submission) =>
        submission.delivery !== 'superseded' &&
        !replacedIds.has(submission.id) &&
        !(submission.serverId && replacedIds.has(submission.serverId)),
    );
    const unresolved = candidates
      .filter((submission) =>
        ['queued', 'sending', 'retry_wait', 'failed_permanent'].includes(
          submission.delivery ?? '',
        ),
      )
      .sort((left, right) => right.sequence - left.sequence);
    const current =
      unresolved[0] ??
      candidates.sort(
        (left, right) =>
          right.createdAt - left.createdAt || right.id.localeCompare(left.id),
      )[0] ??
      null;
    const canSubmit =
      current === null ||
      ['correction_requested', 'failed'].includes(current.status) ||
      current.delivery === 'failed_permanent';
    return {
      ...catalogDocument,
      current,
      history: history
        .filter((submission) => submission !== current)
        .sort(
          (left, right) =>
            right.sequence - left.sequence || right.createdAt - left.createdAt,
        ),
      canSubmit,
    };
  });
}

export function documentPresentationFacts(
  documents: ReturnType<typeof documentViews>,
) {
  return documents.map((document) => {
    const current = document.current;
    const isPending = ['queued', 'sending', 'retry_wait'].includes(
      current?.delivery ?? '',
    );
    const hasPermanentFailure =
      current?.delivery === 'failed_permanent' || current?.status === 'failed';
    return {
      required: document.required,
      // M4: review evidence is independent of an unresolved delivery receipt.
      reviewStatus:
        current?.status === 'approved' ||
        current?.status === 'correction_requested' ||
        current?.status === 'pending_review'
          ? current.status
          : null,
      needsCorrection: current?.status === 'correction_requested' && !isPending,
      isMissing: !current,
      hasPermanentFailure,
      isPending,
      isApproved:
        current?.status === 'approved' && !isPending && !hasPermanentFailure,
      needsRefresh: current?.status === 'needs_refresh',
      isSent:
        !!current?.serverId &&
        !isPending &&
        !hasPermanentFailure &&
        current.delivery !== 'superseded' &&
        current.status !== 'needs_refresh',
    };
  });
}
export function submissionStatusKey(submission: SubmissionView | null): string {
  // A known staff decision remains primary while delivery feedback is independent.
  if (
    submission?.status === 'approved' ||
    submission?.status === 'correction_requested'
  )
    return `documents.status.${submission.status}`;
  if (submission?.delivery === 'sending') return 'ui.sending';
  if (submission?.delivery === 'retry_wait') return 'ui.retry';
  if (submission?.delivery === 'queued') return 'ui.saved';
  return `documents.status.${submission?.status ?? 'not_submitted'}`;
}
