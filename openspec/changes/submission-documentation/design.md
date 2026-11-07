# Design: Assessment documentation and recording verification

## Context

See proposal.md for scope and motivation. The original baseline restrictions are historical. Offline-integration PR #11 and iOS follow-up PR #12 are merged. Android acceptance and partial iOS evidence are available; the coding ledger stopped at 299.91 minutes. This change is documentation-only.

## Goals / Non-Goals

**Goals:** Finalize checked README, DECISIONS/PROCESS/release plan, four short answers, genuine AI evidence and final recording editing/verification.

**Non-Goals:** No coding, delayed Recording B capture, invented approvals or claims of unexecuted tests/builds.

## Decisions

Recording B preparation belongs to scaffold and capture occurs during genuine implementation. Finalize its editing/evidence now, with human narration. Missing capture or genuine correction stays incomplete. Include <=150 words per architecture answer, actual tools/mistakes/verification and explicit release approval limitations.

Apply only `submission-documentation` on `chore/SDD-020-submission-documentation`. Do not apply, implement or auto-start any sibling change. Prerequisite: `offline-integration` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Read `specs/requirements.md`, `specs/testing.md`, `specs/traceability.md` and specs/programme/design.md for shared interfaces, state rules and constraints. Those references do not authorize implementing other changes. Use the smallest adapters/services needed by this scope; preserve strict boundaries. Interfaces/fakes allow early scopes to be verified without implementing future screens.

Tests and scoped README/DECISIONS updates land in this same PR. PR description explains behavior, requirements, significant choices/API/schema impact, executed commands/results, Android evidence and risks without restating the diff. Never report hosted CI/build/reviewer approval solely from configuration.

Budget: documentation/recording outside coding budget. One cumulative programme ledger targets 240 coding minutes and hard-stops at 300; never reset it per branch/change. Review waits are recorded separately and do not authorize bypassing gates. Coding on camera counts. Prepare Recording B before coding and capture during implementation, not final editing.

## Risks / Trade-offs

- [Unavailable dependency or human merge] → Keep this scope blocked before coding; do not auto-apply prerequisites.
- [Original assessment absent] → Preserve provisional assumptions and compare when supplied.
- [Mock or unit evidence overclaimed] → Record actual storage/native/emulator results and NOT RUN where appropriate.
- [Cross-scope drift] → Stop at this checklist; any new feature requires its own explicit apply.

## Migration Plan

Branch from current reviewed/merged main (scaffold establishes the initial baseline, preserving existing files). Run applicable checks, prepare the scoped PR and stop. No release, credential handling or merge is authorized by applying this change. Roll back unmerged work through its isolated branch; do not delete durable user data or rewrite shared history.

## Apply-time evidence status

The user confirmed on 2026-11-07 that neither recording exists. Prepare written handoff/recording guidance, but leave SDD-021 unchecked: genuine implementation footage cannot be reconstructed after the fact. This does not waive the recording requirement. No application code, manual app tests or credential/build operations are authorized by this documentation change.
