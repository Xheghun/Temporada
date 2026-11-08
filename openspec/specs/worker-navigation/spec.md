# worker-navigation Specification

## Purpose

Provide clear primary destinations and contextual return paths without exposing unavailable features or another worker’s information.

## Requirements

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

### Requirement: Reference navigation and headers
Home, Documents and My Job SHALL use small outline icons with localized labels, a thin divider and restrained selected emphasis matching the supplied references, without large filled selected pills. Secondary screens SHALL use their reference-specific compact back/context header without a duplicate brand/language block. Accessible target sizes, route gates and contextual back behavior MUST remain effective.

#### Scenario: Primary and secondary visual comparison
- **WHEN** the three primary destinations, Terms, OTP and Capture are compared with their reference images
- **THEN** primary destinations expose icon-and-label navigation, secondary headers use the correct context, and extra navigation chrome does not displace reference content
