# Verification plan

Current state: scoped worker-domain tests and native checks are recorded under docs/evidence. These do not establish whole-app acceptance; complete assessment scenarios remain owned by offline-integration. Planning validation is separate from executed behavior.

Automated: Jest/Expo + RNTL; pure engine clock/RNG/transport fakes; isolated real SQLite repository integration through an appropriate Node adapter or instrumented Expo harness. Do not claim fake reconstruction proves native persistence. Backend tests start actual service/storage for replay/restart; use temporary files and deterministic failure controls.

| Test | Evidence required |
|---|---|
| TEST-01 | Offline enqueue persisted; restoration delivers original action |
| TEST-02 | Reopen real database/engine; same IDs/payloads/files; interrupted sending recovers |
| TEST-03 | Server commits then drops response; restart backend; same-ID replay creates exactly one record |
| TEST-03R | Commit/drop → staff decision → refresh → original replay; delivery resolved, newer review revision/status/reason preserved and one submission; cover Approved and Correction Requested |
| TEST-04 | 500 backoff bounds/jitter; 413/422 terminal remedy; unrelated action proceeds |
| TEST-05 | v2 queued/v3 published; v2 stale is ordering-resolved, independent refresh, explicit v3 new action delivers successfully without v2 supersession |
| TEST-06 | Carla/Bruno switch hides records/counts; pending queue restored for Carla |

Also verify simultaneous triggers, 401 reauth, unauthorized worker 403, changed payload conflict, old-decision/new-upload, migration reapplication, failed DB file cleanup, missing files, both-language rendering and late async worker results. Relevant tests land with each task, not only at final integration.

Quality scripts to CREATE then execute: npm run typecheck, lint, format:check, test:ci, arch:check. Expo compatibility/config validation after installation. CI must execute scripts; workflow existence alone is not CI success. Inspect sensitive logging and final diff.

Manual scenario definitions (execution results are maintained in [docs/evidence/offline-integration.md](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/offline-integration.md)): 1 Ana switches between Spanish and English; 2 Ana offline terms+passport, kill/reopen offline, reconnect, one effect each/passport pending review; 3 DS-160 dropped response one record; 4 offline v2 versus published v3 explicit reconfirmation; 5 forced 413 localized retake/unrelated progress; 6 random 500 responsiveness/backoff/eventual delivery; 7 Carla correction/new passport→Bruno isolation; 8 expired token queues preserved/relogin resumes.

For EACH create a record with environment (SDK/API/device/build/commit), steps, expected, actual, status, logs/screenshots, limitations. Collect SQLite action rows and server receipt/business counts with redacted tokens; fictional data only. Execute scenarios 2/3/4 on actual emulator, plus all eight before claiming full completion. Large text/360px, image byte measurement and backend reachability mandatory checks. Current Android/ADB execution status is recorded in the dated integration evidence; the original baseline ADB restriction is historical.

Recording A: actual 5–8min emulator demo scenarios 2/3/4 and confident/uncertain code. Recording B: actual 10–15min agent session with real prompt, plan, code review, genuine correction, implementation, emulator tests, PR description and explanation. Prepare its checklist and arrange capture in SDD-001 before coding; capture prompt/plan/review and genuine implementation during the chosen session, including real correction, tests/emulator and PR description. SDD-021 performs final editing and artifact verification. Human records/narrates; never fabricate missed footage or a correction. Coding on camera still counts toward the timebox. If unavailable, mark incomplete.

Pipeline checks are established in the scaffold PR and run for each feature PR. Verify CI installation, typecheck, lint, format, tests, boundaries and Expo configuration as applicable. Build/release workflows require authorized credentials and release execution; configured workflows are not proof of successful cloud builds. PR evidence records exact commands/results and emulator checks plus pending reviews. External branch protections enforce required checks/reviewer where available; document unconfigured controls.

Mock-api backend increment: 12 isolated real-HTTP tests cover seeds/auth, concurrent stable-ID replay, SQLite reopen, SIGKILL/restart after post-commit disconnect, stale terms, review revisions, 413/422, correction history, expiry, deterministic failures, disabled controls and orphan/rollback cleanup. Android emulator /health reachability passed. These supporting backend checks are distinct from the mobile tests and eight Android scenarios now recorded in [docs/evidence/offline-integration.md](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/offline-integration.md). See [docs/evidence/mock-api.md](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/mock-api.md).

Offline-sync core TEST-01–06/03R now have executed real-storage/HTTP evidence in [docs/evidence/offline-sync.md](https://github.com/Xheghun/Temporada/blob/cd85eadd9c9fc803c70c4938693c9a827621fec2/docs/evidence/offline-sync.md). Android development probes are executed there; they do not mark the eight full worker UI scenarios passed.
