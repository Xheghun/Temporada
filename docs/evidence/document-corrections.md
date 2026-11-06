# Document-corrections verification

SDD-013, 2026-11-06. Scope: M4/M5/M8/M9/M10 catalog, state/history projection and submission orchestration. Camera/compression/file adapter remain a separate change. No recording or human approval is claimed.

## Automated

113 tests pass: 22 Jest, 5 architecture, 12 mock API and 74 file-backed persistence/auth/sync tests. Seven new file-backed tests and three new screen tests cover:

- Carla's exact correction reason, new action/immutable prior submission, duplicate suppression, durable reopen and Pending Sync → Pending Review acknowledgment.
- Higher-revision old-passport decisions remaining historical while a replacement is queued and after it is acknowledged.
- Same-submission Approved/Correction Requested retained before and after an older replay receipt; existing real-HTTP TEST-03R cases also remain green.
- Explicit failed-upload replacement atomically supersedes the failed predecessor and delivers the new ID.
- Immediate worker clearing, delayed-read rejection, Bruno isolation and Carla's retained queue on return.
- Failed local transaction, disabled-feature protection and stale expected-submission rejection without false saved state.
- Spanish catalog/correction UI, distinct queued state/history, unavailable camera controls and English labels without translating server free text.

Quality: TypeScript, ESLint, Prettier, architecture boundaries, Expo dependency/public configuration checks, Doctor 20/20, strict OpenSpec validation and Android production JavaScript export passed. No schema/API/native dependency changes. Export is not an APK/EAS build.

## Android

Small_Phone, Android 16/API 36, 720×1280/360 dp, Expo Go SDK 58; explicit development assessment mode, Metro localhost:8081 and mock localhost:3000 through adb reverse. Connection rechecked after a user reconnect message: device attached, port mappings present, backend healthy, airplane mode initially disabled.

- Ana's Documents route rendered the cached catalog and Not Submitted state. New route header was localized before final checks.
- Shared phone 2 / OTP 123456: selected Carla, opened Documents using the Home navigation button. Passport showed Correction Requested and `Reason: Foto borrosa, vuelva a tomarla`; photo controls visibly unavailable. [Carla](document-corrections/carla-en.png), [hierarchy](document-corrections/carla-en.xml).
- Selected Bruno and navigated from Home to Documents. His passport showed Approved with no Carla correction reason; signed contract remained Not Submitted. [Bruno](document-corrections/bruno-en.png), [hierarchy](document-corrections/bruno-en.xml).

- Enabled airplane mode, force-stopped Expo Go and relaunched Documents. The cached catalog loaded with an Offline label; scrolling still showed Bruno’s Approved passport. [Restart](document-corrections/offline-restart.png), [hierarchy](document-corrections/offline-restart.xml), [cached passport](document-corrections/bruno-offline.xml). Airplane mode restored to disabled.

Actual capture/resubmission, staff/replay UI races, all eight complete worker scenarios, iOS and full accessibility audit were NOT RUN on Android in this scope. Those service/projection transitions are automated with real SQLite and durable fixture images; their fixtures do not prove native file-adapter behavior. The original photo is not available to this scope, and no fake production upload control is provided. Recording B remains unconfirmed.
