# Contribution workflow

Use the explicitly named change in specs/tasks.md. Scaffold first; a new descriptive branch and PR for every subsequent feature, starting from reviewed merged main. Ticketed branches: chore/SDD-001-project-scaffold, feature/SDD-008-offline-sync, fix/SDD-016-offline-integration. SDD IDs are provisional local tickets. Commit messages and PR titles include the ticket. Never use AI branding in branch names.

Run npm run typecheck, lint, format:check, arch:check, test:ci, expo:check and config:check. Run npx expo-doctor and Android export/startup where applicable. Add tests/docs with the behavior they verify. No fake tests, swallowed errors or claimed unexecuted passes.

Write PR descriptions directly: what changed, what was tested, and what still needs work. Include tickets, requirements and API/schema decisions when they help review. Avoid generic “Problem and resulting behavior” or “Risks and code review” headings, repeated disclaimers, line-by-line diff narration and conversational history. This is the default, without a separate reminder.

Repository administrator must protect main: require Validate / validate, at least one approval, dismiss stale approvals, restrict direct pushes and prevent bypass. CI naming checks do not replace these settings. Backend contract integration, security changes, signing credentials and releases need approval. No automated merge or direct main pushes.

Build workflow is manually dispatched on reviewed main. Configure development/preview/production environments, restrict deployment branches to main, and require environment approval (especially production). Set Expo owner/project ID as environment variables and Expo token as an environment secret after authorized account/signing setup. No credentials in prompts/source. No cloud build or store submission is implied by workflow existence. OTA requires runtime/native compatibility; installed incompatible native binaries need a corrected store binary.

Write documentation and PR descriptions from the maintainer’s perspective. State current behaviour and technical reasons directly; use first person for decisions and personal testing. Do not narrate conversations with phrases such as “the user requested” or “the user decided”. Omit decision dates, permission exchanges and tool-session details unless they are needed to understand a requirement or reproduce a failure. Keep timing evidence in the coding ledger and preserve accurate AI-workflow disclosure.
