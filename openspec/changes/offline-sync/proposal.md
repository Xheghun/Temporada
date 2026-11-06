# Proposal: Resilient synchronization

## Why

Deliver resilient synchronization as an independently reviewable increment so applying this change cannot silently grow into the entire assessment application.

## What Changes

- Injected UI-independent synchronization, lifecycle trigger adapters, retry/auth classification, stable IDs, stale-version recovery and revision-safe acknowledgments.
- Scope exclusions: No worker screens, OTP form, document camera or feature auto-application.
- Preserve the programme requirements and evidence discipline in specs/requirements.md and specs/programme/design.md.

## Capabilities

### New Capabilities

- `offline-delivery`: Resilient synchronization; scoped behavioral contract in this change.

### Modified Capabilities

None. No main capabilities exist at planning time. Sibling changes own distinct capability paths; review current main specs before apply and reconcile conflicts explicitly.

## Impact

Apply only `offline-sync` on `feature/SDD-008-offline-sync`. Do not apply, implement or auto-start any sibling change. Prerequisite: `persistent-outbox` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Task ownership: SDD-008, SDD-009, SDD-010. Planning only; no behavior verified. Reference documents: `specs/sync-engine.md`, `specs/data-model.md`, `specs/api-contract.md`, `specs/testing.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
