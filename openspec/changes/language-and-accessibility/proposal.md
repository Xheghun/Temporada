# Proposal: Language and accessible layout completion

## Why

Deliver language and accessible layout completion as an independently reviewable increment so applying this change cannot silently grow into the entire assessment application.

## What Changes

- Spanish-first/English completeness, Home toggle verification, localization parity, semantic status cues and narrow/large-text accessibility audit.
- Scope exclusions: No deferral of initial Spanish strings from earlier features; no fabricated server free-text translations.
- Preserve the programme requirements and evidence discipline in specs/requirements.md and specs/programme/design.md.

## Capabilities

### New Capabilities

- `worker-language`: Language and accessible layout completion; scoped behavioral contract in this change.

### Modified Capabilities

None. No main capabilities exist at planning time. Sibling changes own distinct capability paths; review current main specs before apply and reconcile conflicts explicitly.

## Impact

Apply only `language-and-accessibility` on `feature/SDD-015-language-and-accessibility`. Do not apply, implement or auto-start any sibling change. Prerequisite: `document-capture` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Task ownership: SDD-015. Planning only; no behavior verified. Reference documents: `specs/ui-spec.md`, `specs/testing.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
