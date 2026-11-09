# Seasonal worker mobile application

## Scope and sources

Implement only the explicitly requested OpenSpec change; read its proposal/design/tasks and relevant root specs first. specs/tasks.md maps independent changes, branches and prerequisites. project-scaffold excludes worker features. The original assessment takes precedence when supplied; record discrepancies. Do not apply sibling changes automatically. Read applicable React Native/Expo skills for each task.

## Mandatory domain rules

- M1: offline actions save immediately before any network request.
- M2: intent and durable upload bytes survive process death/restart/logout; never clear pending data on logout.
- M3: persist one stable action UUID before sending; retries reuse it; backend deduplication is durable and atomic with effects.
- M4: Pending Sync, Pending Review and staff decisions are distinct; replay acknowledgments never overwrite newer review revisions/reasons.
- M5: retry transient failures with persisted bounded backoff/jitter; 413/422 require user correction and must not block unrelated work.
- M6: accept the exact displayed terms version; stale is resolved for ordering; explicit new confirmation can proceed without superseding stale history.
- M7: backend catalog; preview; measured compressed bytes below 1,500,000; private durable copy before transaction; safe orphan recovery.
- M8: corrections create new submissions/action IDs; preserve historical decisions by submission identity.
- M9: Spanish default, English available; preserve saved choices (user restored Spanish-first on 2026-11-09); localize app-owned strings and accessibility text, never invent translations of server free text.
- M10: worker ownership in every query/action/file/API request; server validates membership; clear view state immediately on switch and guard late results.

## Boundaries

Screens use hooks/services, never raw sync requests. Domain is independent of React/native/database APIs. Repositories and transport implement injected interfaces. Features never import another feature's private implementation. No circular dependencies. Use strict types; no unjustified any, swallowed errors, speculative frameworks or test weakening.

## Naming

Use names that explain the value or operation: `transaction`, `database`, `dependencies`, `request`, `httpResponse`, `action`, `submission`, `workerId` and `testContext`. Avoid opaque abbreviations and single-letter application/test variables. Use camelCase for values/functions, PascalCase for types/components and existing kebab-case filenames. Boolean predicates should read as predicates (`isCurrentSession`, `isSupportedImage`); parsing/validation helpers should state their purpose. Preserve external API fields, persisted schemas, protocol names and library-owned identifiers. Standard domain terms such as API, SQL, URL, UUID, OTP and i18n are acceptable when their role is clear. Read the relevant React Native/Expo skill before each applicable implementation or review task; mention the skill used in the task update.

## Task workflow and verification

Before each task read its spec; state objective/files/tests, implement the smallest coherent scope, run relevant checks, review diff, update checkbox only when fully verified and report evidence/risks. Run typecheck, lint, format:check, test:ci, arch:check and Expo validation as applicable. Domain tests ship with owning features. All six mandatory sync tests and native Android scenarios remain required before whole-app completion; never substitute mocks for actual persistence/emulator evidence. Keep unexecuted checks NOT RUN.

## Security and privacy

Only fictional assessment records. Never put tokens, credentials, signing material or real worker data in source, prompts, fixtures, logs or screenshots. SecureStore for tokens; private files for sensitive media. Mock security does not prove production security. New production behavior must fail closed behind a remote feature flag. Credentials/signing and backend contract integration need human approval.

## Git and PRs

Use chore/, feature/ or fix/ plus ticket ID and a descriptive purpose; never codex/, agents/ or any AI branding. Scaffold branch: chore/SDD-001-project-scaffold. One scoped change/feature per branch and PR, from human-reviewed merged main. No direct main push, auto-merge, invented approval or shared-history rewrite. Stop at scoped PR handoff; human-reviewed merge gates the next explicit apply. PR descriptions must use direct, concrete language: what changed, what was tested, and any remaining work. Include ticket/requirement links and technical decisions only where useful to the reviewer. Avoid generic sections such as “Problem and resulting behavior” or “Risks and human review”, repeated caveats, conversational history, and restating the diff. This is the default for every PR; do not wait for the user to request a rewrite. SDD IDs are provisional local work IDs.

## Timebox and definition of done

Maintain docs/coding-ledger.md across changes: 240-minute target, 300-minute hard coding stop, including verification/on-camera coding. Record actual tests/builds/screenshots/reviews only. Done requires implementation and executed acceptance evidence; unknown/incomplete stays explicit. Prepare Recording B before coding and arrange genuine human capture during implementation. Never fabricate recording footage or a correction. Releases progress internal → staging → approved production; compatible JS-only OTA cannot repair an incompatible native binary.
