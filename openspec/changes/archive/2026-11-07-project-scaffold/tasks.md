# Tasks: Project scaffold and delivery pipeline

Apply only `project-scaffold` on `chore/SDD-001-project-scaffold`. Do not apply, implement or auto-start any sibling change. Prerequisite: None; initial apply target. A prerequisite is a review and merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; review and merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Requirements: see referenced task IDs and specs/traceability.md. All boxes proposed/unverified. Read this change’s proposal/design/specs and named root specifications before each task; report objective/files/tests, implement small coherent steps, run relevant checks, inspect diff and update evidence/ledger.

## 1. Scoped implementation and verification

- [x] 1.1 SDD-001 Confirm approval/source assumptions, preserve inspected files, initialize Git and chore/SDD-001-project-scaffold with ticket commits, begin elapsed coding ledger, and create project AGENTS.md covering M1–M10, boundaries/privacy/tests/DoD/forbidden shortcuts; prepare Recording B checklist before coding and arrange capture of a genuine implementation session including prompt/plan/review; verify checklist, capture schedule, branch, history and configuration by inspection. Record actual coding time even when on camera.
- [x] 1.2 SDD-002 Select compatible Expo SDK/New Architecture/Router and dependencies using official compatibility guidance, strict TS, aliases, tokens, Jest/Expo, lint/format and environment configuration; verify install, Expo config/doctor checks and typecheck; document exact working setup commands in README.
- [x] 1.3 SDD-003 Resolve ADB listener/access, start emulator and launch baseline app; verify real Android screen and record device/API/build evidence, or report blocker without claiming this gate passed. Commit verified baseline to scaffold branch; include no worker business features.
- [x] 1.4 SDD-018 Before feature implementation, create/verify typecheck, lint, format:check, test:ci, arch:check; add validate/build GitHub workflows, dependency/cycle enforcement, EAS development/preview/production profiles, PR template/contribution rules, safe environment defaults and a fail-closed feature-flag interface/default (no hosted flag service); run scripts and Expo validation locally, record hosted CI/build as unverified unless actually run; document external branch protection and approvals. Open the scaffold PR with actual check results and Android evidence; record review and merge as pending follow-up; do not start any dependent feature branch. Hosted CI/credential access gaps remain explicit limitations, not fabricated passes.

## 2. PR handoff

- [x] 2.1 Prepare only the `project-scaffold` PR on `chore/SDD-001-project-scaffold` with relevant requirement links, executed check results, scoped documentation and explicit limitations; verify changed files remain in scope and record PR URL or remote/reviewer blocker. Stop here without implementing another change.

## Workflow follow-up

- Record CI and merge status on the PR.
- Only after review and a new explicit request may another named change be applied. Never treat completing this checklist as authorization for all siblings.
- Archive/sync this change only through the appropriate later workflow; preserved programme reference is not an active or completed change.
