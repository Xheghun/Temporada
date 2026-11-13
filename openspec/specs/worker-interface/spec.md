# worker-interface Specification

## Purpose

Provide a warm, consistent and accessible mobile presentation for workers using shared phones, small screens and unreliable connections.

## Requirements

### Requirement: Visual hierarchy
Screens SHALL use native system fonts, #FAF9F6 backgrounds and #171717 primary headings, including greetings. Green SHALL identify primary actions and active navigation. Layouts SHALL use whitespace, dividers and lightweight rows rather than nested or page-wide cards, with one dominant action per state and no decorative effects or invented features.

#### Scenario: Consistent core screens
- **WHEN** a worker visits authentication, Home, job, terms, documents and capture
- **THEN** primary headings use #171717, type follows the specified 26–30sp heading and 14–16sp body scale, and screen content has approximately 20–24dp horizontal padding with 4dp spacing increments

### Requirement: Accessible bilingual interaction
Every app-owned label, error, helper and accessibility description SHALL support English and Spanish using the persisted preference with Spanish default. Controls SHALL have at least 48dp targets, key actions preferably 56dp, non-color status cues, readable contrast, heading semantics, scalable text and reachable keyboard/safe-area layouts.

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

### Requirement: Reference-based screen fidelity
The eight individual PNGs from the provided temporada_ui_reference_images.zip SHALL be the visual baseline. Authentication and capture SHALL follow the approved design matrix's section order, screen-specific compact headers, small black lowercase wordmark where shown, typography hierarchy, panel treatment and action hierarchy. Generic palette compliance alone MUST NOT establish fidelity. Actual identity, catalog and delivery facts MUST take precedence over illustrative data.

#### Scenario: Authentication reference review
- **WHEN** sign-in, OTP and worker selection are compared at a calibrated equivalent viewport and normal text scale
- **THEN** sign-in retains the intended heading placement, OTP has its separate phone block and compact back/context header, and authorized worker choices use bordered avatar/name/chevron rows with a tinted isolation explanation
- **AND** no illustrative worker is added and all validation/loading/error and keyboard behavior remains functional

#### Scenario: Upload reference review
- **WHEN** capture opens without a selected photo
- **THEN** it shows the compact back/context header, catalog title, dashed document-illustration placeholder, camera/gallery actions and tinted local-storage explanation without a duplicate brand header
- **AND** selecting a real photo replaces the placeholder, makes explicit Save primary and preserves durable-file and permission-recovery behavior

### Requirement: Executed visual acceptance
Each of the eight screens SHALL have a recorded reference/current comparison with viewport, density, language, state, font scale and commit metadata. Structural mismatches SHALL be fixed or explicitly accepted with a reason before visual completion is claimed. Reference assets SHALL be retained unchanged with checksums in a repository-owned location during implementation. Raster images MUST NOT be distorted to conceal differences.

#### Scenario: Fidelity handoff
- **WHEN** the reconciliation is reported complete
- **THEN** eight comparisons identify fixed differences and justified adaptations, no unresolved structural mismatch is marked passed, and unavailable exact-geometry checks are labeled limited
- **AND** both-language 360dp/130-percent checks preserve reachable actions and text scaling, with unexecuted spoken accessibility checks still explicit

### Requirement: Final comparison and spoken accessibility evidence
Final visual evidence SHALL include keyboard-hidden OTP at calibrated reference settings and recorded decisions for minor mismatches. Accessible contrast, touch targets and text scaling MUST remain intact. Spoken accessibility claims SHALL require manual listening; non-auditory evidence MUST NOT establish an audible pass.

#### Scenario: OTP final visual comparison
- **WHEN** the final comparison is prepared
- **THEN** the OTP header, phone block, six-digit field and verify action can be compared with 07_otp.png without keyboard displacement, with actual state and capture metadata recorded
- **AND** keyboard-visible interaction evidence remains available and illustrative worker values are not substituted for authorized data

#### Scenario: Spoken accessibility closure
- **WHEN** TalkBack verification is reported complete
- **THEN** manually checked focus order, localized control names, errors and relevant status announcements are recorded with expected and actual results
- **AND** missing audible verification remains NOT RUN and keeps the existing task 9.3 obligation open
