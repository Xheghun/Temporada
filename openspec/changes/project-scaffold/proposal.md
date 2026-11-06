# Proposal: Project scaffold and delivery pipeline

## Why

Deliver project scaffold and delivery pipeline as an independently reviewable increment so applying this change cannot silently grow into the entire assessment application.

## What Changes

- Expo Router/New Architecture baseline, strict TypeScript, lint/format, Jest/Expo harness, architecture checks, GitHub Actions validation/build definitions, EAS profiles, safe environment defaults, PR template, project guidance and Recording B preparation.
- Scope exclusions: No mock service, SQLite domain schema/outbox, sync engine, authentication, worker screens or media workflow. SQLite package initialization may be smoke-tested without business repositories.
- Preserve the programme requirements and evidence discipline in specs/requirements.md and specs/programme/design.md.

## Capabilities

### New Capabilities

None. Tooling, verification or documentation only; skip_specs is explicit.

### Modified Capabilities

None. No main capabilities exist at planning time. Sibling changes own distinct capability paths; review current main specs before apply and reconcile conflicts explicitly.

## Impact

Apply only `project-scaffold` on `chore/SDD-001-project-scaffold`. Do not apply, implement or auto-start any sibling change. Prerequisite: None; initial apply target. A prerequisite is a human review/merge gate, not CLI-enforced dependency metadata. If unmet, stop before coding. Request this change explicitly to apply it. Stop after preparing its scoped PR; human review/merge and the next change require separate actions. No direct main push, automatic merge or AI-branded branch. Ticket IDs are provisional local IDs.

Task ownership: SDD-001, SDD-002, SDD-003, SDD-018. Planning only; no behavior verified. Reference documents: `specs/architecture.md`, `specs/testing.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
