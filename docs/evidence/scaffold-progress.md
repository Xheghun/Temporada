# Scaffold verification — project-scaffold

Scope: SDD-001/002/003/018, R-ANDROID, R-QUALITY, R-GOV, R-TIME. No worker feature is implemented. Git access was initially denied; user enabled filesystem access and work resumed on chore/SDD-001-project-scaffold.

## Environment

2026-11-06; macOS arm64; Node 24.11.1; npm 11.6.2; Expo 58.0.23; React Native 0.88.1; React/React DOM 19.3.0. SDK-selected Router/native package versions are locked in package-lock.json. Source compatibility: https://docs.expo.dev/versions/latest/ and https://docs.expo.dev/router/installation/.

Android: Small_Phone AVD, emulator-5554, Android 16/API 36, 720×1280 physical pixels at 320 dpi (360×640 dp). Started SDK emulator, verified boot_completed=1 and ran scaffold in Expo Go. No signed development/production binary is claimed.

## Executed verification

| Check                                          | Actual result                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Git initialization / branch                    | PASS; local planning baseline committed; scaffold branch created                                                   |
| npm install                                    | PASS after temporary cache and SDK-compatible React DOM pin                                                        |
| npm ci --cache /private/tmp/seasonal-npm-cache | PASS; lockfile clean install                                                                                       |
| npm run typecheck                              | PASS after adding Jest/Node types                                                                                  |
| npm run lint                                   | PASS                                                                                                               |
| npm run format:check                           | PASS                                                                                                               |
| npm run arch:check                             | PASS                                                                                                               |
| npm run test:ci                                | PASS: 9 feature-flag cases; 5 architecture-checker cases                                                           |
| npm run expo:check                             | PASS; dependencies up to date                                                                                      |
| npm run config:check                           | PASS; public Expo configuration resolves                                                                           |
| npx expo-doctor                                | PASS 20/20 after moving EAS CLI out of local dependencies                                                          |
| npx expo export --platform android             | PASS; Android Hermes JS bundle generated in ignored dist/                                                          |
| Expo Go Android startup                        | PASS; Metro bundles entry; welcome text visible; Expo experience is resumed activity                               |
| 360dp / large text                             | PASS for scaffold content at font_scale 1.0 and 1.3; screenshot inspected, no text clipping; scale restored to 1.0 |
| Error logs                                     | No ReactNativeJS/AndroidRuntime error entries in inspected logcat output                                           |
| git diff --check                               | PASS                                                                                                               |

Evidence: scaffold-android.png/scaffold-screen.xml and scaffold-large-text.png/scaffold-large-text.xml. These prove only the minimal welcome layout/startup, not offline worker flows. Metro/export command logs were inspected in temporary storage. No recording is claimed.

## Real corrections

Shared npm cache had inaccessible entries; used a temporary cache without changing ownership. Npm auto-selected React DOM 19.3.1 against React 19.3.0; pinned SDK-compatible 19.3.0 without force/legacy-peer-deps. Added explicit Jest types after typecheck failure. Expo Doctor rejected local eas-cli; removed it and pinned the workflow's npx invocation. Reverted unrelated formatting-only changes to existing specs. Corrected Android deep-link invocation to avoid shell interpretation of URL query separators.

## Remaining gates and limitations

- User explicitly authorized the one-time repository bootstrap: main contains planning-only baseline 071f2c3. Scaffold branch is pushed and PR https://github.com/Xheghun/Temporada/pull/1 is open. GitHub Actions Validate started; result pending at this update. No merge or release performed.
- SDD-001 remains partial: Recording B checklist is prepared, but human capture schedule is unconfirmed. Proposal is later offline-sync; actual human recording is required, never fabricated.
- SDD-018 is complete with the actual scaffold PR open and local checks recorded. Human review/merge, branch protections, build environment reviewers, Expo owner/project/credentials and signing setup remain pending external work.
- EAS cloud Android/iOS builds, store release and OTA execution NOT RUN. Workflow configuration alone proves none of these.
- All worker scenarios, mandatory six sync tests and TEST-03R remain NOT RUN; backend, durable domain storage, sync, auth and documents belong to later changes.
- Android 9/2 GB behavior, iOS runtime and full bilingual/a11y worker UI are unverified. App identifiers are provisional.

Tracked progress after authorized bootstrap/PR creation: 4/5. SDD-002/003/018 and PR preparation are complete. SDD-001 remains unchecked solely for the unconfirmed human recording schedule. Scaffold implementation commit: 293eef6; Android evidence commit: 4f16274; planning-only main baseline: 071f2c3. The one-time baseline push was expressly approved; no scaffold code was pushed directly to main.
