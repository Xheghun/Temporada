# Seasonal worker mobile application

An Expo/TypeScript offline-first worker application under staged development. **This PR is the scaffold only:** a minimal Spanish welcome route, design tokens, strict tooling, CI/build definitions and a fail-closed feature-flag interface. Authentication, assignments, terms, documents, backend and synchronization are separate OpenSpec changes and are not implemented.

## Local setup

Use Node 24.11.1 (`nvm use`) and npm. Dependencies are locked in package-lock.json.

```sh
npm ci
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

Apply only `project-scaffold`; see [change index](specs/tasks.md) for later scopes. Use a separate ticket branch/PR for each feature. Human-reviewed merges gate dependent changes. See [CONTRIBUTING](CONTRIBUTING.md) for PR conventions and external branch protection/environment settings.

Validate runs on pull requests and main. Build is manual, main-only and build-only: no store submission, release or OTA is automated. EAS profiles cover development (Android APK/iOS simulator), preview (internal Android APK/iOS distribution) and production (Android AAB/iOS distribution). Configure authorized Expo owner/project ID, credentials and GitHub environment controls before running; identifiers are provisional and require ownership confirmation before release. EXPO_TOKEN belongs only in protected GitHub environment secrets, never source or AI context. No cloud build is claimed.

## Verification and limits

See [scaffold evidence](docs/evidence/scaffold-progress.md) for executed commands, Android details, screenshots and outstanding work. Worker tests TEST-01–06, TEST-03R and all eight manual worker scenarios remain NOT RUN. No mock account, OTP or server startup command works yet; those arrive with mock-api. Only fictional records will be used. Recording B is prepared but not recorded; human capture scheduling is tracked in [the checklist](docs/recording-b-checklist.md).

[AGENTS.md](AGENTS.md) and the root specs define safety invariants and dependency boundaries. A single [coding ledger](docs/coding-ledger.md) spans all changes; target four hours, hard stop five. SDK minimum OS support does not establish acceptable behavior/performance on an Android 9 device with 2 GB RAM; that testing remains pending.
