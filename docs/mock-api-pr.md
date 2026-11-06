Adds the local mock backend for SDD-004/005 so we can test the mobile app against persistent data and controlled failures.

### Included

- OTP request/verification, the three fictional workers and their exact assignment/document states.
- Bearer sessions and X-Worker-Id authorization, including the shared phone.
- Version-specific terms acceptance and multipart document uploads.
- SQLite receipts committed with each acceptance/submission. Matching retries return the original response; changed payloads with the same ID return 409.
- UUID-named private image files, rollback cleanup and startup orphan recovery.
- Opt-in loopback controls for latency, seeded 500s, post-commit response loss, v3 publication, 413, token expiry and staff decisions.
- A separate server package, startup instructions and backend checks in the existing CI pipeline.

### Tested

All local checks pass: typecheck, lint, formatting, architecture, Expo dependency/config checks and Expo Doctor. The combined suite has 9 flag cases, 5 architecture cases and 12 backend HTTP tests.

The backend tests include concurrent retries, stale terms, correction history, rollback cleanup and a real SIGKILL/restart after a committed upload loses its response. Retrying creates one server submission. Tests also verify that replay returns its original revision after staff approve or request correction.

Started the server and received HTTP 200 from the Android emulator through 10.0.2.2:3000. No mobile screens or sync engine are included.

### Limitations

This is a local assessment service, not production authentication or document storage. It uses experimental Node SQLite, signature checks rather than full image decoding, and a single process per data directory. Controls are off by default and unavailable in production; the executable refuses production startup. Real backend approval for the worker-selection header is still needed before integration.

Mobile offline/retry tests remain in their separate changes. Hosted CI results are shown in this PR's checks; no EAS build or release was run.
