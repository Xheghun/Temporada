> Programme reference only: split into independently applied changes; see specs/tasks.md. No whole-application apply target exists.

# Worker experience

## Purpose

Provide an understandable bilingual offline worker journey and an honest record of tested assessment behavior.

## ADDED Requirements

### Requirement: Cached home and seven screens
The application MUST provide sign-in, OTP, conditional worker selection, Home, Terms, Documents and Capture screens. Home MUST show identity, order, employer, worksite, dates, terms, timeline, network state and worker-scoped pending count, including cached offline use.

#### Scenario: Offline cached startup
- **WHEN** an authenticated worker reopens offline after assignment caching
- **THEN** the worker's cached assignment, pending actions and navigation remain available with explicit network status

### Requirement: Spanish-first accessible language M9
Spanish MUST be the initial language and Home MUST expose English selection. All app-owned text, errors and accessibility labels MUST be localized. Unknown server free text MUST remain unchanged. Layout MUST support 360-pixel width, large text and non-color status cues.

#### Scenario: Language and large text
- **WHEN** Ana switches Spanish to English on a 360-pixel layout with large text
- **THEN** app-owned labels and states change language without clipping primary actions and server correction text remains verbatim

### Requirement: Exact fictional seed and controllable failures
The mock MUST seed JO-2026-0142, Valle Verde Farms, Yuma Arizona, March 1–July 31 2026, current terms v2 and passport, ds160_confirmation, signed_contract. Ana MUST begin unconfirmed with no documents; Bruno confirmed with passport Approved; Carla with the specified passport correction. Development controls MUST support latency, random 500, post-commit response loss, v3, forced 413 and token expiry.

#### Scenario: Failure controls
- **WHEN** each development-only failure is enabled against fictional data
- **THEN** its documented failure can be reproduced and durable business records can be inspected

### Requirement: Evidence-based delivery
The project MUST provide six mandatory sync tests, eight manual scenario records, strict quality scripts, CI/EAS configuration and required assessment documentation. Android startup and critical scenarios MUST be executed before claiming verified completion. Unexecuted checks and external approvals MUST be marked unverified. Recording B MUST be prepared before coding and captured during genuine implementation; final editing and verification MUST NOT substitute for missing capture.

#### Scenario: Assessment handoff
- **WHEN** delivery is reported
- **THEN** each requirement has evidence or an explicit incomplete status, recording materials describe actual work, and no invented builds or human sign-offs appear

### Requirement: Governed release and timebox
Coding MUST target four hours and stop at five hours with elapsed time recorded. Branches and commits MUST include a ticket ID. Main pushes, merges, backend contract changes, credentials and releases MUST follow human approval rules. New production behavior MUST be remotely flagged off by default.

#### Scenario: Release preparation
- **WHEN** release artifacts are prepared
- **THEN** internal, staging and approved production steps, native-compatible OTA limits and rollback constraints are documented without claiming execution

### Requirement: Scaffold-first feature delivery
The project MUST deliver a separately reviewed scaffold PR with linting, quality checks, GitHub Actions pipelines and build configuration before business features. Each feature MUST use a separate descriptive ticket branch and PR from reviewed main. Branches MUST exclude AI branding. Human review and merge MUST gate dependent feature work. PR descriptions MUST explain behavior, relevant decisions, actual verification and limitations concisely.

#### Scenario: Scaffold then feature PR
- **WHEN** scaffold setup is ready for review
- **THEN** its own PR contains tooling and pipeline evidence, and the next feature begins on a new branch after human-reviewed merge

#### Scenario: Feature handoff
- **WHEN** a feature is implemented and checked
- **THEN** its scoped PR records actual results, risks and requirement links without claiming unexecuted CI or human approval
