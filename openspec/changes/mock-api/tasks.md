# Tasks: Supporting mock API

Apply only `mock-api` on `feature/SDD-004-mock-api`. Do not apply, implement or auto-start any sibling change. Prerequisite: `project-scaffold` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Requirements: see referenced task IDs and specs/traceability.md. All boxes proposed/unverified. Read this change’s proposal/design/specs and named root specifications before each task; report objective/files/tests, implement small coherent steps, run relevant checks, inspect diff and update evidence/ledger.

## 1. Scoped implementation and verification

- [ ] 1.1 SDD-004 Implement exact seeds, OTP/auth and authorized X-Worker-Id assignment contract with persistent storage; verify endpoint smoke tests and forbidden-worker 403; document mock-only assumptions and proposed contract approval status.
- [ ] 1.2 SDD-005 Implement transactional business effect/idempotency receipts, content fingerprint, terms/multipart documents, submission history and development failure controls; verify first/replay, same-ID mismatch, stale terms, 413/422, restart, post-commit drop and safe file recovery; document actual failure-control commands and check Android-to-server reachability.

## 2. PR handoff

- [ ] 2.1 Prepare only the `mock-api` PR on `feature/SDD-004-mock-api` with relevant requirement links, executed check results, scoped documentation and explicit limitations; verify changed files remain in scope and record PR URL or remote/reviewer blocker. Stop here without implementing another change.

## Workflow follow-up

- Human reviews/merges this PR; record merge and required CI evidence separately from implementation completion.
- Only after review and a new explicit request may another named change be applied. Never treat completing this checklist as authorization for all siblings.
- Archive/sync this change only through the appropriate later workflow; preserved programme reference is not an active or completed change.
