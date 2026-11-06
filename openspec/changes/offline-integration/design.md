# Design: Android integration verification and fixes

## Context

See proposal.md for scope and motivation. The inspected repository contains planning artifacts only; no application or Git repository was present at baseline. SDK compatibility and Android startup are unverified; ADB listener binding was denied. Prerequisite: `language-and-accessibility` human-reviewed and merged.

## Goals / Non-Goals

**Goals:** Execute all eight scenarios, inspect local/server persistence and duplicate counts, fix only evidenced integration defects and run final checks.

**Non-Goals:** No additional product feature or replacement for feature-local tests. Material behavior changes require a separately reviewed specification revision.

## Decisions

Preserve all existing feature contracts. Test actual Android scenarios 2/3/4, 401/413/422, worker isolation, file persistence, new-v3 delivery and replay-versus-review. Record every unrun check honestly. This verification-only change skips new normative deltas; no acceptance rule is removed.

Apply only `offline-integration` on `fix/SDD-016-offline-integration`. Do not apply, implement or auto-start any sibling change. Prerequisite: `language-and-accessibility` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Read `specs/testing.md`, `specs/traceability.md` and specs/programme/design.md for shared interfaces, state rules and constraints. Those references do not authorize implementing other changes. Use the smallest adapters/services needed by this scope; preserve strict boundaries. Interfaces/fakes allow early scopes to be verified without implementing future screens.

Tests and scoped README/DECISIONS updates land in this same PR. PR description explains behavior, requirements, significant choices/API/schema impact, executed commands/results, Android evidence and risks without restating the diff. Never report hosted CI/build/reviewer approval solely from configuration.

Budget: 35 coding minutes. One cumulative programme ledger targets 240 coding minutes and hard-stops at 300; never reset it per branch/change. Review waits are recorded separately and do not authorize bypassing gates. Coding on camera counts. Prepare Recording B before coding and capture during implementation, not final editing.

## Risks / Trade-offs

- [Unavailable dependency or human merge] → Keep this scope blocked before coding; do not auto-apply prerequisites.
- [Original assessment absent] → Preserve provisional assumptions and compare when supplied.
- [Mock or unit evidence overclaimed] → Record actual storage/native/emulator results and NOT RUN where appropriate.
- [Cross-scope drift] → Stop at this checklist; any new feature requires its own explicit apply.

## Migration Plan

Branch from current reviewed/merged main (scaffold establishes the initial baseline, preserving existing files). Run applicable checks, prepare the scoped PR and stop. No release, credential handling or merge is authorized by applying this change. Roll back unmerged work through its isolated branch; do not delete durable user data or rewrite shared history.
