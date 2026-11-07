# worker-identity Specification

## Purpose

Provide authentication and shared-phone identity while preserving durable intent, worker isolation and truthful worker-visible status.

## Requirements

### Requirement: Phone OTP authentication
The system SHALL accept a phone number, request an OTP, accept mock code 123456, and return a token and authorized workers. Invalid codes SHALL return 401 without creating a session. Tokens MUST be stored securely and excluded from ordinary records and logs.

#### Scenario: Single and shared phone identities
- **WHEN** Ana authenticates using +52 55 1000 0001
- **THEN** Ana is selected and her assignment opens
- **WHEN** +52 55 1000 0002 authenticates
- **THEN** Bruno Díaz and Carla Díaz are offered for explicit selection

#### Scenario: Incorrect OTP
- **WHEN** a code other than 123456 is verified
- **THEN** authentication fails with an actionable localized error

### Requirement: Worker authorization and isolation M10
Every record, action, image reference and authenticated worker request MUST be worker-scoped. The backend MUST reject workers outside the authenticated phone identity. Switching workers MUST immediately clear prior worker views and prevent late responses from repopulating them.

#### Scenario: Shared phone isolation TEST-06
- **WHEN** Carla queues a passport and switches to Bruno
- **THEN** Bruno cannot see Carla's data, files or pending count, and switching back restores Carla's pending action

#### Scenario: Unauthorized worker header
- **WHEN** Ana's token requests Carla using X-Worker-Id
- **THEN** the server rejects the request without disclosing Carla's records

### Requirement: Session expiry preserves intent M2
Logout and expired sessions MUST preserve queued actions and their stable identifiers. Expiry MUST pause transmission until reauthentication authorizes the same worker. Offline cached access MUST require a previously authenticated local session.

#### Scenario: Expiry and reauthentication
- **WHEN** a queued action encounters 401 and the worker signs in again
- **THEN** the queue remains durable and resumes with the original action ID only for an authorized selected worker
