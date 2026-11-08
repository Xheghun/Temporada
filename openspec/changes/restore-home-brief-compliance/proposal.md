# Restore Home brief compliance

## Why

The merged redesign moved dates and current terms details off Home and removed its timeline, explicit online status and numeric pending count. The original assessment requires those facts on Home; restore them without undoing the new visual system or changing offline behavior.

## What Changes

- Always show a compact connectivity and worker-scoped pending-count strip, including explicit zero when loaded.
- Show employer, worksite, season dates and job-order reference in a readable Home assignment section.
- Show the current cached terms version, real localized summary and truthful confirmation/delivery status with a Review terms link.
- Restore a simple factual progress timeline for terms, required-document delivery and staff review; do not invent dated events.
- Retain the existing greeting, state-driven next action, document rows, language/profile controls and primary navigation.
- Add focused selector/UI/native acceptance checks and reconcile the implementation references with the original brief.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `worker-home-and-terms`: Make the original Home information contract explicit and testable while retaining exact-version terms and next-action behavior.

## Impact

Likely files: assignment presentation selectors/components/public exports, Home route composition, English/Spanish resources, presentation tests, `docs/home-and-terms.md`, root UI/traceability references and dated evidence. Reuse existing cache/action/submission facts and connectivity subscriptions. No API, schema, authentication, sync, image lifecycle or dependency change is planned. My Job and Terms keep their detail screens.

This new change explicitly supersedes the SDD-022 decision to remove the timeline or rely on linked screens for required Home facts. Keep SDD-022 history intact. This is planning only; apply uses a separate descriptive ticket branch from reviewed main (proposed local ticket SDD-023, `fix/SDD-023-home-brief-compliance`). Subsequent work must remain separate from the original five-hour assessment record and requires a new explicit apply request. Repository privacy, default language, recordings and other audit findings are outside this change.
