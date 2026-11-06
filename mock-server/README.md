# Worker mock API

Development-only service for the mobile assessment. No real SMS is sent. OTP 123456 works only for the fictional phone numbers +52 55 1000 0001 (Ana) and +52 55 1000 0002 (Bruno/Carla). Input phone whitespace is normalized. Tokens are random, expire after 24 hours and are stored only as SHA-256 hashes; they are never logged. This mock is not a production authentication service.

X-Worker-Id selects the worker after OTP verification. Every protected request checks that the selected worker belongs to the authenticated phone. Missing/expired authentication returns 401; unauthorized worker selection returns 403. This header is a mock convention; backend sign-off for real integration is pending.

Install with `npm ci --prefix mock-server`; run endpoint tests with `npm run test:mock` from the root. Data uses Node 24's built-in SQLite, which is experimental, to avoid a separately compiled native dependency. No Postgres or external database is required. Only one process may own a data directory. Seed records and sessions persist across restarts; seed inserts do not reset staff decisions or current terms.

## Run

From the repository root:

```sh
npm ci --prefix mock-server
MOCK_ENABLE_CONTROLS=1 npm run mock:start
```

The service binds to 127.0.0.1:3000. Android emulator clients use http://10.0.2.2:3000; the emulator health request has been executed successfully. This development address is not a production mobile default. Override MOCK_PORT and MOCK_DATA_DIR if needed. Default data directory is mock-server/.data (ignored by Git). Stop the service before inspecting/copying SQLite; exclusive locking prevents a second owner from racing startup cleanup. Restart preserves sessions, acceptances, submissions and receipts. Stop the server and explicitly remove its data directory only when you want a fresh fictional test run.

The seed contains JO-2026-0142 / Valle Verde Farms / Yuma, Arizona / March 1–July 31 2026 / terms v2; required passport, ds160_confirmation, signed_contract. Ana starts unconfirmed/no documents. Bruno starts confirmed/passport approved. Carla starts with passport correction “Foto borrosa, vuelva a tomarla”. Seed document decisions have no real image files.

## Endpoints

- POST /auth/otp/request: JSON phoneNumber; 200 or 422. No SMS is sent.
- POST /auth/otp/verify: JSON phoneNumber, otp; 200 token/workers, 401 invalid OTP/unknown phone.
- GET /me/assignment: bearer token and X-Worker-Id; assignment, version/acceptance, bilingual terms summary/catalog, submission history and server revisions. 401/403 on invalid access.
- POST /me/terms-acceptances: JSON clientActionId (UUID), termsVersionId. 201 first, 200 original replay, 409 stale_terms/currentTermsVersionId or action_id_conflict, 422 invalid input.
- POST /me/documents: multipart clientActionId (UUID), documentType, image; optional replacesSubmissionId. JPEG/PNG/WebP signatures/MIME checked (not full image decoding). 201 pending_review, 200 original replay; 413 at or above 1,500,000 image bytes or forced rejection; 422 for unsupported type/invalid image/replacement.
- GET /health: no token, returns service status.

Deduplication uses worker + action ID and fingerprints operation/immutable fields/image SHA-256 bytes, independent of multipart boundaries. Matching receipt is checked before current terms and failure controls; a replay after v3 still returns the original successful v2 acknowledgment. Reusing the ID with changed content returns 409. Authorization always precedes receipt lookup. Acknowledgments carry their original revision: staff decisions target submission IDs and appear with newer revisions in refreshes. Clients must merge delivery separately from those newer decisions.

Uploads are bounded in memory (2 MB transport ceiling), written under UUID filenames with mode 0600, fsynced along with the parent directory, then committed with the submission and receipt in one SQLite transaction (M3/M4/M7). DB failure removes the unreferenced image. Startup removes orphan files before serving; it refuses startup if a referenced image is missing. This is not a production image scanning/storage design.

## Development controls

Available only with MOCK_ENABLE_CONTROLS=1, only from loopback, and never in NODE_ENV=production. The executable refuses production startup entirely. Controls are local test tools, not a staff application. They require no token and must not be exposed through a public tunnel/proxy.

```sh
# Two-second latency (0 resets it)
curl -X POST http://127.0.0.1:3000/__dev/failures -H 'Content-Type: application/json' -d '{"latencyMs":2000}'
# Reproducible 50% precommit failures (rate 0 disables, 1 always fails)
curl -X POST http://127.0.0.1:3000/__dev/failures -H 'Content-Type: application/json' -d '{"serverErrorRate":0.5,"randomSeed":42}'
# Disconnect once AFTER the next new acceptance/upload commits
curl -X POST http://127.0.0.1:3000/__dev/failures -H 'Content-Type: application/json' -d '{"dropNextResponse":true}'
# Force first-upload rejection (false resets it; committed replays still work)
curl -X POST http://127.0.0.1:3000/__dev/failures -H 'Content-Type: application/json' -d '{"force413":true}'
# Publish v3 without accepting it
curl -X POST http://127.0.0.1:3000/__dev/terms -H 'Content-Type: application/json' -d '{"version":"v3"}'
# Expire existing sessions; fresh OTP login works afterwards
curl -X POST http://127.0.0.1:3000/__dev/expire-sessions
# Counts/identifiers and decisions, excluding tokens, file paths and image content
curl http://127.0.0.1:3000/__dev/state
# Target an existing submission (replace the example ID from the state output)
curl -X POST http://127.0.0.1:3000/__dev/review -H 'Content-Type: application/json' -d '{"submissionId":"seed-carla-passport","status":"correction_requested","correctionReason":"Foto borrosa, vuelva a tomarla"}'
```

Latency/random error/drop/413 switches are process-local and reset on restart. Terms publication, session expiration, staff decisions, receipts and business records persist. Existing committed replay does not consume a new-action drop switch. GET assignment can fail transiently; health/auth/development controls stay usable for recovery. A timed-out/retried client retains the original action ID.

## Verification

`npm run test:mock` executes actual HTTP requests against isolated SQLite/file directories, concurrent retries and a real SIGKILL/restart child-process scenario. It checks seeds/auth, replay/content conflicts, stale v2→explicit v3, dropped-response one-effect delivery, original receipts after newer staff reviews, 413/422, corruption-safe cleanup, correction history, deterministic failures, expiry and disabled production/default controls. Test output never prints tokens or image bytes. These backend tests are not the later mobile sync-engine TEST-01–06/TEST-03R or offline Android workflow acceptance.
