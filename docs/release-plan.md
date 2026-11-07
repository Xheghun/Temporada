# Proposed release plan

No build, signing, store submission, monitoring service or production approval is complete. The app identifiers and Expo project ownership require confirmation.

An authorized owner configures Android upload signing/Play App Signing and iOS certificates/provisioning. Protect credentials in approved EAS storage and protected CI environments; never place them in Git, logs or agent context. Separate development, preview and production accounts/configuration, and grant operators only the access they need. See [Expo credentials](https://docs.expo.dev/app-signing/app-credentials/).

After backend contract/security approval, configure HTTPS API/flags URLs and build from reviewed main. Use the existing development profile for simulator/development clients, then preview/internal distribution. QA signed binaries through TestFlight and Play internal testing against staging: offline restart, retries/deduplication, identity isolation, corrections, permission denial and low-memory devices. Expo Go results do not replace these checks.

Production flags stay off until human approval. Proposed rollout is 1% → 5% → 25% → 100%, with a human deciding each step from crash-free sessions, failed-sync rates, queue age and support feedback. Crash/metric instrumentation is future work; redact tokens, worker identifiers, document contents and correction text before collection.

On regression, halt rollout and disable affected flags for new runtimes; an immediate backend gate for already-running clients is still required. Retain queued intent. Only compatible JavaScript/assets may use a future OTA path; OTA is not configured here. Native changes need a new binary/runtime. A compatible update rollback cannot repair an incompatible native binary. Installed store binaries cannot be instantly downgraded; ship an approved corrective release and keep migrations backward-compatible. [Expo runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/).
