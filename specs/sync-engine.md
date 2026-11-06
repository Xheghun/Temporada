# Synchronization

Interfaces: outbox persistence, transactional business repositories, API transport, connectivity, clock/scheduler, jitter policy, session provider, event reporting, file resolver. Pure engine uses injected dependencies and no UI/native imports.

Enqueue: validate against captured worker/session and exact displayed version/catalog; assign UUID once; ensure durable bytes; commit immutable local business intent + outbox; notify; request sync. Local success does not wait for HTTP.

Processing: single-flight guard → verify session/worker → load eligible captured-worker actions ordered by persisted enqueue sequence → respect resource dependencies → atomically claim → recheck authorization → transmit original payload/ID → classify response → transactionally update captured worker rows → emit → release in finally → schedule earliest persistent deadline. On worker switch stop future old-worker dispatch and schedule new worker after settlement; late response never populates another view.

| Outcome | Persistent response |
|---|---|
| 201 / 200 replay | delivered; terms exact-version acknowledged; initialize document pending_review only absent newer review state; preserve newer review revision/status/reason |
| timeout/network/5xx | retry_wait; same ID and file, increment attempts, persist eligibility |
| 401 | preserve/requeue; pause auth, resume only after authorized login |
| 409 stale_terms | stale (resolved for ordering, no supersession needed); reconfirmation required; fetch latest, persist independent refresh need if unreachable |
| 409 action_id_conflict | permanent integrity error, no automatic retry |
| 413 / 422 | failed_permanent + localized remedy; retain bytes for explicit resolution |
| 403 | reject unauthorized worker access; pause that selection |
| other 4xx | actionable terminal error, no blind loop |

Backoff: cap=min(60s, 1s*2^(attempt-1)); sample uniformly [cap/2,cap]. Delay bounded; no action discarded for excessive transient attempts. Clocks/RNG injected. Manual retry can advance transient eligibility; permanent failure needs correction/new action. Recover sending to queued after restart. Skip delayed/terminal unrelated actions; block same-resource successors until predecessor resolved/superseded. Delivered, stale and superseded are resolved; explicit v3 confirmation can deliver after stale v2 without another resolution step. Replay deduplication precedes current terms validation.

Triggers: startup, foreground, network restoration, login, worker selection, enqueue, manual retry and earliest eligibility. Persist next_attempt_at; rebuild timers; positive NetInfo is a hint, background execution best effort. Refresh reads preserve unsynced intent and submission history.

Proof obligations: TEST-01..06, concurrent triggers, refresh failure after stale terms, same-ID changed payload and lost response after server restart. Exactly-once refers to server effect, not delivery count.

Acknowledgment resolves delivery independently of staff review. Merge review fields only for the same submission and a strictly newer server revision; equal revisions must agree. Older receipts cannot regress Approved/Correction Requested or correction reason. Missing/incomparable revision preserves known review and requests refresh. Test the commit/drop → staff decision → refresh → original replay sequence for both decisions, and v2 stale → explicit v3 confirmation → successful v3 delivery without supersession.

A failed local completion transaction must not strand sending intent. After the attempt settles, conditionally release only its captured worker/action for a later original-ID replay. If storage also prevents release, retain targeted recovery for the next trigger; restart recovers durable sending state. Never rewind an already committed completion or reset another active claim. Verify engine-level manual recovery and successor progress without restarting, plus one backend effect per original ID.
