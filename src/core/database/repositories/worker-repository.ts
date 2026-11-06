import { decodeActionPayload, decodeLocalizedText } from './persisted-json.ts';
import type { Database, SqlExecutor } from '../connection.ts';
import type {
  ActionPayload,
  AssignmentSnapshot,
  DurableUpload,
  LocalSubmission,
  OutboxAction,
  WorkerPersistence,
  WorkerViewData,
} from '../../offline/domain/types.ts';

type ActionRow = Omit<OutboxAction, 'payload'> & { payloadJson: string };
const actionColumns = `sequence,
  id,
  worker_id AS workerId,
  client_action_id AS clientActionId,
  action_type AS actionType,
  payload_json AS payloadJson,
  file_uri AS fileUri,
  status,
  attempt_count AS attemptCount,
  next_attempt_at AS nextAttemptAt,
  last_error_code AS lastErrorCode,
  created_at AS createdAt,
  updated_at AS updatedAt`;
const submissionColumns = `submission.submission_id AS submissionId,
  submission.document_type AS documentType,
  COALESCE(submission.client_action_id, submission.server_client_action_id) AS clientActionId,
  submission.server_submission_id AS serverSubmissionId,
  submission.server_status AS serverStatus,
  submission.correction_reason AS correctionReason,
  submission.server_revision AS serverRevision,
  submission.server_created_at AS serverCreatedAt,
  submission.created_at AS createdAt,
  submission.replaces_submission_id AS replacesSubmissionId,
  outboxAction.status AS deliveryStatus`;
const decodeActionRow = (row: ActionRow): OutboxAction => {
  const { payloadJson, ...metadata } = row;
  return { ...metadata, payload: decodeActionPayload(payloadJson, metadata) };
};
const assertNonEmptyString = (value: string): void => {
  if (typeof value !== 'string' || !value.trim())
    throw new Error('invalid_input');
};
const assertNonNegativeInteger = (value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error('invalid_timestamp_or_revision');
};

/** A captured worker ID is required for every query; no selected-worker global is consulted. M10. */
export class WorkerRepository implements WorkerPersistence {
  private readonly database: Database;
  private readonly workerId: string;
  private readonly clock: { uuid: () => string; now: () => number };
  constructor(
    database: Database,
    workerId: string,
    clock: { uuid: () => string; now: () => number },
  ) {
    assertNonEmptyString(workerId);
    this.database = database;
    this.workerId = workerId;
    this.clock = clock;
  }

  async ensureWorkerIdentity(displayName: string): Promise<void> {
    assertNonEmptyString(displayName);
    await this.database.transaction(async (transaction) => {
      await transaction.run(
        `INSERT INTO workers(worker_id,display_name,updated_at) VALUES(?,?,?)
        ON CONFLICT(worker_id) DO UPDATE SET display_name=excluded.display_name`,
        [this.workerId, displayName, this.clock.now()],
      );
      await transaction.run(
        'INSERT OR IGNORE INTO refresh_state(worker_id,assignment_refresh_needed) VALUES(?,1)',
        [this.workerId],
      );
    });
  }
  async cacheAssignment(snapshot: AssignmentSnapshot): Promise<boolean> {
    this.validateAssignment(snapshot);
    const now = this.clock.now();
    assertNonNegativeInteger(now);
    return this.database.transaction(async (transaction) => {
      const existing = await transaction.first<{ revision: number }>(
        'SELECT server_revision AS revision FROM assignments WHERE worker_id=?',
        [this.workerId],
      );
      if (existing && existing.revision > snapshot.serverRevision) return false;
      await this.cacheAssignmentRecords(transaction, snapshot, now);
      await this.cacheCatalog(transaction, snapshot.requiredDocuments, now);
      for (const submission of snapshot.documentSubmissions) {
        await this.mergeSubmission(transaction, submission, now);
      }
      await transaction.run(
        'INSERT OR IGNORE INTO refresh_state(worker_id) VALUES(?)',
        [this.workerId],
      );
      return true;
    });
  }

  private validateAssignment(snapshot: AssignmentSnapshot): void {
    if (snapshot.worker.workerId !== this.workerId)
      throw new Error('worker_mismatch');
    assertNonEmptyString(snapshot.worker.displayName);
    assertNonNegativeInteger(snapshot.serverRevision);
    for (const value of Object.values(snapshot.assignment))
      assertNonEmptyString(value);
    assertNonEmptyString(snapshot.terms.termsVersionId);
    assertNonEmptyString(snapshot.terms.summary.es);
    assertNonEmptyString(snapshot.terms.summary.en);
    if (
      !['accepted', 'not_confirmed'].includes(
        snapshot.terms.serverAcceptanceStatus,
      )
    )
      throw new Error('invalid_terms_status');
    const types = new Set<string>();
    for (const document of snapshot.requiredDocuments) {
      assertNonEmptyString(document.documentType);
      assertNonEmptyString(document.label.es);
      assertNonEmptyString(document.label.en);
      if (
        types.has(document.documentType) ||
        typeof document.required !== 'boolean'
      )
        throw new Error('invalid_catalog');
      types.add(document.documentType);
    }
    for (const submission of snapshot.documentSubmissions) {
      assertNonEmptyString(submission.submissionId);
      assertNonEmptyString(submission.clientActionId);
      assertNonNegativeInteger(submission.serverRevision);
      assertNonNegativeInteger(submission.createdAt);
      assertNonEmptyString(submission.documentType);
      if (
        !['pending_review', 'approved', 'correction_requested'].includes(
          submission.status,
        ) ||
        submission.serverRevision > snapshot.serverRevision
      )
        throw new Error('invalid_server_submission');
      if (
        submission.correctionReason !== null &&
        typeof submission.correctionReason !== 'string'
      )
        throw new Error('invalid_correction_reason');
    }
  }

  private async cacheAssignmentRecords(
    transaction: SqlExecutor,
    snapshot: AssignmentSnapshot,
    now: number,
  ): Promise<void> {
    await transaction.run(
      `INSERT INTO workers(worker_id,
          display_name,
          updated_at)
        VALUES (?,?,?)
        ON CONFLICT (worker_id)
        DO UPDATE SET display_name=excluded.display_name,
          updated_at=excluded.updated_at`,
      [this.workerId, snapshot.worker.displayName, now],
    );
    await transaction.run(
      `INSERT INTO terms(worker_id,
          terms_version_id,
          content_json,
          server_acceptance_status,
          cached_at)
        VALUES (?,?,?,?,?)
        ON CONFLICT (worker_id, terms_version_id)
        DO UPDATE SET content_json=excluded.content_json,
          server_acceptance_status=excluded.server_acceptance_status,
          cached_at=excluded.cached_at`,
      [
        this.workerId,
        snapshot.terms.termsVersionId,
        JSON.stringify({
          es: snapshot.terms.summary.es,
          en: snapshot.terms.summary.en,
        }),
        snapshot.terms.serverAcceptanceStatus,
        now,
      ],
    );
    const assignment = snapshot.assignment;
    await transaction.run(
      `INSERT INTO assignments(worker_id,
          order_id,
          employer,
          worksite,
          season_start,
          season_end,
          terms_version_id,
          server_revision,
          cached_at)
        VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT (worker_id)
        DO UPDATE SET order_id=excluded.order_id,
          employer=excluded.employer,
          worksite=excluded.worksite,
          season_start=excluded.season_start,
          season_end=excluded.season_end,
          terms_version_id=excluded.terms_version_id,
          server_revision=excluded.server_revision,
          cached_at=excluded.cached_at`,
      [
        this.workerId,
        assignment.orderId,
        assignment.employer,
        assignment.worksite,
        assignment.seasonStart,
        assignment.seasonEnd,
        snapshot.terms.termsVersionId,
        snapshot.serverRevision,
        now,
      ],
    );
  }

  private async cacheCatalog(
    transaction: SqlExecutor,
    catalog: AssignmentSnapshot['requiredDocuments'],
    now: number,
  ): Promise<void> {
    await transaction.run(
      'UPDATE document_catalog SET active=0 WHERE worker_id=?',
      [this.workerId],
    );
    for (const document of catalog) {
      await transaction.run(
        `INSERT INTO document_catalog(worker_id,
          document_type,
          content_json,
          required,
          active)
        VALUES (?,?,?,?,1)
        ON CONFLICT (worker_id, document_type)
        DO UPDATE SET content_json=excluded.content_json,
          required=excluded.required,
          active=1`,
        [
          this.workerId,
          document.documentType,
          JSON.stringify({ es: document.label.es, en: document.label.en }),
          document.required ? 1 : 0,
        ],
      );
      await transaction.run(
        `INSERT OR IGNORE INTO documents(worker_id,
          document_type,
          latest_local_action_id,
          latest_server_submission_id,
          updated_at)
        VALUES (?,?,NULL,NULL,?)`,
        [this.workerId, document.documentType, now],
      );
    }
  }

  private async mergeSubmission(
    transaction: SqlExecutor,
    incoming: AssignmentSnapshot['documentSubmissions'][number],
    now: number,
  ): Promise<void> {
    if (
      !(await transaction.first(
        'SELECT 1 FROM document_catalog WHERE worker_id=? AND document_type=?',
        [this.workerId, incoming.documentType],
      ))
    )
      throw new Error('unknown_historical_document_type');
    const previous = await transaction.first<LocalSubmission>(
      `SELECT ${submissionColumns}
        FROM document_submissions AS submission
        LEFT JOIN outbox_actions AS outboxAction ON outboxAction.worker_id=submission.worker_id AND outboxAction.client_action_id=submission.client_action_id
        WHERE submission.worker_id=? AND (submission.server_submission_id=? OR submission.client_action_id=?)`,
      [this.workerId, incoming.submissionId, incoming.clientActionId],
    );
    if (
      previous &&
      (previous.documentType !== incoming.documentType ||
        previous.clientActionId !== incoming.clientActionId ||
        (previous.serverCreatedAt !== null &&
          previous.serverCreatedAt !== incoming.createdAt) ||
        (previous.serverSubmissionId !== null &&
          previous.serverSubmissionId !== incoming.submissionId))
    )
      throw new Error('submission_identity_conflict');
    if (
      previous?.serverRevision !== null &&
      previous?.serverRevision !== undefined
    ) {
      if (previous.serverRevision > incoming.serverRevision) return;
      if (previous.serverRevision === incoming.serverRevision) {
        if (
          previous.serverStatus !== incoming.status ||
          previous.correctionReason !== incoming.correctionReason
        )
          throw new Error('conflicting_review_revision');
        // Upload receipts omit creation time. Equal-review snapshots may still complete metadata/projections.
        if (previous.serverCreatedAt !== null) return;
      }
    }
    if (previous) {
      await transaction.run(
        `UPDATE document_submissions
        SET server_submission_id=?,
          server_client_action_id=?,
          server_status=?,
          correction_reason=?,
          server_revision=?,
          server_created_at=?
        WHERE worker_id=? AND submission_id=?`,
        [
          incoming.submissionId,
          incoming.clientActionId,
          incoming.status,
          incoming.correctionReason,
          incoming.serverRevision,
          incoming.createdAt,
          this.workerId,
          previous.submissionId,
        ],
      );
    } else {
      await transaction.run(
        `INSERT INTO document_submissions(worker_id,
          submission_id,
          document_type,
          client_action_id,
          server_client_action_id,
          server_submission_id,
          server_status,
          correction_reason,
          server_revision,
          server_created_at,
          created_at,
          replaces_submission_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          this.workerId,
          incoming.submissionId,
          incoming.documentType,
          null,
          incoming.clientActionId,
          incoming.submissionId,
          incoming.status,
          incoming.correctionReason,
          incoming.serverRevision,
          incoming.createdAt,
          incoming.createdAt,
          incoming.replacesSubmissionId ?? null,
        ],
      );
    }
    await this.updateServerProjection(transaction, incoming.documentType, now);
  }

  private async updateServerProjection(
    transaction: SqlExecutor,
    documentType: string,
    now: number,
  ): Promise<void> {
    // A server snapshot never clears a newer local intent pointer. M2/M4/M8.
    await transaction.run(
      `UPDATE documents
        SET latest_server_submission_id=(SELECT server_submission_id
        FROM document_submissions
        WHERE worker_id=? AND document_type=? AND server_submission_id IS NOT NULL
        ORDER BY server_created_at DESC,
          submission_id DESC LIMIT 1),
          updated_at=?
        WHERE worker_id=? AND document_type=?`,
      [this.workerId, documentType, now, this.workerId, documentType],
    );
  }

  async getAssignment(): Promise<AssignmentSnapshot | null> {
    return this.database.transaction((transaction) =>
      this.readAssignment(transaction),
    );
  }
  async readView(): Promise<WorkerViewData> {
    return this.database.transaction(async (transaction) => {
      const assignment = await this.readAssignment(transaction);
      const actions = (
        await transaction.all<ActionRow>(
          `SELECT ${actionColumns} FROM outbox_actions WHERE worker_id=? ORDER BY sequence`,
          [this.workerId],
        )
      ).map(decodeActionRow);
      const cache = await transaction.first<{ cachedAt: number }>(
        'SELECT cached_at AS cachedAt FROM assignments WHERE worker_id=?',
        [this.workerId],
      );
      const refresh = await transaction.first<{
        needed: number;
        error: string | null;
      }>(
        `SELECT (assignment_refresh_needed OR terms_refresh_needed) AS needed,last_error_code AS error FROM refresh_state WHERE worker_id=?`,
        [this.workerId],
      );
      return {
        assignment,
        actions,
        cachedAt: cache?.cachedAt ?? null,
        refreshNeeded: !!refresh?.needed,
        refreshError: refresh?.error ?? null,
      };
    });
  }
  private async readAssignment(
    transaction: SqlExecutor,
  ): Promise<AssignmentSnapshot | null> {
    const worker = await transaction.first<AssignmentSnapshot['worker']>(
      'SELECT worker_id AS workerId,display_name AS displayName FROM workers WHERE worker_id=?',
      [this.workerId],
    );
    const row = await transaction.first<
      AssignmentSnapshot['assignment'] & { version: string; revision: number }
    >(
      `SELECT order_id AS orderId,
          employer,
          worksite,
          season_start AS seasonStart,
          season_end AS seasonEnd,
          terms_version_id AS version,
          server_revision AS revision
        FROM assignments
        WHERE worker_id=?`,
      [this.workerId],
    );
    if (!worker || !row) return null;
    const terms = await transaction.first<{
      content: string;
      status: AssignmentSnapshot['terms']['serverAcceptanceStatus'];
    }>(
      `SELECT content_json AS content,
          server_acceptance_status AS status
        FROM terms
        WHERE worker_id=? AND terms_version_id=?`,
      [this.workerId, row.version],
    );
    if (!terms) throw new Error('missing_cached_terms');
    const catalog = await transaction.all<{
      documentType: string;
      required: number;
      label: string;
    }>(
      `SELECT document_type AS documentType,
          required,
          content_json AS label
        FROM document_catalog
        WHERE worker_id=? AND active=1
        ORDER BY document_type`,
      [this.workerId],
    );
    const submissions = await transaction.all<LocalSubmission>(
      `SELECT ${submissionColumns}
        FROM document_submissions AS submission
        LEFT JOIN outbox_actions AS outboxAction ON outboxAction.worker_id=submission.worker_id AND outboxAction.client_action_id=submission.client_action_id
        WHERE submission.worker_id=?
        ORDER BY submission.created_at,
          submission.submission_id`,
      [this.workerId],
    );
    const { version, revision, ...assignment } = row;
    return {
      worker,
      assignment,
      terms: {
        termsVersionId: version,
        summary: decodeLocalizedText(terms.content),
        serverAcceptanceStatus: terms.status,
      },
      requiredDocuments: catalog.map((catalogDocument) => ({
        documentType: catalogDocument.documentType,
        required: Boolean(catalogDocument.required),
        label: decodeLocalizedText(catalogDocument.label),
      })),
      documentSubmissions: submissions
        .filter(
          (submission) =>
            submission.serverSubmissionId !== null &&
            submission.serverStatus !== null &&
            submission.serverRevision !== null,
        )
        .map((submission) => ({
          submissionId: submission.serverSubmissionId!,
          clientActionId: submission.clientActionId!,
          documentType: submission.documentType,
          status: submission.serverStatus!,
          correctionReason: submission.correctionReason,
          serverRevision: submission.serverRevision!,
          createdAt: submission.serverCreatedAt ?? submission.createdAt,
          replacesSubmissionId: submission.replacesSubmissionId,
        })),
      serverRevision: revision,
    };
  }

  async listSubmissions(): Promise<LocalSubmission[]> {
    return this.database.all<LocalSubmission>(
      `SELECT ${submissionColumns}
        FROM document_submissions AS submission
        LEFT JOIN outbox_actions AS outboxAction ON outboxAction.worker_id=submission.worker_id AND outboxAction.client_action_id=submission.client_action_id
        WHERE submission.worker_id=?
        ORDER BY submission.created_at,
          submission.submission_id`,
      [this.workerId],
    );
  }
  async listActions(): Promise<OutboxAction[]> {
    return (
      await this.database.all<ActionRow>(
        `SELECT ${actionColumns} FROM outbox_actions WHERE worker_id=? ORDER BY sequence`,
        [this.workerId],
      )
    ).map(decodeActionRow);
  }
  async eligibleActions(now: number): Promise<OutboxAction[]> {
    assertNonNegativeInteger(now);
    return (
      await this.database.all<ActionRow>(
        `SELECT ${actionColumns}
        FROM outbox_actions
        WHERE worker_id=? AND status IN ('queued',
          'retry_wait') AND next_attempt_at<=?
        ORDER BY sequence`,
        [this.workerId, now],
      )
    ).map(decodeActionRow);
  }
  private createQueuedAction(
    payload: ActionPayload,
    fileUri: string | null,
    now: number,
  ): OutboxAction {
    return {
      sequence: 0,
      id: payload.clientActionId,
      workerId: this.workerId,
      clientActionId: payload.clientActionId,
      actionType: payload.kind,
      payload,
      fileUri,
      status: 'queued',
      attemptCount: 0,
      nextAttemptAt: now,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
    };
  }
  private createActionIdentity(): { id: string; now: number } {
    const actionId = this.clock.uuid();
    const now = this.clock.now();
    assertNonNegativeInteger(now);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        actionId,
      )
    )
      throw new Error('invalid_action_id');
    return { id: actionId, now };
  }
  private async insertAction(
    transaction: SqlExecutor,
    action: OutboxAction,
  ): Promise<void> {
    await transaction.run(
      `INSERT INTO outbox_actions(id,
          worker_id,
          client_action_id,
          action_type,
          payload_json,
          file_uri,
          status,
          attempt_count,
          next_attempt_at,
          last_error_code,
          created_at,
          updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        action.id,
        this.workerId,
        action.clientActionId,
        action.actionType,
        JSON.stringify(action.payload),
        action.fileUri,
        action.status,
        0,
        action.nextAttemptAt,
        null,
        action.createdAt,
        action.updatedAt,
      ],
    );
    const stored = await transaction.first<{ sequence: number }>(
      'SELECT sequence FROM outbox_actions WHERE worker_id=? AND client_action_id=?',
      [this.workerId, action.clientActionId],
    );
    if (!stored) throw new Error('action_insert_failed');
    action.sequence = stored.sequence;
  }
  async enqueueTerms(
    termsVersionId: string,
    supersedesActionId?: string,
  ): Promise<OutboxAction> {
    assertNonEmptyString(termsVersionId);
    const { id: actionId, now } = this.createActionIdentity();
    const action = this.createQueuedAction(
      {
        kind: 'terms_acceptance',
        workerId: this.workerId,
        clientActionId: actionId,
        termsVersionId,
      },
      null,
      now,
    );
    await this.database.transaction(async (transaction) => {
      if (
        !(await transaction.first(
          'SELECT 1 FROM terms WHERE worker_id=? AND terms_version_id=?',
          [this.workerId, termsVersionId],
        ))
      )
        throw new Error('terms_not_cached');
      if (
        supersedesActionId &&
        !(await transaction.first(
          "SELECT 1 FROM outbox_actions WHERE worker_id=? AND client_action_id=? AND action_type='terms_acceptance' AND status='failed_permanent'",
          [this.workerId, supersedesActionId],
        ))
      )
        throw new Error('supersession_not_allowed');
      await this.insertAction(transaction, action);
      await transaction.run(
        `INSERT INTO terms_intents(
          worker_id, client_action_id, terms_version_id, created_at
        ) VALUES (?,?,?,?)`,
        [this.workerId, actionId, termsVersionId, now],
      );
      if (supersedesActionId)
        await transaction.run(
          "UPDATE outbox_actions SET status='superseded',updated_at=? WHERE worker_id=? AND client_action_id=?",
          [now, this.workerId, supersedesActionId],
        );
    });
    return action;
  }
  async enqueueDocument(
    documentType: string,
    file: DurableUpload,
    replacesSubmissionId?: string,
    supersedesActionId?: string,
  ): Promise<OutboxAction> {
    assertNonEmptyString(documentType);
    if (
      file.workerId !== this.workerId ||
      !file.uri.startsWith('file://') ||
      /(?:\/cache\/|\/Caches\/|[?#])/.test(file.uri) ||
      !/^[a-f0-9]{64}$/i.test(file.sha256) ||
      !Number.isSafeInteger(file.byteSize) ||
      file.byteSize <= 0 ||
      file.byteSize >= 1_500_000
    )
      throw new Error('invalid_durable_upload');
    const { id: actionId, now } = this.createActionIdentity();
    const action = this.createQueuedAction(
      {
        kind: 'document_upload',
        workerId: this.workerId,
        clientActionId: actionId,
        documentType,
        localSubmissionId: actionId,
        sha256: file.sha256,
        replacesSubmissionId: replacesSubmissionId ?? null,
      },
      file.uri,
      now,
    );
    await this.database.transaction(async (transaction) => {
      if (
        !(await transaction.first(
          'SELECT 1 FROM document_catalog WHERE worker_id=? AND document_type=? AND active=1',
          [this.workerId, documentType],
        ))
      )
        throw new Error('document_not_in_catalog');
      if (
        replacesSubmissionId &&
        !(await transaction.first(
          `SELECT 1
        FROM document_submissions
        WHERE worker_id=? AND document_type=? AND (submission_id=? OR server_submission_id=?)`,
          [
            this.workerId,
            documentType,
            replacesSubmissionId,
            replacesSubmissionId,
          ],
        ))
      )
        throw new Error('replacement_not_owned');
      if (supersedesActionId) {
        const predecessor = await transaction.first<{ payload: string }>(
          `SELECT payload_json AS payload FROM outbox_actions
           WHERE worker_id=? AND client_action_id=? AND status='failed_permanent'
             AND action_type='document_upload'`,
          [this.workerId, supersedesActionId],
        );
        if (!predecessor) throw new Error('supersession_not_allowed');
        const payload = decodeActionPayload(predecessor.payload, {
          workerId: this.workerId,
          clientActionId: supersedesActionId,
          actionType: 'document_upload',
        });
        // M5/M8: refresh may know this failed action's server submission even when its local receipt never completed.
        const replacesFailedServerSubmission =
          replacesSubmissionId &&
          (await transaction.first(
            `SELECT 1 FROM document_submissions
           WHERE worker_id=? AND document_type=? AND client_action_id=? AND server_submission_id=?`,
            [
              this.workerId,
              documentType,
              supersedesActionId,
              replacesSubmissionId,
            ],
          ));
        if (
          payload.kind !== 'document_upload' ||
          payload.documentType !== documentType ||
          (payload.replacesSubmissionId !== (replacesSubmissionId ?? null) &&
            !replacesFailedServerSubmission)
        )
          throw new Error('supersession_resource_mismatch');
      }
      await this.insertAction(transaction, action);
      await transaction.run(
        `INSERT INTO document_submissions(worker_id,
          submission_id,
          document_type,
          client_action_id,
          server_client_action_id,
          created_at,
          replaces_submission_id)
        VALUES (?,?,?,?,?,?,?)`,
        [
          this.workerId,
          actionId,
          documentType,
          actionId,
          actionId,
          now,
          replacesSubmissionId ?? null,
        ],
      );
      await transaction.run(
        'UPDATE documents SET latest_local_action_id=?,updated_at=? WHERE worker_id=? AND document_type=?',
        [actionId, now, this.workerId, documentType],
      );
      if (supersedesActionId)
        await transaction.run(
          "UPDATE outbox_actions SET status='superseded',updated_at=? WHERE worker_id=? AND client_action_id=? AND status='failed_permanent'",
          [now, this.workerId, supersedesActionId],
        );
    });
    return action;
  }
  async claimAction(clientActionId: string, now: number): Promise<boolean> {
    assertNonNegativeInteger(now);
    const result = await this.database.run(
      `UPDATE outbox_actions
        SET status='sending',
          attempt_count=attempt_count+1,
          updated_at=?
        WHERE worker_id=? AND client_action_id=? AND status IN ('queued',
          'retry_wait') AND next_attempt_at<=?`,
      [now, this.workerId, clientActionId, now],
    );
    return result.changes === 1;
  }
  async failUploadFile(actionId: string, code: string): Promise<void> {
    await this.database.run(
      `UPDATE outbox_actions SET status='failed_permanent',last_error_code=?,updated_at=?
       WHERE worker_id=? AND client_action_id=? AND action_type='document_upload' AND status IN ('queued','retry_wait')`,
      [code, this.clock.now(), this.workerId, actionId],
    );
  }
  async recoverSending(): Promise<number> {
    const result = await this.database.run(
      "UPDATE outbox_actions SET status='queued',updated_at=? WHERE worker_id=? AND status='sending'",
      [this.clock.now(), this.workerId],
    );
    return result.changes;
  }
}
