# Tasks: Worker-scoped persistence and durable intent

Apply only `persistent-outbox` on `feature/SDD-006-persistent-outbox`. Do not apply, implement or auto-start any sibling change. Prerequisite: `mock-api` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Requirements: see referenced task IDs and specs/traceability.md. All boxes proposed/unverified. Read this change’s proposal/design/specs and named root specifications before each task; report objective/files/tests, implement small coherent steps, run relevant checks, inspect diff and update evidence/ledger.

## 1. Scoped implementation and verification

- [x] 1.1 SDD-006 Implement versioned migrations and worker-scoped repositories for assignment/terms/catalog/submissions/outbox; verify schema reapplication, captured-worker queries and isolation against real reopened storage; update data-model/DECISIONS.
- [x] 1.2 SDD-007 Implement atomic intent/outbox enqueue, stable UUIDs, sending recovery and immutable submission history; verify offline persisted state and TEST-02 reconstruction from real storage with identical payload/ID; update persistence evidence.

## 2. PR handoff

- [x] 2.1 Prepare only the `persistent-outbox` PR on `feature/SDD-006-persistent-outbox` with relevant requirement links, executed check results, scoped documentation and explicit limitations; verify changed files remain in scope and record PR URL or remote/reviewer blocker. Stop here without implementing another change.

## Workflow follow-up

- Human reviews/merges this PR; record merge and required CI evidence separately from implementation completion.
- Only after review and a new explicit request may another named change be applied. Never treat completing this checklist as authorization for all siblings.
- Archive/sync this change only through the appropriate later workflow; preserved programme reference is not an active or completed change.

Handoff: https://github.com/Xheghun/Temporada/pull/4. Local evidence: [docs/evidence/persistent-outbox.md](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/persistent-outbox.md). Hosted CI and human review/merge remain separate gates. No sibling change implemented.
