# Native acceptance tests

Implementation is tracked in [the OpenSpec tasks](../../openspec/changes/automate-brief-e2e-scenarios/tasks.md). The driver compatibility probe is the first gate; it does not execute the worker scenarios.

The **E2E driver compatibility** workflow runs the pinned Maestro release against fresh API 28 and API 34 Google APIs x86_64 emulators with 2,048 MiB RAM. It verifies the downloaded archive checksum, emulator/image versions, guest OS and memory, native selection, screenshot capture, process restart and airplane mode with Wi-Fi disabled. Original connectivity settings are restored on failure. Reports and screenshots are retained as workflow artifacts for 14 days.

To repeat the probe on a dedicated matching emulator with the pinned Maestro distribution installed:

```sh
ANDROID_SERIAL=emulator-5554 PROBE_API=28 \
  ANDROID_HOME="$HOME/Android/Sdk" \
  node testing/e2e/probe-android.mjs
```

Use `PROBE_API=34` for the other target. Set `MAESTRO_BINARY` if Maestro is outside `PATH`. `toolchain.json` defines the exact versions; this initial probe targets x86_64 CI rather than the ARM64 desktop emulator. Results default to the ignored `e2e-results/probe` directory. The eight acceptance scenarios are not yet implemented.

The emulator uses `-memory 2048 -lowram` to prevent its API 34 minimum-memory adjustment from silently allocating 2.5 GB. The probe checks guest memory as well as the AVD file. The `-lowram` option removes the emulator's memory floor; it does not change the app's behavior.

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
```

The default suite is `smoke` (brief scenarios 1 and 2); `full` selects all eight. Bootstrap and the Spanish/English media probes are registered; the original brief journeys remain pending. Selecting a pending journey writes `NOT RUN` and fails the suite. `--repeat` runs independent repetitions and preserves every outcome; a later pass cannot erase an earlier failure. Repetitions compare the initial backend fixture hashes. Each journey owns a fresh temporary backend and resets only the E2E package before starting, preserving its state throughout the journey.

Set `E2E_OUTPUT` to choose a fresh report directory. Existing run directories are rejected to preserve failure evidence. The bootstrap checks that normal mock files and the normal app's package registration remain unchanged. CI seeds an unrelated normal mock file and a small native fixture in the normal package namespace. It compares that fixture's private-file digest before and after each E2E run. This verifies native namespace isolation; worker persistence is exercised in the bundled E2E app.

[Runner isolation run 45980872233](https://github.com/Xheghun/Temporada/actions/runs/45980872233) passed two independent bootstrap repetitions on each API. Initial backend fixture hashes matched, and both the unrelated mock-data digest and normal-namespace private-file digest remained unchanged through every repetition.

The media probe requires `-camera-back emulated -camera-front emulated`. It generates a reproducible 1920 × 2560 PNG containing only colored noise (14,752,728 bytes), then uses the native camera, retake, preview and gallery paths. Assertions inspect the saved private uploads and confirm that the gallery original remains intact. Generated images stay outside Git and are removed after the journey. API-specific native picker failures remain failed runs with screenshots; task 2.2 stays pending until both platforms and languages pass.

## Inspection and fixture controls

Native inspection reads the selected worker's actions and submissions in one database transaction, measures private files, then checks that the database snapshot is unchanged. Concurrent delivery causes a bounded resample instead of a mixed report. Reports include UUIDs, delivery/review state, retry deadlines, byte counts and digests; they exclude tokens, image contents and private paths.

The mock server's existing opt-in, loopback-only development controls also expose `GET /__dev/trace` for bounded attempt metadata and `GET /__dev/replays` for replay events. `POST /__dev/replays` accepts `{workerId, clientActionId, mode, timeoutMs}`; `hold`, `disconnect` and `release` coordinate an existing receipt without changing it. Holds expire visibly within 12 seconds. Failure injection supports `force422` alongside `force413`. These controls are unavailable by default and in production mode. HTTP tests cover redaction, disabled controls, unchanged receipt replay and unrelated action progress; native journey verification remains pending.
