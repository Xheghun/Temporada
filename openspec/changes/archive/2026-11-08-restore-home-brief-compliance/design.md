# Design

## Context

See proposal.md for the audit finding and scope. Current Home uses the new compact visual system, `nextWorkerAction` and document rows, but only renders connectivity when offline. `assignmentFacts` already calculates pending/attention counts; the route does not render them. Home's job teaser has employer/worksite but omits dates/reference. Current version/summary/status appear in Terms, not Home. The main capability still requires timeline/counts; SDD-022's completed delta instead replaced the timeline. This change explicitly restores that part of the original contract and does not rewrite SDD-022 history.

`AssignmentService` already subscribes to data/network/session changes and reads one worker-scoped atomic `WorkerViewData`. That includes assignment, actions, cache timestamp and refresh state. Public document projections expose current submission/replacement and delivery/review facts. Reuse these instead of new network requests or tables. Applicable React Native best-practices guidance informs safe-area scrolling, subscriptions, native typography and simple components.

## Goals / Non-Goals

**Goals:** Make Home independently satisfy the original information requirements, retain the redesigned hierarchy and real-state actions, and verify observable behavior across offline/live transitions.

**Non-Goals:** Changes to default language, repo privacy, recordings, notifications, backend/schema, authentication, queue scheduling, idempotency or image lifecycle. No invented event log, dates, legal terms, checklist appointments or chronological history. No new dependencies.

## Decisions

### 1. Keep the design; restore visible sections

Proposed Home order:

1. Existing wordmark/language/profile, greeting and subtitle.
2. Compact sync strip: text/icon Online or Offline; numeric pending count including zero when known. Separately show attention-needed count when nonzero. It stays near the top in normal 393dp and small 360dp layouts; larger text may wrap without fixed-height clipping.
3. Existing state-derived next-action panel.
4. Existing numbered documents/View all.
5. Assignment summary: employer, worksite, date-only start/end and job-order reference, plus My Job link.
6. Current terms: exact version, server/local status, full supplied summary and Review terms link. Do not truncate or collapse the summary; long real content may scroll.
7. Always-expanded progress timeline with terms, document delivery and staff review milestones.
8. Existing contextual refresh/recovery and primary bottom navigation.

Use existing native fonts, palette, dividers and lightweight rows. Three compact milestones can have small markers and a vertical guide, with text carrying meaning independently of color. Required facts may be below the fold, but none require another screen or a disclosure. This intentionally adds Home content to the PNG concept; fidelity checks must document this brief-compliance adaptation rather than remove fields to match its height. My Job/Terms retain their screens. Avoid an additional nested card stack, duplicate giant headings and duplicate primary actions.

### 2. Derive facts from one captured snapshot

Reuse `assignmentFacts` for active queue and attention counts. Count all action types in statuses queued/sending/retry_wait; do not count historical/resolved/permanent states. Before a read completes, show loading/unavailable, not zero. A loaded read with no assignment can still show its known pending count. Online means connectivity hint only; use the existing provider and subscriptions, not an extra poller or HTTP health check.

Compose typed document facts through public document exports in the Home route as it already does. Add minimal pure presentation projections only where needed; assignment domain must not import document-private code. The same assignment snapshot supplies job, current terms and queue facts. Session generation checks remain in the existing hook/service. UI components receive typed presentation props; no raw transport or SQL is introduced.

### 3. Timeline is milestones, not an invented activity feed

| Milestone | Display policy |
| --- | --- |
| Terms | Current exact version: not confirmed, saved/waiting, sending/retry, server-confirmed, update-required or failed/action needed from existing terms facts. A delivered older version does not confirm a new current version. |
| Required documents | n / total current required documents delivered using existing submitted-count semantics; summarize local pending or failures separately. A newer local replacement prevents treating its old server record as completed current work. |
| Staff review | Show current approved / awaiting-review / correction-needed counts independently of transport. Preserve known newer server review while an original receipt is unresolved, with separate pending delivery explanation. No queued upload becomes staff-approved; historical old corrections do not replace current work. |

Unknown catalog/assignment or refresh-required facts show unavailable/updating rather than all complete. With a genuinely loaded empty required catalog, say no required documents rather than fabricate review steps or pending approval. No timestamps unless real event times are later introduced in a separate contract. Existing `nextWorkerAction` priority is not rewritten to implement this timeline. Current review facts must be composed from validated document projections, not inferred from total receipts.

### 4. Localization and failure behavior

Add/reuse English/Spanish keys with singular/plural pending counts, network text, section labels and milestone status descriptions. Render server-provided bilingual summaries by selected locale; keep unknown staff text verbatim. Date formatting reuses the UTC date-only formatter. On failed refresh retain cached content with cache/refresh context. A backend outage can show Online plus actions waiting; do not relabel the queue delivered because NetInfo restored.

Keep TalkBack labels/text and concise live-region announcements for meaningful network/count changes; avoid announcing the full Home on every update. Maintain 48dp touch targets, contrast, safe-area padding and unclipped scalable content. Existing feature flags govern links/actions. Missing document feature must not remove known assignment/terms/queue facts; display unavailable document progress rather than fabricate completion.

### 5. Verification

Focused pure tests cover active status counting, stale/current terms, document/review projection, superseded replacements, zero/unknown states and date-only formatting. UI tests assert required facts exist on Home itself, both network states, loaded zero, mixed queues, bilingual strings, backend-error/cached states and worker change. Use a transition test proving connection loss/restoration and delivered events update the overview without screen re-entry.

Android acceptance at 360dp/100-percent and 130-percent in both languages: inspect the sync strip, scroll every required section and controls, confirm terms offline, queue a document, restart offline, reconnect and observe original IDs/state without duplicate effects. Include expired session and Carla/Bruno switching with pending work. Existing evidence is baseline; record new screenshots and actual expected/observed results for changed Home. Check current version changes require explicit confirmation. Speech checks require manual listening, never simulated sign-off. Run relevant automated suite and standard quality checks; no new implementation tests for palette-only constants.

## Risks / Trade-offs

- [More content than the mockup] → Compact grouped rows and scrolling; original brief wins over the concept's shorter Home.
- [Milestones imply chronological events] → Label as progress, use current facts and no invented timestamps.
- [Connectivity implies successful delivery] → Separate network text from persistent pending/status facts and test Online with server 500s.
- [Conflicting completed delta] → This new delta restores timeline details; archive completed SDD-022 before syncing this change or explicitly reconcile its already-merged requirements through the normal workflow. Never let later archival of SDD-022 remove the new requirements.
- [Assessment clock already exhausted] → Plan/implementation are explicitly later work; preserve the original ledger and disclose additional effort. No reset or new five-hour compliance claim.

## Migration Plan

On an explicit apply request, start from current reviewed merged main on `fix/SDD-023-home-brief-compliance`, preserving untracked recordings. Confirm the local provisional ticket is unused. Reconcile OpenSpec chronology as above without automatically archiving sibling changes. Add this scope to the change index and maintain separate subsequent-work time. Implement selector/props, compact content, bilingual resources and focused tests; update root UI/requirements/traceability and feature docs to distinguish brief compliance from reference adaptations. Preserve all existing domain scenarios. Validate, capture real evidence, and prepare one scoped PR; merge/release remains separate. Rollback reverts presentation changes only; no data migration is needed.
