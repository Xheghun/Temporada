# Proposal: Guided capture and durable image lifecycle

## Why

Deliver guided capture and durable image lifecycle as an independently reviewable increment so applying this change cannot silently grow into the entire assessment application.

## What Changes

- Camera/gallery permissions, preview/retake, measured compression below 1,500,000 bytes, private durable file storage, upload enqueue and cleanup recovery.
- Scope exclusions: No new retry engine, document-state redesign or gallery-original deletion.
- Preserve the programme requirements and evidence discipline in specs/requirements.md and specs/programme/design.md.

## Capabilities

### New Capabilities

- `document-capture`: Guided capture and durable image lifecycle; scoped behavioral contract in this change.

### Modified Capabilities

None. No main capabilities exist at planning time. Sibling changes own distinct capability paths; review current main specs before apply and reconcile conflicts explicitly.

## Impact

Apply only `document-capture` on `feature/SDD-014-document-capture`. Do not apply, implement or auto-start any sibling change. Prerequisite: `document-corrections` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Task ownership: SDD-014. Planning only; no behavior verified. Reference documents: `specs/data-model.md`, `specs/ui-spec.md`, `specs/testing.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
