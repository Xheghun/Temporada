# Contribution workflow

Use the explicitly named change in specs/tasks.md. Scaffold first; a new descriptive branch and PR for every subsequent feature, starting from human-reviewed merged main. Ticketed branches: chore/SDD-001-project-scaffold, feature/SDD-008-offline-sync, fix/SDD-016-offline-integration. SDD IDs are provisional local tickets. Commit messages and PR titles include the ticket. Never use AI branding in branch names.

Run npm run typecheck, lint, format:check, arch:check, test:ci, expo:check and config:check. Run npx expo-doctor and Android export/startup where applicable. Add tests/docs with the behavior they verify. No fake tests, swallowed errors or claimed unexecuted passes.

PR descriptions lead with the concrete problem/result, reference requirements, explain material decisions/API/schema impact and list actual verification, Android evidence and remaining limitations. Avoid repeating each changed line or conversational history. Use the PR template as a guide, not filler.

Repository administrator must protect main: require Validate / validate, at least one human approval, dismiss stale approvals, restrict direct pushes and prevent bypass. CI naming checks do not replace these settings. Backend contract integration, security changes, signing credentials and releases need human approval. No automated merge or direct main pushes.

Build workflow is manually dispatched on reviewed main. Configure development/preview/production environments, restrict deployment branches to main, and require human environment approval (especially production). Set Expo owner/project ID as environment variables and Expo token as an environment secret after authorized account/signing setup. No credentials in prompts/source. No cloud build or store submission is implied by workflow existence. OTA requires runtime/native compatibility; installed incompatible native binaries need a corrected store binary.
