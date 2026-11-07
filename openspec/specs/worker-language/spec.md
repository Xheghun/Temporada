# worker-language Specification

## Purpose

Provide language and accessible layout completion while preserving durable intent, worker isolation and truthful worker-visible status.

## Requirements

### Requirement: English-first accessible language M9
English MUST be the first-launch language when no preference exists, and Home MUST expose Spanish/English selection. A saved language preference MUST survive restart and MUST NOT be overwritten by the default change. This is the user-requested amendment to the original M9 Spanish-first requirement. All app-owned text, errors and accessibility labels MUST be localized. Unknown server free text MUST remain unchanged. Layout MUST support 360-pixel width, large text and non-color status cues.

#### Scenario: Language and large text
- **WHEN** Ana switches English to Spanish on a 360-pixel layout with large text
- **THEN** app-owned labels and states change language without clipping primary actions and server correction text remains verbatim
