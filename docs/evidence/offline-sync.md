# Offline-sync verification — 2026-11-06

Scope: SDD-008/009/010, core M1–M6/M8/M10 delivery behavior. Worker UI, real authentication wiring and camera/compression remain separate changes. Recording B reminder was delivered; capture was not confirmed and no footage is claimed.

## Automated evidence

Node 24.11.1, real temporary SQLite files, fake clock/RNG for engine timing, isolated real HTTP mock processes for transport/idempotency. `npm run test:persistence` passes 46 tests: 18 existing persistence tests and 28 sync/transport/repository tests. These cover all six mandatory core tests (TEST-02 also remains in the persistence suite) plus TEST-03R for both staff decisions.

- TEST-01/02: offline engine does not dispatch; close/reopen actual SQLite and reconstruct engine; original terms/upload IDs deliver and document becomes Pending Review.
- TEST-03: server commits upload and destroys socket; engine persists retry; SIGKILL/restart server and reopen local DB; retry same ID; one receipt and submission.
- TEST-03R: for Approved and Correction Requested, commit/drop → staff decision → cache refresh → original replay; known newer revision/status/reason survives. Post-ack refresh is deliberately unavailable so it cannot conceal an incorrect merge.
- TEST-04: 500 deadline survives reopen, jitter bounds are deterministic; 413/422 terminal, manual retry does not resend permanent failures, unrelated terms deliver. Same-resource successors wait; explicit supersession commits atomically or rolls back, preserving history.
- TEST-05: v2 stale, failed refresh/reopen, v3 fetched unaccepted, explicit new v3 action delivered without superseding v2. A committed v2 replay after publishing v3 does not accept v3.
- TEST-06: Carla send in flight while switching to Bruno; no further Carla dispatch; late acknowledgment is worker-scoped; switching back retains/delivers Carla's queue.
- Additional: process-wide single-flight, duplicate startup, lifecycle unsubscribe, actual expired token/relogin, 403, action-ID conflict, malformed responses, missing/older review revisions, conflicting equal revisions, acknowledgment rollback, receipt-missing metadata completion, v1→v2 upgrade, and permanent refresh classification.

## Android development probes

Environment: Small_Phone emulator, Android 16/API 36, Expo Go/SDK 58, actual Expo SQLite/files/crypto and Expo fetch. Dedicated local backend: `/private/tmp/temporada-native-sync-proof`, port 3001; Metro localhost 8081. `adb reverse` maps both ports. These are development probes, not complete worker acceptance scenarios.

| Probe                        | Executed steps / expected                                                                                                                                                                                                                                    | Actual                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Offline + restart            | Authenticate/bootstrap online, inject offline connectivity into the real engine, persist terms/passport fixture. Force-stop Expo Go, reopen, enable engine connectivity, deliver original IDs once                                                           | PASS; [queued](sync-offline-seed.png), [delivered](sync-offline-delivery.png); Pending Review, never inferred approval |
| Lost acknowledgment + review | Configure actual server socket drop. Also discard any successful HTTP-stack replay acknowledgment to ensure deterministic client retry state. Staff approve/request correction, cache refresh, manually retry original ID while post-ack refresh unavailable | PASS for both decisions/reason; [result](sync-dropped-replay.png); one business effect per tested ID                   |
| Stale terms                  | Enqueue displayed v2, publish v3, synchronize; inspect v3 unaccepted; enqueue explicit v3; synchronize                                                                                                                                                       | PASS; v2 remains stale and v3 delivered; [result](sync-stale-terms.png)                                                |
| File integrity               | Resolve valid private fixture; try foreign-worker URI, missing file, changed digest and exactly 1,500,000 bytes                                                                                                                                              | PASS; valid bytes accepted, others rejected; [result](sync-file-integrity.png)                                         |

UI hierarchies accompany each PNG. Native local action IDs/status/attempts and token-free server records are retained in this folder. The final successful offline pair is `517ebac5-6fd6-436c-8afe-4e24b473ab37` (terms) and `90503161-4825-425c-92aa-590ea09a992f` (passport); server records show one receipt per ID. Expo Go was force-stopped and cold-launched; successful delivery ran in PID 6937. Earlier failed development attempts remain in the dedicated server history and are not counted as successful probe actions.

Native caveats: offline connectivity was injected, not airplane mode. Login/assignment bootstrap occurred online before queueing. A small fictional valid PNG was used, not a captured/compressed photo. Full scenarios 1–8, iOS, reboot, large-text worker UI and production builds are NOT RUN for this change. Native Android HTTP transparently replayed a socket drop; the extra client acknowledgment discard is explicit fault injection, not a claim that the transport exposed that drop to the engine. The Node test independently verifies actual disconnect → persisted engine retry → server SIGKILL/restart.

## Corrections found during implementation

- SDK 58 File.write is asynchronous; both development probes now await it before measuring/queueing.
- RN global Blob rejects byte arrays. ExpoBlob plus a typed buffer normalization wrapper and explicit multipart filename resolved native upload failures. No type-error bypass is used.
- Receipt and refresh can share a review revision but the receipt omits server creation time. Equal matching refreshes now complete missing metadata/projections; a real-SQLite regression test covers this.
- Initial HTTP test assertions included Bruno's seeded acceptance; assertions now scope to Ana rather than changing the seed.

No real worker data, tokens, credentials, human review/approval or recordings appear in these artifacts.

Final local checks: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run arch:check`, `npm run test:ci` (72 tests: 9 mobile, 5 architecture, 12 mock, 46 persistence/sync), Expo dependency/config validation, Expo Doctor 20/20, Android JavaScript export and strict OpenSpec validation passed. Hosted CI is recorded separately at PR handoff.
