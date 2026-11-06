> Programme reference only: split into independently applied changes; see specs/tasks.md. No whole-application apply target exists.

# Design

## Context

See proposal.md for motivation. Inspection on 2026-11-06 found only OpenSpec scaffolding, no app, original brief, package manifest or Git history. Node v24.11.1/npm 11.6.2 are installed; Expo is not on PATH. Android SDK emulator binary and Pixel_6a, Pixel_Tablet, Small_Phone AVDs exist. ADB 37.0.1 failed to bind its listener with Operation not permitted. Android execution is blocked/unverified, not passed. No production credentials or remote repository were inspected.

## Goals / Non-Goals

**Goals:** Prove durable intent, worker isolation, exact-version acceptance and one server effect per action through real storage and Android failure scenarios. Keep seven screens and a small backend understandable.

**Non-Goals:** Production security certification, guaranteed background execution, actual SMS delivery, cloud build success, store release or fabricated recordings. No stretch goals until P0/P1 verification; maximum two.

## Decisions

### Foundation and boundaries

Use the requested Expo Router/strict TypeScript/New Architecture stack. Select a current compatible SDK at apply time through official Expo documentation and Expo dependency validation; use SDK-compatible native packages, React Hook Form/Zod, NetInfo, i18next, Jest/Expo and RNTL. No versions have been verified yet. This proposal does not introduce dependencies. Choose SDK-bundled SQLite over an ORM because explicit transactions and worker keys make safety review straightforward. SecureStore holds token and authenticated identity metadata; ordinary SQLite holds no secrets. App-private files hold compressed uploads. Local storage is not claimed to be encrypted or resistant to a compromised device; shared-phone isolation is enforced in application and API authorization.

Screens use feature hooks/application services; domain interfaces import neither React nor Expo/SQLite. Repositories, API and file adapters implement injected interfaces. Sync receives outbox, business repositories, transport, connectivity, clock, retry, session and events. ESLint or a small import checker enforces boundaries and detects cycles. Use simple subscribed state rather than Redux. Repository structure follows the supplied tree.

### Scaffold-first branch and PR workflow

Deliver the scaffold first on `chore/SDD-001-project-scaffold`: Expo/Router/New Architecture setup, strict TypeScript, lint/format, test harness, architecture checks, GitHub Actions validation/build pipeline definitions, EAS profiles, environment examples, AGENTS.md, PR template and contribution rules. No worker business features in this PR. Validate Android startup and the available quality commands; document hosted CI/build execution separately from configuration.

Open the scaffold PR with actual verification evidence and obtain human review/merge before dependent feature work starts from main. For each subsequent feature, branch from the latest reviewed/merged main, implement its coherent scope plus tests/docs, run checks, push the branch and open a separate PR. Wait for human approval and merge before starting the next dependent branch. Do not combine the application into one final PR, auto-merge, push directly to main, or claim review occurred. Review latency may extend calendar delivery; it does not reset the cumulative coding timebox. If review or remote access is unavailable, report the gate and preserve the completed branch rather than bypassing it. Initial repository bootstrap must preserve planning files; remote creation/default-branch bootstrap needs explicit authorization when no repository exists.

Branch names use `chore/`, `feature/` or `fix/`, a ticket ID and a concrete purpose. Never use Codex, agents or other AI branding. SDD identifiers below are provisional local work IDs, not externally created tickets. Separate PRs may group related task IDs within one feature:

| Scope | Tasks | Branch |
|---|---|---|
| Scaffold/tooling/pipeline | SDD-001–003, SDD-018 | chore/SDD-001-project-scaffold |
| Supporting mock API | SDD-004–005 | feature/SDD-004-mock-api |
| Durable local data/outbox | SDD-006–007 | feature/SDD-006-persistent-outbox |
| Sync/recovery | SDD-008–010 | feature/SDD-008-offline-sync |
| Authentication/worker selection | SDD-011 | feature/SDD-011-worker-authentication |
| Home/terms | SDD-012 | feature/SDD-012-home-and-terms |
| Document states/corrections | SDD-013 | feature/SDD-013-document-corrections |
| Capture/durable images | SDD-014 | feature/SDD-014-document-capture |
| Language/accessibility completion | SDD-015 | feature/SDD-015-language-and-accessibility |
| Integration fixes | SDD-016–017, SDD-019 | fix/SDD-016-offline-integration |
| Submission documentation | SDD-020–021 | chore/SDD-020-submission-documentation |

Each PR description leads with the problem and resulting behavior, references ticket/requirements, explains material decisions and API/schema impact, lists commands actually run and results, includes relevant Android evidence, and identifies risks/incomplete work. Use concise sections and relevant detail; omit repeated diff narration, empty boilerplate and conversational history. Include reviewer/backend sign-off needs without inventing approvals. Describe scaffold checks honestly when domain tests do not yet exist; do not add meaningless tests solely to show a pass.

### Data and session model

See /specs/data-model.md. Worker-scoped composite keys and foreign keys cover assignments, terms versions, catalog, document submissions and outbox. Preserve document history instead of mutating a single document row. Distinguish delivery state from staff review state. Persist immutable payload/version and original action identity; derive UI status from local submissions plus server facts.

All async operations capture worker ID and session generation. Switch/logout clears view state synchronously, invalidates subscriptions and cancels requests where possible. Late results can update only their captured worker records, never the new view. One process-wide engine guard prevents overlapping workers; switching pauses further old-worker dispatch, then triggers the new worker after the in-flight attempt settles. Every dispatch rechecks current authorization. Logout preserves queues/files but clears token and selected view. Reauthentication must authorize the queued worker. Cached resume uses a previously stored authenticated session; cold offline OTP login is unsupported.

### Durable enqueue and files

Confirm exact displayed terms or capture/select, preview, iteratively compress and resize until actual output is below 1,500,000 bytes. This conservative decimal threshold resolves MB ambiguity. Copy into private documents storage under worker/action UUID, then atomically insert local state and outbox. Network never precedes commit. On transaction failure remove the unreferenced copy. Retain pending or failed bytes until acknowledgment or explicit resolution; remove app-created full-resolution temporary copies after successful compression without deleting gallery assets. Startup reconciliation scans only app-managed files under an exclusive enqueue/recovery lock, removes proven unreferenced files and marks missing references as actionable failure without sending. Acknowledgment commits before eventual cleanup; a cleanup crash produces only a removable orphan. Filesystem and SQLite are explicitly not atomic together.

### Synchronization

Recover interrupted sending to queued on startup. Acquire a single-flight guard; inspect selected authorized worker and connectivity hint; query eligible actions by created time and ID. Claim one atomically; send persisted immutable payload and stable ID. On success transactionally mark delivered and merge acknowledgment by action/submission ID. Read responses cannot overwrite unsynced local intent. Use a finally release and notify subscribers.

Skip delayed or terminal actions to allow unrelated work; same-resource actions preserve order and wait for unresolved predecessors. Delivered, stale and superseded predecessors are resolved for ordering. A stale v2 acceptance remains historical but never blocks an explicitly confirmed v3 action; no supersession step is required. Local failed predecessors require explicit replacement/supersession, keeping history. Never collapse queued actions silently. Retry network/timeouts/5xx using delay sampled uniformly from half to full of min(60 seconds, 1 second * 2^(attempt-1)); persist attempt and next eligibility. Delay is capped; transient actions are retained indefinitely until delivered/resolved rather than discarded after an attempt limit. Manual retry can advance transient eligibility, never blindly replay 413/422.

201/200 replay: resolve delivery independently from review state. Initialize Pending Review only when no newer review state is known for that same submission. Merge review fields only from a strictly newer server revision; equal revisions must agree and older revisions cannot overwrite status or correction reason. A replay returns the original receipt/revision, so a refreshed Approved or Correction Requested decision survives an older acknowledgment. Missing or incomparable review revisions must not overwrite a known decision; request refresh instead. 401: retain/requeue, pause session, require reauth. 409 stale_terms: terminal stale acceptance, reconfirmation flag, fetch latest snapshot; if fetch fails retain refresh-needed state and retry refresh independently, never accept current terms implicitly. 413/422: terminal actionable error, unrelated actions continue. Unknown 4xx: visible non-retrying failure; 403 invalidates worker access. Wake on startup, foreground, restoration, login, selection, manual action and earliest persisted deadline; timers are conveniences rebuilt from storage. Background delivery is best effort.

### Backend and idempotency

Use a small Express service with a persistent SQLite database to atomically commit business result and worker/action deduplication receipt. Alternatives such as in-memory maps cannot prove restart survival; separate JSON writes cannot provide atomic receipt/effect commits. Payload fingerprint includes operation type, worker, immutable fields and compressed file digest. Check an existing receipt before validating current terms or applying a new failure control, so replay after v3 publication returns the original v2 success. Different content with the same ID returns 409 action_id_conflict. Development-only post-commit disconnect occurs after durable commit. Server worker authorization is checked before any receipt lookup. Binding X-Worker-Id to token-authorized membership is a proposed mock convention requiring backend sign-off before real integration.

Each server document has submissionId, clientActionId, document type, created time/revision and review decision. Staff decisions target submission IDs; a decision on an old upload never overwrites a newer Pending Sync/Pending Review upload. GET snapshots include historical identity and server revision. The assignment timeline contains only known server events and explicitly labeled local intent.

### Recording and mobile focus

Mobile behavior is the delivery priority. Keep the mock backend minimal while preserving the transactional idempotency and failure controls required to verify the client. Reconcile the original assessment when supplied; do not silently drop existing mobile acceptance requirements.

Before coding, SDD-001 prepares Recording B checklist and schedules human capture during a real implementation session. Include the prompt/plan/review before the selected coding task, a genuine correction if one occurs, implementation, tests/emulator and PR description. Do not stage a rejection or recreate missed footage as real. SDD-021 handles final editing and artifact verification only; missed recording evidence stays incomplete. Recording preparation/capture overhead is outside coding time, but coding performed on camera still counts toward the coding ledger.

### Specifications, verification and time

Root specs/*.md are the requested implementation reference set. Active capability deltas and checklists live in independently named changes listed in specs/tasks.md. This preserved whole-app document provides shared architecture, not executable task scope. Changes must reconcile both; supplied original brief takes precedence when available. All tests/manual records currently unexecuted. TEST-02 must use reopened real persistence, not just a retained fake object; TEST-03 must exercise actual durable backend storage. UI-independent fake clock tests cover retry and concurrency; Android tests prove process/file behavior.

Budget in minutes: foundation/scaffold/CI 30, backend 20, persistence 35, engine/tests 50, auth 20, screens/media/localization 50, integration 30, final checks 5 = 240. Reserve 60 for critical failures, stop at 300. Supplied table totals 300 despite four-hour target; record this discrepancy. Record actual start, pauses and cumulative coding time in a ledger; conservatively count setup and verification. Proposal elapsed time is recorded separately; never reset an existing coding ledger. Documentation/recordings are outside coding per brief, but maintain evidence during work. Cut polish/P2 before data safety and mark missing obligations incomplete.

## Risks / Trade-offs

- [ADB listener denied] → Resolve runnable emulator access at the first implementation milestone; do not substitute unit tests for Android acceptance.
- [Original assessment absent] → Record provisional source and compare before final assessment claims; any material conflict returns to human review.
- [Five-hour scope pressure] → Enforce ledger and P0/P1 ordering; report incomplete CI/UI rather than weaken safety.
- [SDK and low-end compatibility] → Check official SDK minimum OS and Android 9/API 28 compatibility before install; use supported Node LTS if required. Do not promise unsupported Android versions.
- [Shared-device data at rest] → Secure tokens, private paths, no sensitive logs; production encryption/device binding requires security design and approval.
- [Mock authorization and feature flags] → Mock proves specified behavior only. Production flags fail closed; mock assessment mode is explicit and never enabled by production defaults.
- [Out-of-order snapshots/decisions] → Merge by submission ID/revision and preserve local overlay; test old-decision/new-upload interaction.
- [Repository governance external] → CI can check format and ticket conventions; branch protection, reviewer requirement, backend sign-off, credentials and rollout need external human configuration.

## Migration Plan

After approval initialize Git without replacing files/history, use chore/SDD-001-project-scaffold for the first PR, then separate per-feature ticket branches/PRs as listed above. Commit coherent verified increments with ticket IDs. Scaffold includes CI/build configuration from the outset; human-reviewed merges gate dependent branches. Create versioned transactional migrations; test reapplication and upgrade. Launch Android early. Deliver development/internal preview EAS profiles and production profile with remote flags off. Human-controlled internal testing → staging QA → approved staged release. OTA only for JS/assets compatible with runtime/native binary; stop rollout/disable flags first, use compatible OTA rollback when possible, otherwise ship a corrected binary. Installed incompatible binaries cannot be instantly rolled back. No actual release is authorized here.

## Open Questions

- Hosting/account identifiers for eventual EAS and repository branch protection are deferred configuration, not prerequisites for local architecture.
- Human availability for Recording B capture must be arranged in SDD-001 before coding; final editing and artifact verification remain in SDD-021.
