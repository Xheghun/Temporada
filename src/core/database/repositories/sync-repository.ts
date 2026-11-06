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
  private readonly db: Database;
  private readonly workerId: string;
  private readonly worker: WorkerRepository;
  constructor(
    db: Database,
    workerId: string,
    clock: { uuid(): string; now(): number },
  ) {
    this.db = db;
    this.workerId = workerId;
    this.worker = new WorkerRepository(db, workerId, clock);
  }
  listActions() {
    return this.worker.listActions();
  }
  claimAction(id: string, now: number) {
    return this.worker.claimAction(id, now);
  }
  recoverSending() {
    return this.worker.recoverSending();
  }
  async finish(
    action: OutboxAction,
    outcome: ActionOutcome,
    now: number,
  ): Promise<void> {
    if (action.workerId !== this.workerId) throw new Error('worker_mismatch');
    await this.db.transaction(async (tx) => {
      const current = await tx.first<{ status: string }>(
        'SELECT status FROM outbox_actions WHERE worker_id=? AND client_action_id=?',
        [this.workerId, action.clientActionId],
      );
      if (current?.status !== 'sending') throw new Error('action_not_sending');
      if (outcome.kind === 'delivered')
        await this.acknowledge(tx, action, outcome.receipt, now);
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
        await this.markRefresh(tx, true);
      }
      await tx.run(
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
  private async markRefresh(tx: SqlExecutor, terms = false): Promise<void> {
    await tx.run(
      `UPDATE refresh_state SET assignment_refresh_needed=1,
      terms_refresh_needed=MAX(terms_refresh_needed,?),next_attempt_at=0,last_error_code=NULL WHERE worker_id=?`,
      [terms ? 1 : 0, this.workerId],
    );
  }
  private async acknowledge(
    tx: SqlExecutor,
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
      await tx.run(
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
      const old = await tx.first<{
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
        !old ||
        (old.serverId !== null && old.serverId !== receipt.submissionId)
      )
        throw new Error('receipt_submission_mismatch');
      if (
        receipt.serverRevision !== null &&
        old.revision === receipt.serverRevision &&
        (old.status !== receipt.status ||
          old.reason !== receipt.correctionReason)
      )
        throw new Error('conflicting_review_revision');
      // M4: an acknowledgment resolves delivery, never overwrites a newer staff review.
      const merge =
        old.status === null ||
        (old.status === 'pending_review' && old.revision === null) ||
        (receipt.serverRevision !== null &&
          old.revision !== null &&
          receipt.serverRevision > old.revision);
      await tx.run(
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
      await tx.run(
        `UPDATE documents SET latest_local_action_id=CASE WHEN latest_local_action_id=? THEN NULL ELSE latest_local_action_id END,
        updated_at=? WHERE worker_id=? AND document_type=?`,
        [action.clientActionId, now, this.workerId, receipt.documentType],
      );
    } else throw new Error('receipt_type_mismatch');
    if (receipt.serverRevision !== null)
      await tx.run(
        'UPDATE assignments SET server_revision=MAX(server_revision,?) WHERE worker_id=?',
        [receipt.serverRevision, this.workerId],
      );
    // Receipts omit creation timestamps/full state. Refresh independently after delivery.
    await this.markRefresh(tx);
  }
  async refreshState(): Promise<RefreshState> {
    const row = await this.db.first<{
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
    return row
      ? { ...row, needed: !!row.needed, blocked: !!row.blocked }
      : { needed: false, blocked: false, attemptCount: 0, nextAttemptAt: 0 };
  }
  async requestRefresh(): Promise<void> {
    await this.db.transaction((tx) => this.markRefresh(tx));
  }
  async cacheRefresh(snapshot: AssignmentSnapshot): Promise<void> {
    if (!(await this.worker.cacheAssignment(snapshot)))
      throw new Error('older_assignment_snapshot');
    await this.db.run(
      `UPDATE refresh_state SET assignment_refresh_needed=0,terms_refresh_needed=0,
      attempt_count=0,next_attempt_at=0,last_error_code=NULL WHERE worker_id=?`,
      [this.workerId],
    );
  }
  async deferRefresh(at: number, code: string): Promise<void> {
    await this.db.run(
      'UPDATE refresh_state SET attempt_count=attempt_count+1,next_attempt_at=?,last_error_code=? WHERE worker_id=?',
      [at, code, this.workerId],
    );
  }
  async blockRefresh(code: string): Promise<void> {
    await this.db.run(
      'UPDATE refresh_state SET last_error_code=?,attempt_count=attempt_count+1 WHERE worker_id=?',
      ['refresh_permanent:' + code, this.workerId],
    );
  }
  async retryNow(now: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run(
        "UPDATE outbox_actions SET next_attempt_at=?,updated_at=? WHERE worker_id=? AND status='retry_wait'",
        [now, now, this.workerId],
      );
      await tx.run(
        'UPDATE refresh_state SET next_attempt_at=?,last_error_code=NULL WHERE worker_id=? AND (assignment_refresh_needed OR terms_refresh_needed)',
        [now, this.workerId],
      );
    });
  }
  async replaceFailedTerms(
    id: string,
    displayedVersion: string,
  ): Promise<OutboxAction> {
    return this.worker.enqueueTerms(displayedVersion, id);
  }
  /** Explicit user replacement; no automatic supersession of stale or pending intent. */
  async replaceFailedDocument(
    id: string,
    file: DurableUpload,
  ): Promise<OutboxAction> {
    const predecessor = (await this.worker.listActions()).find(
      (a) => a.clientActionId === id,
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
      id,
    );
  }
}
