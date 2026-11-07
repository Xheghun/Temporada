# offline-intent Specification

## Purpose

Provide worker-scoped persistence and durable intent while preserving durable intent, worker isolation and truthful worker-visible status.

## Requirements

### Requirement: Durable offline intent M1 M2
Terms confirmation and document submission MUST persist local intent before network delivery. Business state and queued intent MUST commit together. Actions MUST survive process death, restart and same-worker logout/login. Interrupted deliveries MUST be recoverable.

#### Scenario: Offline enqueue TEST-01
- **WHEN** a worker confirms terms and submits a durable image offline
- **THEN** both actions immediately show Pending Sync and deliver after connectivity returns

#### Scenario: Process recovery TEST-02
- **WHEN** storage is reopened after termination with queued or interrupted actions
- **THEN** the original payloads, worker ownership, files and action IDs remain recoverable
