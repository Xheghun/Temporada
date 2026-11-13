# Proposal

## Why

Temporada already has working authentication, durable offline actions and document review, but oversized nested cards and technical status presentation obscure workers’ next steps. A cohesive, accessible presentation redesign will make the existing application calmer and easier to use on shared phones and unreliable connections.

## What Changes

- Replace page-wide cards with warm backgrounds, native system typography, near-black headings, spacious rows and one dominant action per screen.
- Redesign sign-in, OTP, worker selection, Home, terms, documents and capture; add cached My Job and restrained primary navigation.
- Derive Home’s next action from real terms/document state; distinguish saved locally, sending, delivered and staff review without exposing technical identifiers.
- Collapse submission history by default, preserve correction reasons and guide photo selection, preview and durable saving.
- Maintain English default, persisted Spanish choice, accessible controls and feature availability gates.
- Treat SDD-022 as subsequent work outside the original assessment’s recorded 299.91 minutes. Preserve that historical ledger and identify additional implementation and verification separately.

## Capabilities

### New Capabilities

- `worker-navigation`: Coherent primary Home/Documents/My Job navigation and secondary back navigation with feature availability and worker-session isolation.
- `worker-interface`: Shared visual hierarchy, authentication presentation, guided capture presentation and accessible bilingual interaction contracts.

### Modified Capabilities

- `worker-home-and-terms`: Replace the static Home timeline requirement with meaningful state-derived next actions, cached job details and readable exact-version terms.
- `document-review`: Add delivery-specific presentation, explicit submitted-count semantics and collapsed immutable history without changing review rules.

## Impact

Presentation changes affect `app/`, `src/design-system/`, assignment/documents/capture components, their public exports, `src/core/i18n/` and presentation tests. New pure presentation selectors may compose existing facts through public feature interfaces; routes remain composition boundaries. No backend contracts, database schema, authentication delivery, sync engine, idempotency, retry policy or file lifecycle changes are planned. Existing fail-closed remote flags remain authoritative. No new visual dependencies are expected.

Implementation branch: `feature/SDD-022-temporada-mobile-ui-redesign`, from verified reviewed merged main. Submission documentation remains a separate change; neither its completion nor recording evidence is assumed. Future implementation updates the change index and records subsequent work without rewriting assessed history. No source implementation, screenshots or PR are delivered by this planning workflow.

## Approved visual-fidelity reconciliation — 2026-11-08

The supplied `temporada_ui_reference_images.zip` is the visual baseline for this follow-up. The prior implementation achieved the palette and functional structure but does not establish fidelity to these eight exports. Refine this same change; retain prior completed tasks as historical implementation evidence and append new unchecked reconciliation tasks.

Match screen-specific headers, wordmark, density, typography hierarchy, numbered rows, summary panels and icon navigation. Add matched-state reference/current screenshot review as a required completion gate. Real worker identities, catalog content, version-specific terms, delivery/review semantics, feature gates and accessible layouts remain authoritative. Sample copy and fixture values are illustrative; full legal terms must not be invented. This remains separately recorded subsequent work outside the original assessment. Existing screenshots and green tests do not satisfy the new visual gate. The draft PR requires updated evidence before it can claim design fidelity; the outstanding human TalkBack check remains open.
