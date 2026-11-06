import type { Database } from '../connection.ts';

const versionOne = `
CREATE TABLE workers(worker_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE assignments(worker_id TEXT PRIMARY KEY REFERENCES workers(worker_id), order_id TEXT NOT NULL, employer TEXT NOT NULL, worksite TEXT NOT NULL, season_start TEXT NOT NULL, season_end TEXT NOT NULL, terms_version_id TEXT NOT NULL, server_revision INTEGER NOT NULL, cached_at INTEGER NOT NULL);
CREATE TABLE terms(worker_id TEXT NOT NULL REFERENCES workers(worker_id), terms_version_id TEXT NOT NULL, content_json TEXT NOT NULL, server_acceptance_status TEXT NOT NULL CHECK(server_acceptance_status IN ('accepted','not_confirmed')), cached_at INTEGER NOT NULL, PRIMARY KEY(worker_id,terms_version_id));
CREATE TABLE document_catalog(worker_id TEXT NOT NULL REFERENCES workers(worker_id), document_type TEXT NOT NULL, content_json TEXT NOT NULL, required INTEGER NOT NULL CHECK(required IN(0,1)), active INTEGER NOT NULL CHECK(active IN(0,1)), PRIMARY KEY(worker_id,document_type));
CREATE TABLE outbox_actions(sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, worker_id TEXT NOT NULL REFERENCES workers(worker_id), client_action_id TEXT NOT NULL UNIQUE, action_type TEXT NOT NULL CHECK(action_type IN ('terms_acceptance','document_upload')), payload_json TEXT NOT NULL, file_uri TEXT, status TEXT NOT NULL CHECK(status IN ('queued','sending','retry_wait','delivered','stale','failed_permanent','superseded')), attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0), next_attempt_at INTEGER NOT NULL, last_error_code TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(worker_id,client_action_id));
CREATE TABLE terms_intents(worker_id TEXT NOT NULL, client_action_id TEXT NOT NULL UNIQUE, terms_version_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(worker_id,client_action_id), FOREIGN KEY(worker_id,client_action_id) REFERENCES outbox_actions(worker_id,client_action_id), FOREIGN KEY(worker_id,terms_version_id) REFERENCES terms(worker_id,terms_version_id));
CREATE TABLE document_submissions(worker_id TEXT NOT NULL, submission_id TEXT NOT NULL, document_type TEXT NOT NULL, client_action_id TEXT UNIQUE, server_client_action_id TEXT NOT NULL, server_submission_id TEXT, server_status TEXT CHECK(server_status IN('pending_review','approved','correction_requested')), correction_reason TEXT, server_revision INTEGER, server_created_at INTEGER, created_at INTEGER NOT NULL, replaces_submission_id TEXT, PRIMARY KEY(worker_id,submission_id), UNIQUE(worker_id,server_submission_id), UNIQUE(worker_id,client_action_id), FOREIGN KEY(worker_id,document_type) REFERENCES document_catalog(worker_id,document_type), FOREIGN KEY(worker_id,client_action_id) REFERENCES outbox_actions(worker_id,client_action_id));
CREATE TABLE documents(worker_id TEXT NOT NULL, document_type TEXT NOT NULL, latest_local_action_id TEXT, latest_server_submission_id TEXT, updated_at INTEGER NOT NULL, PRIMARY KEY(worker_id,document_type), FOREIGN KEY(worker_id,document_type) REFERENCES document_catalog(worker_id,document_type), FOREIGN KEY(worker_id,latest_local_action_id) REFERENCES outbox_actions(worker_id,client_action_id), FOREIGN KEY(worker_id,latest_server_submission_id) REFERENCES document_submissions(worker_id,server_submission_id));
CREATE TABLE refresh_state(worker_id TEXT PRIMARY KEY REFERENCES workers(worker_id), assignment_refresh_needed INTEGER NOT NULL DEFAULT 0, terms_refresh_needed INTEGER NOT NULL DEFAULT 0);
CREATE INDEX outbox_eligibility ON outbox_actions(worker_id,status,next_attempt_at,sequence);
CREATE INDEX document_history ON document_submissions(worker_id,document_type,created_at,submission_id);
CREATE TRIGGER immutable_outbox_payload BEFORE UPDATE OF sequence,id,worker_id,client_action_id,action_type,payload_json,file_uri,created_at ON outbox_actions BEGIN SELECT RAISE(ABORT,'immutable_action'); END;
CREATE TRIGGER immutable_local_submission BEFORE UPDATE OF worker_id,submission_id,document_type,client_action_id,created_at,replaces_submission_id ON document_submissions BEGIN SELECT RAISE(ABORT,'immutable_submission'); END;
PRAGMA user_version=1;
`;

export async function migrateDatabase(db: Database): Promise<void> {
  await db.exec(
    'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;',
  );
  await db.transaction(async (tx) => {
    const current = await tx.first<{ user_version: number }>(
      'PRAGMA user_version',
    );
    if (!current || current.user_version > 2)
      throw new Error('unsupported_database_version');
    if (current.user_version === 0) await tx.exec(versionOne);
    if (current.user_version < 2)
      await tx.exec(`
      ALTER TABLE refresh_state ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE refresh_state ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE refresh_state ADD COLUMN last_error_code TEXT;
      PRAGMA user_version=2;
    `);
  });
}
