# Design: Worker-scoped persistence and durable intent

## Context

See proposal.md for scope and motivation. The inspected repository contains planning artifacts only; no application or Git repository was present at baseline. SDK compatibility and Android startup are unverified; ADB listener binding was denied. Prerequisite: `mock-api` human-reviewed and merged.

## Goals / Non-Goals

**Goals:** Versioned worker-scoped SQLite repositories, cached assignment/catalog/terms, immutable submissions, transactional enqueue and interrupted-send recovery.

**Non-Goals:** No live network sync, authentication UI or camera/compression adapter.

## Decisions

Implement explicit transactions and worker-scoped composite references without an ORM. Reopen actual storage for TEST-02. Document upload enqueue precondition as a durable file adapter contract; file creation/compression belongs to document-capture. Verify durable intent through services/test fixtures before screens exist.

Apply only `persistent-outbox` on `feature/SDD-006-persistent-outbox`. Do not apply, implement or auto-start any sibling change. Prerequisite: `mock-api` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Read `specs/data-model.md` and specs/programme/design.md for shared interfaces, state rules and constraints. Those references do not authorize implementing other changes. Use the smallest adapters/services needed by this scope; preserve strict boundaries. Interfaces/fakes allow early scopes to be verified without implementing future screens.

Tests and scoped README/DECISIONS updates land in this same PR. PR description explains behavior, requirements, significant choices/API/schema impact, executed commands/results, Android evidence and risks without restating the diff. Never report hosted CI/build/reviewer approval solely from configuration.

Budget: 35 coding minutes. One cumulative programme ledger targets 240 coding minutes and hard-stops at 300; never reset it per branch/change. Review waits are recorded separately and do not authorize bypassing gates. Coding on camera counts. Prepare Recording B before coding and capture during implementation, not final editing.

## Risks / Trade-offs

- [Unavailable dependency or human merge] → Keep this scope blocked before coding; do not auto-apply prerequisites.
- [Original assessment absent] → Preserve provisional assumptions and compare when supplied.
- [Mock or unit evidence overclaimed] → Record actual storage/native/emulator results and NOT RUN where appropriate.
- [Cross-scope drift] → Stop at this checklist; any new feature requires its own explicit apply.

## Migration Plan

Branch from current reviewed/merged main (scaffold establishes the initial baseline, preserving existing files). Run applicable checks, prepare the scoped PR and stop. No release, credential handling or merge is authorized by applying this change. Roll back unmerged work through its isolated branch; do not delete durable user data or rewrite shared history.
