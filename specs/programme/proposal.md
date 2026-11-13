> Programme reference only: split into independently applied changes; see specs/tasks.md. No whole-application apply target exists.

# Proposal

## Why

Seasonal workers need to confirm employment terms and submit sensitive documents despite unreliable connectivity and shared phones. The assessment must demonstrate durable intent, isolated identities, truthful status, and replay-safe delivery through executed Android scenarios.

## What Changes

- Deliver a separately reviewed scaffold PR first, including linting, quality scripts, GitHub Actions CI/build pipelines, EAS configuration and PR conventions. Implement every subsequent feature on a separate descriptive ticket branch and PR, with code review before merge.
- Introduce an Expo/TypeScript Android application with seven screens, Spanish default, English toggle, and accessible offline feedback.
- Add worker-scoped SQLite caching, transactional outbox actions, secure token storage, durable compressed images, and an independent synchronization engine.
- Add a persistent mock backend with exact fictional seed records, authorized worker selection, idempotency and deterministic failure injection.
- Provide requirements, architecture, data, API, UI, testing, task and traceability documents; six mandatory automated tests; eight manual scenario records; CI/EAS configuration and honest delivery documentation.
- Require initial approval before application code. Prepare Recording B before coding and capture the genuine session during implementation; final editing and evidence checks follow afterward. Actual recordings and approvals require human participation.
- Prioritize mobile correctness and Android verification; keep the mock backend limited to contract behavior and failure simulation needed to test the mobile app. Reconcile the original assessment when supplied.

## Capabilities

### New Capabilities

- `worker-identity`: Phone OTP, shared-phone identity selection, authorization and isolated sessions.
- `offline-delivery`: Durable intent, retry classification, recovery, exactly-once effects and versioned terms.
- `worker-documents`: Server catalog, durable image capture, submission states and correction history.
- `worker-experience`: Cached assignment, bilingual accessible screens and verifiable assessment delivery.

### Modified Capabilities

None. No existing capability specifications or application files were found.

## Impact

Greenfield mobile app, mock service, local database/files, test tooling, repository configuration and delivery documentation. No code changes are authorized in this proposal workflow. The folder is not yet a Git repository; branch/history setup follows approval. ADB listener startup is blocked by current permissions, so Android execution is unverified. The original assessment is absent; supplied instructions are provisional pending comparison. SDK/package compatibility must be checked before installation; no package versions are claimed verified here.
