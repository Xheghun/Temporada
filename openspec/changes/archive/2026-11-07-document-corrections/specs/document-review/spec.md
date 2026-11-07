# Document states and correction history

## Purpose

Provide document states and correction history while preserving durable intent, worker isolation and truthful worker-visible status.

## ADDED Requirements

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
