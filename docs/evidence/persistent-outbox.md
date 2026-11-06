# Persistent-outbox verification — 2026-11-06

Scope: SDD-006/SDD-007; M1/M2/M3/M4/M6/M8/M10 persistence only. No network delivery, authentication UI or image compression is claimed.

## Automated

Node 24.11.1, npm 11.6.2, real temporary SQLite files through the same migrations/repository/serialized transaction wrapper as the Expo driver.

`npm run typecheck`, `npm run lint`, `npm run arch:check`, `npm run test:ci`: PASS. `npm run format:check`, Expo dependency/config validation, `npx expo-doctor` (20/20), Android production JavaScript export and strict OpenSpec validation also passed. 41 tests: 9 existing mobile, 5 architecture, 12 mock API, 15 persistence. Persistence covers migration reapplication/future-version rejection, real close/reopen, stable immutable IDs/payload/file references, worker isolation, rollback before and after outbox insertion, correction history/revision protection, exact cached terms versions, catalog history, exclusive claims and enqueue ordering under clock reversal.

## Android process-death check

Environment: Small_Phone emulator, Android 16/API 36, 360 dp width; Expo Go, SDK 58; Metro on localhost through `adb reverse tcp:8081 tcp:8081`.

1. Reset the dedicated `persistence-proof.sqlite` and fictional fixture through the development-only reset route.
2. Seed Carla's v2 acceptance and passport replacement; one action marked sending. Bruno's queue empty. Actual: SEED_PASSED. [Screenshot](outbox-seed.png), [UI hierarchy](outbox-seed.xml).
3. PID before force-stop: 5355. Execute `adb shell am force-stop host.exp.exponent`; `pidof` returned no process.
4. Relaunch the verify deep link. New PID: 5692. Cold-launch routing initially returned to the launcher; reopening the same link loaded the check.
5. Actual: RECOVERY_PASSED. Same two IDs/payloads/file reference and fixture bytes; sending action recovered; original correction history retained; Bruno queue empty. [Screenshot](outbox-recovery.png), [UI hierarchy](outbox-recovery.xml).

Result: PASS for this persistence probe and TEST-02's storage reconstruction requirement. This is not whole-app offline scenario 2: worker screens, sync transport and camera capture are not implemented here. Device reboot/logout UI and iOS were NOT RUN. The fixture is a small fictional text file, not a compressed photograph.

During development the probe reset initially used an incorrect native path-to-URI conversion, leaving an earlier schema behind. Reset now opens/closes and deletes only its named proof database through SQLite APIs. The successful evidence above was captured after this fix.

## Repeated-check correction

The user reported `actions_changed_after_process_restart` after handoff. Reproduced on the emulator: the original probe compared all fields to its sending snapshot even though its first run had already recovered sending to queued. The probe now permits only that recovery transition and its updated timestamp; all other action fields remain checked. No production persistence behavior changed. A new real-SQLite test verifies repeated checks after reopen and rejection of changed IDs, payloads, files, retry counts and unexpected status changes.

The existing proof data was retained (no reset/reseed). Hot refresh and another force-stop/relaunch both returned RECOVERY_PASSED. [Repeated recovery screenshot](outbox-repeated-recovery.png), [UI hierarchy](outbox-repeated-recovery.xml).

## Maintainability review follow-up

Assignment caching now delegates to private validation, assignment/terms cache, catalog cache, submission merge and projection helpers. Repository INSERTs name columns explicitly and long SQL is multiline. Persisted payloads and localized JSON are runtime-validated on reads, including worker/action/type consistency. Two new real-SQLite tests cover malformed JSON/shapes, identity mismatches, retained invalid rows and valid round trips. All 44 automated tests passed (18 persistence); typecheck, lint and architecture checks passed. The existing native fixture still displayed RECOVERY_PASSED after the refactor; no reset/reseed was performed.
