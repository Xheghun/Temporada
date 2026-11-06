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

- Xheghun/Temporada is confirmed empty, with no default branch. Origin is configured. No branch has been pushed, no hosted PR exists and hosted CI has NOT RUN. A reviewable local scaffold commit and PR body are prepared; one-time main bootstrap requires explicit authorization because normal workflow forbids direct main pushes.
- SDD-001 remains partial: Recording B checklist is prepared, but human capture schedule is unconfirmed. Proposal is later offline-sync; actual human recording is required, never fabricated.
- SDD-018 remains partial until the real scaffold PR exists. Human review/merge, branch protections, build environment reviewers, Expo owner/project/credentials and signing setup remain pending external work.
- EAS cloud Android/iOS builds, store release and OTA execution NOT RUN. Workflow configuration alone proves none of these.
- All worker scenarios, mandatory six sync tests and TEST-03R remain NOT RUN; backend, durable domain storage, sync, auth and documents belong to later changes.
- Android 9/2 GB behavior, iOS runtime and full bilingual/a11y worker UI are unverified. App identifiers are provisional.

Tracked progress at local handoff: 3/5. SDD-002 and SDD-003 are verified/committed; PR preparation task is complete with explicit remote-base blocker. SDD-001 remains unchecked for human recording schedule; SDD-018 remains unchecked for actual hosted PR. Scaffold commit: 293eef6; planning-only local main baseline: 071f2c3. No main push is authorized or performed.
