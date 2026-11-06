# Local persistence

WorkerRepository captures a worker ID at construction. Every cache, submission, action, eligibility, claim and recovery query includes that ID. Create repositories from the same private database connection; never substitute a mutable selected-worker global. Session/token handling belongs to worker-authentication; logout must close views/session access without deleting this database or pending files.

The production driver uses expo-sqlite and expo-crypto UUIDs. A narrow async SQL interface lets the exact migrations/repositories run in Node tests against real SQLite files. Both drivers use the same serialized transaction wrapper. Only static migrations use exec; user/worker values use bound parameters. Version 1 creates worker-scoped cache/catalog, terms intent, submission history, projections, refresh flags and outbox tables with foreign keys, indexes and immutability triggers. Reapplying v1 preserves data; future unknown versions are rejected. No token is written here.

## Writes and reads

- cacheAssignment(snapshot): validate captured worker and fields, ignore globally older snapshots, preserve historical catalog/terms/submissions and pending local pointers. Review metadata only advances for a newer same-submission revision; conflicting equal revisions reject the transaction. No delivery acknowledgment is invented from local enqueue.
- getAssignment/listSubmissions/listActions: scoped persisted views, with server review and local delivery states separate. No queued document becomes Pending Review/Approved locally.
- enqueueTerms(version): require that exact cached version, generate one action UUID, atomically insert outbox plus terms intent. Current server acceptance remains unchanged. New terms are never accepted implicitly.
- enqueueDocument(type, durableFile, replacement?): require the active catalog type and worker-owned replacement. Atomically insert outbox plus a new local submission and advance only the local pointer. Prior submission/review stays historical.
- claimAction(id, now): one conditional transition to sending; duplicate/concurrent claim fails. No HTTP request is sent here.
- recoverSending(): change only this worker's interrupted sending actions back to queued. Preserve IDs, payloads, file URIs, attempt count and persistent retry eligibility.

A database-generated sequence preserves enqueue order even when timestamps tie or the device clock moves backwards. UUIDs remain stable action identifiers. Snapshot projections order server submissions by server creation time, independently from local creation time and later staff review revisions.

The private connection serializes reads and writes. Transactions use BEGIN IMMEDIATE and pass a direct transaction executor to their callback; no public connection methods should be awaited inside that callback. This prevents unrelated async statements from joining a transaction or observers seeing partial writes. Failed operations roll back and do not poison the queue. Multiple independent database handles still use SQLite locking; app services should share one open handle. Initialization performs no worker seeding and has no network/auth side effects.

## File precondition

DurableUpload is an attestation from a trusted file adapter: it must already have verified actual private persistent bytes, correct worker ownership, SHA-256 and measured size. The repository checks metadata, rejects cache-looking URIs and sizes at/above 1,500,000, and persists the reference. It cannot establish filesystem durability from a URI alone. The document-capture change owns actual image selection/compression, copying, cleanup on enqueue failure and orphan/missing-file reconciliation. No file deletion is implemented by this repository. The development/native and Node tests use explicitly created durable fixtures; they are not capture/compression tests.

## Verification

Run npm run test:persistence for actual file-backed repository tests. Root test:ci includes them alongside existing mobile/mock tests. Node type stripping emits experimental SQLite/module-detection notices; Expo mobile uses the native driver instead. No fake in-memory queue is used to claim restart persistence.

For native verification, start `npm start -- --go --localhost`, then open these development-only links in sequence with adb:

```sh
adb reverse tcp:8081 tcp:8081
# Explicitly resets ONLY the dedicated proof database and fixture, never worker-cache.sqlite.
adb shell am start -a android.intent.action.VIEW -d 'exp://127.0.0.1:8081/--/dev/persistence-check?mode=reset' -p host.exp.exponent
adb shell am start -a android.intent.action.VIEW -d 'exp://127.0.0.1:8081/--/dev/persistence-check?mode=seed' -p host.exp.exponent
# Wait for SEED_PASSED before stopping the process.
adb shell am force-stop host.exp.exponent
adb shell am start -a android.intent.action.VIEW -d 'exp://127.0.0.1:8081/--/dev/persistence-check?mode=verify' -p host.exp.exponent
```

Expect RECOVERY_PASSED: same two Carla IDs/payloads and saved fixture after process death, interrupted sending recovered, original correction history intact, Bruno queue empty. The probe uses persistence-proof.sqlite and a small fictional fixture; it never opens or resets the actual worker database. It is blocked by `__DEV__` in production. No worker screen, network synchronization, real media adapter or offline OTP sign-in is implemented in this change. TEST-02 persistence is exercised; TEST-01 delivery and other sync-engine acceptance await offline-sync.

Executed results and native screenshots: [verification evidence](evidence/persistent-outbox.md).

The verify route can be reopened after successful recovery. It permits the probe's own sending-to-queued transition while still comparing immutable intent and retry metadata. Reset/reseed is only necessary to start a new proof.
