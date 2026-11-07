# Worker interface delta

## Purpose

Provide a warm, consistent and accessible mobile presentation for workers using shared phones, small screens and unreliable connections.

## ADDED Requirements

### Requirement: Visual hierarchy
Screens SHALL use native system fonts, #FAF9F6 backgrounds and #171717 primary headings, including greetings. Green SHALL identify primary actions and active navigation. Layouts SHALL use whitespace, dividers and lightweight rows rather than nested or page-wide cards, with one dominant action per state and no decorative effects or invented features.

#### Scenario: Consistent core screens
- **WHEN** a worker visits authentication, Home, job, terms, documents and capture
- **THEN** primary headings use #171717, type follows the specified 26–30sp heading and 14–16sp body scale, and screen content has approximately 20–24dp horizontal padding with 4dp spacing increments

### Requirement: Accessible bilingual interaction
Every app-owned label, error, helper and accessibility description SHALL support English and Spanish using the persisted preference with English default. Controls SHALL have at least 48dp targets, key actions preferably 56dp, non-color status cues, readable contrast, heading semantics, scalable text and reachable keyboard/safe-area layouts.

#### Scenario: Spanish large text and failure feedback
- **WHEN** a worker uses Spanish at approximately 360dp width and at least 130% font scale, opens the keyboard and encounters an error
- **THEN** actions remain reachable without clipped labels, the error is localized and announced, saved preferences survive restart and server free text remains verbatim

### Requirement: Authentication and shared phone presentation
Sign-in SHALL provide a wordmark, language selector, phone input, clear continuation action and accurate verification explanation. OTP SHALL show the phone being verified, a six-digit input and back navigation. Worker selection SHALL show named rows with initials, clear selection feedback and an isolation explanation. Existing validation, errors and duplicate-request protection MUST remain effective.

#### Scenario: Invalid code and recovery
- **WHEN** a worker enters an invalid code and then corrects it
- **THEN** localized feedback preserves the input, verification uses the existing service and mock contract, and repeated taps while busy do not create duplicate requests

#### Scenario: Worker list states
- **WHEN** identities are loading, absent or fail to load
- **THEN** the picker distinguishes loading, empty and error states and never shows stale identities as selectable current results

### Requirement: Guided photo presentation
Capture SHALL offer camera and gallery, meaningful photo guidance, a real private preview and one primary action appropriate to selection or saving. Permission denial SHALL explain available recovery. Local success MUST appear only after durable persistence; ordinary screens MUST NOT expose byte counts, private paths, raw IDs or technical error codes.

#### Scenario: Prepare save and recover
- **WHEN** a worker selects a photo, encounters a saving failure and retries offline
- **THEN** preparation and saving are visible, recoverable input is preserved where safe, and only successful durable saving shows “Saved on this phone. Waiting to send.” without claiming delivery or approval

#### Scenario: Camera permission denied
- **WHEN** camera access is denied
- **THEN** the worker sees localized guidance, a working settings action where supported and gallery selection without a false success message
