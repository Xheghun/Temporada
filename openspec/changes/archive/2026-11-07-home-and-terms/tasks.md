# Tasks: Cached Home and versioned terms

Scope: `home-and-terms` on `feature/SDD-012-home-and-terms`. Start after `worker-authentication` is reviewed and merged. Submit this change for review on its own PR.

Requirements: see referenced task IDs and specs/traceability.md. All boxes proposed/unverified. Read this change’s proposal/design/specs and named root specifications before each task; report objective/files/tests, implement small coherent steps, run relevant checks, inspect diff and update evidence/ledger.

## 1. Scoped implementation and verification

- [x] 1.1 SDD-012 Implement cached Home/timeline/network/pending/attention counts and exact-version Terms UI through services; verify offline cached startup, local feedback and stale reconfirmation rendering; document actual supported timeline facts.

## 2. PR handoff

- [x] 2.1 Prepare only the `home-and-terms` PR on `feature/SDD-012-home-and-terms` with relevant requirement links, executed check results, scoped documentation and explicit limitations; verify changed files remain in scope and record PR URL or remote/reviewer blocker. Stop here without implementing another change.

## Workflow follow-up

- Record CI and merge status on the PR.
- Only after review and a new explicit request may another named change be applied. Never treat completing this checklist as authorization for all siblings.
- Archive/sync this change only through the appropriate later workflow; preserved programme reference is not an active or completed change.

Scoped handoff: https://github.com/Xheghun/Temporada/pull/7. Implementation/evidence in [docs/evidence/home-and-terms.md](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/home-and-terms.md); review and merge pending.

Review follow-up verified: explicit permanent-failure replacement of displayed v2/v3, atomic rollback, duplicate suppression and same-engine delivery. Five new tests; 103 total. Emulator replacement flow NOT RUN; see updated evidence.

Requested implementation-wide naming review completed on this open PR: repository/sync/auth/UI/backend/test/tooling identifiers clarified; AGENTS naming guidance and lint restriction added. Existing 103 tests and Android Home cold startup pass; no sibling feature implemented.
