# Native acceptance tests

Implementation is tracked in [the OpenSpec tasks](../../openspec/changes/automate-brief-e2e-scenarios/tasks.md). The driver compatibility probe is the first gate; it does not execute the worker scenarios.

The **E2E driver compatibility** workflow runs the pinned Maestro release against fresh API 28 and API 34 Google APIs x86_64 emulators with 2,048 MiB RAM. It verifies the downloaded archive checksum, emulator/image versions, guest OS and memory, native selection, screenshot capture, process restart and airplane mode with Wi-Fi disabled. Original connectivity settings are restored on failure. Reports and screenshots are retained as workflow artifacts for 14 days.

To repeat the probe on a dedicated matching emulator with the pinned Maestro distribution installed:

```sh
ANDROID_SERIAL=emulator-5554 PROBE_API=28 \
  ANDROID_HOME="$HOME/Android/Sdk" \
  node testing/e2e/probe-android.mjs
```

Use `PROBE_API=34` for the other target. Set `MAESTRO_BINARY` if Maestro is outside `PATH`. `toolchain.json` defines the exact versions; this initial probe targets x86_64 CI rather than the ARM64 desktop emulator. Results default to the ignored `e2e-results/probe` directory. A failed probe leaves task 1.1 incomplete. The bundled worker test app and eight acceptance scenarios are not yet implemented.

The emulator uses `-memory 2048 -lowram` to prevent its API 34 minimum-memory adjustment from silently allocating 2.5 GB. The probe checks guest memory as well as the AVD file. The `-lowram` option removes the emulator's memory floor; it does not change the app's behavior.
