# API contract (proposed mock v1)

Base URL from environment. Android emulator development example http://10.0.2.2:3000; no development address in production defaults. Authenticated calls: Authorization Bearer token and X-Worker-Id; validate membership for every request before reads/idempotency lookup. Mock convention requires backend developer approval before real integration, not claimed here. Invalid token 401; unauthorized worker 403. JSON errors {code, field?}; UI maps known codes to translations; no raw internal traces.

| Endpoint | Request | Success / expected failure |
|---|---|---|
| POST /auth/otp/request | {phoneNumber}, normalized fictional number | 200 OTP requested; 422 malformed |
| POST /auth/otp/verify | {phoneNumber,otp} | 200 {token,workers:[{workerId,displayName}]} for 123456; 401 invalid |
| GET /me/assignment | authorized headers | 200 {worker,assignment,terms,requiredDocuments,documentSubmissions,serverRevision}; 401/403 |
| POST /me/terms-acceptances | {clientActionId,termsVersionId} | 201 first; 200 replay; 409 stale_terms with current version; 422 invalid |
| POST /me/documents | multipart clientActionId,documentType,image; optional replacesSubmissionId | 201 {submissionId,clientActionId,documentType,status:pending_review,serverRevision}; 200 original replay; 413 upload_too_large; 422 unknown_document_type |

Terms success includes acceptanceId, clientActionId and termsVersionId. Seed terms v2; v3 publication replaces current version only, not historical acceptances. Assignment terms summary should be structured bilingual app-controlled content; server unknown free text remains unchanged. Document history carries IDs and revisions; corrections target a submission, never just type. Successful upload receipts include the original submission review revision, and replay returns that original receipt, not a fresh review decision. Assignment refresh exposes the latest review revision for each submission. Clients resolve delivery separately and retain newer cached decisions/reasons over older receipts.

Durable receipt UNIQUE(worker_id,client_action_id), operation type + canonical field/content digest fingerprint, original successful response and status. In one transaction commit receipt and business effect. Check receipt first after authorization; matching replay returns original result with HTTP 200 even if current terms changed. Changed fingerprint returns 409 action_id_conflict. Compute actual image digest, do not hash multipart boundaries. Validate size <1,500,000 bytes for first uploads.

Backend persistent SQLite database and private upload folder. Stage upload file before DB commit, reconcile unreferenced files; do not retain duplicate replay bytes. Dev-only inspection shows action/submission counts without tokens/image content. OTP/session behavior is mock-only, not production security.

Failure controls disabled in production: response delay 2000ms; seeded random-500 probability; one-shot disconnect after successful commit; publish v3; force 413 for a first upload; expire sessions. Controls use environment or local-only development endpoints. Implement backend smoke tests for seed, authorization, replay, payload conflict, process restart and every failure; document actual names/commands only after implementation. Never apply precommit failure controls to an already committed replay.
