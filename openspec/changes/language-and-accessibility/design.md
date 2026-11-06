# Design: Language and accessible layout completion

## Context

See proposal.md for scope and motivation. The original baseline contained planning artifacts only. At implementation, document-capture PR #9 is merged; Expo SDK 58, Android startup and the shared localized controls are available. This scope completes the language and accessibility audit without applying sibling changes.

## Goals / Non-Goals

**Goals:** English-first/Spanish completeness, Home toggle verification, localization parity, semantic status cues and narrow/large-text accessibility audit.

**Non-Goals:** No deferral of initial Spanish strings from earlier features; no fabricated server free-text translations.

## Decisions

User amendment (2026-11-06): English replaces the original M9 Spanish-first default. Preserve every existing saved language value; seed English only when no language preference exists. This intentional discrepancy takes precedence for this change.

Earlier features ship localized strings; complete cross-screen audit here. Test locale keys and RNTL statuses/errors, inspect actual Android at 360px with large text and record limitations. Use existing design tokens without a UI framework.

Apply only `language-and-accessibility` on `feature/SDD-015-language-and-accessibility`. Do not apply, implement or auto-start any sibling change. Prerequisite: `document-capture` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Read `specs/ui-spec.md`, `specs/testing.md` and specs/programme/design.md for shared interfaces, state rules and constraints. Those references do not authorize implementing other changes. Use the smallest adapters/services needed by this scope; preserve strict boundaries. Interfaces/fakes allow early scopes to be verified without implementing future screens.

Tests and scoped README/DECISIONS updates land in this same PR. PR description explains behavior, requirements, significant choices/API/schema impact, executed commands/results, Android evidence and risks without restating the diff. Never report hosted CI/build/reviewer approval solely from configuration.

Budget: 10 coding minutes. One cumulative programme ledger targets 240 coding minutes and hard-stops at 300; never reset it per branch/change. Review waits are recorded separately and do not authorize bypassing gates. Coding on camera counts. Prepare Recording B before coding and capture during implementation, not final editing.

## Risks / Trade-offs

- [Unavailable dependency or human merge] → Keep this scope blocked before coding; do not auto-apply prerequisites.
- [Original assessment absent] → Preserve provisional assumptions and compare when supplied.
- [Mock or unit evidence overclaimed] → Record actual storage/native/emulator results and NOT RUN where appropriate.
- [Cross-scope drift] → Stop at this checklist; any new feature requires its own explicit apply.

## Migration Plan

Branch from current reviewed/merged main (scaffold establishes the initial baseline, preserving existing files). Run applicable checks, prepare the scoped PR and stop. No release, credential handling or merge is authorized by applying this change. Roll back unmerged work through its isolated branch; do not delete durable user data or rewrite shared history.
