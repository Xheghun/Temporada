# Design

## Context

The original October 29 brief defines eight Android acceptance scenarios and six minimum synchronization tests. The app already has 182 automated tests covering presentation, real SQLite/files and real HTTP, but CI currently exports JavaScript without installing the app. The existing build workflow is manually dispatched from main.

The mock already supports isolated data directories, seeded 500 responses, latency, dropped responses, v3 publication, review changes, forced 413 and session expiry. `/__dev/state` exposes business counts without tokens. Existing native inspection reads durable action IDs and image size/integrity. The default language is Spanish and saved preferences survive restart.

`src/core/auth/runtime.ts` permits local HTTP and assessment flags only in development. Ordinary preview builds need HTTPS API and remote flag URLs. The suite therefore needs its own bundled test variant before offline cold-start testing is reliable.

## Goals / Non-Goals

**Goals:** Automate every brief scenario through the native UI, retain M1–M10 and TEST-01–06/03R coverage, run repeatably on CI and collect the exact Android 9 / 2 GB configuration and measured results.

**Non-Goals:** Store delivery, production credentials, backend contract changes, redesigned screens, a new sync engine or closing the separate recording task. Performance evidence will identify the tested emulator and build type.

## Decisions

### 1. Maestro with a local test orchestrator

Use pinned Maestro flows in `.maestro/` and a small Node/TypeScript runner in `testing/e2e/`. Maestro drives screens and native camera/gallery UI. The runner owns fixtures, connectivity, mock controls, durable assertions and artifacts. Stable `testID` values identify controls across translations, with explicit text assertions proving localized feedback.

Reuse the existing mock and native inspection contracts. The runner must wait for observable UI/backend conditions with bounded deadlines. Fixed sleeps can only represent a measured observation interval. Whole-scenario retries are recorded as flaky and keep the first failure.

Detox would add native test integration. Maestro fits the current Expo screens and can run on the existing Android emulator. Its documentation disagrees about API 28 support, so the first implementation task must pin a working CLI/driver and prove install, tap, screenshot, restart and airplane-mode control on API 28 and the standard API 34 image. If API 28 fails, preserve the diagnostic result and revise the runner decision before building the remaining suite. API 29 cannot substitute for Android 9 acceptance.

### 2. A bundled E2E app with an isolated identity

Add an `e2e` build configuration with a `.e2e` application ID, bundled JavaScript and a private app-data directory. Build it locally through generated Expo native projects and Gradle using a disposable test signing configuration. CI can build/install this artifact without EAS or store credentials. Record whether debugging/inspection is enabled.

The E2E identity selects explicit local fixture API/flag providers and read-only inspection. Validate the variant using native application identity and build configuration, rather than trusting a public environment variable alone. Reject E2E settings in production configurations. Keep production HTTPS and remote-flag checks. Add tests for these configuration boundaries.

Use a known loopback port forwarded with ADB. The runner fails if an unrelated process owns that port. Test flags are available at offline cold start. Avoid Metro and Expo Go as dependencies for the acceptance lane because Wi-Fi shutdown and force-stop must exercise a self-contained app.

### 3. Fixtures and observable results

Create a temporary mock directory and fresh E2E app state before each independent scenario. Use Ana and the Bruno/Carla shared phone from the existing seed. Keep the backend and app data intact throughout each restart, expiry and worker-switch journey. Clear only the dedicated test package between scenarios.

Use fictional gallery images and the emulator’s virtual camera. Verify removal of app-created full-resolution copies after successful compression while preserving the gallery original. Scenario 2 must exercise the camera capture path. Other document scenarios can use a deterministic gallery fixture. Measure the saved compressed bytes and digest after actual native processing. A missing camera/picker step makes the affected scenario incomplete.

Extend read-only test inspection to return only worker/action/submission IDs, status, retry metadata, review revision/reason, byte count and digest checks. Never export the SecureStore record, bearer token, image bytes or private file paths. Live database inspection uses the existing serialized database access. Snapshots after force-stop must include consistent SQLite state, including WAL if required.

Reuse failure controls. Add narrowly scoped test controls only for forced 422 and an allowlisted request trace if existing controls cannot assert the necessary outcome. The trace records worker/action identity, operation, response classification and monotonic arrival time. Do not record headers or request bodies. Keep these controls disabled outside the isolated mock.

Use a replay-response barrier in the test HTTP fixture for TEST-03R so a refresh can deliver the newer staff decision before the original receipt is released. This changes response timing while exercising the normal app transport and merge logic.

### 4. Original brief scenario matrix

| Brief | Device actions and injected state | Required observations |
| --- | --- | --- |
| 1 | Fresh Ana login in Spanish, toggle English from Home, visit Home/Terms/Documents/Capture and trigger queued/retry/error states | Expected translations and accessibility labels, no untranslated app-owned feedback, saved English after restart, verbatim staff text |
| 2 | Disable Wi-Fi and mobile data with airplane mode, assert Offline, confirm v2, capture passport, force-stop and relaunch offline, reconnect | Two original action IDs, intact private file/digest below 1,500,000 bytes, no server effects offline, one acceptance and upload afterward, Pending Review |
| 3 | Drop the response after DS-160 commit, allow retry | Multiple attempts use one original UUID, one receipt and submission, Pending Review. Add a backend restart variant using the same data directory |
| 4 | Cache and open unconfirmed v2 offline, publish v3, confirm v2 offline, reconnect, explicitly confirm v3 | No v2 acceptance, stale history preserved, v3 remains unaccepted before the second tap, distinct v3 action delivers |
| 5 | Force 413 for a valid compressed image in Spanish, queue unrelated terms work, disable rejection, retake | Localized recovery, no repeated 413 attempts, unrelated delivery, new replacement ID. Repeat with forced 422 |
| 6 | Use a fixed seed with random 500s and a recorded retry sequence, repeat with 2-second latency, interact with navigation/language while retrying, restart during backoff | Persisted attempt/deadline, no early retry after restart, responsive controls, eventual delivery with original IDs and one effect |
| 7 | Choose Carla, read the seeded reason, queue replacement offline, switch to Bruno, return to Carla and reconnect | New submission identity, old decision remains historical, Bruno has only his records/count, Carla’s queue/file restored and eventually delivered |
| 8 | Queue offline, expire sessions on the mock, reconnect for a real 401, authenticate as the same worker | Original IDs/files survive, paused sends before login, successful authorized replay. Add logout while pending as a separate regression |

For scenario 6, first prove seeded 500s occurred. Require eventual success within a bounded test deadline, then restore controls. If a fixed seed cannot produce the required sequence reliably, add a mock-only response schedule for the backoff subtest and keep a seeded-random journey separately. Use the normal jitter formula and the real device clock. Compare observed attempts with the persisted retry deadline and record the clock correlation used for cross-process timestamps.

Match each journey to TEST-01–06 and M1–M10 in the result summary. Keep existing real-storage/HTTP tests required. Add TEST-03R for both Approved and Correction Requested, with a post-acknowledgment force-stop/reopen check. UI assertions alone cannot establish one server effect or byte durability. Automated accessibility checks cover exposed labels and state semantics. Spoken TalkBack/VoiceOver listening remains a manual check.

### 5. Connectivity and restart controls

Airplane mode must also disable emulator Wi-Fi. Verify native connectivity is Offline before creating actions and prove the trace has no send attempts. A reachable ADB bridge is used only for test control. Removing a reverse mapping or returning HTTP 500 exercises server reachability separately from actual offline mode.

Use force-stop for the brief’s kill/reopen scenario and preserve data during relaunch. Add a real emulator reboot in the full lane to cover durable storage across boot. Restore connectivity, locale/font scale and failure settings in cleanup, including on cancellation where the runner remains available.

### 6. CI lanes and artifact contract

Add a separate GitHub Actions E2E workflow. Existing validation and production build workflows retain their roles. Use pinned tool/action versions, read-only job permissions, Node 24, the project’s required Java/Android toolchain and runner-owned local mock processes. E2E jobs use no production secrets.

| Lane | Trigger | Coverage |
| --- | --- | --- |
| Android smoke, API 34 | PRs affecting app/mock/tests/build inputs and manual dispatch | Scenarios 1 and 2, primary navigation, language persistence |
| Android full, API 34 | Main, nightly schedule and manual dispatch | All eight scenarios, 422, replay/newer review, logout, reboot and backoff restart |
| Android 9, API 28, 2,048 MiB | Weekly schedule and manual dispatch | All eight scenarios and measurements below |
| iOS smoke | Main and manual dispatch | Sign-in, Spanish/English persistence, shared-phone selection and primary navigation |

Keep PR smoke blocking once the first real CI run is stable. Full and low-end results are published independently. A scheduled failure stays visible and must not be described as an overall acceptance pass. The plan covers all eight scenarios on Android. iOS smoke results must list their exact subset, since Android airplane-mode commands have no effect on an iOS simulator.

Write an individual PASS/FAIL/NOT RUN result for every required scenario with source SHA, APK hash, build variant, Maestro/SDK versions, emulator identity and injected failure settings. Upload JUnit, a short Markdown/JSON summary, failure screenshots, filtered logcat, sanitized mock observations and measurement files through `if: always()`. Retain artifacts for 14 days and link them from the workflow summary. Authentication inputs are fictional, and tokens/secure storage are excluded from artifact collection.

### 7. Android 9 / 2 GB measurements

Configure API 28 with 2,048 MiB RAM and record the system image/ABI, AVD RAM setting, guest `getprop`, `/proc/meminfo`, display density/font scale, CPU settings, host runner and app build identity. Verify these before accepting the low-end lane.

Collect five process-cold launches with a cached authenticated worker, reporting each `am start -W` result and elapsed time to a stable Home-ready element. Label process-cold versus fresh-install setup separately. Sample the app process PSS at a documented interval during idle Home, large-image preparation/save and restart/reconnect. Report raw samples and sampled maximum, alongside crashes, ANRs, process kills, compressed size and action/file retention.

A functional pass requires all eight scenarios, no unexpected crash/ANR and preserved pending work. Publish timings and memory as a baseline without inventing a performance SLA. New thresholds need an agreed budget. Identify the E2E build’s debugging/inspection overhead, and keep signed production-build profiling as a separate result if later collected.

## Risks / Trade-offs

- API 28 automation support → prove the pinned driver on the real target first and keep failure explicit.
- CI emulator timing varies → record raw runs, measurement method and build/runner identity, with functional deadlines separate from performance budgets.
- Native picker/camera UI differs → use API-specific helpers and virtual camera fixtures, with bounded waits and screenshots on failure.
- Test bootstrap changes could escape the test build → require the distinct native identity and reject production/test combinations with regression coverage.
- Data resets could erase unrelated work → target only the E2E package and runner-owned temporary mock directory.

## Migration Plan

Implement on a new ticketed branch after this plan is reviewed. First prove the bundled build, cold offline boot and API 28 driver. Then add shared fixtures/selectors, scenarios 1–2, scenarios 3–8 and supplemental regressions. Wire CI smoke after a local run, followed by full, low-end and iOS lanes. Run each isolated scenario and the complete suite twice from fresh state to expose fixture ordering dependencies.

Record actual runs before checking tasks complete. If tests expose a product defect, record the violated existing requirement and keep its regression assertion. A change to domain behaviour, the backend contract or production security requires revising that scope before implementation. Rollback removes the E2E workflow/build adapters/selectors while retaining the existing application and test suites.

## References

- [Original scenario definitions](../../../specs/testing.md)
- [Expo Maestro workflow setup](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)
- [Maestro React Native selectors](https://docs.maestro.dev/get-started/supported-platform/react-native)
- [Maestro Android airplane mode](https://docs.maestro.dev/reference/commands-available/setairplanemode)
- [Maestro device command, including API 28](https://docs.maestro.dev/maestro-cli/maestro-cli-commands-and-options)
- [Maestro quickstart platform list](https://docs.maestro.dev/get-started/quickstart)
