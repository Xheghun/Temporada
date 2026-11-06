# Tasks: Cached Home and versioned terms

Apply only `home-and-terms` on `feature/SDD-012-home-and-terms`. Do not apply, implement or auto-start any sibling change. Prerequisite: `worker-authentication` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Requirements: see referenced task IDs and specs/traceability.md. All boxes proposed/unverified. Read this change’s proposal/design/specs and named root specifications before each task; report objective/files/tests, implement small coherent steps, run relevant checks, inspect diff and update evidence/ledger.

## 1. Scoped implementation and verification

- [x] 1.1 SDD-012 Implement cached Home/timeline/network/pending/attention counts and exact-version Terms UI through services; verify offline cached startup, local feedback and stale reconfirmation rendering; document actual supported timeline facts.

## 2. PR handoff

- [x] 2.1 Prepare only the `home-and-terms` PR on `feature/SDD-012-home-and-terms` with relevant requirement links, executed check results, scoped documentation and explicit limitations; verify changed files remain in scope and record PR URL or remote/reviewer blocker. Stop here without implementing another change.

## Workflow follow-up

- Human reviews/merges this PR; record merge and required CI evidence separately from implementation completion.
- Only after review and a new explicit request may another named change be applied. Never treat completing this checklist as authorization for all siblings.
- Archive/sync this change only through the appropriate later workflow; preserved programme reference is not an active or completed change.

Scoped handoff: https://github.com/Xheghun/Temporada/pull/7. Implementation/evidence in docs/evidence/home-and-terms.md; human review/merge pending.

Review follow-up verified: explicit permanent-failure replacement of displayed v2/v3, atomic rollback, duplicate suppression and same-engine delivery. Five new tests; 103 total. Emulator replacement flow NOT RUN; see updated evidence.
