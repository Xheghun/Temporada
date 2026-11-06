# Traceability

Worker requirements remain proposed / NOT VERIFIED. Scaffold-only evidence for R-ANDROID/R-QUALITY/R-GOV is recorded in docs/evidence/scaffold-progress.md (commit 293eef6); whole-app acceptance is incomplete. Populate PR/CI/review evidence when executed; file existence is not behavioral acceptance.

| Requirement | Capability / change owner | Tasks | Verification |
|---|---|---|---|
| M1 | offline-intent, offline-delivery, document-capture | SDD-007/008/012/014 | TEST-01; scenario 2 |
| M2 | offline-intent, worker-identity, document-capture | SDD-006/007/011/014 | TEST-02 real reopen; scenarios 2/8; file restart |
| M3 | mock-worker-api, offline-delivery | SDD-005/007/010 | TEST-03 durable server restart/drop; scenario 3; counts |
| M4 | document-review, offline-delivery | SDD-010/012/013 | state render tests; TEST-03R preserves newer same-submission review on replay; scenarios 2/3/7 |
| M5 | offline-delivery | SDD-008/009 | TEST-04 fake clock; scenarios 5/6/8 |
| M6 | offline-delivery, worker-home-and-terms | SDD-005/010/012 | TEST-05 through successful explicit v3 delivery without v2 supersession; scenario 4 |
| M7 | document-capture | SDD-006/014 | actual size/durable URI; cleanup/restart; scenarios 2/5 |
| M8 | document-review | SDD-005/007/013 | new-ID/history/late-decision tests; scenario 7 |
| M9 | worker-language | SDD-011/015 | translation parity/status RNTL; scenario 1 |
| M10 | worker-identity, offline-intent | SDD-004/006/008/011 | TEST-06, 403 and late response; scenario 7 |
| R-AUTH | worker-identity | SDD-004/011 | seeded logins/invalid OTP/secure storage |
| R-HOME | worker-home-and-terms | SDD-012 | cached Home/known timeline/pending counts |
| R-UI | worker-identity, worker-home-and-terms, document-review, document-capture, worker-language | SDD-011–015 | seven screens; 360px/large-text/a11y inspection |
| R-API | mock-worker-api | SDD-004/005 | five endpoints/exact seeds/six failure controls smoke |
| R-ANDROID | project-scaffold, offline-integration | SDD-003/016/019 | actual launch and scenarios 2/3/4 evidence |
| R-QUALITY | project-scaffold, offline-sync, offline-integration | SDD-002/008–010/018/019 | six tests and all scripts; CI run separate from config |
| R-GOV | all changes; programme requirements | SDD-001/018/020/021 | scaffold-first PR including CI; branch/PR per feature with no AI branding; PR URLs/checks, substantive descriptions, human review/merge gates; external contracts/releases sign-off |
| R-DOC | submission-documentation | SDD-020 | README/DECISIONS/PROCESS/release plan/four short answers |
| R-EVIDENCE | project-scaffold, offline-integration, submission-documentation | SDD-001/016/017/021 | pre-coding Recording B preparation, capture during implementation, final verification; eight manual records; two real recordings or incomplete |
| R-TIME | all changes; single ledger | SDD-001/017/019 | cumulative ledger; target 240/hard 300 minutes |

Planning artifacts: requirements, architecture, data-model, sync-engine, api-contract, ui-spec, testing, tasks and this matrix exist. No implementation tests passed yet. Original-brief comparison and backend approval are pending; no human sign-off implied.

## Exact task ownership

Each SDD task appears in exactly one active change checklist; the central change index is [tasks.md](tasks.md). Feature PR handoff tasks are local to each change. Programme reference tasks are historical prose, not active progress boxes. No whole-app apply target remains.

- [project-scaffold](../openspec/changes/project-scaffold/tasks.md): SDD-001, SDD-002, SDD-003, SDD-018.
- [mock-api](../openspec/changes/mock-api/tasks.md): SDD-004, SDD-005.
- [persistent-outbox](../openspec/changes/persistent-outbox/tasks.md): SDD-006, SDD-007.
- [offline-sync](../openspec/changes/offline-sync/tasks.md): SDD-008, SDD-009, SDD-010.
- [worker-authentication](../openspec/changes/worker-authentication/tasks.md): SDD-011.
- [home-and-terms](../openspec/changes/home-and-terms/tasks.md): SDD-012.
- [document-corrections](../openspec/changes/document-corrections/tasks.md): SDD-013.
- [document-capture](../openspec/changes/document-capture/tasks.md): SDD-014.
- [language-and-accessibility](../openspec/changes/language-and-accessibility/tasks.md): SDD-015.
- [offline-integration](../openspec/changes/offline-integration/tasks.md): SDD-016, SDD-017, SDD-019.
- [submission-documentation](../openspec/changes/submission-documentation/tasks.md): SDD-020, SDD-021.

Mock-api: SDD-004/005 implementation evidence for R-API and the backend portions of M3/M4/M6/M7/M8/M10 is in docs/evidence/mock-api.md. Mobile acceptance for those invariants is not complete. Scaffold PR #1 was human-reviewed/merged before this branch; no subsequent feature is started.

Offline-sync SDD-008/009/010: core delivery/retry/isolation/version/replay evidence is in docs/evidence/offline-sync.md, including all six mandatory core tests and Android development probes. Whole-app UI/airplane-mode/media/production acceptance is still incomplete.

Worker-authentication SDD-011: auth/identity/M2/M9/M10 scope evidence is in docs/evidence/worker-authentication.md. Actual Android SecureStore resume/logout and shared-phone identity passed; whole-app worker UI scenarios remain incomplete.

Home-and-terms SDD-012: cached assignment/timeline/connectivity/counts, exact-version terms and M1/M2/M4/M6/M9/M10 scoped evidence is in docs/evidence/home-and-terms.md. Android offline v3 confirmation/restart/reconnect passed; native stale UI and full document journeys remain unverified in this change.

Document-corrections SDD-013: M4/M5/M8/M9/M10 catalog/projection/orchestration and history evidence is in docs/evidence/document-corrections.md. Camera/compression/private-file adapter and whole-worker resubmission journeys remain owned by document-capture/integration.
