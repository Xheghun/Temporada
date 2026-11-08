# Tasks — restore Home brief compliance

Scope: original Home requirements plus M1/M2/M4/M6/M9/M10 presentation integrity. Provisional ticket SDD-023. Apply only this change after a separate explicit request. Original assessment time/history is immutable; subsequent effort is recorded separately. Application work is tracked below, separately from the original assessment.

## 1. Establish the scoped baseline

- [x] 1.1 Verify current reviewed main and unused SDD-023 branch/ticket, then create `fix/SDD-023-home-brief-compliance`; preserve recordings/unrelated files and record base SHA and subsequent-work start. Check merged SDD-022's spec reconciliation status and document the safe archive/sync order without auto-applying or archiving siblings. Add this scope to specs/tasks.md and reconcile its original-brief source reference; verify scoped diff and branch/history.

## 2. Projection and synchronization summary

- [x] 2.1 Reuse worker-scoped assignmentFacts and public document facts for typed Home overview/progress props. Add focused tests for zero/mixed pending states, unknown reads, current terms, historical replacement, review-versus-delivery and empty catalog. Verify status-count and stale/failed/current-version cases without native imports or cross-feature private dependencies; document projection semantics in docs/home-and-terms.md.
- [x] 2.2 Render the near-top Online/Offline text plus numeric pending count in both states, with attention failures separate and no false loading zero; add bilingual keys and transition tests for connection loss/restoration, backend 500/retry and delivery updates. Verify count changes without leaving Home, busy/error accessibility and feature-disabled/cache-empty behavior; update UI/traceability references alongside this work.

## 3. Required Home content

- [x] 3.1 Extend Home's assignment summary with real season dates/reference and add an always-expanded current terms version/summary/status section with detail links. Reuse date-only formatting and preserve real-state actions. Add Home UI tests asserting every original-brief fact is present directly in English/Spanish offline and during failed refresh; update feature/UI docs and show no fixture/legal content is invented.
- [x] 3.2 Add the always-expanded three-milestone timeline (terms, document delivery, staff review) using the tested projections. Cover unconfirmed, queued, retry, acknowledged, correction, stale/new-version, failed replacement, known review with unresolved receipt and unavailable/zero-document states. Verify readable text/non-color cues, no invented timestamps, unchanged next-action priority and worker-switch/late-response isolation; update traceability and document the intentional PNG-layout adaptation.

## 4. Integrated verification and handoff

- [x] 4.1 Run typecheck, lint, format:check, arch:check, test:ci and applicable Expo config/compatibility validation. Inspect Home on Android at 360dp in English/Spanish at 100/130-percent text, all sections reachable above safe navigation. Exercise offline terms/document enqueue, restart, reconnect and stale-version reconfirmation; inspect IDs/counts/review states and Carla/Bruno switching plus reauthentication. Record new screenshots, environment/commit, expected/actual results and PASS/FAIL/NOT RUN; obtain human speech confirmation for changed announcements or leave that evidence unverified.
- [x] 4.2 Compare current Home against the original brief and revised layout: explicit online/offline and count, employer/worksite/dates/reference, actual current terms/version/status, timeline and links all on Home. Review complete diff for presentation-only scope and unchanged persistence/auth/sync/files; validate OpenSpec, update docs/evidence and subsequent ledger, and prepare a scoped ticketed PR with actual tests/screenshots, intentional design adaptation and limitations. Stop for human review; do not merge or change other audit findings.

## Workflow follow-up

- Human review/merge is required. Archive only through a later explicit request, after resolving SDD-022's pending spec-sync chronology so its old timeline-removal delta cannot overwrite this restoration.
- Privacy, Spanish-first compliance, recordings, timebox disclosure and other audit findings remain independent work; this change does not claim full assessment compliance.
