# Tasks

## 1. Subsequent change preparation

- [x] 1.1 Verify human-reviewed merged main is the implementation base and create `feature/SDD-022-temporada-mobile-ui-redesign`; record base/branch evidence without applying submission-documentation or other changes.
- [x] 1.2 Add SDD-022 to `specs/tasks.md` and a clearly separate subsequent-work section in `docs/coding-ledger.md`, preserving the 299.91-minute assessment endpoint; verify the diff does not rewrite original time or evidence and explicitly flags extra assessed-submission work.
- [x] 1.3 Prepare the genuine Recording B capture checklist before coding, record human capture availability and any gap without fabricating footage; verify the preparation artifact exists.

## 2. Shared visual foundation

- [x] 2.1 Refactor `src/design-system/tokens/index.ts` and `components/auth-controls.tsx` for the specified warm palette, #171717 headings, native typography, spacing and card-free containers; verify representative heading/button/form rendering and measured contrast pairs, including secondary text.
- [x] 2.2 Add the smallest shared header/row/status/avatar/empty/loading/error responsibilities needed across screens, with safe areas, keyboard access and 48/56dp targets; add interaction/accessibility regressions in `src/testing/` and verify them with targeted Jest runs.
- [x] 2.3 Document visual tokens, component usage and presentation-only boundaries in `docs/ui-redesign.md`; verify documented components match exports and run typecheck, lint and architecture checks for this group.

## 3. Sign-in, OTP and worker selection

- [x] 3.1 Redesign `app/(auth)/sign-in.tsx` with wordmark, persisted language selection, localized heading/helpers and existing phone validation/loading/errors; test invalid input, busy duplicate prevention, retained input after failure and language persistence using `auth-screens.test.tsx` and language tests.
- [x] 3.2 Expose only the in-memory requested phone in the token-free auth snapshot while code_sent and redesign `verify.tsx` with six-digit input, phone explanation and working back; test clearing on phase exit, invalid-code recovery, loading and no persistence/logging or invented SMS/resend behavior.
- [x] 3.3 Redesign `select-worker.tsx` with initials/name/chevron rows, selection feedback, isolation explanation and loading/empty/error states; verify switching clears old views and late results cannot restore them with auth/presentation tests.
- [x] 3.4 Update `docs/authentication.md` and `docs/ui-redesign.md` with implemented behavior and actual group check results; verify all app-owned copy/accessibility keys exist in both dictionaries and no server free text is translated.

## 4. Home and primary navigation

- [x] 4.1 Add typed public presentation facts and Home composition using assignment/document public exports; test priority/ties, pending background work, failed replacement, unavailable features, missing/mismatched cache and refresh-required state without altering existing selectors’ confirmation/replacement rules.
- [x] 4.2 Redesign Home in `worker-content.tsx` and `app/(worker)/home.tsx` with actual-name local-time greeting, compact connectivity, one next-action panel, catalog document rows and job summary; test clock boundaries, state-derived actions and no invented completion or fixture details.
- [x] 4.3 Add shared primary navigation to Home/Documents and the forthcoming job route while preserving the generation-keyed Stack and existing paths; test selected state, replace versus push, deep-link guards, secondary back fallback and disabled-feature behavior.
- [x] 4.4 Update `docs/home-and-terms.md` and `docs/ui-redesign.md` for removed timeline, priority rules and navigation; run targeted Home/navigation tests, typecheck and arch:check and record actual results.

## 5. My Job

- [x] 5.1 Add `app/(worker)/job.tsx` and assignment-owned job presentation/public export for cached employer/worksite/reference/dates/terms link; test localized date-only formatting, missing and stale cache, offline rendering, real values and relevant feature gates.
- [x] 5.2 Verify Home/Documents/My Job transitions and primary safe-area content reachability; update job/navigation documentation and record targeted test results without claiming native evidence prematurely.

## 6. Terms

- [x] 6.1 Redesign terms presentation for readable localized summary, exact version/status, confirmation explanation and secondary accessible history; keep current callbacks and service behavior, and test offline save, duplicate suppression, stale refresh, explicit new confirmation and failed-action replacement/rollback in `home-terms.test.tsx`.
- [x] 6.2 Verify successful server acceptance is shown only with real evidence and no old saved notice attaches to a new version; update `docs/home-and-terms.md` with summary limitations and actual check results.

## 7. Documents

- [x] 7.1 Refactor `documents-content.tsx` into catalog rows with distinct delivery/review/refresh/failure labels and explicitly defined required sent count; test queued/sending/retry exclusion, delivered correction counting, failed replacement exclusion and newer staff decision preservation in `documents.test.tsx`.
- [x] 7.2 Add per-document collapsed history and clear supported replacement controls with actual correction reason; test accessible expand/collapse, immutable submission identity, historical late decisions and resetting local expansion on worker switch.
- [x] 7.3 Update `docs/documents.md` and bilingual dictionaries for count/status/history semantics; verify targeted tests, public feature boundaries and every enabled capture control’s navigation.

## 8. Guided capture

- [x] 8.1 Redesign `capture-content.tsx` for guidance, empty/real-preview area, state-specific primary action, secondary retake/gallery, preparation/save feedback and settings recovery; remove ordinary byte counts and test cancellation, permission denial, duplicate save, failure and durable saved feedback in `capture-screen.test.tsx`.
- [x] 8.2 Re-run existing capture service/storage tests to verify compression threshold, private copy/digest, transactional enqueue, orphan recovery and worker guards remain unchanged; update `docs/capture.md` with actual presentation and verification evidence.

## 9. Integrated verification and scoped handoff

- [x] 9.1 Audit all screens in English and Spanish, persisted default/choice behavior, server-text preservation and real navigation controls; run `npm run typecheck`, `lint`, `format:check`, `arch:check`, `test:ci`, `expo:check` and `config:check`, plus existing CI Expo Doctor and Android export, and record each PASS/FAIL/NOT RUN accurately.
- [x] 9.2 Execute all six mandatory synchronization cases against actual persistence and Android: offline enqueue, process restart/files, lost-response replay, 500/413/422 classification, stale-v2/explicit-v3 and shared-phone isolation; include reconnection, logout/reauth and real correction replacement, recording new evidence rather than substituting mocks or historical screenshots.
- [ ] 9.3 Inspect actual updated screens on an available Android emulator at approximately 360dp and at least 130% font scale in both languages, including auth keyboard, safe areas, navigation, TalkBack focus/status feedback and cached/no-cache states; fix observed issues and save actual screenshots with device/settings metadata, or leave unavailable checks NOT RUN.
- [x] 9.4 Review the complete diff for presentation scope, no private cross-feature imports, no credentials/worker data, no sync/file/ID/retry regressions and no unsupported production enablement; record actual review and separate subsequent-work ledger totals without changing assessed history.
- [x] 9.5 Prepare ticketed reviewable commits and one focused PR with visual summary, modified/added files, navigation changes, actual test/screenshot links and explicit gaps; verify branch/commit conventions and PR contents, then stop at human review handoff without auto-merge or production release.

## Workflow follow-up

- Human review and merge gate any later explicitly requested change.
- Archive only after a separate explicit archive request and completion review; keep incomplete verification visible.

Verification note: task 9.3 has executed 360dp English/Spanish 100–130% layouts, keyboard/navigation/safe-area checks, actual screenshots and TalkBack focus traversal. Audible status announcements remain NOT RUN and await human verification; the task remains unchecked. See `docs/evidence/ui-redesign/README.md`. The native classification proof’s initial setup failure was corrected and rerun successfully without production sync changes.

Scoped handoff: https://github.com/Xheghun/Temporada/pull/15 (draft). Local checks and Android evidence are recorded; task 9.3 remains open pending the user’s offered audible TalkBack check. Hosted CI is separate from local verification. No merge or release performed.
