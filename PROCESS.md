# Development process: ticket to release

This describes the assessment workflow, subsequent project work and remaining human-controlled release stages. Feature PRs through integration and the UI redesign are merged. Home restoration and README disclosure/recording-link PRs #17–19 remain open as of 2026-11-08. The recordings-only GitHub release hosts videos; no production application release has occurred.

## Intake, context and planning

A human defines the ticket, worker outcome and acceptance criteria. The supplied master brief became M1–M10 and the root specifications. The original assessment dated October 29, 2026 was subsequently supplied and reviewed. Initial planning references to its absence are historical. The Home comparison led to PR #17; other assessment findings remain explicit. Explicit changes, including English as the default, are recorded rather than silently treated as the original requirement. SDD IDs are local work identifiers.

Before an agent task, load AGENTS.md, the named OpenSpec proposal/design/tasks, affected root specs and applicable React Native/Expo guidance. Give the agent fictional fixtures, interfaces and the relevant tests; exclude credentials and real worker data. OpenSpec reports checklist state, not proof that a requirement works.

The initial architecture had a human approval gate. The programme was then split into scaffold, mock API, persistence, sync, authentication, Home/Terms, corrections, capture, language, integration and submission documentation. Only the explicitly requested change is applied. Significant architecture/API/security changes return to the human; routine scoped decisions proceed without repeated permission requests.

## Implementation and local verification

Each feature starts on a descriptive ticket branch from reviewed, merged main. Branches and commits contain the SDD ID and no AI branding. The agent reads the task, names affected files/tests, implements a coherent change, reviews its diff and updates evidence before checking the task complete. The human remains responsible for acceptance and merges.

Owning changes ship domain, repository, transport and UI tests. Deterministic clocks/failure injection test retry and ordering without real waits. Real SQLite/file/HTTP tests verify transaction recovery and idempotency; native Android checks verify the deployed runtime behavior that fakes cannot establish. Failures keep their requirement IDs and regression tests; tests are not weakened to obtain a green result.

Typecheck, lint, formatting, architecture boundaries, tests and Expo compatibility/configuration were run during implementation. Integration executed all eight Android scenarios and inspected action IDs, file digests and server counts. iOS has a smaller explicitly documented passing scope. Screenshots/storage snapshots are evidence, not substitutes for executed steps. Unrun builds, device classes and accessibility checks remain unverified.

The original cumulative ledger includes coding and verification across branches, including any coding on camera. That assessment window stopped at **299.91 minutes**, preserved in [cutoff commit `6db6a09`](https://github.com/Xheghun/Temporada/tree/6db6a0960a913c957a208a656dd9b57e0829ab23). Human review/permission waits are separate; the brief excludes write-up and recording work from coding time. Later user-authorized redesign and follow-up coding/verification are recorded in separate subsequent-work sections of the [ledger](docs/coding-ledger.md). They are outside the original five-hour implementation, and the user's authorization does not waive the assessor's limit. The cutoff snapshot identifies the original implementation; current main includes additional work.

## CI, pull requests and human review

GitHub Actions automatically installs locked dependencies, checks ticket/branch conventions, runs the quality/test/Expo scripts and bundles Android JavaScript on PRs/main. CI checks actual PR commit subjects rather than GitHub's generated merge subject. A green export is not a signed build or store approval.

The agent prepares a concrete PR description: behavior changed, relevant requirement links, actual verification and remaining work. The human reviews code, evidence and trade-offs, requests corrections and merges. No direct main push or automatic merge is part of this workflow. Human review is not inferred from the presence of a PR; approved/merged history is recorded when observed. Branch protection and required reviewers need repository administrator configuration; YAML alone cannot enforce them.

## Contract approval and release

The proposed authenticated `X-Worker-Id` convention and production error/revision semantics require backend developer sign-off. The local mock does not supply that approval or production security. Security decisions, signing credentials and production enablement also need authorized humans.

After approved backend/configuration integration, an authorized operator produces an internal EAS build, then staging QA uses release binaries and the target device matrix. The current manual build workflow is main-only and build-only, with development/preview/production profiles; external account, credentials, HTTPS endpoints, flags and protected environments remain prerequisites.

A human approves store submissions, review access, privacy disclosures and rollout percentages. Monitoring and rollback follow [the release plan](docs/release-plan.md). Production flags default off; a store release, compatible update or server change requires its own authorization. No signing, cloud build, OTA publication or rollout was performed here.

## Evidence and recordings

[Integration evidence](docs/evidence/offline-integration.md) and [traceability](specs/traceability.md) connect requirements to executed checks. The original 2026-11-07 missing-recording status is superseded by two [published recordings](docs/recordings.md). The scenarios/code walkthrough is 15:33 against the requested 5–8 minutes; the AI workflow is 19:16 against 10–15 minutes. Length reconciliation or explicit assessor acceptance and full workflow-content review remain pending. Genuine prompt, plan, human rejection/correction, implementation, emulator testing, PR and narration must be verified from the footage; a hosted file or merged PR cannot establish them. Do not stage missing events or label a retrospective explanation as original implementation capture. SDD-021 stays incomplete until those recording obligations are verified.

The SDD-022 bilingual TalkBack flows have [human-reported confirmation](docs/evidence/ui-final-polish/README.md#subsequent-human-listening-confirmation--2026-11-08). That report does not cover the new Home announcements in PR #17. Production application builds/releases, remaining device checks and human review retain their separate gates. No application code, tests or new device verification were performed for this documentation reconciliation.
