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

SDD-035 adds native automation after the assessment cutoff. The local regression suite passes 209 tests, including real SQLite/files, real HTTP and the E2E harness. Typecheck, lint, formatting, architecture, strict OpenSpec validation, Expo compatibility/public config, all 20 Doctor checks and Android JavaScript export also passed. These checks do not replace native acceptance.

[Compatibility](https://github.com/Xheghun/Temporada/actions/runs/46003750142), [offline bundled bootstrap](https://github.com/Xheghun/Temporada/actions/runs/45976961048) and [repeated fixture isolation](https://github.com/Xheghun/Temporada/actions/runs/45980872233) passed on API 28 and API 34 with 2,048 MiB configured RAM. Guest memory was 2,046,996 KiB and 2,021,528 KiB respectively. The normal app namespace and unrelated mock data remained unchanged. The API 28 camera needs emulator 35.6.11; camera runs on 37.2.12 crashed and remain recorded in CI history.

[Fresh-build Android smoke](https://github.com/Xheghun/Temporada/actions/runs/46001675451) passed brief scenarios 1 and 2 on API 34: Spanish/English feedback and saved choice, offline terms and passport capture, force-stop/reopen, original IDs/private-file integrity and one final server effect per action.

Focused driver runs passed Spanish native capture/retake/gallery on [API 28](https://github.com/Xheghun/Temporada/actions/runs/46007560270) and [API 34](https://github.com/Xheghun/Temporada/actions/runs/46001709629), [offline force-stop/reboot durability](https://github.com/Xheghun/Temporada/actions/runs/46004044834), [dropped-response recovery](https://github.com/Xheghun/Temporada/actions/runs/46007542621) and [413 recovery with later queue progress](https://github.com/Xheghun/Temporada/actions/runs/46007544721). These runs reused recorded APK artifacts to debug helpers; they do not satisfy final current-commit acceptance.

The isolated iOS Release simulator build passed locally and in CI with Xcode 26.6 and bundled JavaScript. [The initial smoke run](https://github.com/Xheghun/Temporada/actions/runs/46003750538) failed at driver startup; its corrected run remains pending. Full Android acceptance, supplemental regressions, both-language layout checks, API 28 startup/PSS measurements and iOS smoke remain incomplete. The OpenSpec checklist and per-run artifacts track the remaining evidence.
