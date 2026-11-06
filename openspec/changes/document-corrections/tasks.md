# Tasks: Document states and correction history

Apply only `document-corrections` on `feature/SDD-013-document-corrections`. Do not apply, implement or auto-start any sibling change. Prerequisite: `home-and-terms` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Requirements: see referenced task IDs and specs/traceability.md. All boxes proposed/unverified. Read this change’s proposal/design/specs and named root specifications before each task; report objective/files/tests, implement small coherent steps, run relevant checks, inspect diff and update evidence/ledger.

## 1. Scoped implementation and verification

- [x] 1.1 SDD-013 Implement backend-catalog Documents, distinct delivery/review states, correction reason/new submission and ID/revision-aware merge; verify correction history, late old-passport decision cannot replace newer pending state, and TEST-03R preserves the same submission’s newer staff decision after replay; document conflict policy.

## 2. PR handoff

- [ ] 2.1 Prepare only the `document-corrections` PR on `feature/SDD-013-document-corrections` with relevant requirement links, executed check results, scoped documentation and explicit limitations; verify changed files remain in scope and record PR URL or remote/reviewer blocker. Stop here without implementing another change.

## Workflow follow-up

- Human reviews/merges this PR; record merge and required CI evidence separately from implementation completion.
- Only after review and a new explicit request may another named change be applied. Never treat completing this checklist as authorization for all siblings.
- Archive/sync this change only through the appropriate later workflow; preserved programme reference is not an active or completed change.
