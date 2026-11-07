# document-capture Specification

## Purpose

Provide guided capture and durable image lifecycle while preserving durable intent, worker isolation and truthful worker-visible status.

## Requirements

### Requirement: Guided durable capture M7
Required document types MUST come from the server catalog. Workers MUST be able to capture or select, preview and retake images. Before queueing, compressed output MUST be verified below 1,500,000 bytes and copied to private durable storage. App-created full-resolution copies MUST be removed after successful compression; user-owned gallery originals MUST remain untouched.

#### Scenario: Offline capture
- **WHEN** a valid catalog image is compressed and submitted offline
- **THEN** verified compressed bytes exist outside cache before Pending Sync appears and remain available after restart

#### Scenario: Storage or compression failure
- **WHEN** compression, durable copy or database commit fails
- **THEN** no misleading queued submission appears, a recovery instruction is shown and unreferenced app files are safely cleaned

### Requirement: Safe file lifecycle M2 M7
Pending upload bytes MUST remain until acknowledgment or explicit resolution. Missing references MUST become actionable local failures. Cleanup MUST NOT delete referenced pending files or expose files across workers.

#### Scenario: Interrupted file and database sequence
- **WHEN** the app restarts after copying a file but before committing its reference
- **THEN** recovery can remove the orphan safely without deleting any committed pending upload
