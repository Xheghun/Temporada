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

Apply only `worker-authentication` on `feature/SDD-011-worker-authentication`. Do not apply, implement or auto-start any sibling change. Prerequisite: `offline-sync` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Task ownership: SDD-011. Planning only; no behavior verified. Reference documents: `specs/architecture.md`, `specs/api-contract.md`, `specs/ui-spec.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
