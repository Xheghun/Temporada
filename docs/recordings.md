# Recording status and handoff

As of 2026-11-08, both videos are available as compressed MP4 attachments in the [project recordings release](https://github.com/Xheghun/Temporada/releases/tag/project-recordings-2026-11-08). This supersedes the 2026-11-07 report that no recording files were available. **SDD-021 remains incomplete:** file availability does not establish that the recordings meet the assessment's length, content and genuine-session requirements.

| Artifact                           | Available recording                                                                                                                                                  | Brief requirement                                                                                                            | Remaining review                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A — scenarios and code walkthrough | [Temporada-Scenarios-and-Code.mp4](https://github.com/Xheghun/Temporada/releases/download/project-recordings-2026-11-08/Temporada-Scenarios-and-Code.mp4), **15:33** | 5–8 minutes: scenarios 2, 3 and 4, then code the author is proud of and least confident in                                   | Shorten or obtain assessor acceptance of the longer version; review the complete combined walkthrough and narration     |
| B — AI workflow                    | [Temporada-AI-Workflow.mp4](https://github.com/Xheghun/Temporada/releases/download/project-recordings-2026-11-08/Temporada-AI-Workflow.mp4), **19:16**               | 10–15 minutes: real prompt, plan, human rejection/correction, implementation, emulator testing, PR description and narration | Shorten or obtain assessor acceptance; verify every required event and the session's provenance from the actual footage |

## What has been checked

The hosted viewing copies passed full video/audio decoding and sampled readability checks during PR #19 preparation. Their uploaded sizes and SHA-256 digests matched the checked files, and both public download links returned HTTP 200. The workflow copy is 1280×828; the scenarios/code copy is 1752×2112. Desktop originals remain unchanged, and no video is committed to Git history. This documentation reconciliation rechecked release metadata; it did not perform another full media review or rerun the app.

The scenarios segment was captured directly with Android's native screen recorder in one continuous 6:41 take, including actual app navigation, offline restart and test waits. The later viewing version speeds that segment to 1.7× and appends the user-provided code walkthrough with its audio. The combined recording is 15:33; it is not the original unedited take. Compression preserves the supplied files' playback timing and audio tracks; intelligible narration and complete requirement coverage still need a full listening/content review.

During that scenario capture, offline terms/photo actions survived force-stop/reopen with the same IDs and image digest, the passport delivered as Pending Review, DS-160 replay used two attempts for one server record, and stale v2 required explicit v3 confirmation. Isolated fixtures and preserved completed caches kept existing worker data separate. This is later demonstration evidence, not additional implementation claimed within the original five-hour window.

## Recording B review still required

The user supplied the AI workflow file. Metadata, decoding and sampled frames establish that a playable video exists; they do not establish all of the following:

- A real task prompt and agent plan are visible.
- A genuine human rejection or correction occurs, rather than a staged example.
- The resulting implementation, relevant tests and actual emulator behavior are shown.
- The PR description and human explanation are included and understandable.
- The session date and code/commit context identify whether this is original assessment work or a subsequent session.

The [pre-coding checklist](recording-b-checklist.md) preserves the original preparation record. At that time no capture was confirmed; the later supplied video supersedes the missing-file status without proving that checklist was followed. Do not reconstruct missing events or label a retrospective walkthrough as genuine original implementation. Review the footage and original source context before marking SDD-021 complete. Assessor acceptance of longer recordings or alternative evidence has not been obtained.

## Assessment cutoff and historical evidence

The original implementation/verification ended at **299.91 minutes**, recorded in [cutoff commit `6db6a09`](https://github.com/Xheghun/Temporada/tree/6db6a0960a913c957a208a656dd9b57e0829ab23). The [coding ledger](coding-ledger.md) separately records subsequent authorized redesign and follow-up work. The original brief excludes write-up and recording work from coding time; it does not turn later application work into a five-hour implementation. Current main and later footage must be presented with that distinction.

The earlier missing-recording reports remain historical evidence in Git and the dated OpenSpec planning records. They must not be read as the current availability status, and uploaded footage must not be treated as retroactive proof of recording or human review at those earlier dates. No historical test, timing, approval or recording result has been rewritten.
