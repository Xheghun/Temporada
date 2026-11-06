# Worker-authentication verification — 2026-11-06

SDD-011, M2/M9/M10 and auth routing. Home/terms/documents/capture remain separate features. No recording or human approval is claimed.

## Automated

88 tests pass: 13 Jest UI/config tests, 5 architecture checks, 12 mock API tests and 58 file-backed persistence/auth/sync tests. New coverage includes:

- Invalid OTP has no session; single-worker selection; token-free public snapshots.
- Explicit shared-phone selection; invalid worker rejection; synchronous view clearing and generation invalidation on switch.
- Late OTP verification after logout; logout serialized after an in-flight secure write; stale restore completion cannot resurrect identity.
- Secure-write failure fails closed and a later verification succeeds. Old-generation 401 cannot revoke a newer session; current expiry clears identity/vault.
- Real HTTP auth and file-backed SQLite: Carla queues passport, logs out, reauthenticates, selects Bruno (no Carla action visible/dispatched), then selects Carla and delivers the original ID.
- Real server token expiry with AuthService/engine: queue preserved, vault cleared, reauthentication resumes original ID.
- Initial authorized worker identity creates persistent refresh intent before assignment exists; engine later caches its own assignment.
- RNTL Spanish phone validation/normalization, invalid-code recovery, English authorized picker, identity view clearing and signed-out route gating.

Vaults are injected fakes in automated tests; actual SecureStore persistence/removal is verified on Android below. Existing storage/sync tests continue to execute. No real tokens are printed or stored in these artifacts.

## Android

Environment: Small_Phone, Android 16/API 36, 720×1280 at 360 dp width, Expo Go/SDK 58. Mock localhost:3000 through adb reverse; Metro localhost:8081 with explicit development assessment mode.

| Check                           | Steps and actual result                                                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spanish/default and OTP failure | Enter Ana's phone, request code, submit 000000 → actionable Spanish error; change to 123456 → Ana selected automatically. PASS. [Error](auth-invalid-otp.png), [Ana](auth-ana.png)                         |
| SecureStore resume offline      | With Ana authenticated, enable airplane mode, force-stop Expo Go (previous PID 7578), reopen identity link → Ana restored without OTP. Airplane setting read as 1. PASS. [Resume](auth-offline-resume.png) |
| Shared phone                    | Sign out, sign in with phone 2/123456 → picker offers only Bruno/Carla. Choose Carla → Carla; switch → picker; choose Bruno → Bruno. PASS. [Picker](auth-worker-picker.png), [Carla](auth-carla.png)       |
| Large text                      | Set font_scale=1.3; reopen identity; Bruno and switch/sign-out controls visible/reachable with scrolling. PASS for this screen. [Bruno](auth-bruno-large-text.png). Restore font_scale=1.0 afterward.      |
| Logout and route gate           | Sign out as Bruno, force-stop, reopen /identity → Spanish sign-in, no previous identity. PASS. [Gate](auth-route-gate.png)                                                                                 |

UI hierarchy XML accompanies the screenshots. Keyboard dismissal and scrolling were exercised for both forms; code submission recovered after the invalid attempt. The full eight worker journeys, camera/file capture, all-screen large-text audit, iOS, device reboot and EAS builds are NOT RUN here. Expiry/queue preservation is automated real-HTTP evidence, not a new native scenario-8 pass. Airplane mode was disabled after the resume test; font scale restored to its original 1.0.

During development, cached Router types required regeneration after adding routes, i18next's current option is initAsync, and RNTL 14 requires awaited render/events. Editing a combined context/provider module caused a Fast Refresh context mismatch; context/hooks now live in a stable separate module, and cold-launch behavior passed. Navigation group labels were replaced with localized screen titles. None of these corrections is claimed as human-recorded Recording B evidence.

Quality checks passed locally: TypeScript, ESLint, Prettier, architecture boundaries, all 88 tests, Expo dependency/config validation, Expo Doctor 20/20, Android production JavaScript export and strict OpenSpec validation. Spanish/English key parity passed for all 40 resource keys. Hosted CI is recorded separately at PR handoff.
