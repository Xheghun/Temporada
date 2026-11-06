import { decodeActionPayload, decodeLocalizedText } from './persisted-json.ts';
import type { Database, SqlExecutor } from '../connection.ts';
import type {
  ActionPayload,
  AssignmentSnapshot,
  DurableUpload,
  LocalSubmission,
  OutboxAction,
  WorkerPersistence,
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
const submissionColumns = `s.submission_id AS submissionId,
  s.document_type AS documentType,
  COALESCE(s.client_action_id, s.server_client_action_id) AS clientActionId,
  s.server_submission_id AS serverSubmissionId,
  s.server_status AS serverStatus,
  s.correction_reason AS correctionReason,
  s.server_revision AS serverRevision,
  s.server_created_at AS serverCreatedAt,
  s.created_at AS createdAt,
  s.replaces_submission_id AS replacesSubmissionId,
  a.status AS deliveryStatus`;
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
  private readonly db: Database;
  private readonly workerId: string;
  private readonly clock: { uuid: () => string; now: () => number };
  constructor(
    db: Database,
    workerId: string,
    clock: { uuid: () => string; now: () => number },
  ) {
    assertNonEmptyString(workerId);
    this.db = db;
    this.workerId = workerId;
    this.clock = clock;
  }

  async ensureWorkerIdentity(displayName: string): Promise<void> {
    assertNonEmptyString(displayName);
    await this.db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO workers(worker_id,display_name,updated_at) VALUES(?,?,?)
        ON CONFLICT(worker_id) DO UPDATE SET display_name=excluded.display_name`,
        [this.workerId, displayName, this.clock.now()],
      );
      await tx.run(
        'INSERT OR IGNORE INTO refresh_state(worker_id,assignment_refresh_needed) VALUES(?,1)',
        [this.workerId],
      );
    });
  }
  async cacheAssignment(snapshot: AssignmentSnapshot): Promise<boolean> {
    this.validateAssignment(snapshot);
    const now = this.clock.now();
    assertNonNegativeInteger(now);
    return this.db.transaction(async (tx) => {
      const existing = await tx.first<{ revision: number }>(
        'SELECT server_revision AS revision FROM assignments WHERE worker_id=?',
        [this.workerId],
      );
      if (existing && existing.revision > snapshot.serverRevision) return false;
      await this.cacheAssignmentRecords(tx, snapshot, now);
      await this.cacheCatalog(tx, snapshot.requiredDocuments, now);
      for (const submission of snapshot.documentSubmissions) {
        await this.mergeSubmission(tx, submission, now);
      }
      await tx.run('INSERT OR IGNORE INTO refresh_state(worker_id) VALUES(?)', [
        this.workerId,
      ]);
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
    for (const doc of snapshot.requiredDocuments) {
      assertNonEmptyString(doc.documentType);
      assertNonEmptyString(doc.label.es);
      assertNonEmptyString(doc.label.en);
      if (types.has(doc.documentType) || typeof doc.required !== 'boolean')
        throw new Error('invalid_catalog');
      types.add(doc.documentType);
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
    tx: SqlExecutor,
    snapshot: AssignmentSnapshot,
    now: number,
  ): Promise<void> {
    await tx.run(
      `INSERT INTO workers(worker_id,
          display_name,
          updated_at)
        VALUES (?,?,?)
        ON CONFLICT (worker_id)
        DO UPDATE SET display_name=excluded.display_name,
          updated_at=excluded.updated_at`,
      [this.workerId, snapshot.worker.displayName, now],
    );
    await tx.run(
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
    const a = snapshot.assignment;
    await tx.run(
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
        a.orderId,
        a.employer,
        a.worksite,
        a.seasonStart,
        a.seasonEnd,
        snapshot.terms.termsVersionId,
        snapshot.serverRevision,
        now,
      ],
    );
  }

  private async cacheCatalog(
    tx: SqlExecutor,
    catalog: AssignmentSnapshot['requiredDocuments'],
    now: number,
  ): Promise<void> {
    await tx.run('UPDATE document_catalog SET active=0 WHERE worker_id=?', [
      this.workerId,
    ]);
    for (const doc of catalog) {
      await tx.run(
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
          doc.documentType,
          JSON.stringify({ es: doc.label.es, en: doc.label.en }),
          doc.required ? 1 : 0,
        ],
      );
      await tx.run(
        `INSERT OR IGNORE INTO documents(worker_id,
          document_type,
          latest_local_action_id,
          latest_server_submission_id,
          updated_at)
        VALUES (?,?,NULL,NULL,?)`,
        [this.workerId, doc.documentType, now],
      );
    }
  }

  private async mergeSubmission(
    tx: SqlExecutor,
    incoming: AssignmentSnapshot['documentSubmissions'][number],
    now: number,
  ): Promise<void> {
    if (
      !(await tx.first(
        'SELECT 1 FROM document_catalog WHERE worker_id=? AND document_type=?',
        [this.workerId, incoming.documentType],
      ))
    )
      throw new Error('unknown_historical_document_type');
    const previous = await tx.first<LocalSubmission>(
      `SELECT ${submissionColumns}
        FROM document_submissions s
        LEFT JOIN outbox_actions a ON a.worker_id=s.worker_id AND a.client_action_id=s.client_action_id
        WHERE s.worker_id=? AND (s.server_submission_id=? OR s.client_action_id=?)`,
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
      await tx.run(
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
      await tx.run(
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
    await this.updateServerProjection(tx, incoming.documentType, now);
  }

  private async updateServerProjection(
    tx: SqlExecutor,
    documentType: string,
    now: number,
  ): Promise<void> {
    // A server snapshot never clears a newer local intent pointer. M2/M4/M8.
    await tx.run(
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
    return this.db.transaction(async (tx) => {
      const worker = await tx.first<AssignmentSnapshot['worker']>(
        'SELECT worker_id AS workerId,display_name AS displayName FROM workers WHERE worker_id=?',
        [this.workerId],
      );
      const row = await tx.first<
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
      const terms = await tx.first<{
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
      const catalog = await tx.all<{
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
      const submissions = await tx.all<LocalSubmission>(
        `SELECT ${submissionColumns}
        FROM document_submissions s
        LEFT JOIN outbox_actions a ON a.worker_id=s.worker_id AND a.client_action_id=s.client_action_id
        WHERE s.worker_id=?
        ORDER BY s.created_at,
          s.submission_id`,
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
        requiredDocuments: catalog.map((d) => ({
          documentType: d.documentType,
          required: Boolean(d.required),
          label: decodeLocalizedText(d.label),
        })),
        documentSubmissions: submissions
          .filter(
            (s) =>
              s.serverSubmissionId !== null &&
              s.serverStatus !== null &&
              s.serverRevision !== null,
          )
          .map((s) => ({
            submissionId: s.serverSubmissionId!,
            clientActionId: s.clientActionId!,
            documentType: s.documentType,
            status: s.serverStatus!,
            correctionReason: s.correctionReason,
            serverRevision: s.serverRevision!,
            createdAt: s.serverCreatedAt ?? s.createdAt,
            replacesSubmissionId: s.replacesSubmissionId,
          })),
        serverRevision: revision,
      };
    });
  }

  async listSubmissions(): Promise<LocalSubmission[]> {
    return this.db.all<LocalSubmission>(
      `SELECT ${submissionColumns}
        FROM document_submissions s
        LEFT JOIN outbox_actions a ON a.worker_id=s.worker_id AND a.client_action_id=s.client_action_id
        WHERE s.worker_id=?
        ORDER BY s.created_at,
          s.submission_id`,
      [this.workerId],
    );
  }
  async listActions(): Promise<OutboxAction[]> {
    return (
      await this.db.all<ActionRow>(
        `SELECT ${actionColumns} FROM outbox_actions WHERE worker_id=? ORDER BY sequence`,
        [this.workerId],
      )
    ).map(decodeActionRow);
  }
  async eligibleActions(now: number): Promise<OutboxAction[]> {
    assertNonNegativeInteger(now);
    return (
      await this.db.all<ActionRow>(
        `SELECT ${actionColumns}
        FROM outbox_actions
        WHERE worker_id=? AND status IN ('queued',
          'retry_wait') AND next_attempt_at<=?
        ORDER BY sequence`,
        [this.workerId, now],
      )
    ).map(decodeActionRow);
  }
  private newAction(
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
  private identity(): { id: string; now: number } {
    const id = this.clock.uuid();
    const now = this.clock.now();
    assertNonNegativeInteger(now);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw new Error('invalid_action_id');
    return { id, now };
  }
  private async insertAction(
    tx: SqlExecutor,
    action: OutboxAction,
  ): Promise<void> {
    await tx.run(
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
    const stored = await tx.first<{ sequence: number }>(
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
    const { id, now } = this.identity();
    const action = this.newAction(
      {
        kind: 'terms_acceptance',
        workerId: this.workerId,
        clientActionId: id,
        termsVersionId,
      },
      null,
      now,
    );
    await this.db.transaction(async (tx) => {
      if (
        !(await tx.first(
          'SELECT 1 FROM terms WHERE worker_id=? AND terms_version_id=?',
          [this.workerId, termsVersionId],
        ))
      )
        throw new Error('terms_not_cached');
      if (
        supersedesActionId &&
        !(await tx.first(
          "SELECT 1 FROM outbox_actions WHERE worker_id=? AND client_action_id=? AND action_type='terms_acceptance' AND status='failed_permanent'",
          [this.workerId, supersedesActionId],
        ))
      )
        throw new Error('supersession_not_allowed');
      await this.insertAction(tx, action);
      await tx.run(
        `INSERT INTO terms_intents(
          worker_id, client_action_id, terms_version_id, created_at
        ) VALUES (?,?,?,?)`,
        [this.workerId, id, termsVersionId, now],
      );
      if (supersedesActionId)
        await tx.run(
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
    const { id, now } = this.identity();
    const action = this.newAction(
      {
        kind: 'document_upload',
        workerId: this.workerId,
        clientActionId: id,
        documentType,
        localSubmissionId: id,
        sha256: file.sha256,
        replacesSubmissionId: replacesSubmissionId ?? null,
      },
      file.uri,
      now,
    );
    await this.db.transaction(async (tx) => {
      if (
        !(await tx.first(
          'SELECT 1 FROM document_catalog WHERE worker_id=? AND document_type=? AND active=1',
          [this.workerId, documentType],
        ))
      )
        throw new Error('document_not_in_catalog');
      if (
        replacesSubmissionId &&
        !(await tx.first(
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
        const predecessor = await tx.first<{ payload: string }>(
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
        if (
          payload.kind !== 'document_upload' ||
          payload.documentType !== documentType ||
          payload.replacesSubmissionId !== (replacesSubmissionId ?? null)
        )
          throw new Error('supersession_resource_mismatch');
      }
      await this.insertAction(tx, action);
      await tx.run(
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
          id,
          documentType,
          id,
          id,
          now,
          replacesSubmissionId ?? null,
        ],
      );
      await tx.run(
        'UPDATE documents SET latest_local_action_id=?,updated_at=? WHERE worker_id=? AND document_type=?',
        [id, now, this.workerId, documentType],
      );
      if (supersedesActionId)
        await tx.run(
          "UPDATE outbox_actions SET status='superseded',updated_at=? WHERE worker_id=? AND client_action_id=? AND status='failed_permanent'",
          [now, this.workerId, supersedesActionId],
        );
    });
    return action;
  }
  async claimAction(clientActionId: string, now: number): Promise<boolean> {
    assertNonNegativeInteger(now);
    const result = await this.db.run(
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
  async recoverSending(): Promise<number> {
    const result = await this.db.run(
      "UPDATE outbox_actions SET status='queued',updated_at=? WHERE worker_id=? AND status='sending'",
      [this.clock.now(), this.workerId],
    );
    return result.changes;
  }
}
