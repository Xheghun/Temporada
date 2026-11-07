# Independently applied change index

The original whole-app change has been split. Its planning provenance is preserved under [programme/](programme/design.md), outside active OpenSpec changes; it is not an apply target and has not been completed or archived. Each active change owns its checklist, branch and PR. **Apply only the explicitly named change.**

Start with `$openspec-apply-change project-scaffold`. This implements scaffold only; no worker feature is included. It stops at its PR handoff. A separate explicit apply request and prerequisite human-reviewed merge are required for every subsequent change. OpenSpec does not enforce cross-change prerequisites itself; verify them before coding. If invoked without a name, select explicitly rather than applying all active changes.

| Order | Change / task checklist | Owned task IDs | Branch | Budget | Prerequisite review/merge |
|---|---|---|---|---|---|
| 1 | [project-scaffold](../openspec/changes/project-scaffold/tasks.md) | SDD-001, SDD-002, SDD-003, SDD-018 | `chore/SDD-001-project-scaffold` | 30m | initial scaffold |
| 2 | [mock-api](../openspec/changes/mock-api/tasks.md) | SDD-004, SDD-005 | `feature/SDD-004-mock-api` | 20m | project-scaffold |
| 3 | [persistent-outbox](../openspec/changes/persistent-outbox/tasks.md) | SDD-006, SDD-007 | `feature/SDD-006-persistent-outbox` | 35m | mock-api |
| 4 | [offline-sync](../openspec/changes/offline-sync/tasks.md) | SDD-008, SDD-009, SDD-010 | `feature/SDD-008-offline-sync` | 50m | persistent-outbox |
| 5 | [worker-authentication](../openspec/changes/worker-authentication/tasks.md) | SDD-011 | `feature/SDD-011-worker-authentication` | 20m | offline-sync |
| 6 | [home-and-terms](../openspec/changes/home-and-terms/tasks.md) | SDD-012 | `feature/SDD-012-home-and-terms` | 15m | worker-authentication |
| 7 | [document-corrections](../openspec/changes/document-corrections/tasks.md) | SDD-013 | `feature/SDD-013-document-corrections` | 10m | home-and-terms |
| 8 | [document-capture](../openspec/changes/document-capture/tasks.md) | SDD-014 | `feature/SDD-014-document-capture` | 15m | document-corrections |
| 9 | [language-and-accessibility](../openspec/changes/language-and-accessibility/tasks.md) | SDD-015 | `feature/SDD-015-language-and-accessibility` | 10m | document-capture |
| 10 | [offline-integration](../openspec/changes/offline-integration/tasks.md) | SDD-016, SDD-017, SDD-019 | `fix/SDD-016-offline-integration` | 35m | language-and-accessibility |
| 11 | [submission-documentation](../openspec/changes/submission-documentation/tasks.md) | SDD-020, SDD-021 | `chore/SDD-020-submission-documentation` | outside coding | offline-integration |

The dependency chain intentionally follows the reviewed implementation sequence. Shared interfaces/fakes let persistence and engine scopes pass their own tests before later screens are built. Scope-specific tests/docs ship with each PR; integration never replaces them. Spanish application-owned strings start with each UI feature; the locale change completes/audits coverage.

One cumulative coding ledger targets 240 minutes, with maximum 60-minute critical contingency and hard stop at 300. Branches/changes do not reset the clock. Review latency can extend calendar time and never authorizes bypassing the human gate. No direct main pushes, automatic merges or AI-branded branches.

Recording B preparation/scheduling belongs to project-scaffold (SDD-001), capture occurs during genuine implementation, final editing/verification belongs to submission-documentation (SDD-021). Coding on camera counts. Human recordings and approvals are never fabricated.

PR descriptions state behavior/problem, requirements, significant decisions, actual check results/Android evidence and risks without duplicating the diff. Record PR/CI/review/merge status separately. Current status: feature/integration PRs #1–11 and iOS evidence PR #12 are merged. All eight Android scenarios and partial iOS results are recorded. Submission documentation is the current scoped change; recordings A/B are absent and their task remains incomplete.
