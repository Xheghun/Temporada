# Document states and corrections

SDD-013 adds the backend-catalog Documents screen and a headless submission service. It uses the existing worker-scoped SQLite read transaction, outbox and revision-aware acknowledgment merge. No schema, backend API or native dependency changes are needed. Production access requires `worker_document_corrections` as well as the existing auth/Home flags; it fails closed. Explicit development assessment mode enables the local demo.

## State and conflict policy

The current catalog controls document names and required/optional labels. An absent submission is Not Submitted. Local queued/sending/retry-wait intent with no server evidence is Pending Sync. A server receipt or refresh provides Pending Review or an explicit staff decision; successful delivery never invents approval. Delivery state remains separate and is shown when its receipt is still pending or delivery failed. Unknown delivered state asks for refresh rather than claiming submission or approval.

History merges by submission/client-action identity. Review revisions only order decisions about the **same** submission. Explicit replacement links exclude predecessors from the current view; among unresolved local successors, outbox sequence preserves worker intent. Remaining server candidates use immutable creation time and a stable ID tie-break, not review revision. Thus a late/high-revision decision about an older passport stays in history and cannot replace a newer queued or acknowledged passport. A same-submission staff decision obtained by refresh stays visible before and after an old replay receipt.

## Submission service

`DocumentsService.submit(documentType, durableUpload, generation, expectedSubmissionId)` captures the worker/session and checks the current catalog/submission before enqueueing. It accepts a new image for an unsubmitted, corrected or locally failed document, suppresses duplicate taps, and rejects stale selection/worker callbacks. Correction creates a new action ID referring to the previous server submission. Failed local replacement atomically supersedes that failed action while inserting the new immutable intent. Existing history and decisions remain intact. Local state refreshes before sync is signaled; Home is notified using the captured worker ID.

The caller must supply verified durable private image bytes/digest (M7). This scope verifies orchestration using real durable image fixtures. Camera, compression, preview and the production file adapter belong to `document-capture`; photo controls are enabled when `worker_document_capture` is enabled; otherwise they remain explicitly unavailable. No fixture image or fake upload button is offered in the production worker UI.

Spanish/English resources cover app-owned statuses, errors, history and accessibility controls. Server correction reasons remain verbatim. Refresh failures do not hide cached history. Worker switch clears the view immediately and ignores late reads from the old generation.

See [executed verification](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/document-corrections.md).

## Subsequent SDD-022 presentation

Documents now uses divider-separated rows, explicit sending/retry feedback and collapsed per-document history. A known staff decision remains visible independently of pending/failed delivery; reasons remain verbatim. The count means current required submissions delivered for staff review, not approval: local pending/failed replacements and historical submissions do not count, while delivered correction requests do. This definition is displayed beside the count. Route guards and expected submission/generation capture parameters are unchanged. Targeted bilingual/presentation tests pass; native evidence is recorded separately.
