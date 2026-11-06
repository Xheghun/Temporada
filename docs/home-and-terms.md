# Home and versioned terms

SDD-012 uses the existing authenticated runtime and outbox. Enable `worker_home_and_terms` in the HTTPS remote flag response alongside `worker_authentication`; both fail closed. Explicit development assessment mode enables the demo locally. No new API contract or native dependency is introduced.

Home reads assignment, terms, outbox counts and refresh state in one worker-scoped SQLite transaction. The session generation clears old views immediately and rejects late reads. Connectivity is an availability hint, not a delivery guarantee. Pending counts include queued/sending/retry-wait actions; attention counts include permanent failures and an unresolved stale terms confirmation. Refresh requests persist before the engine runs.

The timeline states only facts the current model supports: authenticated identity, cached assignment, current terms state and required-document catalog count. It does not infer appointments, visa progress, document review or staff approval. Documents navigation is explicitly unavailable until its owning feature.

Terms renders the cached localized summary and version. Confirmation captures that displayed version and selection generation, commits through the existing transactional repository, updates local feedback, then signals sync. Duplicate pending confirmations are suppressed. Stale history remains resolved for ordering; newly fetched terms remain unconfirmed until an explicit new action. An old saved notice is never attached to a new version. Permanent failure offers refresh/support rather than blind retries.

Spanish is the initial language. Home toggles Spanish/English; schema v3 stores the app-wide preference without identity data, tokens or queue deletion. Migration/reopen coverage verifies pending intent survives the upgrade. Layouts scroll and avoid fixed content heights. The complete accessibility audit belongs to its later change.

See [executed verification](evidence/home-and-terms.md). Camera, document status/corrections and full integration scenarios remain separate changes.
