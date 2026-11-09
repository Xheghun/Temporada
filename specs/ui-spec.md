# UI specification

Use colors/type/spacing/radii/border/semantic tokens with Button, Input, Card, Status, ErrorBanner and Loading primitives. Touch targets >=48dp; support font scaling, wrapping/scrolling, visible text/icon status cues, screen-reader labels and busy/disabled feedback. Test at 360px with Android large text; avoid fixed-height text containers.

| Screen | Content and behavior |
|---|---|
| Sign in | Localized phone label, RHF/Zod validation, request OTP, localized actionable network error |
| Verify | Six digits, mock code information in development, loading, retry/error |
| Worker picker | Authorized names; required for shared number; switch entry reachable from Home |
| Home | Identity, JO/employer/worksite/season, cached terms, known timeline, network hint, Pending Sync count, attention count, terms/documents, ES/EN, switch worker, sign out |
| Terms | Exact version+summary, confirm, immediate locally saved notice, stale reconfirmation and refresh-needed states |
| Documents | Server catalog with Not submitted/Pending Sync/Pending Review/Approved/Correction Requested; correction text; failed delivery remedy |
| Capture | Camera/gallery permissions, preview/retake, measured compression, durable-copy progress, queue success and recovery |

Spanish initial default per the 2026-11-09 user request; English/Spanish preference persisted without overwriting existing choices. Translate every app-owned label/button/status/error/a11y/empty state. Known API codes map to localized messages; server free text such as Carla's reason displayed verbatim. Locale key parity check plus status rendering tests in both languages. Do not call a queued file submitted. Never infer approval from HTTP success. Cache age/refresh failure must be visible without hiding local intent. Switch clears old identity content immediately; late responses filtered by generation.

Capture permission denied → explain settings/gallery alternative; unavailable camera → selection option. Compression/storage failure → retry/retake without false Pending Sync. 413 → recapture/new action; 422 → actionable correction; 401 → sign in with queue preserved. Terms stale → show new version and an explicit new confirmation button.

When a replay resolves an upload after refresh has already obtained a staff decision for that same submission, continue displaying the newer Approved/Correction Requested state and reason; do not flash Pending Review. A stale v2 history entry must not disable explicit confirmation/delivery of v3.

SDD-023 restores the original Home contract within the SDD-022 refactored design: always-visible near-top Online/Offline and numeric pending count (unknown while reading), separate attention, assignment season/reference, actual localized current terms/version/status, and expanded terms/delivery/review milestones. Keep green next-action panel, numbered document rows, ivory background, native fonts, lightweight separators and safe-area navigation. Required facts scroll without disclosure. The additional sections intentionally extend the Home PNG concept to satisfy the original assessment. Online is a connectivity hint, never delivery proof; reviewed counts and pending delivery remain independent.
