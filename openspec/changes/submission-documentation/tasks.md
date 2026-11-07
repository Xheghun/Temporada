# Tasks: Assessment documentation and recording verification

Apply only `submission-documentation` on `chore/SDD-020-submission-documentation`. Do not apply, implement or auto-start any sibling change. Prerequisite: `offline-integration` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Requirements: see referenced task IDs and specs/traceability.md. All boxes proposed/unverified. Read this change’s proposal/design/specs and named root specifications before each task; report objective/files/tests, implement small coherent steps, run relevant checks, inspect diff and update evidence/ledger.

## 1. Scoped implementation and verification

- [x] 1.1 SDD-020 Finalize README using executed commands, 2–4 page DECISIONS including M1–M10/real AI usage, 1–2 page PROCESS, half-page release plan and four architecture answers each <=150 words (passport conflict, notifications, stores/low-end devices, device loss); verify claims against evidence and word limits, explicitly document cuts/unverified approvals/builds.
- [ ] 1.2 SDD-021 Finalize truthful PR description and Recording A (5–8min app demo); edit and verify Recording B (10–15min) captured during implementation under the SDD-001 checklist; verify real prompt/plan/review/correction, implementation, emulator testing and PR evidence. Human narrates actual work; missing or missed capture remains incomplete and must not be reconstructed as a genuine session. No invented review, rejection, session or approval.

## 2. PR handoff

- [x] 2.1 Prepare only the `submission-documentation` PR on `chore/SDD-020-submission-documentation` with relevant requirement links, executed check results, scoped documentation and explicit limitations; verify changed files remain in scope and record PR URL or remote/reviewer blocker. Stop here without implementing another change.

## Workflow follow-up

- Human reviews/merges this PR; record merge and required CI evidence separately from implementation completion.
- Only after review and a new explicit request may another named change be applied. Never treat completing this checklist as authorization for all siblings.
- Archive/sync this change only through the appropriate later workflow; preserved programme reference is not an active or completed change.

Apply-time status: PRs #11/#12 are merged. User confirmed no recordings exist (2026-11-07). SDD-021 remains incomplete; its written outline/status cannot substitute for real footage. This documentation-only stage does not reset the 299.91-minute coding ledger or rerun application verification.

SDD-020 checks: documentation formatting and strict OpenSpec validation passed; 47 local Markdown link targets exist; architecture answers are 120/115/117/131 words, DECISIONS 1,392 words, PROCESS 710 words and release plan 249 words. Claims were reconciled against existing integration/source evidence. No application test/build/emulator run was added. SDD-021 written outline/status is prepared, but both actual recordings remain absent.

PR handoff: https://github.com/Xheghun/Temporada/pull/13. Written submission and scoped handoff are complete; SDD-021 remains unchecked because no recordings exist. Hosted CI/human review are separate. Do not archive this change as complete or infer recording acceptance from this PR.
