# Home and terms delta

## MODIFIED Requirements

### Requirement: Cached Home and exact-version terms
The worker SHALL see cached identity, assignment, relevant connectivity and delivery information, navigation and a meaningful next action on Home instead of a static timeline. Terms SHALL display the exact cached version and allow durable offline confirmation. A stale version SHALL require explicit new confirmation without blocking its replacement.

#### Scenario: Offline Home and replacement terms
- **WHEN** Ana opens cached Home offline and confirms v2 before the server publishes v3
- **THEN** local intent shows Pending Sync; after rejection and refresh v3 requires explicit confirmation and its new action can deliver without superseding v2


#### Scenario: Explicit recovery from a permanent terms failure
- **WHEN** a v2 confirmation fails permanently and the worker explicitly reconfirms the displayed v2 or refreshed v3
- **THEN** the failed predecessor is superseded atomically with a new intent/action ID, and the replacement can deliver without restarting the engine
- **AND** refresh alone does not replace the failure, duplicate taps create one successor, and a failed local replacement leaves the predecessor and queue unchanged

## ADDED Requirements

### Requirement: Meaningful Home next action
Home SHALL derive one featured action from current worker state: actionable current terms first, required correction second, missing required document third, then other permanent document failure. Queued work requiring no input MUST NOT become a new task. Disabled features MUST NOT offer enabled actions; unavailable or uncertain data MUST NOT imply completion.

#### Scenario: Task priority and deterministic selection
- **WHEN** current terms need explicit confirmation and multiple required documents need work
- **THEN** Home offers terms review first; after resolution it selects corrections, missing documents and other permanent failures in that order, using catalog order within each priority

#### Scenario: Queued waiting and complete states
- **WHEN** no input is needed and current required work is queued, awaiting review or entirely accepted and approved
- **THEN** Home respectively explains local sending progress, waiting for staff review or no further action; it never asks for duplicate submission or equates delivery with approval

#### Scenario: Refresh required or feature unavailable
- **WHEN** cached state requires refresh or a required action’s feature is unavailable
- **THEN** Home explains the limitation and offers only supported recovery, without claiming everything is complete or providing an inert CTA

### Requirement: Personal cached Home and job details
Home SHALL greet the selected worker by their actual name, calculate any time-based greeting using device local time, show catalog document rows and a secondary job summary. My Job SHALL show only cached employer, worksite, reference, season dates and an available terms link, with localized values and honest loading, empty, stale and offline states.

#### Scenario: Cached assignment and no cache
- **WHEN** a worker opens Home or My Job offline
- **THEN** valid cached content remains usable without blocking loaders, stale content is labeled honestly and absent assignment data shows an offline empty state without fixture details

### Requirement: Readable exact-version review
Terms SHALL present the current cached version, actual localized summary, confirmation status and meaning, with a single prominent confirmation action only when allowed. Historical stale versions SHALL remain accessible but secondary. A summary MUST NOT be described as a complete legal document.

#### Scenario: Pending confirmation and changed terms
- **WHEN** a worker confirms the displayed version offline and later receives a stale-version result
- **THEN** the first state says saved locally and waiting to send, duplicate pending confirmation is prevented, and the refreshed version requires explicit new confirmation without erasing history or claiming acceptance
