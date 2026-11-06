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
