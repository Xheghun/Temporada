# Home brief compliance delta

## MODIFIED Requirements

### Requirement: Cached Home and exact-version terms
The worker SHALL see cached identity, assignment, known timeline, connectivity, pending counts and navigation on Home. Terms SHALL display the exact cached version and allow durable offline confirmation. A stale version SHALL require explicit new confirmation without blocking its replacement.

#### Scenario: Offline Home and replacement terms
- **WHEN** Ana opens cached Home offline and confirms v2 before the server publishes v3
- **THEN** local intent shows Pending Sync; after rejection and refresh v3 requires explicit confirmation and its new action can deliver without superseding v2


#### Scenario: Explicit recovery from a permanent terms failure
- **WHEN** a v2 confirmation fails permanently and the worker explicitly reconfirms the displayed v2 or refreshed v3
- **THEN** the failed predecessor is superseded atomically with a new intent/action ID, and the replacement can deliver without restarting the engine
- **AND** refresh alone does not replace the failure, duplicate taps create one successor, and a failed local replacement leaves the predecessor and queue unchanged

## ADDED Requirements

### Requirement: Always visible synchronization summary
Home SHALL show explicit Online or Offline text and the selected worker's numeric pending-action count in both states. Pending includes queued, sending and retry-wait terms and documents; failed, stale, delivered and superseded actions are excluded. Loading or failed reads MUST NOT be presented as a known zero. Connectivity MUST NOT imply delivery.

#### Scenario: Loaded zero and mixed queue
- **WHEN** loaded Home has zero or several queued/sending/retry-wait actions with historical delivered/stale/failed actions
- **THEN** it shows the exact active count, including explicit zero, in either network state and keeps attention-needed failures separate

#### Scenario: Connectivity restoration and server failure
- **WHEN** connectivity changes while the backend remains unavailable
- **THEN** the indicator follows native connectivity promptly but pending actions remain counted until their persistent state resolves

### Requirement: Assignment and current terms on Home
Home SHALL directly show cached employer, worksite, season dates, job-order reference, current terms version, actual localized terms summary and truthful terms status. These facts SHALL NOT require navigation or expanding collapsed content. Dates SHALL preserve date-only meaning; detail screens and existing actions remain available.

#### Scenario: Cached offline overview
- **WHEN** an authorized worker opens Home offline after caching assignment data
- **THEN** assignment details and current terms/version/status are readable on the scrollable Home itself, and queued confirmation remains local until server evidence acknowledges it

#### Scenario: Absent cache and unavailable refresh
- **WHEN** Home has no cached assignment or a refresh fails
- **THEN** it shows an explicit empty/error or cached-stale explanation without fabricated dates, terms or approval, while any independently loaded pending count remains accurate

### Requirement: Factual progress timeline
Home SHALL provide an always-expanded simple milestone timeline for terms confirmation, required-document delivery and staff review. It SHALL use current worker/version/submission facts, clearly separating local saving from server acknowledgment and review decisions. Missing or uncertain data MUST NOT appear complete. No event times or appointment steps may be invented.

#### Scenario: Offline and reviewed progress
- **WHEN** terms/documents are queued, delivered or reviewed
- **THEN** the timeline distinguishes saved/waiting to send, acknowledged/waiting for review, approved and correction-needed states, with a correction on an older submission remaining historical

#### Scenario: Stale terms and replacement
- **WHEN** v2 becomes stale and current cached v3 awaits explicit confirmation, or an older document has a newer local replacement
- **THEN** the relevant milestone requires action or shows the replacement pending; historical acceptance/review cannot mark the current work complete

### Requirement: Accessible worker-scoped Home overview
All required Home facts SHALL remain readable in English and Spanish at 360dp with 130-percent text scaling. The sync summary SHALL sit near the top; remaining sections may scroll but MUST NOT be hidden behind navigation or disclosure. Worker switches SHALL clear prior data immediately and late updates MUST NOT restore it.

#### Scenario: Large text and identity switch
- **WHEN** Carla's pending Home is viewed with large Spanish text and switches to Bruno
- **THEN** wrapping/scrolling keeps controls and required facts reachable, and Bruno sees only his own count, assignment, terms and milestones
