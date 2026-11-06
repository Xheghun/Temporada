# Home and terms verification

2026-11-06, SDD-012; M1/M2/M4/M6/M9/M10 and Home UI requirements. No human recording, approval, iOS build or complete application acceptance is claimed.

## Automated

98 tests pass: 17 Jest tests, 5 architecture checks, 12 mock API tests and 64 file-backed persistence/auth/sync tests. The new six service/storage tests cover offline cached assignment, durable confirmation/reopen and duplicate suppression; stale v2 followed by explicit v3 enqueue without supersession; background refresh preserving the displayed version; immediate worker clearing/late read rejection; local transaction failure and disabled-feature enqueue protection; v2→v3 language migration/reopen preserving queued intent. Four new screen tests cover displayed-version callbacks, cached Home/offline/unavailable documents, English empty-state recovery, and stale-history reconfirmation without a misleading saved notice. Existing engine tests cover stale v2 through successful v3 delivery and lost-response idempotency.

TypeScript, ESLint, Prettier, architecture boundaries, Expo dependency/config checks, Expo Doctor 20/20 and Android production JavaScript export passed. This export is not an APK/EAS build. Strict OpenSpec validation passed. No dependencies added.

## Android

Small_Phone emulator, Android 16/API 36, 720×1280/360 dp, Expo Go SDK 58, development assessment mode. Existing mock localhost:3000 via adb reverse; Metro localhost:8081. Only fictional assessment data used.

- Ana signed in using phone 1 / 123456; Home displayed employer, order, worksite and season in Spanish. [Home](home-and-terms/home-es.png).
- First attempted airplane-mode confirmation of v2 raced the connectivity event and reached the server. It is **not** counted as an offline test. Server acceptance of v2 is expected for that attempt.
- Published v3 using the existing development control, manually refreshed Home, opened unconfirmed v3. Enabled airplane mode and verified Home's explicit “Sin conexión” label before confirmation. [Offline Home hierarchy](home-and-terms/home-offline.xml).
- Confirmed v3 offline: immediate Pending Sync/local-saved feedback. [Screenshot](home-and-terms/terms-offline.png), [hierarchy](home-and-terms/terms-offline.xml).
- Force-stopped Expo Go and relaunched while airplane mode remained enabled: v3 still Pending Sync, no in-memory saved notice needed. [Restart](home-and-terms/terms-restart.png), [hierarchy](home-and-terms/terms-restart.xml).
- Disabled airplane mode: v3 became “Confirmadas en el servidor”. [Acknowledgment](home-and-terms/terms-acknowledged.png), [hierarchy](home-and-terms/terms-acknowledged.xml). Inspected mock state: exactly one Ana v3 acceptance, action `a3aafd23-6dd1-4967-b04f-2273fd0329c3`; one v2 acceptance from the earlier online race.
- Scrolled Home to its language control and switched to English. [English controls](home-and-terms/home-en.png), [hierarchy](home-and-terms/home-en.xml). Force-stopped/relaunched again: Home remained in English. [Restart](home-and-terms/home-en-restart.png), [hierarchy](home-and-terms/home-en-restart.xml). Preference is also covered by SQLite reopen tests.

This change does not claim a native stale-v2→v3 UI pass: stale/reconfirmation rendering is automated here, with existing core engine integration coverage. Full critical native journeys, documents, device reboot, iOS and all-screen large-text/accessibility checks remain for their owning changes. Airplane mode restored to disabled. Recording B remains unconfirmed.

Direct native SQLite extraction via `run-as` was unavailable because Expo Go is not debuggable. Native persistence evidence is the force-stop/offline UI recovery; direct SQL assertions use file-backed production repositories in automated tests. `npx openspec` was unavailable; the installed global `openspec` CLI passed strict validation.
