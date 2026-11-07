# Design

## Context

See proposal.md for motivation. `AuthPage` in `src/design-system/components/auth-controls.tsx` wraps all content in a bordered 20dp-radius card. Tokens currently use green headings and 18sp body text. `worker-content.tsx` adds assignment/timeline/document cards; `documents-content.tsx` expands every historical submission. Capture already previews with `expo-image` and caching disabled, but displays bytes and competing primary actions.

The worker layout is a generation-keyed Expo Router Stack. Home composes assignment and documents hooks; document routes gate capture separately. Public `assignmentFacts` and `documentViews` selectors already expose valid confirmation, delivery, review, history and replacement facts. Existing tests live in `src/testing/{auth-screens,home-terms,documents,capture-screen,language-accessibility}.test.tsx`; CI runs all seven requested scripts plus Expo Doctor and Android export.

The user explicitly identifies this redesign as subsequent work. This supersedes the generic cumulative-timebox constraint only for this separately labeled change; the historical 299.91-minute assessment ledger remains intact. The root Home requirement’s timeline conflicts with the requested design and is explicitly replaced in the delta. English default is already the documented amendment and stays unchanged. Historical architecture documentation’s empty-project baseline describes the past, not current source availability.

## Goals / Non-Goals

**Goals:** Make real states easy to understand, retain existing service boundaries, preserve mounted-session isolation, and keep the change reviewable as SDD-022.

**Non-Goals:** Backend integration, real SMS, resend timers or capabilities unsupported by the service, new legal content, synchronization/persistence rewrites, new schema, visual frameworks, custom fonts, animations or release approval. A narrow read-only auth snapshot addition for the OTP phone explanation is allowed; authentication behavior stays unchanged.

## Decisions

### 1. Small shared visual vocabulary

Refactor existing auth-controls and tokens rather than replace all call sites with a new framework. Add only reusable screen/header, section/row, status, avatar and navigation responsibilities that multiple screens need. Remove the page-wide card. Use native fonts with no fontFamily asset; heading 28/700, section 20/600–700, label/body 16, secondary 14, overline 12 and button 16/600–700. Use 4dp spacing increments, 24dp horizontal padding, 48dp minimum controls and 56dp key actions, small consistent button radii, dividers and no shadows.

Palette: background #FAF9F6; headings #171717; body #4D5950; secondary #747970; primary #224638; pressed #193E34; accent #B76B4B; highlighted CTA #E9C5A8; divider #DFDFD9; information #EFEEE5; surface #FFFFFF. Secondary/accent colors are candidates rather than automatic small-text foregrounds: verify contrast and darken functional text where necessary (normal text 4.5:1, large text/control boundaries 3:1). Main page headings always remain #171717. The featured green Home panel uses a white task label subordinate to the near-black page greeting, with one contrasting CTA.

Alternatives: adding @expo/ui, a component kit or custom fonts would expand native/dependency scope without being necessary. User palette and native-primitives constraints take precedence over optional skill styling preferences. Retain existing StyleSheet patterns. Screen headings and localized stack labels must avoid duplicate screen-reader announcements.

### 2. Keep routes and services

Keep `app/(worker)/_layout.tsx` as a generation-keyed Stack and preserve current route URLs and capture parameters. Add `app/(worker)/job.tsx` using assignment hooks and a public `JobContent` export. Render a shared primary bottom bar in Home/Documents/Job screen shells only, with selected state and safe-area bottom padding. Primary transitions use route replacement to avoid accumulating tab-like history; secondary screens push and return contextually, with a safe primary fallback for deep links. This avoids a nested route-group migration or added navigation packages.

Home/My Job/Terms use `worker_home_and_terms`; Documents uses `worker_document_corrections`; capture requires `worker_document_capture` and its existing prerequisites. Missing flags hide or clearly disable unsupported controls and guard deep links. Keep identity fallback, switch and logout available under existing authentication rules. No new production workflow is enabled outside fail-closed remote flags or explicit development assessment mode.

### 3. Compose read-only presentation facts

Export typed facts through feature public indexes. Assignment owns terms/job projections; documents owns document delivery/count projections. Home’s route composes facts from public interfaces into typed presentation props, avoiding assignment imports of document private code or a speculative shared state framework. Read current worker/generation only; if feature snapshots disagree, show loading/limited-state feedback instead of mixing workers or inferring completion.

Next action order: current actionable terms (including stale refresh/reconfirmation and explicit failed-action recovery); required correction with a supported replacement; required missing document; other required permanent failure. Use catalog order for ties. Pending local work means reassurance, delivered pending review means waiting, all current terms accepted and required documents approved means complete. Unknown/refresh-required state means refresh guidance, never complete. A correction already being replaced by an active upload is background work, not another correction task. If a feature is disabled, explain the limitation without an enabled-looking action. Retain existing selectors as the authority for canConfirm/canSubmit and replacement IDs.

Keep review and delivery as independent facts: queued = saved locally; sending = sending; retry_wait = saved, automatic retry; pending_review = sent, waiting for review; approved = no action; correction = new photo required with verbatim reason; permanent failure = correction needed; needs_refresh = status refresh needed. Known staff decisions are preserved alongside delivery problems. Suppress repetitive retry banners. Connectivity is a hint and never delivery proof.

Count only current required submissions with server delivery evidence, excluding current unresolved/failed replacements even if an older submission was delivered. A delivered correction counts as sent but remains action needed. Label and explain this count explicitly; never equate it to approval.

### 4. Screen integration

| Screen | Presentation and integration |
| --- | --- |
| Sign-in | Small wordmark, persisted language selector, “Your season starts here.”, existing RHF/Zod phone field and service continuation, accurate privacy/verification helper; keyboard-safe scrolling. |
| OTP | “Enter your code.”, phone explanation, one accessible six-digit field, verify CTA and working back action. Expose the requested phone through a token-free in-memory auth snapshot only while code_sent; clear it on phase exit. Do not persist or log it or invent resend behavior. |
| Worker picker | “Who’s using the phone?”, initials/name/chevron rows, busy selection feedback and separation explanation; loading/error/empty handling without bypassing auth gates. |
| Home | Wordmark/language/avatar-to-identity, real-name local-time greeting, compact relevant offline notice, one next-action panel, catalog-driven document rows, secondary employer/worksite link. No timeline. |
| My Job | Cached employer, worksite, reference and locale-formatted season dates using date-only semantics; terms link and honest missing/stale cache state. |
| Terms | Current version/status, actual localized summary, accurate confirmation explanation and existing displayed-version/generation callback; secondary collapsed stale history, existing refresh/replacement behavior. |
| Documents | Introduction and sent-count definition, divider-separated rows, delivery/review feedback and actual correction reason, actionable replacement, history collapsed per item and reset on worker switch. |
| Capture | Catalog label, compact photo guidance, empty-photo area or private real preview. Camera primary before selection; save primary after selection; gallery/retake secondary. Retain busy, settings and durable-saved feedback; remove ordinary byte display. |

Language changes use the existing app-wide persisted preference operation, including on unauthenticated screens; expose it through the existing preference boundary if currently available only through assignment service. Do not introduce a second preference store. All labels and accessibility text are added to `src/core/i18n/en.json` and `es.json`; server summary translations use backend values and correction free text stays verbatim. Use a neutral localized greeting if no reliable given-name field exists; do not invent one by assuming name order.

### 5. Preserve offline and image invariants

Screen callbacks remain service calls. No raw transport, new queue cleanup, changes to IDs, supersession rules or retry scheduling. Terms pending state disables duplicates; acceptance requires server evidence. Capture keeps compression attempts, measured size strictly below 1,500,000, durable private copy, SHA-256 checks, transactional enqueue, leases/journal reconciliation and ownership checks. Navigation may discard unqueued drafts using existing service behavior, but never durable actions/files. Cached content remains visible during refresh without a blocking loader.

### 6. Verification and evidence

Add focused pure priority/count tests and presentation interaction tests, rather than style snapshots that merely mirror constants. Cover all delivery/review combinations, replay with newer review, correction with current replacement, stale terms, missing cache, feature gates, clock boundaries, busy duplicate suppression, history toggle and route return. Update existing assertions without removing domain regressions.

Run typecheck, lint, format:check, arch:check, test:ci, expo:check and config:check, plus existing CI Expo Doctor/Android export where applicable. Re-exercise all six mandatory sync cases and native Android journeys against real persistence: offline enqueue; process restart/file retention; commit/lost response/replay; 500 versus 413/422 recovery; stale v2/explicit v3; worker isolation. Include capture, Pending Review, staff correction/replacement, logout/reauth and reconnect. Use existing fictional fixtures and controls only.

Inspect actual screens in both languages at approximately 360dp and 130%+ font scale, keyboard visible on auth, safe areas, back navigation and screen-reader focus/announcements. Capture actual updated screenshots when an emulator is available. Historical screenshots/test results are baseline evidence, never evidence of the redesign. Tests, native checks, low-end performance, iOS and human recording remain NOT RUN until actually executed.

## Risks / Trade-offs

- Shared component changes affect developer inspection routes too → check them for readable layouts and keep diagnostics confined to explicit development surfaces.
- Home composition may encounter asynchronous mismatched snapshots → worker/generation guards and conservative limited-state rendering; no new cross-feature repository.
- Light secondary palette can fail small-text contrast → measure functional color pairs and choose darker text without changing near-black headings.
- Bottom bar is shared presentation over the current Stack rather than native tabs → verify selection, replacement history, Android back and deep links; preserve URLs and avoid migration scope.
- Service-local preview/snapshot updates can arrive after switching → preserve existing guards and explicitly regress late results; never solve by deleting pending data.
- Broad visual scope can exceed an informal estimate → record actual subsequent work separately, report incomplete evidence and do not backdate it into assessment history.

## Migration Plan

After a separate explicit apply request, verify the reviewed main base and create `feature/SDD-022-temporada-mobile-ui-redesign`. Update the change index with this subsequent scope; prepare Recording B checklist for genuine capture without claiming it occurred. Add a clearly titled subsequent SDD-022 section to the ledger, preserving the original 299.91-minute endpoint and explicitly flagging extra work in any assessed submission description.

Implement shared components and screens in the requested order, verify real-state integration and then execute checks/native evidence. No data migration or new backend contract is planned. Rollback reverts presentation commits while preserving databases, outbox and private files. Reuse the existing compatible runtime only if native configuration/dependencies stay compatible; otherwise a new binary is required. Stop at one scoped PR with ticketed commits, changed-file list, actual test results, screenshots and explicit gaps. Human review/merge and approved production rollout remain separate.
