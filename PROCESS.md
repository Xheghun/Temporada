# Development process: ticket to release

This describes the workflow used for the assessment and the remaining human-controlled release stages. Feature PRs through integration are merged. Documentation/recordings are the current handoff; no production release has occurred.

## Intake, context and planning

A human defines the ticket, worker outcome and acceptance criteria. The supplied master brief became M1–M10 and the root specifications. The original assessment remains pending comparison. Explicit changes, including English as the default, are recorded rather than silently treated as the original requirement. SDD IDs are local work identifiers.

Before an agent task, load AGENTS.md, the named OpenSpec proposal/design/tasks, affected root specs and applicable React Native/Expo guidance. Give the agent fictional fixtures, interfaces and the relevant tests; exclude credentials and real worker data. OpenSpec reports checklist state, not proof that a requirement works.

The initial architecture had a human approval gate. The programme was then split into scaffold, mock API, persistence, sync, authentication, Home/Terms, corrections, capture, language, integration and submission documentation. Only the explicitly requested change is applied. Significant architecture/API/security changes return to the human; routine scoped decisions proceed without repeated permission requests.

## Implementation and local verification

Each feature starts on a descriptive ticket branch from reviewed, merged main. Branches and commits contain the SDD ID and no AI branding. The agent reads the task, names affected files/tests, implements a coherent change, reviews its diff and updates evidence before checking the task complete. The human remains responsible for acceptance and merges.

Owning changes ship domain, repository, transport and UI tests. Deterministic clocks/failure injection test retry and ordering without real waits. Real SQLite/file/HTTP tests verify transaction recovery and idempotency; native Android checks verify the deployed runtime behavior that fakes cannot establish. Failures keep their requirement IDs and regression tests; tests are not weakened to obtain a green result.

Typecheck, lint, formatting, architecture boundaries, tests and Expo compatibility/configuration were run during implementation. Integration executed all eight Android scenarios and inspected action IDs, file digests and server counts. iOS has a smaller explicitly documented passing scope. Screenshots/storage snapshots are evidence, not substitutes for executed steps. Unrun builds, device classes and accessibility checks remain unverified.

The cumulative ledger includes coding and verification across branches, including on-camera coding. It stopped at 299.91 minutes. Human review/permission waits are separate. Final documentation and recording work do not authorize more application coding or app verification after that stop.

## CI, pull requests and human review

GitHub Actions automatically installs locked dependencies, checks ticket/branch conventions, runs the quality/test/Expo scripts and bundles Android JavaScript on PRs/main. CI checks actual PR commit subjects rather than GitHub's generated merge subject. A green export is not a signed build or store approval.

The agent prepares a concrete PR description: behavior changed, relevant requirement links, actual verification and remaining work. The human reviews code, evidence and trade-offs, requests corrections and merges. No direct main push or automatic merge is part of this workflow. Human review is not inferred from the presence of a PR; approved/merged history is recorded when observed. Branch protection and required reviewers need repository administrator configuration; YAML alone cannot enforce them.

## Contract approval and release

The proposed authenticated `X-Worker-Id` convention and production error/revision semantics require backend developer sign-off. The local mock does not supply that approval or production security. Security decisions, signing credentials and production enablement also need authorized humans.

After approved backend/configuration integration, an authorized operator produces an internal EAS build, then staging QA uses release binaries and the target device matrix. The current manual build workflow is main-only and build-only, with development/preview/production profiles; external account, credentials, HTTPS endpoints, flags and protected environments remain prerequisites.

A human approves store submissions, review access, privacy disclosures and rollout percentages. Monitoring and rollback follow [the release plan](docs/release-plan.md). Production flags default off; a store release, compatible update or server change requires its own authorization. No signing, cloud build, OTA publication or rollout was performed here.

## Evidence and recordings

[Integration evidence](docs/evidence/offline-integration.md) and [traceability](specs/traceability.md) connect requirements to executed checks. The user confirmed no recordings exist. Recording A can demonstrate the actual app; Recording B was intended to capture genuine implementation and cannot be recreated as if it happened. Both remain incomplete until their real artifacts meet [the recording criteria](docs/recordings.md). A missing mandatory artifact is reported, not hidden behind a completed code checklist.
