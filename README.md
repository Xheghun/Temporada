# Temporada — seasonal worker mobile app

Expo SDK 58, React Native 0.88.1/New Architecture and strict TypeScript. Workers sign in by phone, choose their identity on shared phones, confirm an exact terms version and submit compressed document images. SQLite records intent before transmission; the network delivers that durable intent later. Staff review remains separate from delivery.

English is the first-launch default, with an in-app Spanish toggle and a persisted choice. This is the user's explicit amendment to the original Spanish-first requirement.

## Run locally

Prerequisites: Node 24.11.1 (`nvm use`), npm, Android Studio/SDK with a running AVD, and an Expo Go build compatible with SDK 58. Xcode/Simulator is needed for iOS. Native dependencies have been checked against the installed Expo SDK. Development/EAS binaries are configured but have not been built.

Install from the repository root:

```sh
npm ci
npm ci --prefix mock-server
```

Start the fictional backend in one terminal:

```sh
MOCK_ENABLE_CONTROLS=1 npm run mock:start
```

It binds to localhost:3000 and persists under `mock-server/.data`. Restarting does not reset terms, submissions or sessions. See [mock-server instructions](mock-server/README.md) for isolated fixtures, seed data and failure controls. Never delete a mobile database or pending images to reset a demo.

For Android, start an emulator in Android Studio Device Manager, then use another terminal:

```sh
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000 EXPO_PUBLIC_ASSESSMENT_MODE=1 npx expo start --go --localhost --clear
```

Open the app from Expo's Android launcher. The direct Android-emulator host alternative is `http://10.0.2.2:3000`; localhost with ADB reverse was used for worker-flow verification. Reapply reverse mappings after an emulator/ADB restart.

For iOS, use the same running backend:

```sh
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000 EXPO_PUBLIC_ASSESSMENT_MODE=1 npx expo start --go --ios --localhost --port 8082
```

The iOS follow-up used this launch pattern with an isolated backend on port 3009. Do not point an existing cache at an unrelated reset backend; use a separate disposable fixture without removing unresolved actions. Expo Go may need its matching SDK build; `--go` avoids selecting an uninstalled development client.

These commands are based on executed setup/launch evidence; a fresh-machine installation was not repeated during final documentation. If the shared npm cache is inaccessible, the previously used workaround is `npm ci --cache /private/tmp/seasonal-npm-cache`. Public configuration examples are in [.env.example](.env.example); `EXPO_PUBLIC_*` values are bundled and must never contain secrets.

## Fictional accounts

Use OTP **123456**. No real SMS is sent.

| Phone            | Worker / fresh seed                                                          |
| ---------------- | ---------------------------------------------------------------------------- |
| +52 55 1000 0001 | Ana López: v2 unconfirmed, no documents                                      |
| +52 55 1000 0002 | Bruno Díaz: v2 confirmed, passport Approved                                  |
| +52 55 1000 0002 | Carla Díaz: passport Correction Requested — `Foto borrosa, vuelva a tomarla` |

Assignment: JO-2026-0142, Valle Verde Farms, Yuma, Arizona, March 1–July 31, 2026. Required documents: passport, DS-160 confirmation and signed contract. Existing persistent fixtures may have advanced to v3 or contain later submissions.

## Offline behavior and architecture

```mermaid
flowchart LR
  Screens[Router screens] --> Services[Worker-scoped services]
  Services --> Local[SQLite cache and outbox]
  Services --> Files[Private compressed images]
  Engine[Injected sync engine] <--> Local
  Engine <--> API[Authorized API transport]
  API <--> Server[Mock business records and receipts]
```

Screens use hooks/services; domain/sync logic has no React/native/database imports. Repositories implement persistence contracts. Logout preserves pending intent and images; worker changes clear views and reject late results. Fresh authentication requires network; an existing saved session/cache can resume offline.

Pending Sync means local intent without an acknowledged delivery. Pending Review means server submission awaiting staff. Approved/Correction Requested require server review evidence. Refresh-known staff decisions survive older replay receipts. Stale terms require an explicit new confirmation. Transient errors use persisted backoff; 413/422 require a new corrected action, not blind retry. Background delivery is best effort; foreground/startup rebuild retry scheduling.

See [DECISIONS](DECISIONS.md), [data model](specs/data-model.md), [sync contract](docs/synchronization.md), [capture lifecycle](docs/capture.md) and [API contract](specs/api-contract.md).

## Failure controls and checks

With development controls enabled, the backend supports two-second latency, seeded random 500s, post-commit response loss, v3 publication, forced 413 and session expiry. Exact `curl` commands and submission-specific staff decisions are in [mock-server/README.md](mock-server/README.md#development-controls). Controls are loopback-only and disabled in production. The mock refuses production startup.

Previously executed quality commands:

```sh
npm run typecheck
npm run lint
npm run format:check
npm run arch:check
npm run test:ci
npm run expo:check
npm run config:check
npx expo-doctor
npx expo export --platform android
npx expo export --platform ios --output-dir /private/tmp/temporada-ios-export
```

Last application verification: **138 tests passed** (36 Jest, 85 real SQLite/sync/file tests, 12 mock HTTP/storage tests, 5 architecture tests), including TEST-01–06 and replay-versus-review regressions. The saved Android observations also have 21 evidence assertions; those do not rerun the emulator. Literal dependency checks cannot validate computed imports and do not replace human review.

## Verification and remaining work

| Area                   | Recorded outcome                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Android                | All eight manual scenarios passed on Android 16/API 36, 360dp, Expo Go; process/device restart and file digest/counts inspected                 |
| Language/accessibility | English/Spanish rendering and key/contrast checks; Android 130% text inspection passed; spoken screen-reader audit not completed                |
| iOS                    | Sign-in, language switching, backend-outage restart/file recovery, terms, dropped response, 413 replacement and 500 recovery passed on iOS 26.5 |
| Remaining iOS          | Worker-switch isolation, expired-session recovery, real airplane mode, physical-camera capture, 422/review races and device reboot incomplete   |
| Release readiness      | Signed/EAS builds, store submissions, real backend integration and Android 9/2GB performance unverified                                         |
| Submission evidence    | Recordings A/B absent; original-assessment comparison pending                                                                                   |

[Integration results](docs/evidence/offline-integration.md) contain the dated steps, screenshots, storage records and limits. iOS evidence does not inherit Android's passes. A Simulator camera attempt produced no image and was cancelled; gallery recovery worked.

The [coding ledger](docs/coding-ledger.md) stops at **299.91 minutes**. Final documentation does not reset that limit or add application tests. [PROCESS](PROCESS.md), [release plan](docs/release-plan.md), [architecture answers](docs/architecture-answers.md) and [recording status](docs/recordings.md) complete the written handoff.

Production requires HTTPS API/remote-flags URLs and separately approved `worker_authentication`, `worker_home_and_terms`, `worker_document_corrections` and `worker_document_capture` flags. Missing/invalid configuration fails closed; flags load at runtime creation, not continuously. Assessment mode requires `__DEV__` and is not a production bypass. No remote service is hosted by this repository.

GitHub Actions validates PRs/main; EAS development/preview/production profiles and a manual main-only build workflow exist. Credentials, protected environments, backend contract approval and rollout require authorized humans. OTA is not configured or published; native dependency changes require a compatible binary. No store or production approval is claimed.
