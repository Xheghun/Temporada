# Design: Resilient synchronization

## Context

See proposal.md for scope and motivation. The inspected repository contains planning artifacts only; no application or Git repository was present at baseline. SDK compatibility and Android startup are unverified; ADB listener binding was denied. Prerequisite: `persistent-outbox` human-reviewed and merged.

## Goals / Non-Goals

**Goals:** Injected UI-independent synchronization, lifecycle trigger adapters, retry/auth classification, stable IDs, stale-version recovery and revision-safe acknowledgments.

**Non-Goals:** No worker screens, OTP form, document camera or feature auto-application.

## Decisions

Use session/connectivity interfaces and fakes until authentication wires the real provider. Global single-flight plus captured worker/session generation; persist jitter deadlines and independent refresh need. Delivered/stale/superseded are ordering-resolved. Explicit v3 proceeds without superseding stale v2. Delivery ack must not overwrite a newer same-submission review revision/reason; missing/incomparable revision preserves known decision and requests refresh. TEST-03R covers approve and correction. Do not require later UI for pure engine acceptance.

Apply only `offline-sync` on `feature/SDD-008-offline-sync`. Do not apply, implement or auto-start any sibling change. Prerequisite: `persistent-outbox` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Read `specs/sync-engine.md`, `specs/data-model.md`, `specs/api-contract.md`, `specs/testing.md` and specs/programme/design.md for shared interfaces, state rules and constraints. Those references do not authorize implementing other changes. Use the smallest adapters/services needed by this scope; preserve strict boundaries. Interfaces/fakes allow early scopes to be verified without implementing future screens.

Tests and scoped README/DECISIONS updates land in this same PR. PR description explains behavior, requirements, significant choices/API/schema impact, executed commands/results, Android evidence and risks without restating the diff. Never report hosted CI/build/reviewer approval solely from configuration.

Budget: 50 coding minutes. One cumulative programme ledger targets 240 coding minutes and hard-stops at 300; never reset it per branch/change. Review waits are recorded separately and do not authorize bypassing gates. Coding on camera counts. Prepare Recording B before coding and capture during implementation, not final editing.

## Risks / Trade-offs

- [Unavailable dependency or human merge] → Keep this scope blocked before coding; do not auto-apply prerequisites.
- [Original assessment absent] → Preserve provisional assumptions and compare when supplied.
- [Mock or unit evidence overclaimed] → Record actual storage/native/emulator results and NOT RUN where appropriate.
- [Cross-scope drift] → Stop at this checklist; any new feature requires its own explicit apply.

## Migration Plan

Branch from current reviewed/merged main (scaffold establishes the initial baseline, preserving existing files). Run applicable checks, prepare the scoped PR and stop. No release, credential handling or merge is authorized by applying this change. Roll back unmerged work through its isolated branch; do not delete durable user data or rewrite shared history.

Persistence interface note: the merged persistent-outbox repository will return actions in database-generated enqueue sequence order, preserving user intent when device timestamps tie or move backwards. UUID remains action identity. This is the deterministic ordering to use in engine selection; do not substitute timestamp/UUID sorting.

Implementation notes: process-wide guard, SQLite v2 refresh deadlines, permanent-refresh pause, explicit failed-action transactional supersession, and dispatch-time file verification are described in docs/synchronization.md. Native/HTTP evidence and limitations are recorded in docs/evidence/offline-sync.md. No worker UI or real auth provider is wired in this change.
