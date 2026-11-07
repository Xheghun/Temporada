# offline-delivery Specification

## Purpose

Provide resilient synchronization while preserving durable intent, worker isolation and truthful worker-visible status.

## Requirements

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

### Requirement: Replay preserves newer staff decisions M4
Delivery and review MUST merge independently by submission identity. An older replay acknowledgment MUST NOT overwrite a newer review revision. Equal revisions MUST agree; missing or incomparable revisions MUST preserve known staff decisions and trigger refresh.

#### Scenario: Lost response followed by staff decision and replay
- **WHEN** an upload commits, its response drops, staff approve or request correction, a refresh caches that decision, and the original upload replay returns
- **THEN** delivery becomes resolved, the newer decision/reason/revision remains visible, and exactly one server submission exists

### Requirement: Explicit failed-action resolution
Replacing a permanently failed action MUST atomically mark that predecessor superseded and enqueue a new immutable action, scoped to the same worker/resource. History and original IDs MUST remain. Active, delivered and stale actions MUST NOT be silently superseded.

#### Scenario: Supersession survives restart
- **WHEN** a worker explicitly replaces a failed document action
- **THEN** replacement intent and predecessor supersession commit together, survive reopen and allow the replacement to deliver; rollback or a foreign-worker reference changes neither action
