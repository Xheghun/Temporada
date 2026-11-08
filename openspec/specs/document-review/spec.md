# document-review Specification

## Purpose

Provide document states and correction history while preserving durable intent, worker isolation and truthful worker-visible status.

## Requirements

### Requirement: Honest document states M4
The system MUST distinguish Not Submitted, Pending Sync, Pending Review, Approved and Correction Requested. Delivery acknowledgment MUST resolve delivery and initialize Pending Review only if no newer review revision is known. It MUST preserve newer staff decisions and correction reasons for the same submission, never infer approval. Local delivery failures MUST be visible without overwriting historical staff decisions.

#### Scenario: Acknowledged upload
- **WHEN** a queued upload receives 201 or a successful 200 replay and no newer staff review is known
- **THEN** that submission shows Pending Review and never Approved without a staff decision

### Requirement: Immutable corrections M8
Correction Requested MUST display the server reason and allow a new submission with a new action ID. Prior submissions and their decisions MUST remain distinguishable. A late staff decision on an older submission MUST NOT overwrite a newer submission's state.

#### Scenario: Carla resubmits
- **WHEN** Carla sees Foto borrosa, vuelva a tomarla and submits a replacement passport
- **THEN** the old correction remains historical and a distinct new action shows Pending Sync, then Pending Review after acknowledgment

#### Scenario: Older decision arrives after new capture
- **WHEN** staff reject an older passport while a newer passport is queued
- **THEN** the rejection stays attached to the older submission and the newer one remains visibly pending

### Requirement: Delivery and review presentation
Documents SHALL render catalog rows with distinct labels for not submitted, saved locally, sending, retry scheduled, sent awaiting review, approved, correction requested, permanent failure and refresh required. Delivery and review SHALL remain independent; local delivery problems MUST NOT erase known staff decisions or reasons.

#### Scenario: Delivery transitions
- **WHEN** an upload moves from queued to sending, retry wait and acknowledged delivery
- **THEN** labels respectively explain saved locally, sending, saved with automatic retry and sent waiting for staff review; approval appears only with actual staff evidence

#### Scenario: Newer review with replay
- **WHEN** a cached staff decision precedes a replay receipt or a local delivery failure
- **THEN** the staff decision remains attached to its submission and delivery feedback is shown independently without overriding the decision

### Requirement: Required submitted count
The document list SHALL explain that its submitted count means current required submissions with server delivery evidence. Local queued, sending, retrying, permanently failed, superseded or unresolved submissions MUST NOT contribute. Delivery count MUST NOT be described as approval or task completion.

#### Scenario: Mixed current submissions
- **WHEN** three required documents have a queued upload, a delivered pending review submission and a delivered correction request
- **THEN** the count is two of three sent, the queued item is clearly local, and the correction remains action needed despite being counted as sent

#### Scenario: Failed replacement
- **WHEN** an older delivered submission has a current failed replacement
- **THEN** the older historical submission does not inflate the current submitted count and the replacement failure remains actionable

### Requirement: Secondary immutable history
Current correction requests SHALL show the actual staff reason and an obvious supported replacement action. Prior submissions SHALL be collapsed by default and available through an accessible history control. Expanding history MUST preserve submission identity, decisions and replacement relationships without exposing raw identifiers.

#### Scenario: Replacement with historical correction
- **WHEN** a new replacement is queued after staff request correction
- **THEN** the current row shows saved locally, its prior correction remains in collapsed expandable history, and a late decision on the older submission cannot change the replacement’s status

### Requirement: Compact reference document list
Documents SHALL show the reference's prominent required submitted-count summary, compact numbered divider rows, localized state/action cues and tinted offline note. Ordinary rows SHALL avoid separate full-width action buttons; correction/error/history states MAY expand when needed. Submitted count and staff-decision semantics MUST remain unchanged.

#### Scenario: Compact list with correction recovery
- **WHEN** a mixed document catalog is compared against 03_documents.png
- **THEN** the count summary and ordinary row density follow the reference, actionable rows open only supported capture flows, and a correction shows its verbatim reason with reachable replacement and collapsed history
- **AND** visual simplification never hides a permanent delivery failure or implies approval from delivery
