# Proposal: Authentication and shared-phone identity

## Why

Deliver authentication and shared-phone identity as an independently reviewable increment so applying this change cannot silently grow into the entire assessment application.

## What Changes

- Localized phone/OTP, SecureStore session adapter, authorized worker picker, route gating, offline session resume, worker switch and logout.
- Scope exclusions: No Home business content, terms screen, document capture or review UI.
- Preserve the programme requirements and evidence discipline in specs/requirements.md and specs/programme/design.md.

## Capabilities

### New Capabilities

- `worker-identity`: Authentication and shared-phone identity; scoped behavioral contract in this change.

### Modified Capabilities

None. No main capabilities exist at planning time. Sibling changes own distinct capability paths; review current main specs before apply and reconcile conflicts explicitly.

## Impact

Scope: `worker-authentication` on `feature/SDD-011-worker-authentication`. Start after `offline-sync` is reviewed and merged. Submit this change for review on its own PR.

Task ownership: SDD-011. Planning only; no behavior verified. Reference documents: `specs/architecture.md`, `specs/api-contract.md`, `specs/ui-spec.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
