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

Scope: `offline-sync` on `feature/SDD-008-offline-sync`. Start after `persistent-outbox` is reviewed and merged. Submit this change for review on its own PR.

Task ownership: SDD-008, SDD-009, SDD-010. Planning only; no behavior verified. Reference documents: `specs/sync-engine.md`, `specs/data-model.md`, `specs/api-contract.md`, `specs/testing.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
