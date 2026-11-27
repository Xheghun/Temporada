# Tasks

Scope SDD-035. Implement only `automate-brief-e2e-scenarios` after a separate apply request. All tasks below are pending. Keep the original assessment timing record intact.

## 1. Toolchain and bundled test app

- [x] 1.1 Pin Maestro and the Android emulator/system-image tooling. Run a driver compatibility probe on API 34 and API 28 with 2,048 MiB RAM, covering native UI selection, screenshots, restart and airplane/Wi-Fi control. Record versions and output. If API 28 fails, keep its result incomplete and revise the runner choice before continuing the target lane.
- [x] 1.2 Add a bundled E2E variant with its own application ID, test API/flag providers and inspection access. Install it, stop Metro, force-stop offline and verify cached Home can reopen. Add tests proving production configurations reject E2E settings and retain HTTPS/feature gates. Document the exact local build command and variant settings.

## 2. Isolated runner and assertions

- [ ] 2.1 Add the local E2E command with suite/scenario selection, temporary mock directories, fixture seeding, package-scoped app resets and bounded readiness waits. Verify two isolated runs produce the same starting state and do not touch the normal app or mock data. Document the runnable commands beside the harness.
- [ ] 2.2 Add stable selectors to the exercised controls, fictional media fixtures and API-specific camera/gallery helpers. Verify Spanish and English selectors, native virtual-camera capture, real preview/compression, app-created original cleanup and gallery selection on API 34 and API 28. Keep failed or unavailable capture steps visible.
- [ ] 2.3 Reuse native inspection and `/__dev/state` for worker/action/submission identity, retry metadata, review state and private-file integrity. Add mock-only 422/replay timing/allowlisted attempt tracing where needed. Verify snapshot consistency, disabled non-test controls and redaction of tokens, image contents and private paths.
- [ ] 2.4 Implement device-level offline/online, force-stop, relaunch and reboot helpers plus cleanup. Verify airplane mode also disables Wi-Fi, the app observes Offline, no sends occur offline, storage survives restart and cleanup restores settings after an intentionally failed flow.

## 3. Initial device journeys

- [ ] 3.1 Implement brief scenario 1 with Ana login, default Spanish, English selection from Home and saved preference after restart. Assert app-owned text on Home/Terms/Documents/Capture plus representative queued/retry/error messages and unchanged staff free text. Map the result to M9 and document its covered states.
- [ ] 3.2 Implement brief scenario 2 with actual camera capture offline, terms confirmation, force-stop/reopen and reconnect. Assert both original UUIDs, private compressed size/digest, no premature server effects, one final effect per action and Pending Review. Add a full-suite emulator-reboot variant and record TEST-01/02 coverage.

## 4. Brief failure and shared-phone journeys

- [ ] 4.1 Implement brief scenario 3 and its backend-restart variant. Assert the response drops after commit, at least two attempts reuse the same UUID, and one receipt/submission and Pending Review remain. Verify the backend uses the same persistent directory through restart and map TEST-03.
- [ ] 4.2 Implement brief scenario 4 in the original order: open unconfirmed v2 offline, publish v3, confirm v2, reconnect, then explicitly confirm v3. Assert zero v2 acceptances, visible v3 awaiting input, retained stale history and a new v3 action that delivers. Map TEST-05.
- [ ] 4.3 Implement brief scenario 5 with forced 413, Spanish recovery, no automatic retry, unrelated terms progress and explicit retake/new ID. Add a separate 422 case, verify both failures remain distinct from transient retry and document TEST-04 coverage.
- [ ] 4.4 Implement brief scenario 6 using seeded random 500s, a separate 2-second latency run, UI interaction during retries and restart before eligibility. Verify actual injected failures, real persisted backoff/deadlines, no early retries, eventual delivery and one effect per original action. Preserve failure controls and trace settings in the result.
- [ ] 4.5 Implement brief scenario 7 with Carla’s verbatim correction, offline replacement, Bruno switch and return to Carla. Assert hidden prior-worker content, accurate separate counts, worker-scoped requests, preserved historical decision and durable replacement. Verify TEST-06 and M8/M10 coverage.
- [ ] 4.6 Implement brief scenario 8 with a real forced 401 and reauthentication. Assert paused delivery, original action IDs/files and authorized resumption. Add logout with pending work, preserving the queue through another login and identity selection.
- [ ] 4.7 Implement TEST-03R with a replay-response barrier and newer Approved/Correction Requested refresh before the old receipt arrives. Verify delivery completion, retained decision/reason/revision and private queue consistency through another force-stop/reopen. Confirm the existing six mandatory sync tests and M1–M10 remain mapped in the suite report.

## 5. CI and device evidence

- [ ] 5.1 Add Android PR smoke and main/nightly full workflows with manual dispatch, pinned tools, isolated local backend and bundled test APK. Upload JUnit, per-scenario results and sanitized failure artifacts even on failure. Verify a passing run and an intentionally failing assertion produce the expected CI status, cleanup and downloadable artifacts. Keep existing validation required.
- [ ] 5.2 Add the API 28 / 2,048 MiB weekly/manual lane. Verify OS/RAM and build identity, run all eight scenarios, collect five process-cold launches and sampled PSS through capture/restart, and publish raw values plus summary. Fail wrong-target or missing-data runs. Record build overhead and avoid an invented performance threshold.
- [ ] 5.3 Add iOS smoke on main/manual dispatch for sign-in, locale persistence, shared-phone selection and navigation. Verify its simulator/build metadata and publish its exact subset. Keep unsupported airplane-mode checks outside its pass count and describe the remaining iOS journeys.

## 6. Acceptance and handoff

- [ ] 6.1 Run all eight Android scenarios individually and as a suite twice from fresh fixtures on API 34 and API 28. Verify order independence, supplemental regressions, observed server counts, native file retention and both-language 360dp/130-percent layouts. Preserve the first failure on retries and list any NOT RUN checks.
- [ ] 6.2 Run typecheck, lint, formatting, architecture, the full existing suite, Expo compatibility/config/Doctor, Android bundle export and strict OpenSpec validation. Review production/test boundaries, credential handling and the complete diff. Update only relevant setup/testing docs, traceability and the subsequent-work ledger with executed results and CI artifact links, then prepare the scoped PR.

## Workflow follow-up

- Review and merge gate completion. Archive and sync require a later explicit request.
- Keep `submission-documentation` and its recording acceptance task separate.
