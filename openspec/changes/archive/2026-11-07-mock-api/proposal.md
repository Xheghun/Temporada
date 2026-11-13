# Proposal: Supporting mock API

## Why

Deliver supporting mock api as an independently reviewable increment so applying this change cannot silently grow into the entire assessment application.

## What Changes

- Minimal persistent mock endpoints, exact fictional seeds, worker authorization, idempotent receipts, multipart uploads and deterministic failure controls.
- Scope exclusions: No mobile authentication screens, local outbox, sync implementation or worker UI.
- Preserve the programme requirements and evidence discipline in specs/requirements.md and specs/programme/design.md.

## Capabilities

### New Capabilities

- `mock-worker-api`: Supporting mock API; scoped behavioral contract in this change.

### Modified Capabilities

None. No main capabilities exist at planning time. Sibling changes own distinct capability paths; review current main specs before apply and reconcile conflicts explicitly.

## Impact

Scope: `mock-api` on `feature/SDD-004-mock-api`. Start after `project-scaffold` is reviewed and merged. Submit this change for review on its own PR.

Task ownership: SDD-004, SDD-005. Planning only; no behavior verified. Reference documents: `specs/api-contract.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
