# Development process

I used OpenSpec to break the brief into small changes covering the scaffold, mock API, persistence, synchronization, authentication, worker screens, document capture and integration. Each change had its own branch, acceptance criteria and tests. The [change index](specs/tasks.md) links the implementation records.

## Working with AI

I used AI coding assistance to work through the scoped changes, investigate failures and draft tests and documentation. I reviewed the changes, tried the flows and asked for corrections where the behaviour or design did not match the brief. The [AI workflow recording](https://github.com/Xheghun/Temporada/releases/download/project-recordings-2026-11-08/Temporada-AI-Workflow.mp4) shows the workflow.

The architecture keeps screens separate from services, repositories and native adapters. That made it possible to test the offline rules without mounting the UI, and to check the actual SQLite, file and HTTP behaviour separately. Only fictional worker records were used.

## Verification

GitHub Actions checks branch and commit conventions, TypeScript, lint, formatting, architecture boundaries, tests, Expo configuration and an Android JavaScript export. The latest application change passed 182 tests: 79 component/domain tests, 5 architecture checks, 12 mock API tests and 86 persistence/integration tests.

The native scenario checks covered offline saving, process restart, lost responses, retry backoff, failed uploads, changed terms and shared-phone isolation. I also completed end-to-end UI testing on iOS and Android, TalkBack checks and testing on lower-end devices. Those were manual checks; exact device models, OS versions and performance measurements were not recorded here. They do not establish release-build performance or store approval.

The original assessment implementation and verification stopped at **299.91 minutes**. The [coding ledger](docs/coding-ledger.md) separates that work from the later redesign, fixes, documentation and recordings. The current application includes the later work.

## Pull requests and release scope

Changes go through ticketed branches and pull requests. Descriptions explain the behaviour changed, checks performed and any relevant limitations. CI results and review are separate: a passing check is evidence about that check, not approval of a release.

The app uses a local mock backend for the assessment. The production sequence covers signing, staging QA, store submission and rollout. See the [release plan](docs/release-plan.md).

Both recordings are listed in the [README](README.md#projects-recordings).
