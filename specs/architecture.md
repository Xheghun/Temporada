# Architecture

See programme/design.md for decisions and risk register.

Expo Router screens → feature hooks/application services → domain interfaces. SQLite repositories, secure session adapter, image adapter and API transport implement interfaces. Pure TypeScript sync engine receives dependencies; screens never send raw sync requests. No React/Expo/SQLite imports in domain, no cross-feature private imports, no cycles. Enforce with ESLint/lightweight architecture script.

Requested layout: app auth/worker groups; src/core api/auth/database/sync/files/i18n/connectivity/config; src/features assignment/terms/documents; src/design-system; src/testing; mock-server; specs; .github/workflows. Keep simple services and subscribed state, no Redux/ORM/UI framework.

Foundation: current compatible Expo SDK, New Architecture, strict TS, Router, SDK-compatible SQLite/SecureStore/image picker/manipulator/filesystem, NetInfo, RHF/Zod, i18next/react-i18next. Select exact versions from official Expo guidance at implementation time; validate with Expo tooling before claiming compatibility. Backend Express + persistent transactional SQLite. Testing Jest/Expo, RNTL and clock-injected engine.

Session generation guards late responses. Every operation captures worker ID. Worker changes clear current views before asynchronous work; persisted queues survive. One global sync flight settles before processing the newly selected worker. Token expiry pauses sends. Production feature flags use remote configuration and default false on missing/unreachable service; local assessment mode is explicitly development-only.

Historical initial baseline: no app/package manifest/Git and ADB startup was blocked. Current implementation uses Expo SDK 58/React Native 0.88.1, has executed Android integration and partial iOS evidence, and retains the interfaces described above. See README.md, DECISIONS.md and docs/evidence/offline-integration.md. Security-sensitive tokens never enter logs or ordinary database; app-private SQLite/images do not establish encryption or protection against device compromise.

Mobile behavior and Android evidence are the focus. The mock backend remains supporting test infrastructure limited to the contracts, durable idempotency and failure controls needed by the client. Reconcile the original assessment once supplied; no new backend product scope is planned.

Delivery: scaffold-first PR includes strict tooling, lint/format, test harness, boundaries, GitHub Actions CI/build definitions, EAS profiles and PR conventions. Use a separate purpose-named ticket branch/PR per feature from reviewed main; never AI-branded names. See tasks.md for scope-to-branch mapping and human merge gates.
