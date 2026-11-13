# Proposal: Document states and correction history

## Why

Deliver document states and correction history as an independently reviewable increment so applying this change cannot silently grow into the entire assessment application.

## What Changes

- Backend-catalog document screen, accurate local/server/staff states, correction reasons and new-submission orchestration/history.
- Scope exclusions: No camera/compression/file adapter; verify submission orchestration using a durable-image fixture until capture wires the user-facing path.
- Preserve the programme requirements and evidence discipline in specs/requirements.md and specs/programme/design.md.

## Capabilities

### New Capabilities

- `document-review`: Document states and correction history; scoped behavioral contract in this change.

### Modified Capabilities

None. No main capabilities exist at planning time. Sibling changes own distinct capability paths; review current main specs before apply and reconcile conflicts explicitly.

## Impact

Scope: `document-corrections` on `feature/SDD-013-document-corrections`. Start after `home-and-terms` is reviewed and merged. Submit this change for review on its own PR.

Task ownership: SDD-013. Planning only; no behavior verified. Reference documents: `specs/ui-spec.md`, `specs/data-model.md`, `specs/testing.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
