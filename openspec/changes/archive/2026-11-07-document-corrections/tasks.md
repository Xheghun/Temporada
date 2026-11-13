# Tasks: Document states and correction history

Scope: `document-corrections` on `feature/SDD-013-document-corrections`. Start after `home-and-terms` is reviewed and merged. Submit this change for review on its own PR.

Requirements: see referenced task IDs and specs/traceability.md. All boxes proposed/unverified. Read this change’s proposal/design/specs and named root specifications before each task; report objective/files/tests, implement small coherent steps, run relevant checks, inspect diff and update evidence/ledger.

## 1. Scoped implementation and verification

- [x] 1.1 SDD-013 Implement backend-catalog Documents, distinct delivery/review states, correction reason/new submission and ID/revision-aware merge; verify correction history, late old-passport decision cannot replace newer pending state, and TEST-03R preserves the same submission’s newer staff decision after replay; document conflict policy.

## 2. PR handoff

- [x] 2.1 Prepare only the `document-corrections` PR on `feature/SDD-013-document-corrections` with relevant requirement links, executed check results, scoped documentation and explicit limitations; verify changed files remain in scope and record PR URL or remote/reviewer blocker. Stop here without implementing another change.

## Workflow follow-up

- Record CI and merge status on the PR.
- Only after review and a new explicit request may another named change be applied. Never treat completing this checklist as authorization for all siblings.
- Archive/sync this change only through the appropriate later workflow; preserved programme reference is not an active or completed change.

Scoped PR: https://github.com/Xheghun/Temporada/pull/8. Evidence: [docs/evidence/document-corrections.md](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/document-corrections.md). Review and merge pending; no sibling change started.
