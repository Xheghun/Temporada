> Programme reference only: split into independently applied changes; see specs/tasks.md. No whole-application apply target exists.

# Worker documents

## Purpose

Guide workers through durable document capture and corrections while preserving submission history and staff decision ownership.

## ADDED Requirements

### Requirement: Guided durable capture M7
Required document types MUST come from the server catalog. Workers MUST be able to capture or select, preview and retake images. Before queueing, compressed output MUST be verified below 1,500,000 bytes and copied to private durable storage. App-created full-resolution copies MUST be removed after successful compression; user-owned gallery originals MUST remain untouched.

#### Scenario: Offline capture
- **WHEN** a valid catalog image is compressed and submitted offline
- **THEN** verified compressed bytes exist outside cache before Pending Sync appears and remain available after restart

#### Scenario: Storage or compression failure
- **WHEN** compression, durable copy or database commit fails
- **THEN** no misleading queued submission appears, a recovery instruction is shown and unreferenced app files are safely cleaned

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

### Requirement: Safe file lifecycle M2 M7
Pending upload bytes MUST remain until acknowledgment or explicit resolution. Missing references MUST become actionable local failures. Cleanup MUST NOT delete referenced pending files or expose files across workers.

#### Scenario: Interrupted file and database sequence
- **WHEN** the app restarts after copying a file but before committing its reference
- **THEN** recovery can remove the orphan safely without deleting any committed pending upload

### Requirement: Replay preserves newer staff decisions M4
Delivery and review MUST merge independently by submission identity. An older replay acknowledgment MUST NOT overwrite a newer review revision. Equal revisions MUST agree; missing or incomparable revisions MUST preserve known staff decisions and trigger refresh.

#### Scenario: Lost response followed by staff decision and replay
- **WHEN** an upload commits, its response drops, staff approve or request correction, a refresh caches that decision, and the original upload replay returns
- **THEN** delivery becomes resolved, the newer decision/reason/revision remains visible, and exactly one server submission exists
