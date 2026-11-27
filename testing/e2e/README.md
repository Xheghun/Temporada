# Native acceptance tests

Implementation is tracked in [the OpenSpec tasks](../../openspec/changes/automate-brief-e2e-scenarios/tasks.md). The driver compatibility probe is the first gate; it does not execute the worker scenarios.

The **E2E driver compatibility** workflow runs the pinned Maestro release against fresh API 28 and API 34 Google APIs x86_64 emulators with 2,048 MiB RAM. It verifies the downloaded archive checksum, emulator/image versions, guest OS and memory, native selection, screenshot capture, process restart and airplane mode with Wi-Fi disabled. Original connectivity settings are restored on failure. Reports and screenshots are retained as workflow artifacts for 14 days.

To repeat the probe on a dedicated matching emulator with the pinned Maestro distribution installed:

```sh
ANDROID_SERIAL=emulator-5554 PROBE_API=28 \
  ANDROID_HOME="$HOME/Android/Sdk" \
  node testing/e2e/probe-android.mjs
```

Use `PROBE_API=34` for the other target. Set `MAESTRO_BINARY` if Maestro is outside `PATH`. `toolchain.json` defines the exact versions; this initial probe targets x86_64 CI rather than the ARM64 desktop emulator. Results default to the ignored `e2e-results/probe` directory. The eight acceptance journeys are implemented but await native acceptance verification.

API 28 uses emulator 35.6.11 (build 13610412); API 34 uses 37.2.12 (build 16428233). The newer emulator crashes in camera YUV conversion on the API 28 image. Both versions are checked from SDK metadata. Before the first flow and after a reboot, the runner requires five seconds of stable ADB readiness. Maestro has a 60-second startup limit. A failed driver command still fails the journey; there are no silent flow retries. [Compatibility run 46003750142](https://github.com/Xheghun/Temporada/actions/runs/46003750142) passed both target pins, including 2,048 MiB configuration, guest RAM, native selection/restart and connectivity restoration.

API 34 uses `-memory 2048 -lowram` to prevent its minimum-memory adjustment from silently allocating 2.5 GB. The probe checks guest memory as well as the AVD file. The `-lowram` option removes the emulator's memory floor; it does not change the app's behavior.

[Compatibility run 45887783598](https://github.com/Xheghun/Temporada/actions/runs/45887783598) passed all probe steps on both targets with Maestro 2.12.1 and emulator 37.2.12. API 28 reported 2,046,996 KiB of guest memory; API 34 reported 2,021,528 KiB. The configured allocation was 2,048 MiB in each case. This proves driver compatibility, not worker acceptance or application performance.

## Bundled test app

The E2E app uses `com.cremedigital.seasonalworker.e2e`, a bundled JavaScript release and an ephemeral test signing key. The builder copies source into a temporary directory; it does not replace local native projects or load `.env` files. Java 21, Android platform/build-tools 37 and NDK 27.1.12297006 are required.

```sh
npm ci
node testing/e2e/build-android.mjs
npm ci --prefix mock-server
ANDROID_SERIAL=emulator-5554 node testing/e2e/bootstrap-android.mjs
```

The default APK targets x86_64 CI. Use `E2E_ANDROID_ABI=arm64-v8a` when building for an ARM64 emulator. `E2E_APK` overrides the output path; the APK and its build record must remain together. The runner uses only the E2E package, its own temporary mock directory and port 3101. It authenticates through the real UI, caches Home, stops the backend, force-stops the app, enables airplane mode with Wi-Fi off, then reopens cached Home and guarded file inspection. It never starts Metro. [Bundled bootstrap run 45976961048](https://github.com/Xheghun/Temporada/actions/runs/45976961048) passed this proof on API 28 and API 34.

The build requires both `BUILD_VARIANT=e2e` and `EXPO_PUBLIC_APP_ENV=e2e` (set by the builder). The EAS `e2e` profile records equivalent settings for optional use. Other EAS profiles reject E2E settings. At runtime, bundled test metadata must match the native application ID before local feature flags or inspection are available. The fixture API is restricted to HTTP on `127.0.0.1`. Ordinary builds retain HTTPS and remote feature gates.

## Scenario runner

```sh
npm run e2e:android -- --suite bootstrap --repeat 2
npm run e2e:android -- --scenario 2
npm run e2e:android -- --suite full
npm run e2e:android -- --suite media
npm run e2e:android -- --suite device
```

The default suite is `smoke` (brief scenarios 1 and 2); `full` selects all eight. All eight original journeys, bootstrap, media, device durability and supplemental regressions are registered. The new journeys remain unverified until their native reports pass. Selecting a pending journey writes `NOT RUN` and fails the suite. `--repeat` runs independent repetitions and preserves every outcome; a later pass cannot erase an earlier failure. Repetitions compare the initial backend fixture hashes. Each journey owns a fresh temporary backend and resets only the E2E package before starting, preserving its state throughout the journey.

Set `E2E_OUTPUT` to choose a fresh report directory. Existing run directories are rejected to preserve failure evidence. The bootstrap checks that normal mock files and the normal app's package registration remain unchanged. CI seeds an unrelated normal mock file and a small native fixture in the normal package namespace. It compares that fixture's private-file digest before and after each E2E run. This verifies native namespace isolation; worker persistence is exercised in the bundled E2E app.

[Runner isolation run 45980872233](https://github.com/Xheghun/Temporada/actions/runs/45980872233) passed two independent bootstrap repetitions on each API. Initial backend fixture hashes matched, and both the unrelated mock-data digest and normal-namespace private-file digest remained unchanged through every repetition.

API 34 uses `-camera-back imagefile:/absolute/path/to/camera-feed.png -camera-front none`; API 28 uses the legacy virtual-scene camera. `prepare-emulator.mjs` creates the synthetic feed and the isolation fixture before CI boots the emulator. It generates a reproducible 1920 × 2560 PNG containing only colored noise (14,752,728 bytes), then uses the native camera, retake, preview and gallery paths. Assertions inspect the saved private uploads and confirm that the gallery original remains intact. Generated images stay outside Git and are removed after the journey. API-specific native picker failures remain failed runs with screenshots; task 2.2 stays pending until both platforms and languages pass.

## Inspection and fixture controls

Native inspection copies the real diagnostic text with Maestro's [native text reader](https://docs.maestro.dev/reference/commands-available/copytextfrom), rather than Android's generic UI dump. It reads the selected worker's actions and submissions in one database transaction, measures private files, then checks that the database snapshot is unchanged. Concurrent delivery causes a bounded resample instead of a mixed report. Reports include UUIDs, delivery/review state, retry deadlines, byte counts and digests; they exclude tokens, image contents and private paths.

The mock server's existing opt-in, loopback-only development controls also expose `GET /__dev/trace` for bounded attempt metadata and `GET /__dev/replays` for replay events. `POST /__dev/replays` accepts `{workerId, clientActionId, mode, timeoutMs}`; `hold`, `disconnect` and `release` coordinate an existing receipt without changing it. Holds expire visibly within 120 seconds; the ordinary client's 15-second timeout still applies. Failure injection supports `force422` alongside `force413`. These controls are unavailable by default and in production mode. HTTP tests cover redaction, disabled controls, unchanged receipt replay and unrelated action progress; native journey verification remains pending.

The device probe compares real actions and file integrity through force-stop and a full emulator reboot, checks that no requests reach the mock while offline, then restores connectivity. `node testing/e2e/verify-failed-cleanup.mjs` deliberately fails after those offline steps and independently verifies a failing exit/result, restored settings and stopped backend. `E2E_REBOOT_VARIANT=1` adds a reboot to scenario 2. These probes restore airplane mode, Wi-Fi and font scale; cancellation aborts the active driver command so cleanup can run. Native results for these additions remain pending.

## CI suites

PRs run Android API 34 smoke (brief 1 and 2). Main and nightly runs select all eight plus regressions; the weekly lane uses API 28 with 2,048 MiB RAM. Manual inputs select the API and suite: `smoke`, `full`, `foundation`, `acceptance`, `layouts`, `scenario` or `intentional-failure`. `acceptance` shares one fresh APK across independent emulator jobs: individual journeys in reverse order, two full suites in brief order, supplemental cases, layouts and API 28 measurements. This keeps the same coverage while avoiding a single long serial job. `foundation` exercises media, repeated bootstrap, reboot and expected-failure cleanup. These workflow changes await executed CI verification.

`npm run e2e:android -- --suite regressions` selects `2-reboot`, `3-restart`, `5-422`, `6-latency`, `8-logout`, `replay-approved` and `replay-correction`. Each also accepts `--scenario <id>`. Backend restart retains the same owned data directory; replay barriers preserve the original receipt. The backoff journey records its seed, failure controls, actual deadlines and an ADB clock-correlation interval. The latency case uses a separate 2,000 ms setting.

Every native journey validates API, image, ABI, configured/guest RAM and pinned tools, then records the installed APK hash and source/build identity. Reports retain the first failure, JUnit files and screenshots. Uploaded logcat is filtered to fatal/ANR diagnostics and redacts private paths and bearer values. `intentional-failure` deliberately returns a failing workflow status; its artifacts must remain available. Native acceptance, low-end measurements and iOS smoke remain incomplete until their required runs pass.

## Low-end measurements and layouts

`npm run e2e:android -- --scenario measurements` requires API 28 with the pinned image and 2,048 MiB allocation. It samples `dumpsys meminfo` once per second after each completed sample during idle, native capture/compression, five process-cold launches and reconnect. Raw timestamps/PSS values and every `am start -W` result are retained. Home readiness includes Maestro startup and polling overhead; sampled maximum PSS is a baseline, not a profiler peak or SLA. Missing samples, wrong targets, app crashes/ANRs or lost actions fail the run. Measurement execution remains pending.

The full API 28 lane includes measurements. Acceptance and the separate `layouts` dispatch run both media languages at 360dp width and font scale 1.3. The emulator boots with `-skin 360x720` at 160dpi; the harness verifies the observed geometry before starting and restores font settings afterward. Resizing a running API 28 emulator can clamp the requested resolution and must not be counted as 360dp evidence.

## iOS smoke

```sh
node testing/e2e/build-ios.mjs
node testing/e2e/install-maestro.mjs
MAESTRO_BINARY=/path/printed/by/installer node testing/e2e/ios-smoke.mjs
```

CI selects Xcode 26.6 on macOS 26, matching the successful local build. The builder generates an isolated Release simulator app with bundled JavaScript. A simulator-only ad-hoc signature supplies the application and Keychain access-group entitlements required by SecureStore, without developer certificates or provisioning profiles. The runner creates and deletes its own simulator and temporary mock data. Its exact subset is Ana sign-in, Spanish default, English navigation, locale persistence after termination, shared-phone selection and switching. It records Xcode, runtime, device type, architecture, archive digest and source/build identity. Android airplane-mode, upload/failure journeys and spoken VoiceOver listening are outside the iOS pass count.

The workflow runs on main and manual dispatch. The local simulator build succeeded with Xcode 26.6; local smoke did not run because the pinned driver download timed out. CI smoke remains pending.

Suite JSON and Markdown reports map passing and failing journeys to their brief numbers, M1–M10 and TEST-01–06/03R. Probe results have no brief scenario number. Independent fixture hashes are compared across groups, and existing output directories are rejected to preserve earlier evidence. The latency regression correlates actual driver tap timestamps with the injected request window.

For isolated driver debugging, manual `scenario` or `foundation` dispatch can reuse an existing E2E APK via `apk_run_id`. Reports retain the original APK build identity and mark the reused run. Smoke/full acceptance requires a fresh build; APK reuse cannot satisfy the final acceptance run.

Manual compatibility checks can select `camera_backend` to compare synthetic image-file, virtual-scene and legacy emulated feeds. Reports record the selected backend. `build_diagnostics` enables Gradle dependency-resolution logs for failed builds.
