# Coding time and verification

The original assessment allowed five hours of coding. Recorded implementation, setup and verification totalled **299.91 minutes**. Review waits were excluded; documentation and recording preparation were tracked separately.

- Start: November 6, 2026, 16:02:53 UTC (17:02:53 WAT).
- End: November 7, 2026, 00:21:41 UTC (01:21:41 WAT).
- [Assessment cutoff: `6db6a09`](https://github.com/Xheghun/Temporada/tree/6db6a0960a913c957a208a656dd9b57e0829ab23).

These are the first and last session times, not a continuous five-hour session. The table groups the recorded active time by feature, including its fixes and publication checks.

| Work                                  | Recorded minutes | Cumulative minutes |
| ------------------------------------- | ---------------: | -----------------: |
| Scaffold and CI                       |            14.68 |              14.68 |
| Mock API                              |            11.00 |              25.68 |
| Persistent outbox                     |            26.05 |              51.73 |
| Offline synchronization               |            31.46 |              83.19 |
| Authentication                        |            24.86 |             108.05 |
| Home and terms                        |            23.24 |             131.29 |
| Naming and maintainability review     |            11.26 |             142.55 |
| Document corrections                  |            23.30 |             165.85 |
| Document capture and journal recovery |            54.86 |             220.71 |
| Language and accessibility            |            19.82 |             240.53 |
| Android offline integration           |            33.29 |             273.82 |
| iOS follow-up verification            |            26.09 |             299.91 |

The original integration ran 138 automated tests and all eight Android scenarios. The iOS run covered a smaller scope and was interrupted before its remaining shared-phone checks. The [full session log](https://github.com/Xheghun/Temporada/blob/ecdf390e0c929a8f3484a855a85bc8ce71a426fe/docs/coding-ledger.md) retains the exact timestamps, intermediate test counts, failures and follow-up work.

## Work after the assessment

The UI redesign, visual refinements, restored Home information, later fixes and language-default change happened after the cutoff. Documentation and recording work also continued separately. This work is included in current main, not in the five-hour claim. Individual pull requests retain their checks; the full log above records the timed redesign and Home verification sessions.

The latest application change passed 182 automated tests, quality checks and the Android JavaScript export in CI. I also completed manual end-to-end UI checks on iOS and Android, including TalkBack and a lower-end Android emulator. [Question 3](architecture-answers.md#3-store-review-and-low-end-devices) records the coverage and missing target-device measurements.

The low-end testing documentation review reconciles the recorded manual checks with the outstanding Android 9 / 2 GB measurement record. Verification covers formatting, links and strict OpenSpec checks. The Expo compatibility fix also passed all 182 tests, typecheck, lint, architecture, public config and all 20 Expo Doctor checks. No new device run or performance measurements were collected.

SDD-035 CI maintenance updated seven Expo SDK 58 dependencies to the versions required by the compatibility check. All 182 tests, typecheck, lint, formatting, architecture, Expo compatibility/public config, all 20 Doctor checks, Android JavaScript export and strict OpenSpec validation passed locally. Native E2E implementation and device runs remain pending.

SDD-035 native automation starts with a pinned Maestro/Android compatibility probe on dedicated CI emulators. Local lint, syntax, formatting, typecheck, architecture and strict OpenSpec checks passed. [The driver probe](https://github.com/Xheghun/Temporada/actions/runs/45887783598) passed on API 28 and API 34 with 2,048 MiB configured RAM, including native selection, screenshots, restart, airplane/Wi-Fi control and cleanup. Earlier probe failures remain in CI history. All eight worker scenarios remain pending.

The isolated E2E build configuration and native-identity/HTTPS guards passed 195 automated tests, quality checks, Expo compatibility/public config and all 20 Doctor checks locally. [Bundled bootstrap run 45976961048](https://github.com/Xheghun/Temporada/actions/runs/45976961048) built the release APK and passed sign-in, cached Home after offline force-stop, guarded native inspection and cleanup on API 28 and API 34. Metro was never started and the backend was stopped before offline reopening. These bootstrap results do not count as the eight worker scenarios.

The scenario runner adds four checks for complete selection, rejected options, explicit missing coverage and retention of earlier failures. The native isolation fixture compiled and signed locally. Camera/gallery probes and selector changes passed typecheck, lint, formatting, architecture and strict OpenSpec validation; their native media results remain pending.

[Runner isolation run 45980872233](https://github.com/Xheghun/Temporada/actions/runs/45980872233) passed two independent native bootstrap runs on API 28 and API 34. Their initial backend fixture hashes matched, while unrelated mock data and a native private-file sentinel in the normal package namespace remained unchanged. The local regression suite now passes 199 tests.

Read-only inspection and mock replay/422 controls passed all 208 automated tests, typecheck, lint, formatting, architecture and strict OpenSpec validation. Tests cover SQLite reopen, consistent inspection, artifact redaction, disabled controls and unchanged replay receipts. Native media run 45983017167 failed at the Android 9 Camera location prompt and Android 14 inspection-text extraction; both failures remain recorded while their helper fixes await another native run. No original brief journey is counted as complete.

The original eight E2E journeys and supplemental replay/restart/logout/422/latency cases are implemented with native assertions but remain unverified. Local typecheck, lint, formatting, architecture and the 208-test regression suite pass. Run 45989065908 retained bootstrap failures: an offline ADB transport on API 34 and a driver timeout on API 28. The runner now checks transport readiness and records command exit/termination details; later native results must verify those changes. No additional OpenSpec acceptance tasks are checked.

The local isolated iOS Release simulator build succeeded with Xcode 26.6, bundled JavaScript and signing disabled. Local iOS smoke was NOT RUN after the pinned Maestro download timed out. Native run 45990165729 preserved camera onboarding and inspection-extraction failures; the next helper change handles the observed Android 9 location-onboarding controls and exposes the allowlisted inspection text through an explicit accessibility label. Android measurements, layouts and iOS smoke remain unverified.

The suite mapping guard raises the local regression total to 209 passing tests. Typecheck, lint, formatting, architecture and strict OpenSpec checks also passed. Driver tap timing extraction was checked against saved native artifacts. iOS CI selected Xcode 16.4 and failed because ExpoModulesJSI requires Swift 6.2; the lane now selects installed Xcode 26.3. Android run 45997266871 confirmed an emulator camera fatal error on API 28 (`Unknown format: 0x18`). The next run uses a synthetic image-file camera feed and Maestro’s own text-copy adapter for native inspection. Both changes await native verification.

[Focused driver run 46001709629](https://github.com/Xheghun/Temporada/actions/runs/46001709629) passed Spanish camera, retake, gallery and read-only inspection on API 34. Private files measured 529,925 and 1,015,982 bytes, matched their digests and left no picker-cache copies or journals. This debug run reused the recorded APK from run 45997155959 and is not current-commit acceptance. API 28 still crashed in the emulator before capture completed. Its replacement pin, 35.6.11/build 13610412, was verified against Google’s archive metadata; task 1.1 is reopened until compatibility passes. The Xcode 26.3 CI build hit an ExpoModulesJSI compiler error, so iOS now uses the locally successful Xcode 26.6 toolchain on macOS 26. Expo compatibility/public config, all 20 Doctor checks and the Android JavaScript export also passed locally.
