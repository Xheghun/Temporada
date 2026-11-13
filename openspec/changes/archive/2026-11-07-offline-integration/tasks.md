# Tasks: Android integration verification and fixes

Scope: `offline-integration` on `fix/SDD-016-offline-integration`. Start after `language-and-accessibility` is reviewed and merged. Submit this change for review on its own PR.

Requirements: see referenced task IDs and specs/traceability.md. All boxes proposed/unverified. Read this change’s proposal/design/specs and named root specifications before each task; report objective/files/tests, implement small coherent steps, run relevant checks, inspect diff and update evidence/ledger.

## 1. Scoped implementation and verification

- [x] 1.1 SDD-016 Run automated suite and execute all eight manual scenarios, prioritizing Android scenarios 2/3/4, worker switching, 401/413/422 and image byte/persistence checks; inspect SQLite and server business/receipt counts, record expected/actual/environment/logs and mark unexecuted scenarios NOT RUN.
- [x] 1.2 SDD-017 Fix critical verified failures within remaining budget and rerun affected checks; inspect sensitive logging, final diff/history and update traceability with evidence rather than assumed passes; record incomplete items at hard 300-minute coding stop.
- [x] 1.3 SDD-019 Run final available checks, verify Android startup after final change, inspect final diff and create ticketed commit; reconcile evidence and cumulative ledger, preserving genuine history; stop coding by five hours regardless of unfinished scope.

## 2. PR handoff

- [x] 2.1 Prepare only the `offline-integration` PR on `fix/SDD-016-offline-integration` with relevant requirement links, executed check results, scoped documentation and explicit limitations; verify changed files remain in scope and record PR URL or remote/reviewer blocker. Stop here without implementing another change.

## Workflow follow-up

- Record CI and merge status on the PR.
- Only after review and a new explicit request may another named change be applied. Never treat completing this checklist as authorization for all siblings.
- Archive/sync this change only through the appropriate later workflow; preserved programme reference is not an active or completed change.

PR handoff: https://github.com/Xheghun/Temporada/pull/11. All eight native scenario results and limits: [docs/evidence/offline-integration.md](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/offline-integration.md). Review and merge and hosted CI remain separate gates. No sibling change was applied.
