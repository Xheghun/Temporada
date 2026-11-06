# Document-capture verification

SDD-014, 2026-11-06; M1/M2/M3/M5/M7/M8/M9/M10 capture/file lifecycle scope. No human recording, production approval, cloud build or whole-app acceptance is claimed.

## Automated

128 tests pass: 28 Jest, 5 architecture, 12 mock API and 83 file-backed persistence/auth/sync tests. New coverage:

- Preview lease versus reconciliation; enqueue/file/ID survives actual database reopen and file-store reconstruction; acknowledgment cleanup.
- SQLite transaction failure removes an unreferenced copy; ambiguous committed result preserves the original action/bytes; database-query failure retains bytes.
- Interrupted-copy orphan recovery, missing/changed bytes becoming permanent local failures, measured exact-threshold rejection, digest/worker ownership protection.
- Concurrent enqueue/reconciliation and retained failed bytes until explicit replacement. A failed delivery remains explicitly replaceable when a refresh already obtained a staff decision for that submission; the old decision remains historical.
- Camera-permission failure followed by gallery recovery, duplicate saves and late picker result after worker switch.
- Native adapter algorithm tests with asynchronous SDK mocks: actual output size/retry, awaited journal/copy, cache cleanup, copy-failure storage guidance, gallery-original preservation and worker-scoped journal recovery.
- Capture UI permission/settings/gallery actions, measured preview and explicit save without claiming approval.

File-store integration tests use real temporary files, real SHA-256 and production SQLite repositories. Native codec/permission behavior is verified separately below; mocked compression tests do not prove native image quality. TypeScript, ESLint, Prettier, architecture checks, Expo dependency/config validation, Doctor 20/20, strict OpenSpec validation and Android JavaScript export pass. Export is not an APK/EAS build.

## Android

Small_Phone emulator, Android 16/API 36, 720×1280/360 dp, Expo Go SDK 58, explicit assessment mode; localhost mock:3000 and Metro:8081 over adb reverse. Bruno is selected through the authorized shared-phone flow. Test images are synthetic; the camera displays the emulator's virtual scene.

1. Camera request: denied the Android permission prompt. The app showed a localized explanation and offered gallery/settings recovery. [Denial](document-capture/permission-denied.png), [hierarchy](document-capture/permission-denied.xml).
2. Enabled airplane mode. Chose a 2,400×1,800 synthetic gallery PNG of **6,499,833 bytes**. Compression/preview succeeded at **523,491 bytes**. [Preview](document-capture/preview.png), [hierarchy](document-capture/preview.xml). Explicit Save queued DS-160; gallery original remained **6,499,833 bytes**.
3. Force-stopped/relaunched while still offline. Documents retained Pending Sync. Read-only inspection of actual SQLite references/private files found the original action `6514a65f-5dc5-4173-8e0c-22d87b1cb330`, 523,491 bytes, matching digest, one managed file, zero picker cache files/journals. [Proof](document-capture/files-offline-restart.json), [screen](document-capture/files-offline-restart.png).
4. Disabled airplane mode. Exactly one DS-160 server record became Pending Review. Local action became delivered and its private file was removed; zero managed files/journals/picker copies. [Cleanup](document-capture/files-acknowledged.json), [Documents](document-capture/pending-review.png), [server records](document-capture/server-records.json).
5. Granted camera permission, took/accepted a virtual-scene photo for signed contract. JPEG preview measured **21,460 bytes**. Forced backend 413 before Save. Documents showed Delivery Failed with the size remedy and an explicit replacement button. The failed action `02167775-d9bb-441a-901c-d4f6f5c9eb91` retained its image and matching digest. [Error](document-capture/rejected-413.png), [retention](document-capture/files-failed.json).
6. Disabled forced 413, chose Prepare a new submission, selected the gallery fixture and saved explicitly. New ID `bae4a70c-5f1f-4a39-a6eb-2a2877a31a01` delivered; the old ID remained superseded. Both private files were removed safely, and the backend contains one successful signed-contract record, Pending Review. [Replacement](document-capture/files-replacement.json), [screen](document-capture/files-replacement.png).

Airplane mode and backend 413 injection are restored to disabled. Gallery original remains untouched. Native missing-file/DB-fault injection, device reboot, iOS, Android 9/2 GB performance and the full accessibility audit were NOT RUN; those file/DB failure paths are automated with real storage. Full combined assessment scenarios and recordings remain later work.

## Actual development corrections

The first dependency install hit root-owned global npm cache entries; a task-local cache succeeded without changing global ownership. SDK source/type inspection showed asynchronous file writes/copies; missing awaits were corrected before native validation. Node's strip-only runner rejected parameter properties, so the pure modules use explicit fields. Type checking and route generation caught optional/null guards; lint warnings were corrected. The new known-review/missing-file regression initially failed because repository supersession only accepted the original replacement target. It now also accepts the failed action’s own worker/type-scoped server submission, preserving its historical decision. These were actual agent corrections, not a human-recorded session.

Dependency audit comparison: npm reports 31 existing findings (1 low, 30 moderate), identical to the merged baseline; the capture install introduces no new audit entries. Dependency remediation was not folded into this feature. Native permission translations are configured in Spanish/English; iOS build verification remains NOT RUN.
