# Engineering decisions — scaffold increment

Status: scaffold only. Domain decisions below are requirements for future changes, not implemented guarantees. See specs/programme/design.md and the active change index.

## Foundation

Use the official Expo SDK 58 blank TypeScript template's dependency baseline, adding Expo Router with SDK-selected native versions. React 19.3.0 and react-dom 19.3.0 are pinned together to avoid npm selecting an incompatible React DOM patch. Router uses its native stack; no extra UI framework or Redux. Native projects use Expo continuous generation; SDK 58 uses New Architecture. Native dependency compatibility is checked with expo install --check and expo-doctor, separately from emulator execution.

Minimal design tokens and a scrollable Spanish scaffold route establish layout without claiming complete worker UI/localization. No placeholder controls advertise unimplemented actions. The full English toggle and language audit belong to later scopes.

## Local storage, synchronization and state

Future SQLite repositories own worker-scoped cached data and transactional intent/outbox writes (M1/M2/M10). SecureStore will hold tokens. Sync will inject persistence, transport, clock and session dependencies. Stable action IDs and atomic backend receipts establish exactly-once business effects, not exactly-once network delivery (M3). Retry deadlines are persistent; terminal client errors require correction (M5). Stale terms resolve ordering but never accept a new version without explicit confirmation (M6).

Delivery acknowledgment must resolve delivery independently from newer staff review revisions/reasons (M4). No queued upload implies submission or approval. Historical correction submissions remain immutable (M8). These components are absent in the scaffold.

## Images and privacy

Future capture measures compressed bytes below 1,500,000, copies to private durable storage before enqueue, compensates on transaction failure and reconciles orphan/missing files safely (M7). Pending bytes remain through restart/logout. Gallery originals are never deleted. No passport media or real worker data is present in this increment.

## Configuration and governance

Feature-flag provider is an injected interface, not a hosted service: absent/malformed/unavailable responses fail closed and only an own boolean true enables a flag. Future production features must wire approved remote configuration. No current worker behavior is enabled.

CI runs checks on PRs/main. EAS builds are manual/main-only, with protected environments and authorized credentials required externally. GitHub repository/branch protections, human review, signing and production rollout are not enforced merely by committing YAML. No direct main pushes or automatic merge. Each feature has a named OpenSpec change, branch and PR.

## Assumptions and cuts

Original assessment not yet supplied; user master requirements remain provisional. SDD IDs are local work IDs. Bundle/package identifiers are provisional. No backend, worker workflow, persistence, queue, media or staff approval exists yet. Mock behavior cannot establish production security; SQLite/private files alone do not prove device encryption. Spanish first/English completeness (M9), Android 9 low-memory testing, all six sync tests, native offline scenarios and cloud builds remain future verification.

## Actual AI usage and corrections

Tools used: OpenSpec CLI, shell/Git/npm/Expo tooling and official documentation lookup. Applicable React Native/Expo skills informed native stack and safe-area layout. No tasks delegated to sub-agents. Genuine issues encountered: managed sandbox initially denied Git creation; user enabled filesystem access; npm shared cache contained inaccessible entries (used a temporary cache); npm auto-selected react-dom 19.3.1 against React 19.3.0 (pinned SDK-compatible React DOM). No human review, recording or cloud execution is fabricated. Executed check results are maintained in docs/evidence/scaffold-progress.md.

Hosted CI caught a real governance-check bug: GitHub checks out a synthetic merge commit whose generated subject has no ticket. The commit check now validates base-to-PR-head subjects, while the remaining validation still tests the merged tree. No ticket requirement was relaxed.

## Mock API increment (SDD-004/005)

The mock is an isolated Express package; mobile runtime dependencies are unchanged. Node 24's built-in SQLite provides the durable transaction without another native database addon. It is experimental and acceptable only for this local assessment service. Exclusive locking gives one process ownership before startup file reconciliation. WAL and synchronous=FULL plus file/parent fsync put the durable receipt and effect behind a single SQLite commit; response loss is injected only afterwards (M3).

Token hashes/session expiry and worker membership checks support the specified mock auth flow (M10), not production security. Replay lookup follows authorization and precedes current terms/failure switches. It returns the original receipt/revision, even after v3 publication or a newer staff decision. Client delivery/review merging remains required in offline-sync (M4/M6). Images are bounded, signature-checked and privately persisted; this is not full image decoding, antivirus scanning or real document verification (M7/M8).

The backend tests issue real HTTP requests to isolated SQLite/files, including a child-process SIGKILL/restart after a committed dropped response. The Android emulator successfully requested /health through 10.0.2.2:3000. These results do not complete the mobile offline acceptance scenarios or the six sync-engine tests. No backend integration sign-off is claimed for the proposed X-Worker-Id convention. No sub-agents were used.

## Persistent outbox increment (SDD-006/007)

M1/M2/M10: WorkerRepository captures a worker ID rather than consulting selected-session state. Exact-version terms intent and document submission are committed with their outbox row in one transaction. SQLite foreign keys constrain worker ownership; triggers prevent rewriting action payload/ID/file or submission identity. No token or real worker data is stored by this layer. Logout deletion is intentionally absent; later authentication must preserve it.

The Expo adapter owns a private connection and serializes all reads/writes, using BEGIN IMMEDIATE with a transaction-scoped executor. This avoids Expo ambient-transaction async interleaving and readers observing half-written intent. Node tests run the same SQL/repositories/transaction wrapper on real files, with an injected UUID/clock and a Node SQLite driver. Native proof uses the actual Expo SQLite driver, not the Node adapter. No ORM or speculative generic repository framework was added.

M3/M4/M6/M8: each enqueue persists one UUID, immutable payload and URI; recovery changes only sending metadata. A generated enqueue sequence handles tied/backward clocks. Server review and local delivery remain separate, and local enqueue never creates approval or acceptance. Snapshot merge retains pending local pointers and historical corrections, rejects conflicting identity/equal revisions, ignores older revisions and records server creation time separately from local time. The sync engine will own acknowledgment/retry/stale transitions; those are not implemented here.

M7: durable image verification/copying remains a documented file-adapter precondition. The repository validates worker/type/version/size/digest/URI metadata, but a file URI is not proof of durable bytes. Native/Node checks use explicit fictional fixture files; real capture, compression, cleanup and orphan reconciliation remain in document-capture. M5/M9 and actual authenticated UI are later feature work. See docs/persistence.md for interfaces and boundaries.

Real corrections: Node .mts generic syntax needed a trailing comma for strict type checking. The development reset helper initially treated SQLite’s native directory path as a file URI; Android execution caught this and the helper now opens/closes and deletes its dedicated database through SQLite APIs. Server/local creation times and enqueue sequences were made explicit to avoid clock-dependent ordering. No sub-agents were used and no recording was claimed.

## Synchronization increment (SDD-008/009/010)

M1/M2/M3/M5/M10: the injected engine runs without screens/native imports, with process-wide single-flight and captured session/worker checks before each dispatch. The sequence orders resources; delayed/failed predecessors only block their own resource. Equal-jitter retry deadlines and independent refresh backoff survive SQLite reopen. A 401/403 preserves intent and invalidates only the captured generation; real secure session invalidation belongs to authentication. Unknown permanent client errors do not loop automatically. Startup/foreground/network/session/enqueue adapters are ready for later service wiring; no worker UI is implied. Production enablement is an injected fail-closed remote gate; only developer probes explicitly enable behavior.

M4/M6/M8: transactional delivery outcomes merge review by submission/revision, retaining newer decisions and reasons. Equal conflicts roll back; missing/incomparable revisions preserve known review and request refresh. Matching equal-review snapshots may still complete server creation metadata omitted from receipts. Stale intent resolves ordering without erasing earlier acknowledged historical acceptance or autoaccepting a newer version. Explicit replacement of failed terms/documents atomically supersedes only that failed worker/resource predecessor and preserves history/files.

M7: dispatch verifies worker-private file location, existence, actual byte size and SHA-256 and uploads the same byte snapshot. This strengthens delivery integrity without implementing capture/copy/compression or safe orphan cleanup. SDK 58 requires awaited file writes and ExpoBlob for binary data; a typed subclass normalizes TypeScript 6 buffer types without an assertion or any bypass. Multipart filenames are explicit because ExpoBlob does not inherit RN's default Blob.

Evidence: real SQLite/fake-clock engine tests plus actual HTTP integration against a SIGKILL/restarted persistent mock; Android probes cover offline restart delivery, review-before-replay, stale terms and file integrity. Android can transparently replay a socket drop, so the review-window probe explicitly discards the returned acknowledgment too; this is documented fault injection. Full worker scenarios/iOS/recordings remain incomplete. No subagents or signing/release operations were used. Actual corrections and results are in docs/evidence/offline-sync.md.

## Authentication increment (SDD-011)

SecureStore holds the token, authorized roster and selected identity together; public React snapshots contain no token. Serialized secure writes plus generation guards prevent stale login/restore responses from repopulating a logged-out or switched view. Only a successfully persisted selected identity reaches the worker route. Logout/expiry clear access without deleting durable intent or media. Cached opaque tokens resume offline but remain subject to server expiry/worker checks when reachable; this is not production identity assurance. Failed secure deletion is surfaced and not reported as completed logout.

Session signals are separate from UI/error subscriptions, avoiding synchronization loops when an error banner updates. The runtime creates selected-worker refresh intent before an assignment exists, then connects native lifecycle/network and authorized-session events to the merged engine. Production enablement fails closed through a remote flag; explicit assessment mode is development-only. No Home business view or capture feature was applied. SecureStore adds a native-binary requirement.

Real Node/HTTP tests plus RNTL and Android SecureStore/route checks are recorded in docs/evidence/worker-authentication.md. Actual Fast Refresh/context, Router type generation and async-test API corrections are documented there. No subagents, recordings, credentials or release operations were used.

## SDD-012: cached Home and terms

Home and Terms share an injected application service and an atomic worker-scoped read view; screens do not send raw sync requests. Session generations discard late results. M1/M2/M6 confirmation captures the displayed version, commits first, then signals the engine; stale history never confirms a replacement. Saved feedback is version-specific. The timeline lists only cached facts and does not invent staff decisions (M4). Documents navigation remains visibly unavailable in this scope. Schema v3 persists only the app-wide language preference (M9). A separate remote `worker_home_and_terms` flag defaults closed outside explicit development assessment mode.

Actual AI-assisted corrections included suppressing duplicate pending confirmations and preventing an old saved notice from appearing on new unconfirmed terms. The first native offline attempt raced connectivity and was excluded; a later airplane-mode v3 confirmation survived force-stop/relaunch and synchronized once. See docs/evidence/home-and-terms.md for executed evidence and limitations. No human-recorded session or approval is claimed.

### SDD-012 review: permanent terms failure recovery

The initial Home/Terms service only used ordinary enqueue. That left same-version failures without a recovery button and allowed a new-version action to sit behind a failed predecessor. The UI now explicitly names replacement; its callback captures the failed action ID alongside the displayed version and generation. The service verifies that the failed ID is still the expected one before calling the existing transactional supersession path (M1/M3/M5/M6). A new user confirmation creates a new ID; network retries of that confirmation keep it. Refresh and stale-version history do not trigger supersession. File-backed engine regressions cover both versions, duplicate taps and transactional rollback.

### Naming review

Use purpose-specific names throughout implementation and tests, including `transaction`, `database`, `dependencies`, `httpResponse`, `action`, `submission` and `testContext`. AGENTS.md records this convention; ESLint rejects recurring abbreviated declarations/parameters. Public protocol fields and persisted schemas retain their existing spelling. The review used TypeScript-aware renames plus manual semantic checks, corrected response-name collisions/unintended object keys, and verified all 103 tests and Android Home startup. React Native guidance was consulted; no behavior/state architecture change was required.

## SDD-013: document states and correction history

Documents uses an injected headless service with the existing atomic worker read view. Projection joins local actions and server history by client/submission identity, keeping delivery and staff review separate (M4). Replacement links and local sequence identify the current worker intent; review revision orders decisions only within one submission. Old-passport decisions cannot become current merely because they have a newer review revision (M8). A refresh-known staff decision remains visible while the original receipt is retried.

Correction creates new immutable intent referencing the prior server submission. Failed local replacement uses the existing transactional supersession path (M5), with a new UUID; retry IDs remain stable (M3). Session generations reject stale callbacks and worker-owned notifications refresh Home counts (M10). App strings are localized; server free text is retained (M9).

The production feature flag defaults closed. Capture/file verification remains a caller precondition until document-capture; this change exercises real durable fixtures and deliberately leaves photo controls unavailable rather than faking a worker upload. No new API/schema contract or production-security guarantee is claimed. React Native guidance was consulted; UI remains scrollable and text-based. Testing corrected a local Bruno fixture to include his seeded Approved passport and localized the new route header. No recording or human correction is fabricated.

## SDD-014: guided capture and upload files

SDK-compatible ImagePicker and ImageManipulator provide on-demand selection/permission and bounded JPEG compression. The measured private copy and SHA-256—not camera quality settings—gate queueing below 1,500,000 bytes (M7). Preview uses expo-image without disk caching. App cache originals/outputs are journaled and removed; gallery originals remain.

A serialized UploadFileStore coordinates preview leases, DB enqueue and reconciliation. Compensation/restart recovery bridges the non-atomic filesystem/SQLite boundary (M2). Query failure retains bytes; acknowledgment or explicit supersession permits deletion. Only managed capture-prefixed files under the owning worker are disposable. Missing/changed bytes become actionable local failures without deleting intent; sending rows remain under the existing dispatcher. A new explicit replacement uses a new action ID, while transport retries retain the original (M3/M5/M8). Session generations hide/discard late media results (M10).

New production capture requires a fail-closed feature flag. Native packages/permission configuration require a new binary; appVersion/runtime version moved to 1.1.0 rather than permitting an incompatible JS-only OTA. No signing/build/release approval is claimed. See docs/capture.md and docs/evidence/document-capture.md for executed evidence, actual AI corrections and limitations. React Native and Expo UI/media guidance were read for this task; existing controls were reused without another UI library.

### SDD-014 review: corrupt capture journals

Journal metadata is advisory to cleanup; it cannot gate durable upload recovery. Malformed JSON or invalid schema is moved, unchanged, to the owning worker’s private quarantine. No file URI is inferred from partial metadata. Recovery continues through valid journals and does database-aware file checks/removal even if journal IO fails; the IO failure is reported after that pass. Unknown cache copies remain untouched rather than risking another worker’s bytes. Regression coverage includes repeated recovery, retained pending uploads, valid neighboring journals and orphan cleanup.

## SDD-015: language and accessible controls

The user explicitly amended M9 to English-first on 2026-11-06; Spanish remains available from Home. Fresh settings use English, and startup restores an existing Spanish preference. Existing v3 settings are not rewritten: older installations do not distinguish an initial Spanish seed from a deliberate choice, so preservation is safer than guessing. No schema bump or data reset is needed.

The shared button retains readable pressed-state contrast, announces busy/disabled state, and hides the redundant spinner from accessibility services. Errors expose localized hints and polite alerts; current statuses announce updates. The language switch is near the top of Home. Existing scroll views, scalable text and minimum 56dp controls accommodate wrapping. No new dependency or independent feature framework was introduced.

Dictionary parity, interpolation, literal call-site keys, bilingual document states/errors, configured contrast pairs and real SQLite preference recovery are tested. The initial key audit incorrectly rejected plural base keys; it was corrected to recognize their one/other forms. Native evidence and unverified accessibility areas are recorded in docs/evidence/language-and-accessibility.md. Recording B remains unconfirmed; no footage or human review is claimed.

## SDD-016/017/019: native integration evidence

Integration preserves the existing contracts and uses isolated fictional server/mobile fixtures. Prior databases are archived only with resolved actions. Android snapshots include IDs, delivery/review revisions, counts, measured bytes and digest equality, excluding tokens and private paths. A loopback test proxy supplies native 422 and held-replay responses without adding production debug behavior. Backend 422 validation remains independently tested against the actual service.

No product logic fix was justified by the observed results. Test-driver URI decoding and swipe adjustments are recorded in the integration evidence, separately from application behavior. Executed scenarios, reboot checks, limitations and quality results are in docs/evidence/offline-integration.md; the single coding ledger continues across branches. Recordings and production approvals are not inferred from emulator tests.
