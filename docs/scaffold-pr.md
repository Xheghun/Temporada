# SDD-001 Establish Expo scaffold and validation/build pipelines

## Problem and resulting behavior

The repository had only planning artifacts. This change adds a runnable Expo Router/TypeScript baseline and a repeatable validation/build setup, so later worker features can be delivered through separate reviewed PRs. Scope: project-scaffold; SDD-001–003/018; R-ANDROID/R-QUALITY/R-GOV/R-TIME.

The only screen is a Spanish welcome route. There is no authentication, backend, assignment/terms/document UI, outbox or synchronization implementation.

## Implementation and decisions

- Expo SDK 58, React Native 0.88.1 and React 19.3.0; SDK-selected native packages and lockfile. Native stack, safe-area-aware scrolling and small design tokens. New Architecture is the SDK baseline.
- Strict TypeScript, Expo ESLint/Jest, Prettier and an AST-based boundary/cycle checker. React Native Testing Library is installed for future UI tests. Fail-closed remote flag interface is unit-tested; no remote service/product behavior is enabled.
- GitHub Actions validates PRs/main, checks ticket/branch/commit naming and exports Android JavaScript. Manual/main-only EAS build definitions cover Android/iOS development, internal preview and production; no submission or OTA action runs automatically.
- Guidance, PR template, contribution process, real evidence, recording checklist and cumulative time ledger preserve the independent change/branch/PR workflow. No API or business schema is introduced.

## Executed verification

- Clean npm ci (temporary cache used because shared cache had inaccessible entries).
- typecheck, lint, format:check, arch:check, test:ci: PASS (9 flag cases + 5 architecture cases).
- Expo dependency/config checks: PASS; Expo Doctor 20/20.
- Android export: PASS. Small_Phone emulator Android 16/API 36 at 360dp: Expo Go welcome route visually verified, including font_scale 1.3; screenshots/UI hierarchy under docs/evidence. Error logs inspected with no ReactNativeJS/AndroidRuntime errors.

## Risks and human review

No worker workflow or persistence guarantee has been verified; mandatory sync tests/manual scenarios remain future work. Hosted CI validation is running on PR #1; cloud builds are NOT RUN. EAS ownership/signing and protected environments need human setup; package IDs are provisional. Recording B capture schedule is pending. Review the static checker limits, build environment protection setup and external main branch protections. Original assessment is still pending comparison.

This PR requires human review/merge. Do not auto-start another OpenSpec change after preparing it. No approval or release is claimed.
