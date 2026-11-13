# Proposal: Language and accessible layout completion

## Why

Deliver language and accessible layout completion as an independently reviewable increment so applying this change cannot silently grow into the entire assessment application.

## What Changes

- English-first/Spanish completeness, Home toggle verification, localization parity, semantic status cues and narrow/large-text accessibility audit.
- Scope exclusions: No deferral of initial Spanish strings from earlier features; no fabricated server free-text translations.
- Preserve the programme requirements and evidence discipline in specs/requirements.md and specs/programme/design.md.

## Capabilities

### New Capabilities

- `worker-language`: Language and accessible layout completion; scoped behavioral contract in this change.

### Modified Capabilities

None. No main capabilities exist at planning time. Sibling changes own distinct capability paths; review current main specs before apply and reconcile conflicts explicitly.

## Impact

Scope: `language-and-accessibility` on `feature/SDD-015-language-and-accessibility`. Start after `document-capture` is reviewed and merged. Submit this change for review on its own PR.

Task ownership: SDD-015. Planning only; no behavior verified. Reference documents: `specs/ui-spec.md`, `specs/testing.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
