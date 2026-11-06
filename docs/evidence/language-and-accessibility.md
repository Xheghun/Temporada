# SDD-015 verification — 2026-11-06

Scope: `language-and-accessibility`, branch `feature/SDD-015-language-and-accessibility`, from merged main `9dc4c80` (document-capture PR #9). User amendment replaces the original Spanish-first M9 with English-first; Spanish and saved choices remain supported.

## Automated checks

PASS: `npm run typecheck`, `npm run lint`, `npm run arch:check`, `npm run test:ci` (36 Jest, 85 real SQLite persistence, 12 mock API, 5 architecture tests: 138 total). Seven new Jest tests cover dictionaries/interpolation, literal call-site keys, bilingual document statuses/errors, control semantics and configured text/border contrast. One new real SQLite test verifies English seed, retained Spanish preference and original queued action ID across repeat reopen/migration.

PASS: `npm run expo:check`, `npm run config:check`, `npx expo-doctor` (20/20), Android JavaScript export to `/private/tmp/temporada-language-export`, and `openspec validate language-and-accessibility --strict`. This is a JS export, not a signed Android build.

## Android inspection

Android 16/API 36 emulator `Small_Phone`, Expo Go SDK 58, 720×1280 physical pixels / density 320 = 360dp width, system font scale 1.3. Mock backend and Metro used localhost through ADB reverse. Fictional Bruno/Carla records only. Existing private database/session was retained.

Executed: opened Home in English, switched to Spanish using the first-screen button, force-stopped and reopened the app, and observed Spanish retained. Inspected Home, Terms, Documents, identity/logout, sign-in, OTP verification, shared-phone worker picker and passport capture. Scrolled to primary actions; signed in with shared phone and OTP 123456 and selected Carla. Her correction reason remained `Foto borrosa, vuelva a tomarla`, with a wrapping replacement button. Selected the synthetic gallery fixture to inspect capture preview/save layout. No new submission was queued for this layout audit.

Screenshots and UI hierarchy XML are under [language-and-accessibility/](language-and-accessibility/). Text and wrapping controls inspected at 130% scaling were readable; actions below the fold were reachable by scrolling. These are targeted observations, not a blanket accessibility certification.

## Limits

TalkBack spoken announcements/focus traversal, iOS, Android 9/2 GB performance, device reboot, fresh native install and all eight end-to-end assessment scenarios: NOT RUN in this change. Fresh English defaults are verified against actual new SQLite storage and i18n tests; the native inspection verifies an existing installation’s language persistence. Dynamic translation keys are covered through parity/status/error tests; the static call-site audit checks literal/conditional keys only. Existing v3 Spanish settings are intentionally preserved because their origin cannot be inferred. Recording B capture remains unconfirmed. Hosted CI and human review are recorded separately.
