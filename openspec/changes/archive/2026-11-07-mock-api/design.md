# Design: Supporting mock API

## Context

See proposal.md for scope and motivation. The inspected repository contains planning artifacts only; no application or Git repository was present at baseline. SDK compatibility and Android startup are unverified; ADB listener binding was denied. Prerequisite: `project-scaffold` reviewed and merged.

## Goals / Non-Goals

**Goals:** Minimal persistent mock endpoints, exact fictional seeds, worker authorization, idempotent receipts, multipart uploads and deterministic failure controls.

**Non-Goals:** No mobile authentication screens, local outbox, sync implementation or worker UI.

## Decisions

Use transactional server storage so receipt and effect commit together. Replay authorization precedes lookup; matching receipt precedes current terms/failure checks. Fingerprint canonical fields and file bytes. Include original review revision and submission ID. Test endpoint/restart/drop behavior now; Android client scenarios land later. Add only minimal development staff-decision control required for TEST-03R.

Scope: `mock-api` on `feature/SDD-004-mock-api`. Start after `project-scaffold` is reviewed and merged. Submit this change for review on its own PR.

Read `specs/api-contract.md` and specs/programme/design.md for shared interfaces, state rules and constraints. Those references do not authorize implementing other changes. Use the smallest adapters/services needed by this scope; preserve strict boundaries. Interfaces/fakes allow early scopes to be verified without implementing future screens.

Tests and scoped README/DECISIONS updates land in this same PR. PR description explains behavior, requirements, significant choices/API/schema impact, executed commands/results, Android evidence and risks without restating the diff. Never report hosted CI/build/reviewer approval solely from configuration.

Budget: 20 coding minutes. One cumulative programme ledger targets 240 coding minutes and hard-stops at 300; never reset it per branch/change. Review waits are recorded separately and do not authorize bypassing gates. Coding on camera counts. Prepare Recording B before coding and capture during implementation, not final editing.

## Risks / Trade-offs

- [Unavailable dependency or merge] → Keep this scope blocked before coding; do not auto-apply prerequisites.
- [Original assessment absent] → Preserve provisional assumptions and compare when supplied.
- [Mock or unit evidence overclaimed] → Record actual storage/native/emulator results and NOT RUN where appropriate.
- [Cross-scope drift] → Stop at this checklist; any new feature requires its own explicit apply.

## Migration Plan

Branch from current reviewed/merged main (scaffold establishes the initial baseline, preserving existing files). Run applicable checks, prepare the scoped PR and stop. No release, credential handling or merge is authorized by applying this change. Roll back unmerged work through its isolated branch; do not delete durable user data or rewrite shared history.
