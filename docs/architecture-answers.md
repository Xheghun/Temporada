# Architecture answers

These answers cover the implemented conflict rules and possible production extensions. Notifications, device binding and store release are not implemented features. I completed manual UI checks on iOS, Android and lower-end devices; release-build profiling remains separate.

## 1. Conflicting passport submissions

The server associates Tuesday's rejection with the earlier submission ID, never with every passport for that worker. Wednesday's upload carries its original action ID and an explicit replacement relationship where applicable. The server deduplicates that action and returns Pending Review; it does not infer approval or apply the old rejection to the new image.

The client retains the newer local intent as current while it is Pending Sync. It merges the older correction into that submission's history by ID/revision. After acknowledgment, the new passport becomes Pending Review, while the historical reason remains readable. A newer review revision on the old passport cannot replace the current submission. Conflicting replacement relationships require server validation and an explicit correction flow, not silent mutation.

## 2. Push notifications and SMS fallback

A production backend should commit a notification event alongside the staff decision or appointment change, then deliver through a durable delivery outbox. Retry providers, deduplicate by event ID and track outcomes; push/SMS delivery is not guaranteed. Escalate time-sensitive failures to staff rather than treating provider acceptance as worker acknowledgment.

Send minimal opaque identifiers, not passport details or correction text on lock screens. The app authenticates, checks worker ownership and refreshes authoritative details. Persist worker-scoped event IDs, server revisions, read/acknowledgment state and the latest appointment details/time zone locally. Reconcile missed events on foreground/login regardless of push arrival. SMS fallback uses an authorized verified number and appropriate consent; shared-phone messages must avoid exposing another worker's sensitive details.

## 3. Store review and low-end devices

Release risks include incomplete review access, inaccurate privacy disclosures, camera/photo purpose strings, data-retention/deletion practices and production behavior still pointing at a mock. Check the generated manifests, privacy requirements and signed binaries against current Apple/Play policies before submission. No store review has occurred.

Android 9/API 28 is above the locked React Native package's declared minimum API 24; that does not prove the final binary or 2 GB performance. Test release builds on physical low-memory devices with large images, low storage, process kills, permission denial, poor connectivity and large text. Measure peak memory during decoding/compression, startup and scrolling; verify pending files after restart. Existing Android 16 Expo Go results and bounded compression attempts cannot substitute for that device testing.

## 4. Device binding and device loss

Production sessions should be independently revocable per device, with backend-approved recovery and stronger identity checks where needed. A replacement phone must authenticate and select an authorized worker; it downloads server-acknowledged records, not a fictitious copy of the old local queue.

Offline actions on a lost, wiped or uninstalled device may never reach the server and cannot be reconstructed from server state. Tell the worker which documents/terms need submitting again. If the old phone returns, validate its session and submission relationships before accepting retained actions. Stable IDs deduplicate retries of one action, not independently created actions on two phones.

The current client preserves queued intent after 401 and requires reauthentication. Remote revocation cannot erase private files on a disconnected lost device; OS protection, encryption/retention policy and multi-device conflict handling need further design.

## Sources

The dependency minimum was read from installed `react-native/gradle/libs.versions.toml`; final binary compatibility remains unverified. Store guidance: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and [Google Play User Data](https://support.google.com/googleplay/android-developer/answer/10144311). Recheck policies before any release.
