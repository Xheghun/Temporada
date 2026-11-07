# worker-home-and-terms Specification

## Purpose

Provide cached home and versioned terms while preserving durable intent, worker isolation and truthful worker-visible status.

## Requirements

### Requirement: Cached Home and exact-version terms
The worker SHALL see cached identity, assignment, known timeline, connectivity, pending counts and navigation on Home. Terms SHALL display the exact cached version and allow durable offline confirmation. A stale version SHALL require explicit new confirmation without blocking its replacement.

#### Scenario: Offline Home and replacement terms
- **WHEN** Ana opens cached Home offline and confirms v2 before the server publishes v3
- **THEN** local intent shows Pending Sync; after rejection and refresh v3 requires explicit confirmation and its new action can deliver without superseding v2


#### Scenario: Explicit recovery from a permanent terms failure
- **WHEN** a v2 confirmation fails permanently and the worker explicitly reconfirms the displayed v2 or refreshed v3
- **THEN** the failed predecessor is superseded atomically with a new intent/action ID, and the replacement can deliver without restarting the engine
- **AND** refresh alone does not replace the failure, duplicate taps create one successor, and a failed local replacement leaves the predecessor and queue unchanged
