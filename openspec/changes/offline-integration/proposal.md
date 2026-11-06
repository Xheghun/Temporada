# Proposal: Android integration verification and fixes

## Why

Deliver android integration verification and fixes as an independently reviewable increment so applying this change cannot silently grow into the entire assessment application.

## What Changes

- Execute all eight scenarios, inspect local/server persistence and duplicate counts, fix only evidenced integration defects and run final checks.
- Scope exclusions: No additional product feature or replacement for feature-local tests. Material behavior changes require a separately reviewed specification revision.
- Preserve the programme requirements and evidence discipline in specs/requirements.md and specs/programme/design.md.

## Capabilities

### New Capabilities

None. Tooling, verification or documentation only; skip_specs is explicit.

### Modified Capabilities

None. No main capabilities exist at planning time. Sibling changes own distinct capability paths; review current main specs before apply and reconcile conflicts explicitly.

## Impact

Apply only `offline-integration` on `fix/SDD-016-offline-integration`. Do not apply, implement or auto-start any sibling change. Prerequisite: `language-and-accessibility` human-reviewed and merged. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Task ownership: SDD-016, SDD-017, SDD-019. Planning only; no behavior verified. Reference documents: `specs/testing.md`, `specs/traceability.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
