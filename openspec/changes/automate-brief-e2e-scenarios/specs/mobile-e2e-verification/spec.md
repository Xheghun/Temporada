# Mobile E2E verification delta

## Purpose

Provide repeatable device-driven checks for the seasonal worker brief, with isolated fictional data, observable failure outcomes and measured device results.

## ADDED Requirements

### Requirement: Original brief scenario coverage
The automated Android suite SHALL execute each of the eight scenarios in the original brief. Each scenario MUST have independent setup, visible UI assertions and the corresponding server or persistence assertions. A skipped step or infrastructure failure MUST remain explicit in the result.

#### Scenario: Brief 1 Spanish sign-in and English selection
- **WHEN** Ana signs in on a fresh installation and changes the language from Home
- **THEN** Spanish appears initially and English appears across the exercised screens, including queued, retry, error and review messages
- **AND** the saved choice survives restart while server correction text remains verbatim

#### Scenario: Brief 2 Airplane mode and process restart
- **WHEN** Ana confirms terms and captures her passport in airplane mode, then the app is force-stopped and reopened offline
- **THEN** both actions remain pending with their original identifiers and the private compressed image remains intact
- **AND** after connectivity returns each action has one server effect and the passport shows Pending Review

#### Scenario: Brief 3 Committed upload with dropped response
- **WHEN** the server saves Ana’s DS-160 upload and drops its response before acknowledgment
- **THEN** the app retries the same action identifier, one server submission and receipt exist, and the UI reaches Pending Review

#### Scenario: Brief 4 Unconfirmed stale terms
- **WHEN** Ana opens v2 offline without confirming, the mock publishes v3, and she then confirms v2 offline and reconnects
- **THEN** the server records no v2 acceptance and the app displays v3 awaiting explicit confirmation
- **AND** confirming v3 creates a new action that delivers while stale v2 remains historical

#### Scenario: Brief 5 Permanent upload rejection
- **WHEN** the mock rejects an upload with 413 while the app uses Spanish
- **THEN** the UI explains how to retake, automatic retry stops, and an unrelated eligible action can deliver
- **AND** retaking creates a new submission and action identifier

#### Scenario: Brief 6 Transient failures and backoff
- **WHEN** seeded random 500 responses affect queued actions
- **THEN** retries respect persisted backoff, the UI remains responsive to interaction, and the original actions eventually deliver once

#### Scenario: Brief 7 Carla and Bruno isolation
- **WHEN** Carla opens the shared-phone account, reads the correction reason and queues a replacement, then switches to Bruno
- **THEN** Bruno’s UI, pending count and requests contain only his work
- **AND** returning to Carla restores her pending replacement and its historical correction

#### Scenario: Brief 8 Expired authentication
- **WHEN** queued work encounters an expired session and the worker authenticates again
- **THEN** pending actions and files retain their identifiers and integrity, delivery stays paused until authorization, and the queue resumes for the selected worker

### Requirement: Isolated repeatable execution
Every scenario SHALL use a fresh fictional backend namespace and a controlled initial app state. The harness MUST preserve storage within restart and reauthentication journeys, restore network/failure settings on exit and return a failing result for failed assertions. Retries of the test harness MUST retain the first failure.

#### Scenario: Independent reruns
- **WHEN** a scenario is run individually or in a different suite order
- **THEN** its initial terms, workers, language, sessions and submissions match its fixture without deleting unrelated local data

#### Scenario: Interrupted run cleanup
- **WHEN** a run fails while airplane mode or a mock failure is active
- **THEN** cleanup restores device settings, stops owned processes and retains failure artifacts

### Requirement: Independent native persistence and delivery evidence
A scenario pass SHALL require the relevant visible outcome and durable evidence. Offline persistence checks MUST inspect real device storage, action identifiers and image integrity. Duplicate-prevention checks MUST count server business effects by worker/action identity. Backend observations SHALL use a token-free allowlist.

#### Scenario: Local intent survives before delivery
- **WHEN** the process-restart journey is inspected before and after force-stop
- **THEN** the saved action identifiers match, the private upload exists below 1,500,000 bytes with the same digest, and the server has no premature acceptance or submission

#### Scenario: UI succeeds but backend effects disagree
- **WHEN** the UI reaches Pending Review but duplicate server effects exist
- **THEN** the scenario fails with the mismatched counts recorded

### Requirement: Supplemental synchronization regression coverage
The suite SHALL retain TEST-01–06 and TEST-03R coverage and add device journeys for 422 rejection, persisted backoff after restart, logout retention and replay after a newer staff decision. Test setup MUST exercise the ordinary queue and transport path.

#### Scenario: Permanent validation failure
- **WHEN** the server returns 422 for one upload while another resource is eligible
- **THEN** the failed upload awaits correction without automatic retry and the unrelated work proceeds

#### Scenario: Newer staff decision before replay acknowledgment
- **WHEN** a dropped upload response is followed by a newer cached staff decision and then the original receipt arrives
- **THEN** delivery resolves while the newer decision, reason and revision survive another process restart

#### Scenario: Restart and logout during pending work
- **WHEN** pending work is in backoff and the app restarts or the worker signs out
- **THEN** the action, file and retry eligibility persist and sending resumes only when the authorized worker and deadline allow it

### Requirement: Test build isolation
Device tests SHALL run a bundled application that can cold-start offline with deterministic test configuration. Local fixtures and diagnostic controls MUST be restricted to a distinct E2E build identity. Production builds MUST retain HTTPS validation and fail-closed remote feature flags.

#### Scenario: Offline cold start
- **WHEN** the E2E app is launched after force-stop with networking disabled
- **THEN** cached screens and pending actions load without a development server or configuration request

#### Scenario: Production configuration rejects test controls
- **WHEN** E2E settings are supplied to a production build configuration
- **THEN** validation fails and the production app cannot enable local diagnostic or mock shortcuts

### Requirement: Automated CI execution and reports
CI SHALL run Android smoke journeys on PRs and the complete eight-scenario suite on main and scheduled runs. All suites SHALL support manual dispatch. iOS smoke coverage SHALL identify its executed subset. Reports MUST include scenario outcomes, build/source identity and failure artifacts, with incomplete coverage visible.

#### Scenario: PR feedback
- **WHEN** a PR changes the app, mock, E2E harness or relevant build configuration
- **THEN** the smoke suite executes on an installed app and publishes its report and failure evidence

#### Scenario: Full acceptance run
- **WHEN** the full suite runs
- **THEN** the report lists scenarios 1 through 8 individually and fails if any required scenario is failed or skipped

### Requirement: Android 9 and constrained-memory results
The low-end lane SHALL verify Android API 28 and a configured 2,048 MiB emulator, record guest memory and execute the full brief suite. It SHALL collect repeatable startup timings and sampled app memory during capture and restart. A different OS or missing measurement MUST NOT satisfy this target.

#### Scenario: Target configuration and measurements
- **WHEN** the low-end lane executes successfully
- **THEN** its artifacts identify the AVD/system image, API, configured and observed memory, build type, commit, repetitions, timing method and memory samples alongside each scenario result

#### Scenario: Unsupported runner or target
- **WHEN** the pinned automation driver cannot run on API 28 or target configuration checks fail
- **THEN** the lane fails with the exact compatibility error and the Android 9 result remains incomplete
