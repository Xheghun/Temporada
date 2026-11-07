# Home and versioned terms

SDD-012 uses the existing authenticated runtime and outbox. Enable `worker_home_and_terms` in the HTTPS remote flag response alongside `worker_authentication`; both fail closed. Explicit development assessment mode enables the demo locally. No new API contract or native dependency is introduced.

Home reads assignment, terms, outbox counts and refresh state in one worker-scoped SQLite transaction. The session generation clears old views immediately and rejects late reads. Connectivity is an availability hint, not a delivery guarantee. Pending counts include queued/sending/retry-wait actions; attention counts include permanent failures and an unresolved stale terms confirmation. Refresh requests persist before the engine runs.

The timeline states only facts the current model supports: authenticated identity, cached assignment, current terms state and required-document catalog count. It does not infer appointments, visa progress, document review or staff approval. Documents navigation is available when its `worker_document_corrections` flag is enabled; otherwise it remains explicitly unavailable.

Terms renders the cached localized summary and version. Confirmation captures that displayed version and selection generation, commits through the existing transactional repository, updates local feedback, then signals sync. Duplicate pending confirmations are suppressed. Stale history remains resolved for ordering; newly fetched terms remain unconfirmed until an explicit new action. An old saved notice is never attached to a new version. Permanent failure offers an explicit reconfirm-and-replace button for the displayed version, including the same version. The callback captures the failed predecessor ID; the service revalidates it and the repository atomically supersedes that failure and inserts a new action/intent with a new UUID. Refresh alone never replaces a failed action. Stale history is not superseded.

English is the initial language when no preference exists (SDD-015 user amendment); existing saved choices are preserved. Home toggles Spanish/English; schema v3 stores the app-wide preference without identity data, tokens or queue deletion. Migration/reopen coverage verifies pending intent survives the upgrade. Layouts scroll and avoid fixed content heights. The complete accessibility audit belongs to its later change.

See [executed verification](evidence/home-and-terms.md). Camera, document status/corrections and full integration scenarios remain separate changes.

## Subsequent SDD-022 redesign

Home replaces the static timeline with a single state-derived next step and catalog rows. Terms needing confirmation precede required corrections, missing required documents and other permanent failures. Pending local work and staff review are reassurance states, not duplicate worker tasks. Unknown/refresh-needed state never implies completion. Home projects document and terms facts from the same atomic cache read and uses the actual selected display name with a neutral greeting. Primary Home/Documents/My Job navigation retains existing route paths and guards; secondary screens use the existing Stack.

My Job presents only cached employer, worksite, order reference and season dates; date-only formatting cannot shift a day across timezones. Terms explicitly describes its content as a summary, preserves displayed-version callbacks and hides stale history behind an accessible disclosure. Existing offline, stale-version and explicit failed-action replacement tests remain intact. Ten new priority/job tests plus existing Home/terms presentation tests, typecheck, lint and architecture checks passed; new native evidence is recorded separately.
