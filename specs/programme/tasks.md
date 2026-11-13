# Superseded task reference — DO NOT APPLY

Preserved for planning provenance only. Authoritative active checklists are listed in [../tasks.md](../tasks.md). No implementation or archive completion is implied.

# Tasks

All tasks proposed and unchecked. Follow root specs and capability contracts. Before each task read relevant specs, state objective/files/tests; implement smallest coherent change; execute checks, inspect diff, update evidence/status and ledger. Report Task ID, requirements, implementation, tests, verification, risks and status concisely. Never weaken tests or invent evidence. Stop at initial approval gate until explicit apply request.

## 1. Scaffold and pipeline PR — 30 minutes (M1–M10, R-ANDROID, R-GOV, R-TIME)

- Original proposed task: 1.1 SDD-001 Confirm approval/source assumptions, preserve inspected files, initialize Git and chore/SDD-001-project-scaffold with ticket commits, begin elapsed coding ledger, and create project AGENTS.md covering M1–M10, boundaries/privacy/tests/DoD/forbidden shortcuts; prepare Recording B checklist before coding and arrange capture of a genuine implementation session including prompt/plan/review; verify checklist, capture schedule, branch, history and configuration by inspection. Record actual coding time even when on camera.
- Original proposed task: 1.2 SDD-002 Select compatible Expo SDK/New Architecture/Router and dependencies using official compatibility guidance, strict TS, aliases, tokens, Jest/Expo, lint/format and environment configuration; verify install, Expo config/doctor checks and typecheck; document exact working setup commands in README.
- Original proposed task: 1.3 SDD-003 Resolve ADB listener/access, start emulator and launch baseline app; verify real Android screen and record device/API/build evidence, or report blocker without claiming this gate passed. Commit verified baseline to scaffold branch; include no worker business features.

- Original proposed task: 1.4 SDD-018 Before feature implementation, create/verify typecheck, lint, format:check, test:ci, arch:check; add validate/build GitHub workflows, dependency/cycle enforcement, EAS development/preview/production profiles, PR template/contribution rules, safe environment defaults and fail-closed remote production flags; run scripts and Expo validation locally, record hosted CI/build as unverified unless actually run; document external branch protection and approvals. Open the scaffold PR with actual check results and Android evidence; verify review and merge before beginning dependent feature branches. Hosted CI/credential access gaps remain explicit blockers to that gate.

## 2. Mock backend — 20 minutes (M3, M4, M6, M10, R-API)

- Original proposed task: 2.1 SDD-004 Implement exact seeds, OTP/auth and authorized X-Worker-Id assignment contract with persistent storage; verify endpoint smoke tests and forbidden-worker 403; document mock-only assumptions and proposed contract approval status.
- Original proposed task: 2.2 SDD-005 Implement transactional business effect/idempotency receipts, content fingerprint, terms/multipart documents, submission history and development failure controls; verify first/replay, same-ID mismatch, stale terms, 413/422, restart, post-commit drop and safe file recovery; document actual failure-control commands and check Android-to-server reachability.

## 3. Local persistence — 35 minutes (M1, M2, M4, M7, M8, M10)

- Original proposed task: 3.1 SDD-006 Implement versioned migrations and worker-scoped repositories for assignment/terms/catalog/submissions/outbox; verify schema reapplication, captured-worker queries and isolation against real reopened storage; update data-model/DECISIONS.
- Original proposed task: 3.2 SDD-007 Implement atomic intent/outbox enqueue, stable UUIDs, sending recovery and immutable submission history; verify offline persisted state and TEST-02 reconstruction from real storage with identical payload/ID; update persistence evidence.

## 4. Engine and tests — 50 minutes (M1–M6, M10)

- Original proposed task: 4.1 SDD-008 Implement injected engine contracts, single-flight, eligible deterministic ordering/resource dependencies, captured-session checks and lifecycle triggers; verify TEST-01 and concurrent-trigger tests; document ordering and queue semantics.
- Original proposed task: 4.2 SDD-009 Implement persistent jittered retry, 401 pause/resume, 413/422 terminal remedies and unrelated progress; verify TEST-04 with fake clock, deadline recovery and auth tests; document classifications.
- Original proposed task: 4.3 SDD-010 Implement revision-aware 201/200 delivery/review merge, stale v2 as resolved for ordering and independent latest-terms refresh with explicit reconfirmation; verify TEST-03 against durable real backend, TEST-03R (commit/drop → staff decision → refresh → original replay preserves Approved/Correction Requested and reason), and TEST-05 through successful explicit v3 delivery without v2 supersession, including refresh failure/replay after v3; update sync evidence and decisions.

## 5. Authentication — 20 minutes (M2, M9, M10, R-AUTH)

- Original proposed task: 5.1 SDD-011 Implement localized phone/OTP forms, SecureStore sessions, worker picker, cached resume, switch/logout isolation and auth route gates; verify invalid OTP, single/shared phone, TEST-06, late-response isolation and logout/reauth queue survival; document seeded login flow.

## 6. Worker journey — 50 minutes (M1, M4, M6–M10, R-HOME, R-UI)

- Original proposed task: 6.1 SDD-012 Implement cached Home/timeline/network/pending/attention counts and exact-version Terms UI through services; verify offline cached startup, local feedback and stale reconfirmation rendering; document actual supported timeline facts.
- Original proposed task: 6.2 SDD-013 Implement backend-catalog Documents, distinct delivery/review states, correction reason/new submission and ID/revision-aware merge; verify correction history, late old-passport decision cannot replace newer pending state, and TEST-03R preserves the same submission’s newer staff decision after replay; document conflict policy.
- Original proposed task: 6.3 SDD-014 Implement camera/gallery/preview, measured compression, durable private copy, transactional enqueue and safe file reconciliation; verify byte threshold, restart file retention, DB-failure/orphan cleanup, missing bytes and permission/413 recovery; document file lifecycle.
- Original proposed task: 6.4 SDD-015 Complete Spanish-first/English resources, Home toggle, a11y and responsive tokens/components; verify key parity and RNTL statuses/errors in both locales plus 360px/large-text Android inspection; document observed limitations.

## 7. Integration — 30 minutes (M1–M10, R-ANDROID, R-EVIDENCE)

- Original proposed task: 7.1 SDD-016 Run automated suite and execute all eight manual scenarios, prioritizing Android scenarios 2/3/4, worker switching, 401/413/422 and image byte/persistence checks; inspect SQLite and server business/receipt counts, record expected/actual/environment/logs and mark unexecuted scenarios NOT RUN.
- Original proposed task: 7.2 SDD-017 Fix critical verified failures within remaining budget and rerun affected checks; inspect sensitive logging, final diff/history and update traceability with evidence rather than assumed passes; record incomplete items at hard 300-minute coding stop.

## 8. Final checks — 5 minutes (R-QUALITY, R-GOV, R-TIME)

- Original proposed task: 8.1 SDD-019 Run final available checks, verify Android startup after final change, inspect final diff and create ticketed commit; reconcile evidence and cumulative ledger, preserving genuine history; stop coding by five hours regardless of unfinished scope.

## 9. Documentation and human evidence — outside coding timebox (R-DOC, R-EVIDENCE, R-GOV)

- Original proposed task: 9.1 SDD-020 Finalize README using executed commands, 2–4 page DECISIONS including M1–M10/real AI usage, 1–2 page PROCESS, half-page release plan and four architecture answers each <=150 words (passport conflict, notifications, stores/low-end devices, device loss); verify claims against evidence and word limits, explicitly document cuts/unverified approvals/builds.
- Original proposed task: 9.2 SDD-021 Finalize truthful PR description and Recording A (5–8min app demo); edit and verify Recording B (10–15min) captured during implementation under the SDD-001 checklist; verify real prompt/plan/review/correction, implementation, emulator testing and PR evidence. Narrate the actual work; missing or missed capture remains incomplete and must not be reconstructed as a genuine session. No invented review, rejection, session or approval.

## Branch and PR gates

Follow the branch/task map in design.md: scaffold first, then a separate PR for mock API, local persistence, sync, authentication, Home/terms, document corrections, capture and localization/accessibility. Integration fixes and final documentation also use their own purpose-named branches/PRs. Each feature task includes opening its PR with scoped tests/docs and actual verification results; a task's implementation may be complete while its review/merge gate remains pending. Record both states separately.

Start each feature from reviewed/merged main. No direct main pushes, automatic merges or AI-branded branch names. Review and merge is required before dependent feature work begins. Each PR explains behavior, requirements, material decisions, actual test/build/emulator results and limitations concisely. Track PR URLs and review/CI evidence in traceability. Missing remote/reviewer access never authorizes bypassing a gate. CI/build definitions land in scaffold; credentials, hosted runs and production approval are separate evidence.

## Workflow follow-up

- Code reviews PR; no direct main push/merge/release. Backend developers approve actual contract integration; credentials/signing and rollout remain release.
- Configure external branch protection, remote feature-flag hosting, EAS accounts and internal/staging QA as authorized follow-up; do not claim configuration executed merely because documented.
- Archive only after evidence and review satisfy the workflow; archive is not an implementation task here.

Budget total 240 minutes; contingency 60 minutes only for critical work. Prioritize P0 then P1; cut polish before safety. No more than two stretch goals, none planned initially.
