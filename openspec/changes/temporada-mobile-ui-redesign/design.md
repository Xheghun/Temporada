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

## Approved reference-fidelity addendum — 2026-11-08

This addendum governs visual decisions where the earlier broad presentation guidance is insufficient or conflicts. Preserve domain/service behavior and the earlier accessibility requirements. Earlier baseline observations describe past source; the current implementation already has a redesign, whose fidelity is now being reconciled.

### Reference provenance and calibration

Source archive: `/Users/david/Downloads/temporada_ui_reference_images.zip`. Use `01_home.png` through `08_worker_selection.png` individually; `00_overview_contact_sheet.png` is an overview only. Each individual export is 786 × 1704 pixels. These are static concepts, not evidence of app execution. The included README describes the visuals; it does not authorize domain or workflow changes.

Before code changes, place an unchanged reference copy and checksum manifest in a repository-owned design-reference location during apply, so review does not depend on Downloads. Measure section bounds and typography against the individual images, recording the measurements and chosen React Native logical values in a reference matrix. Source pixels are not automatically dp/sp. Calibrate the reference viewport explicitly, normalize screenshots uniformly by width, and record differences in aspect ratio/system bars. Do not stretch/crop away application content or reduce font scaling to hide discrepancies.

Preserve the exact background #FAF9F6, heading #171717, action #224638 and highlighted CTA #E9C5A8. The shared wordmark becomes small, black, lowercase `temporada.`. Use screen-specific header variants, not the same brand/language header everywhere. Keep native fonts, 48dp targets and scalable text; compact visual labels can sit inside larger touch regions. Reference body hierarchy takes precedence over a single global body style. Measure spacing/row density per screen rather than applying a universal 24dp gap. Record target values before implementation; flag deviations exceeding 4dp for layout anchors/spacing or 1sp for calibrated typography for explicit review rather than silently accepting them. These are review thresholds, not claims that raster font rendering is identical.

### Screen contract matrix

| Reference / route | Required visual structure, in order | Real-state adaptations |
| --- | --- | --- |
| 01 Home / home | Small wordmark + compact language/profile controls; near-black greeting/subtitle; compact connectivity; green next-action panel with eyebrow, white title/body and peach arrow CTA; Documents heading with View all; numbered divider rows with status/chevrons; icon bottom bar | Neutral full-name greeting permitted; next task follows existing priorities. Offline indicator only when relevant. Job summary may follow reference-visible content and must not displace it through excessive spacing. |
| 02 Terms / terms | Back arrow with centered small JOB TERMS context; Before you begin heading/introduction; CURRENT VERSION label, green version and status; dividers; assignment section; actual terms summary section; tinted offline panel; confirm CTA | Exact displayed version, real acceptance/delivery, stale history and failed replacement remain supported. Summary is labeled as summary; never invent a complete legal document or retain sample-content footnotes as product copy. |
| 03 Documents / documents | Compact back/context header; heading/introduction; SUBMITTED DOCUMENTS eyebrow, prominent n / total and adjacent explanation; numbered compact divider rows with state cue/action; tinted offline note; icon bottom bar | Calculate count through existing delivery semantics. Corrections, errors and expandable history may increase a row height; ordinary rows do not acquire full-width buttons. Row action opens capture only when allowed. |
| 04 Upload / capture | Back arrow and ADD DOCUMENT context; catalog title/guidance; dashed tinted empty panel with simple document outline, title/helper; camera primary; gallery secondary; tinted local-storage note | Private preview replaces placeholder; explicit Save becomes primary after selection; retake/settings/progress/errors/saved feedback remain. Keep both initial photo actions reachable without unnecessary brand/header duplication. |
| 05 My Job / job | Small wordmark + YOUR ASSIGNMENT context; heading/subtitle; tinted employer/worksite summary panel; compact uppercase field labels and bold values separated by dividers; terms CTA; icon bottom bar | Cached real assignment/date-only formatting, offline/no-cache/refresh states; do not duplicate employer as a large ordinary detail row. |
| 06 Sign-in / sign-in | Small wordmark + compact language control; intentionally spaced two-line season heading; short subtitle; phone field; Continue; concise verification helper | Existing input/validation, busy/errors and truthful mock explanation; keyboard-safe scrolling. |
| 07 OTP / verify | Compact back arrow + VERIFY YOUR NUMBER context; heading/introduction; separate PHONE NUMBER label/value; code field; Verify & continue; concise mock explanation | Show actual requested phone, one accessible six-digit field, retained input and working back; no fabricated resend timer. |
| 08 Worker picker / select-worker | Small wordmark + WORKER SELECTION context; heading/introduction; individually bordered rounded white rows with initials avatar/name/detail/chevron; tinted isolation note | Only authorized workers, including two for the seeded shared phone. Keep logout reachable as a secondary action; never add Ana just to match illustrative three-person rows. |

Bottom navigation uses small outline icons plus labels, a thin top divider and restrained selected color/weight. Remove large filled selected pills. Use existing/native capabilities or small local assets, not a UI framework. Primary bar stays on Home/Documents/My Job; Terms/Upload retain contextual back navigation. Extra operational actions belong below primary reference content or in existing profile/history surfaces, without removing required recovery.

### Screenshot acceptance protocol

Create a matrix for all eight routes with reference, baseline screenshot, new screenshot, language, worker/state, logical viewport/density, font scale, keyboard, capture commit and outstanding differences. Use ordinary 100% English reference-equivalent states first, including unconfirmed terms and empty upload; sample names/counts may differ for real data. Obtain a calibrated same-aspect comparison when available and a separate 360dp small-screen check. If exact reference geometry is unavailable, mark that comparison limited and do not claim pixel-exact matching from resized 360 × 640 screenshots.

For each screen, inspect side-by-side and optionally a uniformly aligned overlay: header bounds, content order, margins, line wrapping, row density, panels, primary action and navigation. Exclude only recorded OS/Expo chrome, never app headers. Save discrepancy decisions as fixed, accepted adaptation with reason, or unresolved. No unresolved structural mismatch may be marked complete. Do not use an aggregate image-similarity score as the acceptance decision.

Then verify both languages at 360dp and at least 130% text scaling, keyboard-visible auth, scroll reachability, contrast, focus and live announcements. Larger fonts may wrap/scroll; matching the 100% mockup must not cap accessibility scaling. Preserve task 9.3's unverified spoken TalkBack requirement. Re-run affected UI/route/selector tests and the existing automated suite; recheck offline terms, capture/restart, replay/status transitions and switching on touched routes. These checks complement rather than substitute for the visual comparison. Record actual execution only.

### Follow-up boundaries and handoff

Implement shared vocabulary first, then authentication, Home/My Job, Terms/Documents and Capture. Keep the current scoped branch/draft PR unless actual merge state requires a separately authorized follow-up. Preserve completed work and existing evidence; append fresh reconciliation records and subsequent-work time, never backdate the assessment. Update the PR with before/reference/after evidence and remaining gaps. No new backend/schema/sync/auth/file-lifecycle behavior is authorized by this plan.
