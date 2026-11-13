# Design: Authentication and shared-phone identity

## Context

See proposal.md for scope and motivation. The inspected repository contains planning artifacts only; no application or Git repository was present at baseline. SDK compatibility and Android startup are unverified; ADB listener binding was denied. Prerequisite: `offline-sync` reviewed and merged.

## Goals / Non-Goals

**Goals:** Localized phone/OTP, SecureStore session adapter, authorized worker picker, route gating, offline session resume, worker switch and logout.

**Non-Goals:** No Home business content, terms screen, document capture or review UI.

## Decisions

Inject real session into existing engine. Clear views/subscriptions synchronously on switch; generation guards reject late visible data. Preserve queue/files on logout and expiry. TEST-06 uses repositories plus session switching even before document screens exist. Spanish labels and English resource keys are required now; later locale work completes/toggles and audits all screens.

Scope: `worker-authentication` on `feature/SDD-011-worker-authentication`. Start after `offline-sync` is reviewed and merged. Submit this change for review on its own PR.

Read `specs/architecture.md`, `specs/api-contract.md`, `specs/ui-spec.md` and specs/programme/design.md for shared interfaces, state rules and constraints. Those references do not authorize implementing other changes. Use the smallest adapters/services needed by this scope; preserve strict boundaries. Interfaces/fakes allow early scopes to be verified without implementing future screens.

Tests and scoped README/DECISIONS updates land in this same PR. PR description explains behavior, requirements, significant choices/API/schema impact, executed commands/results, Android evidence and risks without restating the diff. Never report hosted CI/build/reviewer approval solely from configuration.

Budget: 20 coding minutes. One cumulative programme ledger targets 240 coding minutes and hard-stops at 300; never reset it per branch/change. Review waits are recorded separately and do not authorize bypassing gates. Coding on camera counts. Prepare Recording B before coding and capture during implementation, not final editing.

## Risks / Trade-offs

- [Unavailable dependency or merge] → Keep this scope blocked before coding; do not auto-apply prerequisites.
- [Original assessment absent] → Preserve provisional assumptions and compare when supplied.
- [Mock or unit evidence overclaimed] → Record actual storage/native/emulator results and NOT RUN where appropriate.
- [Cross-scope drift] → Stop at this checklist; any new feature requires its own explicit apply.

## Migration Plan

Branch from current reviewed/merged main (scaffold establishes the initial baseline, preserving existing files). Run applicable checks, prepare the scoped PR and stop. No release, credential handling or merge is authorized by applying this change. Roll back unmerged work through its isolated branch; do not delete durable user data or rewrite shared history.

## Implementation evidence

The baseline above describes the original planning inspection. The merged foundation/sync now supports this scoped auth implementation. Session/runtime contracts are in docs/authentication.md; executed tests/native evidence and limitations are in [docs/evidence/worker-authentication.md](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/worker-authentication.md). Home business content remains outside this change.
