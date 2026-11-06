# Mock API verification — SDD-004/005

Prerequisite: scaffold PR #1 was human-reviewed and merged at 1eb9b56 before feature/SDD-004-mock-api was created. Scope: supporting backend only; no mobile feature changed. Source contract: specs/api-contract.md; real-backend approval for X-Worker-Id remains pending.

## Executed

2026-11-06, macOS arm64, Node 24.11.1/npm 11.6.2. Mock Express 5.3/Multer 2.5, built-in Node SQLite 3.50.4. Node SQLite is experimental. Separate service package and lockfile keep backend dependencies outside the mobile app.

- npm ci --prefix mock-server --cache /private/tmp/seasonal-npm-cache: PASS.
- npm run typecheck: PASS for strict mobile and separate strict Node configs.
- npm run lint / format:check / arch:check: PASS.
- npm run test:ci: PASS: 9 existing feature-flag cases, 5 existing boundary cases, 12 backend HTTP tests.
- Backend tests cover exact seeds/auth/shared identities, 401/403, persistent sessions, stable-ID receipt/content conflict, version changes, actual file/database reopen, concurrent terms/upload retries, old upload receipts after newer staff review, 413/422, correction history, seeded failure controls/expiry, production/default-disabled controls, rollback compensation and startup orphan cleanup.
- Real child-process test: server commits an upload and destroys its response, process receives SIGKILL, fresh process opens the same SQLite/files, original-ID retry returns 200 pending_review; one receipt/submission and retained bytes. No tokens/images printed.
- Started executable using the documented MOCK_ENABLE_CONTROLS=1 npm run mock:start command and default private .data directory. Desktop curl /health returned 200/status ok.
- Small_Phone emulator-5554 (Android 16/API 36): toybox nc sent GET /health through 10.0.2.2:3000 and received HTTP 200 with the expected mock service status. This checks emulator networking, not mobile API adapter behavior.
- App domain files/screens/native dependencies are unchanged. No sensitive logs or committed runtime database/upload files; .data is ignored. Git diff checked before PR.

Raw transient process logs were inspected in /private/tmp; tests use isolated temporary directories and remove them. Review actual PR CI checks separately; hosted CI result is pending until the PR runs. No cloud build/release is executed.

## Limits

The later pure client sync tests TEST-01–06/TEST-03R and all eight manual worker workflows remain NOT RUN. Backend behavior establishes only the server side of those requirements. Mock OTP is fixed, HTTP is loopback, image validation checks signatures rather than full decoding/scanning, controls are opt-in loopback tools and the executable refuses production. One process owns a data directory via exclusive SQLite locking; stop it before direct DB inspection. Current SQLite schema is initial v1; future schema changes need new migrations.

Real corrections: the test upload helper initially inferred UUID template-string types too narrowly for invalid-input tests; explicitly typed its ID argument as string. Default data path was made module-relative so npm --prefix cannot create a nested runtime directory. No implementation tests were weakened; no delegated agents, human sign-off or footage invented.
