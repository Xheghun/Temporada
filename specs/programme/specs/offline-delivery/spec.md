> Programme reference only: split into independently applied changes; see specs/tasks.md. No whole-application apply target exists.

# Offline delivery

## Purpose

Preserve worker intent through disconnection and termination while preventing duplicate effects and misleading acceptance states.

## ADDED Requirements

### Requirement: Durable offline intent M1 M2
Terms confirmation and document submission MUST persist local intent before network delivery. Business state and queued intent MUST commit together. Actions MUST survive process death, restart and same-worker logout/login. Interrupted deliveries MUST be recoverable.

#### Scenario: Offline enqueue TEST-01
- **WHEN** a worker confirms terms and submits a durable image offline
- **THEN** both actions immediately show Pending Sync and deliver after connectivity returns

#### Scenario: Process recovery TEST-02
- **WHEN** storage is reopened after termination with queued or interrupted actions
- **THEN** the original payloads, worker ownership, files and action IDs remain recoverable

### Requirement: Exactly-once business effect M3
The client MUST persist a stable clientActionId before sending and reuse it on retries. The server MUST durably deduplicate by worker and action ID, atomically with the business effect. Reuse with different content MUST fail explicitly.

#### Scenario: Commit with lost response TEST-03
- **WHEN** the server commits an action, drops its response, restarts and receives the retry
- **THEN** one business record exists and the replay returns the original successful result

### Requirement: Classified nonblocking retries M5
Transient network errors and 5xx MUST use bounded exponential backoff with jitter and persisted eligibility. 413 and 422 MUST stop automatic retries and expose recovery. A failed action MUST NOT indefinitely block unrelated actions. Concurrent triggers MUST NOT send an action concurrently.

#### Scenario: Response classification TEST-04
- **WHEN** separate actions receive 500, 413 and 422
- **THEN** 500 schedules a retry, the others require user resolution, and unrelated eligible actions proceed

#### Scenario: Concurrent triggers
- **WHEN** startup and connectivity restoration trigger synchronization together
- **THEN** each action has at most one concurrent delivery attempt

### Requirement: Version-specific terms M6
Acceptance MUST reference the exact displayed termsVersionId. Stale acceptance MUST leave active delivery, remain historically invalid, fetch current terms and require explicit reconfirmation. New terms MUST never be accepted automatically. Stale actions MUST count as resolved for ordering, allowing a newly confirmed version to proceed without superseding the stale action.

#### Scenario: Stale terms TEST-05
- **WHEN** v2 is queued offline and v3 is published before delivery
- **THEN** v2 is rejected, v3 is fetched, and v3 remains unaccepted until a new explicit action

#### Scenario: Replacement terms deliver after stale rejection
- **WHEN** queued v2 receives stale_terms, v3 is fetched, and the worker explicitly confirms v3 with a new action ID
- **THEN** v3 delivers successfully without superseding v2, v2 remains historical and invalid, and only v3 is newly accepted


### Requirement: Reliable synchronization opportunities
The system MUST request synchronization at startup, foreground entry, connectivity restoration, authentication, worker selection, manual retry and persisted retry eligibility. It MUST treat connectivity as a hint and background execution as best effort.

#### Scenario: Restart during backoff
- **WHEN** the app restarts before a persisted retry is eligible
- **THEN** the eligibility survives and delivery is requested when due while execution is available
