import type { Database, SqlExecutor } from '../connection.ts';
import type {
  AssignmentSnapshot,
  OutboxAction,
  DurableUpload,
} from '../../offline/domain/types.ts';
import type {
  SyncPersistence,
  ActionOutcome,
  DeliveryReceipt,
  RefreshState,
} from '../../sync/types.ts';
import { WorkerRepository } from './worker-repository.ts';

export class SyncRepository implements SyncPersistence {
  private readonly database: Database;
  private readonly workerId: string;
  private readonly worker: WorkerRepository;
  constructor(
    database: Database,
    workerId: string,
    clock: { uuid(): string; now(): number },
  ) {
    this.database = database;
    this.workerId = workerId;
    this.worker = new WorkerRepository(database, workerId, clock);
  }
  listActions() {
    return this.worker.listActions();
  }
  claimAction(actionId: string, now: number) {
    return this.worker.claimAction(actionId, now);
  }
  recoverSending() {
    return this.worker.recoverSending();
  }
  async releaseClaim(actionId: string, now: number): Promise<void> {
    await this.database.run(
      `UPDATE outbox_actions SET status='queued',updated_at=?,last_error_code='local_completion_failed'
       WHERE worker_id=? AND client_action_id=? AND status='sending'`,
      [now, this.workerId, actionId],
    );
  }
  async finish(
    action: OutboxAction,
    outcome: ActionOutcome,
    now: number,
  ): Promise<void> {
    if (action.workerId !== this.workerId) throw new Error('worker_mismatch');
    await this.database.transaction(async (transaction) => {
      const current = await transaction.first<{ status: string }>(
        'SELECT status FROM outbox_actions WHERE worker_id=? AND client_action_id=?',
        [this.workerId, action.clientActionId],
      );
      if (current?.status !== 'sending') throw new Error('action_not_sending');
      if (outcome.kind === 'delivered')
        await this.acknowledge(transaction, action, outcome.receipt, now);
      const status =
        outcome.kind === 'delivered'
          ? 'delivered'
          : outcome.kind === 'retry'
            ? 'retry_wait'
            : outcome.kind === 'failed'
              ? 'failed_permanent'
              : outcome.kind === 'stale'
                ? 'stale'
                : 'queued';
      const code =
        outcome.kind === 'stale'
          ? 'stale_terms'
          : 'code' in outcome
            ? outcome.code
            : null;
      if (outcome.kind === 'stale') {
        if (action.payload.kind !== 'terms_acceptance')
          throw new Error('stale_non_terms_action');
        // This intent is invalid; an earlier acknowledged acceptance of the same version remains historical fact.
        await this.markRefresh(transaction, true);
      }
      await transaction.run(
        `UPDATE outbox_actions SET status=?,next_attempt_at=?,last_error_code=?,updated_at=?
        WHERE worker_id=? AND client_action_id=?`,
        [
          status,
          outcome.kind === 'retry' ? outcome.at : now,
          code,
          now,
          this.workerId,
          action.clientActionId,
        ],
      );
    });
  }
  private async markRefresh(
    transaction: SqlExecutor,
    terms = false,
  ): Promise<void> {
    await transaction.run(
      `UPDATE refresh_state SET assignment_refresh_needed=1,
      terms_refresh_needed=MAX(terms_refresh_needed,?),next_attempt_at=0,last_error_code=NULL WHERE worker_id=?`,
      [terms ? 1 : 0, this.workerId],
    );
  }
  private async acknowledge(
    transaction: SqlExecutor,
    action: OutboxAction,
    receipt: DeliveryReceipt,
    now: number,
  ): Promise<void> {
    if (
      receipt.clientActionId !== action.clientActionId ||
      receipt.kind !== action.payload.kind
    )
      throw new Error('receipt_identity_mismatch');
    if (
      receipt.serverRevision !== null &&
      (!Number.isSafeInteger(receipt.serverRevision) ||
        receipt.serverRevision < 0)
    )
      throw new Error('invalid_receipt_revision');
    if (
      receipt.kind === 'terms_acceptance' &&
      action.payload.kind === 'terms_acceptance'
    ) {
      if (receipt.termsVersionId !== action.payload.termsVersionId)
        throw new Error('receipt_terms_mismatch');
      await transaction.run(
        "UPDATE terms SET server_acceptance_status='accepted',cached_at=? WHERE worker_id=? AND terms_version_id=?",
        [now, this.workerId, action.payload.termsVersionId],
      );
    } else if (
      receipt.kind === 'document_upload' &&
      action.payload.kind === 'document_upload'
    ) {
      if (
        receipt.documentType !== action.payload.documentType ||
        !receipt.submissionId.trim()
      )
        throw new Error('receipt_document_mismatch');
      const existingSubmission = await transaction.first<{
        serverId: string | null;
        revision: number | null;
        status: string | null;
        reason: string | null;
      }>(
        `SELECT server_submission_id AS serverId,server_revision AS revision,server_status AS status,correction_reason AS reason
         FROM document_submissions WHERE worker_id=? AND client_action_id=?`,
        [this.workerId, action.clientActionId],
      );
      if (
        !existingSubmission ||
        (existingSubmission.serverId !== null &&
          existingSubmission.serverId !== receipt.submissionId)
      )
        throw new Error('receipt_submission_mismatch');
      if (
        receipt.serverRevision !== null &&
        existingSubmission.revision === receipt.serverRevision &&
        (existingSubmission.status !== receipt.status ||
          existingSubmission.reason !== receipt.correctionReason)
      )
        throw new Error('conflicting_review_revision');
      // M4: an acknowledgment resolves delivery, never overwrites a newer staff review.
      const merge =
        existingSubmission.status === null ||
        (existingSubmission.status === 'pending_review' &&
          existingSubmission.revision === null) ||
        (receipt.serverRevision !== null &&
          existingSubmission.revision !== null &&
          receipt.serverRevision > existingSubmission.revision);
      await transaction.run(
        `UPDATE document_submissions SET server_submission_id=?,
        server_status=CASE WHEN ? THEN ? ELSE server_status END,
        correction_reason=CASE WHEN ? THEN ? ELSE correction_reason END,
        server_revision=CASE WHEN ? THEN ? ELSE server_revision END
        WHERE worker_id=? AND client_action_id=?`,
        [
          receipt.submissionId,
          merge ? 1 : 0,
          receipt.status,
          merge ? 1 : 0,
          receipt.correctionReason,
          merge ? 1 : 0,
          receipt.serverRevision,
          this.workerId,
          action.clientActionId,
        ],
      );
      await transaction.run(
        `UPDATE documents SET latest_local_action_id=CASE WHEN latest_local_action_id=? THEN NULL ELSE latest_local_action_id END,
        updated_at=? WHERE worker_id=? AND document_type=?`,
        [action.clientActionId, now, this.workerId, receipt.documentType],
      );
    } else throw new Error('receipt_type_mismatch');
    if (receipt.serverRevision !== null)
      await transaction.run(
        'UPDATE assignments SET server_revision=MAX(server_revision,?) WHERE worker_id=?',
        [receipt.serverRevision, this.workerId],
      );
    // Receipts omit creation timestamps/full state. Refresh independently after delivery.
    await this.markRefresh(transaction);
  }
  async refreshState(): Promise<RefreshState> {
    const refreshRow = await this.database.first<{
      needed: number;
      blocked: number;
      attemptCount: number;
      nextAttemptAt: number;
    }>(
      `SELECT (assignment_refresh_needed OR terms_refresh_needed) AS needed,
        (COALESCE(last_error_code,'') LIKE 'refresh_permanent:%') AS blocked,
        attempt_count AS attemptCount,next_attempt_at AS nextAttemptAt FROM refresh_state WHERE worker_id=?`,
      [this.workerId],
    );
    return refreshRow
      ? {
          ...refreshRow,
          needed: !!refreshRow.needed,
          blocked: !!refreshRow.blocked,
        }
      : { needed: false, blocked: false, attemptCount: 0, nextAttemptAt: 0 };
  }
  async requestRefresh(): Promise<void> {
    await this.database.transaction((transaction) =>
      this.markRefresh(transaction),
    );
  }
  async cacheRefresh(snapshot: AssignmentSnapshot): Promise<void> {
    if (!(await this.worker.cacheAssignment(snapshot)))
      throw new Error('older_assignment_snapshot');
    await this.database.run(
      `UPDATE refresh_state SET assignment_refresh_needed=0,terms_refresh_needed=0,
      attempt_count=0,next_attempt_at=0,last_error_code=NULL WHERE worker_id=?`,
      [this.workerId],
    );
  }
  async deferRefresh(nextAttemptAt: number, code: string): Promise<void> {
    await this.database.run(
      'UPDATE refresh_state SET attempt_count=attempt_count+1,next_attempt_at=?,last_error_code=? WHERE worker_id=?',
      [nextAttemptAt, code, this.workerId],
    );
  }
  async blockRefresh(code: string): Promise<void> {
    await this.database.run(
      'UPDATE refresh_state SET last_error_code=?,attempt_count=attempt_count+1 WHERE worker_id=?',
      ['refresh_permanent:' + code, this.workerId],
    );
  }
  async retryNow(now: number): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction.run(
        "UPDATE outbox_actions SET next_attempt_at=?,updated_at=? WHERE worker_id=? AND status='retry_wait'",
        [now, now, this.workerId],
      );
      await transaction.run(
        'UPDATE refresh_state SET next_attempt_at=?,last_error_code=NULL WHERE worker_id=? AND (assignment_refresh_needed OR terms_refresh_needed)',
        [now, this.workerId],
      );
    });
  }
  async replaceFailedTerms(
    actionId: string,
    displayedVersion: string,
  ): Promise<OutboxAction> {
    return this.worker.enqueueTerms(displayedVersion, actionId);
  }
  /** Explicit user replacement; no automatic supersession of stale or pending intent. */
  async replaceFailedDocument(
    actionId: string,
    file: DurableUpload,
  ): Promise<OutboxAction> {
    const predecessor = (await this.worker.listActions()).find(
      (action) => action.clientActionId === actionId,
    );
    if (
      !predecessor ||
      predecessor.status !== 'failed_permanent' ||
      predecessor.payload.kind !== 'document_upload'
    )
      throw new Error('supersession_not_allowed');
    return this.worker.enqueueDocument(
      predecessor.payload.documentType,
      file,
      predecessor.payload.replacesSubmissionId ?? undefined,
      actionId,
    );
  }
}
