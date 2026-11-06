# Seasonal worker mobile application

An Expo/TypeScript offline-first worker application under staged development. The mobile app currently has a minimal Spanish welcome route, design tokens, strict tooling, CI/build definitions and a fail-closed feature-flag interface. The supporting mock API is implemented separately; mobile authentication, assignment/terms/document screens, durable local data and synchronization are not implemented.

## Local setup

Use Node 24.11.1 (`nvm use`) and npm. Dependencies are locked in package-lock.json.

```sh
npm ci
npm ci --prefix mock-server
npm start -- --go
```

For Android, start an AVD through Android Studio Device Manager, then:

```sh
npm run android -- --go
```

The scaffold uses Expo Go first. Development EAS builds use expo-dev-client, configured separately after human account/signing approval. The project uses Expo SDK 58, React Native 0.88.1 and React 19.3.0; New Architecture is the SDK's native baseline (there is no legacy-architecture opt-out). No custom native project is committed. Official references: [SDK compatibility](https://docs.expo.dev/versions/latest/), [Router setup](https://docs.expo.dev/router/installation/).

If npm reports a permissions error in your shared cache, use `npm ci --cache /private/tmp/seasonal-npm-cache`; this avoids changing existing cache ownership. Public configuration examples are in .env.example. EXPO_PUBLIC values ship in the binary; never put secrets there. No API base URL is active in this scaffold.

## Checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm run arch:check
npm run test:ci
npm run expo:check
npm run config:check
npx expo-doctor
npx expo export --platform android
```

Jest uses jest-expo; React Native Testing Library is installed for future feature tests. Current tests verify invalid/missing/unavailable remote flags remain off and architecture violations are detected. They do not prove any worker workflow. Architecture checks enforce domain-native separation, cross-feature private imports, screen transport access and import cycles for literal imports/exports/require/dynamic import. Computed imports are outside static analysis; review remains necessary.

## Workflow and builds

The scaffold PR is merged; `mock-api` is the current change. See [change index](specs/tasks.md) for independent scopes. Use a separate ticket branch/PR for each feature. Human-reviewed merges gate dependent changes. See [CONTRIBUTING](CONTRIBUTING.md) for PR conventions and external branch protection/environment settings.

Validate runs on pull requests and main. Build is manual, main-only and build-only: no store submission, release or OTA is automated. EAS profiles cover development (Android APK/iOS simulator), preview (internal Android APK/iOS distribution) and production (Android AAB/iOS distribution). Configure authorized Expo owner/project ID, credentials and GitHub environment controls before running; identifiers are provisional and require ownership confirmation before release. EXPO_TOKEN belongs only in protected GitHub environment secrets, never source or AI context. No cloud build is claimed.

## Verification and limits

See [scaffold evidence](docs/evidence/scaffold-progress.md) for executed commands, Android details, screenshots and outstanding work. Worker tests TEST-01–06, TEST-03R and all eight manual worker scenarios remain NOT RUN. The mock service accepts OTP `123456` for Ana at `+52 55 1000 0001` and Bruno/Carla at `+52 55 1000 0002`. Start it with `MOCK_ENABLE_CONTROLS=1 npm run mock:start`; see [mock API instructions](mock-server/README.md) for the contract, durable state, failure controls and tested limitations. Only fictional records will be used. Recording B is prepared but not recorded; human capture scheduling is tracked in [the checklist](docs/recording-b-checklist.md).

[AGENTS.md](AGENTS.md) and the root specs define safety invariants and dependency boundaries. A single [coding ledger](docs/coding-ledger.md) spans all changes; target four hours, hard stop five. SDK minimum OS support does not establish acceptable behavior/performance on an Android 9 device with 2 GB RAM; that testing remains pending.

Mock API evidence is in [mock-api verification](docs/evidence/mock-api.md). Root typecheck/test:ci cover both packages; Node backend files use a separate tsconfig and never enter the mobile bundle. The backend uses experimental Node SQLite and refuses production startup.

### Persistent local intent

Worker-scoped SQLite repositories now cache assignments and atomically record terms/document intent with stable action IDs. Run `npm run test:persistence` for 15 file-backed tests. See [persistence contracts](docs/persistence.md) and [Android restart evidence](docs/evidence/persistent-outbox.md). Network sync and worker capture screens remain separate changes.

### Synchronization engine

The worker-scoped engine now delivers durable intent, persists retries, handles stale terms and merges replay acknowledgments without regressing newer staff decisions. See [runtime contracts](docs/synchronization.md) and [executed sync evidence](docs/evidence/offline-sync.md). Run `npm run test:persistence` for the file-backed core and real-HTTP integration tests. Authentication/UI wiring and capture remain separate changes.
