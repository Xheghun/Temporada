# Worker authentication

The phone/OTP forms call AuthService through React Hook Form/Zod. English is the initial default per the SDD-015 user amendment; saved Spanish preferences remain unchanged and both languages are covered by rendering tests. Home's language toggle and business content remain separate work. Single-worker phone authentication selects Ana; the shared phone requires explicit Bruno/Carla selection. The protected identity landing screen provides switch/sign-out without inventing assignment or review content.

AuthService exposes token-free subscribed snapshots and implements the sync SessionProvider. Tokens and the authorized worker roster/selected identity are stored as one validated SecureStore record with WHEN_UNLOCKED_THIS_DEVICE_ONLY. Nothing writes a token to SQLite, navigation parameters, errors or logs. Runtime worker cache initialization writes only the selected authorized ID/display name and durable refresh intent; assignment data comes from the backend.

Identity mutations increment a generation and clear visible selection before asynchronous writes. Late network/vault results cannot republish a previous generation. Credential writes are serialized, so a logout queued after an in-flight login write clears it afterward. A selected identity is published only after successful secure persistence. Storage failures keep the view signed out or at the picker and surface an actionable error. UI error handling also checks the generation before showing a fallback.

Logout/401/403 clear the in-memory identity immediately and clear the vault; queues and files are never deleted. A 401 from an obsolete generation cannot invalidate a newer login. Successful logout awaits secure removal; an OS storage failure is displayed and must be retried. No promise is made that an interrupted or failed vault deletion has completed. SecureStore/device failure and uninstall are not a production account-recovery solution.

A previously authenticated stored session can resume without network. The mock token is opaque and carries no client expiry metadata, so the app learns expiry/revocation from the server when reachable. A fresh OTP sign-in requires network. Cached access is not proof of current server authorization. The server still validates worker membership for every authenticated request.

The runtime wires session changes, foreground/network restoration and future enqueue signals into the existing engine. Session signals are separate from presentation/error subscriptions to avoid an error-notification retry loop. Initial selected-worker metadata creates refresh intent even without an assignment cache; offline startup retains that intent until reachable. Runtime disposal stops triggers, waits for active sync and vault writes, then closes its database. Worker routes are keyed by generation and gated by auth state; future async worker hooks must additionally use isCurrent/captured repositories.

## Local execution

The verified Android setup uses the existing mock at port 3000:

```sh
npm run mock:start
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000 EXPO_PUBLIC_ASSESSMENT_MODE=1 npx expo start --go --localhost --clear
```

Open the application and use mock code 123456:

- +52 55 1000 0001 → Ana López.
- +52 55 1000 0002 → explicit choice of Bruno Díaz / Carla Díaz.

Development assessment mode requires **DEV** plus EXPO_PUBLIC_ASSESSMENT_MODE=1. Production defaults closed; an HTTPS EXPO_PUBLIC_FLAGS_URL must return worker_authentication: true and EXPO_PUBLIC_API_URL must be HTTPS. Flags are checked at runtime creation, not continuously. No production flag/release approval is implied. Public environment variables must contain no secrets.

SecureStore is a new native dependency/config plugin. Build a compatible native binary before release; do not OTA this change onto a binary without it. Expo Go was used for actual Android verification; no EAS/iOS build is claimed. [Executed evidence](evidence/worker-authentication.md).

## Subsequent SDD-022 presentation

Authentication now uses the shared card-free page, persisted language selector and worker rows with initials. OTP explains the requested phone through a token-free in-memory snapshot value that clears when verification ends; it is not added to secure or ordinary persisted records. No SMS or resend contract changed. Eight targeted auth/shared-control tests, typecheck, lint and architecture checks passed. Native checks for the redesign are recorded separately, not inferred from previous evidence.
