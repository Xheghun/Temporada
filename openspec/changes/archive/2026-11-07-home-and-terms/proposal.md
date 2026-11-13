# Proposal: Cached Home and versioned terms

## Why

Deliver cached home and versioned terms as an independently reviewable increment so applying this change cannot silently grow into the entire assessment application.

## What Changes

- Cached assignment Home, known timeline, worker counts/connectivity, navigation and exact displayed-version terms confirmation/reconfirmation.
- Scope exclusions: No document status/capture implementation; navigation destinations for future screens may be explicitly unavailable.
- Preserve the programme requirements and evidence discipline in specs/requirements.md and specs/programme/design.md.

## Capabilities

### New Capabilities

- `worker-home-and-terms`: Cached Home and versioned terms; scoped behavioral contract in this change.

### Modified Capabilities

None. No main capabilities exist at planning time. Sibling changes own distinct capability paths; review current main specs before apply and reconcile conflicts explicitly.

## Impact

Scope: `home-and-terms` on `feature/SDD-012-home-and-terms`. Start after `worker-authentication` is reviewed and merged. Submit this change for review on its own PR.

Task ownership: SDD-012. Planning only; no behavior verified. Reference documents: `specs/ui-spec.md`, `specs/sync-engine.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
