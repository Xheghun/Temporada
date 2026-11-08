# Tasks: Guided capture and durable image lifecycle

Apply only `document-capture` on `feature/SDD-014-document-capture`. Do not apply, implement or auto-start any sibling change. Prerequisite: `document-corrections` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Requirements: see referenced task IDs and specs/traceability.md. All boxes proposed/unverified. Read this change’s proposal/design/specs and named root specifications before each task; report objective/files/tests, implement small coherent steps, run relevant checks, inspect diff and update evidence/ledger.

## 1. Scoped implementation and verification

- [x] 1.1 SDD-014 Implement camera/gallery/preview, measured compression, durable private copy, transactional enqueue and safe file reconciliation; verify byte threshold, restart file retention, DB-failure/orphan cleanup, missing bytes and permission/413 recovery; document file lifecycle.

## 2. PR handoff

- [x] 2.1 Prepare only the `document-capture` PR on `feature/SDD-014-document-capture` with relevant requirement links, executed check results, scoped documentation and explicit limitations; verify changed files remain in scope and record PR URL or remote/reviewer blocker. Stop here without implementing another change.

## Workflow follow-up

- Human reviews/merges this PR; record merge and required CI evidence separately from implementation completion.
- Only after review and a new explicit request may another named change be applied. Never treat completing this checklist as authorization for all siblings.
- Archive/sync this change only through the appropriate later workflow; preserved programme reference is not an active or completed change.

Scoped PR: https://github.com/Xheghun/Temporada/pull/9. Evidence: [docs/evidence/document-capture.md](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/document-capture.md). Human review/merge pending; no sibling change started.

P2 review verified: malformed journals are quarantined per worker without blocking valid journals or DB-aware file reconciliation; pending bytes remain intact across repeated recovery. 130 tests pass; emulator fault injection NOT RUN.
