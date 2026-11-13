# Design: Cached Home and versioned terms

## Context

See proposal.md for scope and motivation. The inspected repository contains planning artifacts only; no application or Git repository was present at baseline. SDK compatibility and Android startup are unverified; ADB listener binding was denied. Prerequisite: `worker-authentication` reviewed and merged.

## Goals / Non-Goals

**Goals:** Cached assignment Home, known timeline, worker counts/connectivity, navigation and exact displayed-version terms confirmation/reconfirmation.

**Non-Goals:** No document status/capture implementation; navigation destinations for future screens may be explicitly unavailable.

## Decisions

Render local source-of-truth state through services; never raw sync calls. Home locale toggle foundation is usable now; language-and-accessibility completes the audit. Keep stale history while v3 confirmation remains enabled and queues a distinct action. Use existing engine tests plus UI reconfirmation coverage. Permanent terms failures expose explicit reconfirmation of the displayed version. The callback includes the failed predecessor ID; the service revalidates it, and the existing repository atomically supersedes that failure and inserts new intent with a new UUID. Refresh alone does not replace failures; stale history remains resolved without supersession.

Scope: `home-and-terms` on `feature/SDD-012-home-and-terms`. Start after `worker-authentication` is reviewed and merged. Submit this change for review on its own PR.

Read `specs/ui-spec.md`, `specs/sync-engine.md` and specs/programme/design.md for shared interfaces, state rules and constraints. Those references do not authorize implementing other changes. Use the smallest adapters/services needed by this scope; preserve strict boundaries. Interfaces/fakes allow early scopes to be verified without implementing future screens.

Tests and scoped README/DECISIONS updates land in this same PR. PR description explains behavior, requirements, significant choices/API/schema impact, executed commands/results, Android evidence and risks without restating the diff. Never report hosted CI/build/reviewer approval solely from configuration.

Budget: 15 coding minutes. One cumulative programme ledger targets 240 coding minutes and hard-stops at 300; never reset it per branch/change. Review waits are recorded separately and do not authorize bypassing gates. Coding on camera counts. Prepare Recording B before coding and capture during implementation, not final editing.

## Risks / Trade-offs

- [Unavailable dependency or merge] → Keep this scope blocked before coding; do not auto-apply prerequisites.
- [Original assessment absent] → Preserve provisional assumptions and compare when supplied.
- [Mock or unit evidence overclaimed] → Record actual storage/native/emulator results and NOT RUN where appropriate.
- [Cross-scope drift] → Stop at this checklist; any new feature requires its own explicit apply.

## Migration Plan

Branch from current reviewed/merged main (scaffold establishes the initial baseline, preserving existing files). Run applicable checks, prepare the scoped PR and stop. No release, credential handling or merge is authorized by applying this change. Roll back unmerged work through its isolated branch; do not delete durable user data or rewrite shared history.
