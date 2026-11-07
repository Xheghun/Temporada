# Engineering decisions

This is the implemented assessment architecture, not a production security guarantee. Android acceptance and partial iOS results are in [integration evidence](docs/evidence/offline-integration.md). The coding ledger stopped at 299.91 minutes; this final consolidation changes documentation only. Earlier increment-by-increment decisions remain in Git history and feature evidence.

## Foundation and boundaries

Expo SDK 58 provides the New Architecture baseline, Router's native stack and SDK-matched native packages. Strict TypeScript, React Hook Form/Zod and a small token-based component set keep the implementation reviewable. React and React DOM are pinned together. There is no Redux, ORM or UI framework to obscure the small domain.

Router screens call feature services/hooks. Domain rules and the injected sync engine remain independent of React, Expo and SQLite. Repositories, transport, clock, connectivity, session and reporting adapters supply infrastructure. A static architecture script checks literal imports, cycles, feature-private dependencies and raw screen transport access; computed imports still require review. Descriptive names such as `transaction`, `workerId` and `submission` are enforced where practical.

## Local storage and worker separation — M1/M2/M10

SQLite is the immediate source for cached assignment, catalog, terms, local submissions and outbox delivery state. Versioned transactional migrations reach schema v3. Constraints/indexes and worker-bound repository instances make ownership explicit. Business intent and outbox insertion commit together before a network request; duplicate taps do not create extra intent.

The selected worker's identity is captured into each immutable payload, query and managed path. Session generations clear old views immediately and reject late reads, picker results and authentication responses. The server separately checks token membership before honoring `X-Worker-Id`; client filtering alone is insufficient.

Tokens plus the authorized roster/selected identity use SecureStore, with a device-only unlocked accessibility policy on iOS. They never enter ordinary SQLite, navigation parameters or application logs. Logout/401 clears the session, not pending actions/files. A saved session can resume offline; an opaque cached token cannot prove that server authorization is still current. SQLite/private files are not application-level encryption or remote-wipe guarantees.

## Sync ordering, retries and idempotency — M3/M5/M6

A worker action receives one UUID before transmission. Retries preserve its ID, payload and image digest. The mock atomically commits the business effect and a worker/action receipt in SQLite. Fingerprinting covers operation, immutable fields and image bytes; different content reusing an ID conflicts. Authorized replay returns the original receipt before current-version/failure checks. This demonstrates exactly-once business effects under the mock's storage/process assumptions, not exactly-once network delivery or production distributed consistency.

The headless engine uses a process-wide single flight and persistent sequence order. Unresolved predecessors block successors for the same resource; unrelated resources remain eligible. Delivered, stale and superseded actions resolve ordering. Permanent failures require explicit replacement, atomically superseding the failed predecessor and creating a new ID. Stale acceptance stays historical without that extra supersession step, so explicit v3 confirmation can proceed.

Transient network failures, 5xx, 408 and 429 retain intent indefinitely. Equal-jitter exponential delays start around 0.5–1 second and cap at 60 seconds; attempt/deadline state is durable. Startup, foreground, connectivity, selection, login, enqueue and manual retry trigger work. Timers are rebuilt conveniences, not background-delivery guarantees. 413/422 require user correction. 401/403 pause the session and preserve the queue.

Interrupted sending recovers on startup. A failed local completion transaction releases only its claimed action for a later replay with the original ID; a failed release is retried on the next trigger. Invalid persisted payloads or conflicting equal revisions pause work for investigation rather than silently deleting intent.

An acceptance contains the exact displayed terms version. `stale_terms` resolves the old action, persists refresh intent and fetches the new snapshot independently. Refresh never accepts a version. Same-version permanent failure and failed-v2/new-v3 recovery use the explicit replacement path; genuine stale history does not.

## Delivery, review and correction state — M4/M8

Outbox status answers whether an action was delivered. Submission status answers what staff decided. Pending Sync is not a submission receipt; successful upload initializes Pending Review, never approval. A refresh can independently establish a staff decision while delivery is unresolved; the UI labels that outstanding delivery separately.

History merges by submission identity and monotonic server review revision. An older replay resolves delivery without replacing a newer Approved/Correction Requested status or reason. Equal revisions must agree. Replacement links and local action sequence identify the current submission; a newer review revision on an old passport cannot make that passport current again.

A correction shows the server's reason and queues a new immutable submission targeting its predecessor. It does not rewrite the historical rejected upload. Workers and mocked staff controls have separate responsibilities.

## Images and filesystem recovery — M7/M2

ImagePicker supplies camera/gallery input; ImageManipulator makes up to four bounded JPEG attempts with lower dimensions/quality. Every output is measured; only a private durable copy strictly below 1,500,000 bytes with a verified SHA-256 can enter the outbox. Image quality settings are not proof of byte size. expo-image previews without disk caching. App-created temporary originals/outputs are removed; the worker's gallery original remains.

Filesystem and SQLite cannot share a transaction. A serialized file store coordinates preview leases, private copies, transactional enqueue and compensating cleanup. If commit outcome or reference lookup is uncertain, retain bytes. Active/failed actions keep images until acknowledgment or explicit resolution; cleanup cannot interrupt an in-flight send.

Worker-scoped journals support temporary-file recovery. Truncated/invalid metadata is quarantined without trusting partial paths, and valid journals/database-aware reconciliation continue. Journal IO errors are reported after that pass. Only the managed `capture-{uuid}.jpg` namespace is disposable; unknown files and other workers' uploads are preserved. Missing/changed bytes surface an actionable local failure while intent remains. These rules address process interruption, not arbitrary hardware corruption.

## Language and accessible UI — M9

The user amended the assessment's Spanish-first rule to English-first. Spanish remains available near the top of Home, and saved preferences survive restart. Existing v3 Spanish settings are preserved because an old seed cannot be distinguished from a deliberate choice. App-owned labels/errors/accessibility text are localized; server free text is not fabricated in another language.

Scalable text, scrollable layouts, minimum 56dp controls, non-color statuses, readable pressed-state contrast and busy/disabled/error semantics support the worker flow. Dictionary/interpolation/literal-key checks and bilingual rendering tests supplement the 360dp/130% Android inspection. TalkBack/VoiceOver speech and focus traversal are still unverified; token contrast checks are not accessibility certification.

## Assumptions, cuts and production work

The original assessment has not been supplied as an authoritative document; the user's master brief and later explicit amendments govern this implementation. SDD IDs and app identifiers are provisional. `X-Worker-Id` is a documented mock convention needing backend integration approval. Seed summaries do not invent wages or additional employment promises.

The mock uses fictional OTP 123456, Node's experimental SQLite, local image storage and loopback failure controls. It is not real SMS, identity assurance, malware scanning or a deployable production service. Production behavior requires HTTPS and fail-closed remote flags; flags are read at runtime creation, so immediate rollback of running clients still needs a server-side gate.

No stretch features were added. Push/SMS fallback, signing, signatures, store/cloud builds, release monitoring, encryption/retention hardening, multi-device conflict resolution and a hosted flags service remain outside the delivered app. EAS profiles/workflows are configuration, not executed builds. OTA is not configured. iOS camera/isolation/reauth and additional races, low-memory devices and recordings remain incomplete as detailed in the evidence. The four-hour target was exceeded; work stopped before the five-hour hard limit.

## Actual AI usage and review corrections

Codex assisted planning, implementation, tests, documentation and PR preparation. Tools included OpenSpec CLI, Git/GitHub, npm/Expo, Jest/RNTL, real Node/SQLite/HTTP fixtures, ADB, Simulator, Computer Use and primary documentation. Applicable React Native/Expo skills informed mobile work. No subagent delegation is recorded.

Real corrections included SDK asynchronous file APIs needing awaited writes/copies; a user-reported failed acknowledgment leaving `sending` stuck; failed terms predecessors requiring explicit reconfirmation/replacement; and malformed journals blocking reconciliation. Each owning change records its regression coverage. TypeScript-aware naming cleanup also caught unintended protocol-key/response-name changes before validation. Hosted CI exposed a synthetic-merge commit-subject check bug; the fix retained ticket enforcement against actual PR commits.

Inspection tooling needed URI decoding, slower swipes and capture-only file classification. Computer Use approval initially failed; changing permission mode enabled access, and a later lost Simulator window interrupted iOS checks. These are recorded limitations, not invented application fixes. Android's eight scenarios, 138 tests and partial iOS evidence are dated; they were not rerun for this document. Human review comes from the actual PR/user workflow, not an AI sign-off. The user confirmed neither recording exists; chat/commit history cannot be passed off as genuine Recording B footage.
