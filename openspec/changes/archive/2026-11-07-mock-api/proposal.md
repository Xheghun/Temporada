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

Apply only `mock-api` on `feature/SDD-004-mock-api`. Do not apply, implement or auto-start any sibling change. Prerequisite: `project-scaffold` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Task ownership: SDD-004, SDD-005. Planning only; no behavior verified. Reference documents: `specs/api-contract.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
