# Requirements

Status: proposed; no application implementation or behavioral verification yet.
Source: user-supplied master task, 2026-11-06. Original assessment not present; compare when available and record discrepancies. OpenSpec capability owners are split across the changes in tasks.md: mock-worker-api, offline-intent, offline-delivery, worker-identity, worker-home-and-terms, document-review, document-capture and worker-language. Cross-cutting assessment/governance requirements remain in this document and the programme reference.

| ID | Contract | Priority |
|---|---|---|
| M1 | Terms and documents enqueue offline with immediate durable feedback | P0 |
| M2 | Actions/files survive termination, restart and same-worker logout/login | P0 |
| M3 | Stable persisted action IDs and durable server deduplication produce one effect | P0 |
| M4 | Local Pending Sync, server Pending Review and staff decisions remain separate | P0 |
| M5 | Persistent bounded backoff/jitter for transient failures; actionable permanent failures | P0 |
| M6 | Confirm displayed terms version only; stale terms require explicit reconfirmation | P0 |
| M7 | Backend catalog, guided preview, actual compressed size <1,500,000 bytes, durable files | P0 |
| M8 | Correction reason and immutable new submission/action | P0 |
| M9 | Spanish default, English toggle, every app-owned string localized | P1 |
| M10 | Authorized selected worker partitions local data, views, files and queues | P0 |
| R-AUTH | Phone OTP 123456, invalid 401, secure token, conditional worker picker | P1 |
| R-HOME | Cached identity, assignment, terms, timeline, connectivity and pending count | P1 |
| R-UI | Seven screens, 360px/large text, accessible actionable feedback | P1 |
| R-API | Five specified endpoints, persistent mock, exact seeds and six failure controls | P0 |
| R-ANDROID | Actual Android launch and critical failure scenarios | P0 |
| R-QUALITY | Six tests, strict scripts, boundaries, CI, EAS configuration | P2 except critical tests P0 |
| R-GOV | Scaffold/CI first; separate descriptive ticket branch and PR per feature; human review/merge gates; concise substantive PR descriptions; no AI branch branding; production flags off | Mandatory workflow |
| R-DOC | README, DECISIONS, PROCESS, release plan, four <=150-word answers, honest AI log | P2 |
| R-EVIDENCE | Eight executed scenario records, two genuine human recordings or incomplete status | P1 |
| R-TIME | Four-hour coding target; hard five-hour stop and visible ledger | P0 |

Acceptance requires implementation AND executed evidence. No queued upload is submitted/approved; no new version autoacceptance; no retry ID regeneration; no cross-worker leakage. Missing external approval, execution or evidence remains incomplete.

Seed: JO-2026-0142; Valle Verde Farms; Yuma, Arizona; 2026-03-01 to 2026-07-31; terms v2. Required types passport, ds160_confirmation, signed_contract. +52 55 1000 0001: Ana López unconfirmed/no documents. +52 55 1000 0002: Bruno Díaz confirmed/passport approved; Carla Díaz passport correction reason “Foto borrosa, vuelva a tomarla”. No real people/data.

Discrepancies/assumptions: supplied budgets sum to five hours, not four; decimal 1.5 MB is conservative; season year inferred from job order; original unavailable; X-Worker-Id proposed mock convention; SDD-001 is a provisional local ticket, not an externally created ticket.

Clarifications: stale terms are resolved for ordering without supersession; old upload replay receipts resolve delivery without overwriting newer same-submission review revisions. Prepare Recording B before coding and capture during implementation; final editing/evidence checks remain late. Mobile is the focus, with a minimal supporting mock; original assessment comparison remains pending.

Delivery clarification: scaffold includes linting (interpreting “LinkedIn” in context), GitHub Actions validation/build pipeline configuration, EAS profiles and quality/PR conventions from the start. Every feature has a separate branch/PR based on reviewed main; no single final application PR. Human review waits do not reset the coding ledger.
