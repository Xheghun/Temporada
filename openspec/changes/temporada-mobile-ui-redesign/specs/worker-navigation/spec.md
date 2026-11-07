# Worker navigation delta

## Purpose

Provide clear primary destinations and contextual return paths without exposing unavailable features or another worker’s information.

## ADDED Requirements

### Requirement: Primary and secondary destinations
Authenticated workers SHALL have Home, Documents and My Job primary destinations with restrained bottom navigation. Terms, capture and identity management SHALL use contextual back navigation without competing bottom navigation. Every enabled control MUST perform its advertised action.

#### Scenario: Primary navigation and return
- **WHEN** a worker opens Documents, starts capture and returns
- **THEN** capture has no bottom navigation and returns to Documents; primary destinations indicate their selected state and preserve reachable content above safe areas

#### Scenario: Unavailable destination
- **WHEN** the relevant remote feature flag is missing, false or unavailable
- **THEN** the destination is omitted or explicitly unavailable, its deep link is guarded and no enabled-looking control promises unavailable functionality

### Requirement: Session scoped navigation
Navigation SHALL preserve authentication gates and immediately clear prior-worker content when switching identities. Back navigation and late asynchronous results MUST NOT restore the previous worker’s data. Switching and logout MUST preserve durable pending actions and files.

#### Scenario: Shared phone switch during capture
- **WHEN** Carla has pending work and switches to Bruno while a prior picker or assignment read completes
- **THEN** Bruno sees only his data, prior results cannot repopulate the view and Carla’s durable work is restored when she returns
