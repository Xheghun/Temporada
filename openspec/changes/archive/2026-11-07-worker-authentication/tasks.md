# Tasks: Authentication and shared-phone identity

Scope: `worker-authentication` on `feature/SDD-011-worker-authentication`. Start after `offline-sync` is reviewed and merged. Submit this change for review on its own PR.

Requirements: see referenced task IDs and specs/traceability.md. All boxes proposed/unverified. Read this change’s proposal/design/specs and named root specifications before each task; report objective/files/tests, implement small coherent steps, run relevant checks, inspect diff and update evidence/ledger.

## 1. Scoped implementation and verification

- [x] 1.1 SDD-011 Implement localized phone/OTP forms, SecureStore sessions, worker picker, cached resume, switch/logout isolation and auth route gates; verify invalid OTP, single/shared phone, TEST-06, late-response isolation and logout/reauth queue survival; document seeded login flow.

## 2. PR handoff

- [x] 2.1 Prepare only the `worker-authentication` PR on `feature/SDD-011-worker-authentication` with relevant requirement links, executed check results, scoped documentation and explicit limitations; verify changed files remain in scope and record PR URL or remote/reviewer blocker. Stop here without implementing another change.

## Workflow follow-up

- Record CI and merge status on the PR.
- Only after review and a new explicit request may another named change be applied. Never treat completing this checklist as authorization for all siblings.
- Archive/sync this change only through the appropriate later workflow; preserved programme reference is not an active or completed change.

Handoff: https://github.com/Xheghun/Temporada/pull/6. Evidence: [docs/evidence/worker-authentication.md](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/worker-authentication.md). Hosted CI and review and merge are separate gates; no sibling feature was started.
