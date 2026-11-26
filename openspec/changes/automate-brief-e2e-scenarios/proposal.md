# Automated brief scenarios

## Why

The original brief’s eight Android scenarios currently depend on manual runs. Automated device journeys would catch UI, native storage and synchronization regressions and produce repeatable results for the Android 9 / 2 GB target.

## What Changes

- Add Maestro journeys for all eight brief scenarios, with assertions against the visible UI, real device persistence and the isolated mock backend.
- Add a bundled E2E app variant, stable UI selectors, fictional image fixtures and a local runner that controls the emulator and mock failures.
- Run a short Android suite on PRs, the full eight-scenario suite on main and scheduled runs, and an Android 9 / 2 GB measurement lane. Provide manual dispatch for every suite.
- Include iOS sign-in, language and navigation smoke coverage, with platform-specific offline coverage tracked explicitly.
- Publish per-scenario results, failure screenshots/logs and low-end configuration, startup and memory measurements as CI artifacts.
- Keep the existing unit, persistence and HTTP suites as regression coverage for M1–M10 and TEST-01–06/03R.

## Capabilities

### New Capabilities

- `mobile-e2e-verification`: Repeatable device-driven acceptance scenarios, isolated fixtures, CI execution and measured device reports.

### Modified Capabilities

None. The existing worker behaviour contracts remain the acceptance criteria.

## Impact

Expected implementation areas are `.maestro/`, `testing/e2e/`, a dedicated GitHub Actions workflow, app/EAS configuration, UI `testID` props and narrowly scoped test-build bootstrap/inspection adapters. Existing mock controls supply most failure injection. A test-only request trace may be needed to assert attempts and deadlines without logging credentials.

Maestro runs locally on CI emulators. Store accounts and production signing are outside this test setup. The Android 9 runner must pass a pinned-tool compatibility check before its results count. Build setup and tooling assumptions are detailed in design.md.

Provisional ticket SDD-035. This is subsequent project work after the original assessment cutoff. This proposal prepares implementation through a separate apply request.
