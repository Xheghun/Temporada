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

Apply only `document-corrections` on `feature/SDD-013-document-corrections`. Do not apply, implement or auto-start any sibling change. Prerequisite: `home-and-terms` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Task ownership: SDD-013. Planning only; no behavior verified. Reference documents: `specs/ui-spec.md`, `specs/data-model.md`, `specs/testing.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
