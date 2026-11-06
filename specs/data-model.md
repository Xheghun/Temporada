# Data model

All timestamps UTC epoch milliseconds. Versioned PRAGMA user_version migrations; foreign keys enabled per connection; migrations transactional and repeatable via version tracking. Worker-scoped queries are mandatory, never inferred from a mutable global selection.

| Table | Key / principal fields |
|---|---|
| workers | worker_id PK, display_name, optional normalized phone, updated_at |
| assignments | worker_id PK (one current assignment), order_id, employer, worksite, season_start/end, terms_version_id, server_revision, cached_at |
| terms | worker_id + terms_version_id PK, content/summary, server_acceptance_status, cached_at |
| document_catalog | worker_id + document_type PK, localized labels, required, active (snapshot revision belongs to assignment) |
| document_submissions | worker_id + submission_id PK (local UUID before acknowledgment), document_type, client_action_id unique nullable (local), server_client_action_id, server_submission_id nullable, server_status, correction_reason, server_revision, server_created_at, created_at |
| terms_intents | worker_id + client_action_id PK, terms_version_id, created_at; composite references to exact terms and owning outbox action |
| documents | worker_id + document_type PK, latest_local_action_id nullable, latest_server_submission_id, updated_at; projection only |
| outbox_actions | sequence INTEGER PK AUTOINCREMENT, id UNIQUE, worker_id FK, client_action_id unique, action_type, immutable payload_json, file_uri nullable, status, attempt_count, next_attempt_at, last_error_code, created_at, updated_at |
| refresh_state | worker_id PK, assignment_refresh_needed, terms_refresh_needed |

Indexes: outbox(worker_id,status,next_attempt_at,sequence), submissions(worker_id,document_type,created_at), worker-scoped assignment/catalog/terms indexes. Foreign keys/composite constraints ensure referenced submissions belong to the same worker. Payload includes terms version OR document type, local submission ID, optional replaced server submission ID and file digest; never token. File paths are generated under private worker/action UUID directories, not user input.

Delivery enum: queued, sending, retry_wait, delivered, stale, failed_permanent, superseded. Staff enum: pending_review, approved, correction_requested. Not submitted is absence; Pending Sync derives from a local active action. Keep failed delivery visible separately. Pending count counts queued/sending/retry_wait for selected worker; failed/stale require separate attention count.

Atomic enqueue: insert local intent/submission + outbox in one exclusive transaction. Ack: update action + that submission/terms acceptance in one transaction, never a different current worker row. Delivery acknowledgments update delivery independently; review fields merge only from strictly newer revisions for the same submission. Equal revisions must agree; older/missing/incomparable receipt revisions preserve known staff decisions and correction reasons (refresh if revision is unavailable). Stale outbox actions are resolved for ordering without supersession. Server snapshots merge by revision/submission identity and cannot replace local active actions. Preserve history of stale acceptance and corrections. New correction creates a new action; user replacement explicitly supersedes failed predecessor without deleting it.

Startup: recover sending; serialize file reconciliation with enqueue; detect missing bytes; remove only provably unreferenced app files. Keep files for active/failed uploads until ack or explicit resolution. Ack then cleanup is crash-safe; logout removes no pending rows/files. Token/authorized identity metadata live in SecureStore; selected worker is restored only when membership is known. No SQL encryption guarantee.

Implemented in persistent-outbox: migrations v1, foreign keys, parameterized worker-scoped repositories and immutable-action/submission identity triggers. outbox sequence is the deterministic enqueue order (not a wall-clock/UUID tie-breaker). Local creation time stays immutable; server_created_at is stored separately for latest-server-submission projections. Private connection serializes reads and transactions so no partial enqueue is visible. Repository metadata attestation does not replace the later file adapter's actual durable-file verification. See docs/persistence.md and docs/evidence/persistent-outbox.md for commands/evidence.
