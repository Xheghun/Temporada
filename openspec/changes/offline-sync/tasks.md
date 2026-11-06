# Tasks: Resilient synchronization

Apply only `offline-sync` on `feature/SDD-008-offline-sync`. Do not apply, implement or auto-start any sibling change. Prerequisite: `persistent-outbox` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Requirements: see referenced task IDs and specs/traceability.md. All boxes proposed/unverified. Read this change’s proposal/design/specs and named root specifications before each task; report objective/files/tests, implement small coherent steps, run relevant checks, inspect diff and update evidence/ledger.

Recording B is assigned to this session by the user. Before coding, remind the user to start screen/audio capture before the task prompt, plan and review. Follow docs/recording-b-checklist.md; do not claim recording has started without confirmation. This note does not authorize applying offline-sync before its prerequisite or a separate explicit apply request.

## 1. Scoped implementation and verification

- [x] 1.1 SDD-008 Implement injected engine contracts, single-flight, eligible deterministic ordering/resource dependencies, captured-session checks and lifecycle triggers; verify TEST-01 and concurrent-trigger tests; document ordering and queue semantics.
- [x] 1.2 SDD-009 Implement persistent jittered retry, 401 pause/resume, 413/422 terminal remedies, explicit transactional failed-action supersession and unrelated progress; verify TEST-04 with fake clock, deadline recovery, auth tests and supersession reopen/rollback/worker-isolation tests; document classifications.
- [x] 1.3 SDD-010 Implement revision-aware 201/200 delivery/review merge, stale v2 as resolved for ordering and independent latest-terms refresh with explicit reconfirmation; verify TEST-03 against durable real backend, TEST-03R (commit/drop → staff decision → refresh → original replay preserves Approved/Correction Requested and reason), and TEST-05 through successful explicit v3 delivery without v2 supersession, including refresh failure/replay after v3; update sync evidence and decisions.

## 2. PR handoff

- [ ] 2.1 Prepare only the `offline-sync` PR on `feature/SDD-008-offline-sync` with relevant requirement links, executed check results, scoped documentation and explicit limitations; verify changed files remain in scope and record PR URL or remote/reviewer blocker. Stop here without implementing another change.

## Workflow follow-up

- Human reviews/merges this PR; record merge and required CI evidence separately from implementation completion.
- Only after review and a new explicit request may another named change be applied. Never treat completing this checklist as authorization for all siblings.
- Archive/sync this change only through the appropriate later workflow; preserved programme reference is not an active or completed change.
