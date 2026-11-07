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

Apply only `home-and-terms` on `feature/SDD-012-home-and-terms`. Do not apply, implement or auto-start any sibling change. Prerequisite: `worker-authentication` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Task ownership: SDD-012. Planning only; no behavior verified. Reference documents: `specs/ui-spec.md`, `specs/sync-engine.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
