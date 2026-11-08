import type { WorkerViewData } from '../../../core/offline/domain/types';
import { assignmentFacts } from './view-state';
export interface RequiredDocumentFact {
  required: boolean;
  needsCorrection: boolean;
  isMissing: boolean;
  hasPermanentFailure: boolean;
  isPending: boolean;
  isApproved: boolean;
  needsRefresh: boolean;
}
export type NextAction =
  | 'terms'
  | 'correction'
  | 'missing'
  | 'failed'
  | 'saved'
  | 'review'
  | 'complete'
  | 'refresh'
  | 'unavailable';
export function nextWorkerAction(
  data: WorkerViewData,
  documents: readonly RequiredDocumentFact[],
  documentsEnabled: boolean,
  captureEnabled = documentsEnabled,
): NextAction {
  if (!data.assignment) return 'refresh';
  const terms = assignmentFacts(data);
  if (terms.termsStatus === 'update_required') return 'refresh';
  if (terms.canConfirm) return 'terms';
  if (!documentsEnabled) return 'unavailable';
  const required = documents.filter((document) => document.required);
  if (
    !captureEnabled &&
    required.some(
      (document) =>
        document.needsCorrection ||
        document.isMissing ||
        document.hasPermanentFailure,
    )
  )
    return 'unavailable';
  if (required.some((document) => document.needsCorrection))
    return 'correction';
  if (required.some((document) => document.isMissing)) return 'missing';
  if (required.some((document) => document.hasPermanentFailure))
    return 'failed';
  if (data.refreshNeeded || required.some((document) => document.needsRefresh))
    return 'refresh';
  if (
    terms.termsStatus === 'pending_sync' ||
    required.some((document) => document.isPending)
  )
    return 'saved';
  if (
    terms.termsStatus === 'accepted' &&
    required.every((document) => document.isApproved)
  )
    return 'complete';
  return 'review';
}
