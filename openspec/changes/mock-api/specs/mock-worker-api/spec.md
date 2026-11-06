# Supporting mock API

## Purpose

Provide supporting mock api while preserving durable intent, worker isolation and truthful worker-visible status.

## ADDED Requirements

### Requirement: Exact fictional seed and controllable failures
The mock MUST seed JO-2026-0142, Valle Verde Farms, Yuma Arizona, March 1–July 31 2026, current terms v2 and passport, ds160_confirmation, signed_contract. Ana MUST begin unconfirmed with no documents; Bruno confirmed with passport Approved; Carla with the specified passport correction. Development controls MUST support latency, random 500, post-commit response loss, v3, forced 413 and token expiry.

#### Scenario: Failure controls
- **WHEN** each development-only failure is enabled against fictional data
- **THEN** its documented failure can be reproduced and durable business records can be inspected
