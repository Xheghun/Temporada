# worker-language Specification

## Purpose

Provide language and accessible layout completion while preserving durable intent, worker isolation and truthful worker-visible status.

## Requirements

### Requirement: Spanish-first accessible language M9
Spanish MUST be the first-launch language when no preference exists, and Home MUST expose Spanish/English selection. A saved language preference MUST survive restart and MUST NOT be overwritten by the default change. All app-owned text, errors and accessibility labels MUST be localized. Unknown server free text MUST remain unchanged. Layout MUST support 360-pixel width, large text and non-color status cues.

#### Scenario: Language and large text
- **WHEN** Ana switches Spanish to English on a 360-pixel layout with large text
- **THEN** app-owned labels and states change language without clipping primary actions and server correction text remains verbatim
