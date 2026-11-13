# Proposal: Worker-scoped persistence and durable intent

## Why

Deliver worker-scoped persistence and durable intent as an independently reviewable increment so applying this change cannot silently grow into the entire assessment application.

## What Changes

- Versioned worker-scoped SQLite repositories, cached assignment/catalog/terms, immutable submissions, transactional enqueue and interrupted-send recovery.
- Scope exclusions: No live network sync, authentication UI or camera/compression adapter.
- Preserve the programme requirements and evidence discipline in specs/requirements.md and specs/programme/design.md.

## Capabilities

### New Capabilities

- `offline-intent`: Worker-scoped persistence and durable intent; scoped behavioral contract in this change.

### Modified Capabilities

None. No main capabilities exist at planning time. Sibling changes own distinct capability paths; review current main specs before apply and reconcile conflicts explicitly.

## Impact

Scope: `persistent-outbox` on `feature/SDD-006-persistent-outbox`. Start after `mock-api` is reviewed and merged. Submit this change for review on its own PR.

Task ownership: SDD-006, SDD-007. Planning only; no behavior verified. Reference documents: `specs/data-model.md`. The original assessment is pending; mobile correctness is the focus. Mock work remains supporting infrastructure.
