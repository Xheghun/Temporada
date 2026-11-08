# Guided document capture

SDD-014 uses SDK 58-compatible expo-image-picker, expo-image-manipulator and expo-image. Production capture is gated by `worker_document_capture`, alongside the earlier auth/Home/Documents flags. Development assessment mode enables the emulator workflow. This adds native packages and camera/photo permission descriptions; microphone permission is disabled. Spanish/English iOS permission descriptions are configured through Expo locales (not build-tested on iOS). App version is now 1.1.0 so the existing appVersion runtime policy separates it from the earlier binary. Build a new binary before production use; this is not a JS-only OTA change.

## Capture and enqueue

Documents passes the displayed catalog type, expected submission identity, worker and session generation. The capture service validates that selection, lazily asks for camera permission or opens the system photo picker, and prepares a JPEG preview. No broad Android media permission is required for the system picker. Camera denial offers settings or gallery; cancellation preserves an existing preview. Settings failures are reported. Back, worker switch and late picker results clear/discard unqueued drafts without deleting queued intent.

Compression uses the current ImageManipulator context API. At most four JPEG attempts reduce maximum dimension/quality (1600/.8, 1280/.65, 960/.5, 720/.35), without upscaling. Each output is measured. Only bytes strictly below 1,500,000 can proceed; the private copied file is measured and SHA-256 hashed again. Native contexts/images are released. expo-image displays the preview with caching disabled; Save requires an explicit tap.

Private files use `Paths.document/workers/{workerId}/uploads/capture-{uuid}.jpg`. The file UUID is separate from the stable client action UUID. Worker IDs/path ownership and generated basenames are checked. App-created picker/manipulator cache copies are removed; user-owned gallery originals are untouched. A private worker-scoped journal records temporary URIs before compression and after each generated output; writes/copies are awaited using SDK 58 APIs. Recovery cleans only app cache URIs recorded in that journal. It never blindly deletes the durable destination.

`UploadFileStore` serializes prepare, preview leases, enqueue and reconciliation. Before calling the existing document service it rechecks ownership, actual size and digest. The service then performs its existing atomic intent/outbox transaction. Duplicate saves are suppressed. A database failure removes the unreferenced private copy; if commit status is ambiguous, a worker-scoped reference query resolves an existing action or retains bytes when the query itself fails. Capture does not report server approval.

## File recovery

- Active preview leases prevent in-process orphan cleanup.
- Restart drops leases; a copied file without a committed reference can be removed.
- Empty, truncated or schema-invalid journals move into a private worker-local quarantine without using their contents to delete files. Valid journals continue processing. Unknown cache references are not guessed. Journal IO/quarantine failures are reported after database-aware reconciliation, so they cannot block pending-file checks or orphan removal.
- Queued/sending/retry/failed references retain their bytes. Missing/changed queued bytes become actionable permanent local failures; a conditional update never interrupts a sending action. Dispatch independently verifies the bytes before upload.
- Acknowledgment or explicit failed-action supersession permits cleanup. Business history/action rows remain.
- Startup/worker selection, foreground and sync outcome events schedule reconciliation. Interrupted sends recover before startup file inspection; offline recovery can flag missing bytes without waiting for network.
- Cleanup scans only the new `capture-{uuid}.jpg` namespace. Older/development-probe files are not treated as disposable orphans. It does not delete another worker's files.

Filesystem and SQLite cannot share a transaction. This design compensates and recovers across their boundary; it does not claim survival of arbitrary hardware/filesystem corruption or guaranteed background execution. If cleanup cannot finish, bytes/journals are retained for a later attempt and a localized issue is reported. A failed upload remains available until explicit replacement, including when refresh already knows a staff decision for the same submission; that decision is preserved in history. The new photo/action must be durable before the failed predecessor is superseded.

## Verification

See [executed tests and Android evidence](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/document-capture.md). `/dev/capture-inspection` is a read-only assessment-mode probe scoped to the selected worker. It reports action IDs/status, byte count/digest-match booleans and file/journal counts; no tokens, image data or private URIs. It is disabled outside development assessment mode.

## Subsequent SDD-022 presentation

The shared page is card-free. The capture screen has photo guidance, an empty-photo area, the real cache-disabled private preview and one dominant action: camera before selection, explicit Use this photo after selection. Retake and gallery become secondary actions. Ordinary byte counts are removed; permission/settings and saving failures remain actionable. Service compression, measured byte limit, SHA-256, private file journal, commit, cleanup and worker guards are unchanged. Targeted preview/permission tests pass; native and file lifecycle results are recorded separately.

Capture’s saved feedback now follows the existing document snapshot for its saved action, so it advances to sending, retry, review or failure when known. If the projection has not arrived, the fallback confirms local persistence and directs the worker to Documents without asserting delivery state. This changes presentation only; the added regression passed.
