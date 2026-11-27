import type {
  OutboxAction,
  WorkerViewData,
  LocalSubmission,
} from '../core/offline/domain/types';

export interface FileInspection {
  exists: boolean;
  ownsPrivateFile: boolean;
  bytes: number | null;
  digest: string | null;
  digestMatches: boolean | null;
}
export interface InspectionFileCounts {
  managedFiles: number;
  journals: number;
  quarantinedJournals: number;
  pickerCacheFiles: number;
}
export interface InspectionDependencies {
  readView(): Promise<WorkerViewData & { submissions: LocalSubmission[] }>;
  inspectFile(action: OutboxAction): Promise<FileInspection>;
  countFiles(): Promise<InspectionFileCounts>;
  now(): number;
}

/** Project an atomic cache read through an explicit artifact allowlist. */
export async function readInspectionModel(
  workerId: string,
  dependencies: InspectionDependencies,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const view = await dependencies.readView();
    if (view.assignment && view.assignment.worker.workerId !== workerId)
      throw new Error('inspection_worker_mismatch');
    const actions = [];
    for (const action of view.actions) {
      if (action.workerId !== workerId || action.payload.workerId !== workerId)
        throw new Error('inspection_worker_mismatch');
      const upload =
        action.payload.kind === 'document_upload' ? action.payload : null;
      const file = upload ? await dependencies.inspectFile(action) : null;
      const serverSubmission = view.submissions.find(
        (submission) => submission.clientActionId === action.clientActionId,
      );
      actions.push({
        workerId,
        actionId: action.id,
        clientActionId: action.clientActionId,
        actionType: action.actionType,
        status: action.status,
        attemptCount: action.attemptCount,
        nextAttemptAt: action.nextAttemptAt,
        lastErrorCode: action.lastErrorCode,
        createdAt: action.createdAt,
        updatedAt: action.updatedAt,
        documentType: upload?.documentType ?? null,
        submissionId: upload?.localSubmissionId ?? null,
        serverSubmissionId: serverSubmission?.serverSubmissionId ?? null,
        replacesSubmissionId: upload?.replacesSubmissionId ?? null,
        termsVersionId:
          action.payload.kind === 'terms_acceptance'
            ? action.payload.termsVersionId
            : null,
        exists: file?.exists ?? null,
        ownsPrivateFile: file?.ownsPrivateFile ?? null,
        bytes: file?.bytes ?? null,
        digest: file?.digest ?? null,
        expectedDigest: upload?.sha256 ?? null,
        digestMatches: file?.digestMatches ?? null,
      });
    }
    const counts = await dependencies.countFiles();
    // Delivery can finish and remove bytes during inspection. Retry instead of publishing a torn sample.
    const after = await dependencies.readView();
    if (JSON.stringify(view) !== JSON.stringify(after)) continue;
    return {
      workerId,
      sampledAt: dependencies.now(),
      actions,
      submissions: view.submissions.map((submission) => ({
        submissionId: submission.submissionId,
        serverSubmissionId: submission.serverSubmissionId,
        clientActionId: submission.clientActionId,
        documentType: submission.documentType,
        status: submission.serverStatus,
        correctionReason: submission.correctionReason,
        serverRevision: submission.serverRevision,
        deliveryStatus: submission.deliveryStatus,
        replacesSubmissionId: submission.replacesSubmissionId ?? null,
      })),
      termsVersionId: view.assignment?.terms.termsVersionId ?? null,
      serverAcceptanceStatus:
        view.assignment?.terms.serverAcceptanceStatus ?? null,
      refreshNeeded: view.refreshNeeded,
      refreshError: view.refreshError,
      managedFiles: counts.managedFiles,
      journals: counts.journals,
      quarantinedJournals: counts.quarantinedJournals,
      pickerCacheFiles: counts.pickerCacheFiles,
    };
  }
  throw new Error('inspection_snapshot_changed');
}
