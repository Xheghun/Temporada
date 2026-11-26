# Architecture answers

These answers cover the implemented conflict rules and possible production extensions. Notifications, device binding and store release are not implemented features. I completed manual UI checks on iOS and Android, including a lower-end Android emulator.

## 1. Conflicting passport submissions

The server associates Tuesday's rejection with the earlier submission ID, never with every passport for that worker. Wednesday's upload carries its original action ID and an explicit replacement relationship where applicable. The server deduplicates that action and returns Pending Review; it does not infer approval or apply the old rejection to the new image.

The client retains the newer local intent as current while it is Pending Sync. It merges the older correction into that submission's history by ID/revision. After acknowledgment, the new passport becomes Pending Review, while the historical reason remains readable. A newer review revision on the old passport cannot replace the current submission. Conflicting replacement relationships require server validation and an explicit correction flow, not silent mutation.

## 2. Push notifications and SMS fallback

A production backend should commit a notification event alongside the staff decision or appointment change, then deliver through a durable delivery outbox. Retry providers, deduplicate by event ID and track outcomes; push/SMS delivery is not guaranteed. Escalate time-sensitive failures to staff rather than treating provider acceptance as worker acknowledgment.

Send minimal opaque identifiers, not passport details or correction text on lock screens. The app authenticates, checks worker ownership and refreshes authoritative details. Persist worker-scoped event IDs, server revisions, read/acknowledgment state and the latest appointment details/time zone locally. Reconcile missed events on foreground/login regardless of push arrival. SMS fallback uses an authorized verified number and appropriate consent; shared-phone messages must avoid exposing another worker's sensitive details.

## 3. Store review and low-end devices

My main risks are camera/photo permissions and privacy disclosures for store review, plus memory pressure during image decoding and compression on low-end Android. The local mock also needs a production backend before release.

I completed manual end-to-end UI checks on iOS and Android, including a lower-end Android emulator and TalkBack. The saved results omit the low-end emulator’s Android version, RAM setting, startup timing and peak memory, so the specific Android 9 / 2 GB result is still missing.

For release validation, I would record those details on an Android 9/API 28 device or emulator with 2 GB RAM, then check large-image capture, low storage, process restart, poor connectivity and queued-file retention. The dependency’s API 24 minimum addresses installation compatibility. Measured behaviour on the target configuration is the performance evidence.

## 4. Device binding and device loss

Production sessions should be independently revocable per device, with backend-approved recovery and stronger identity checks where needed. A replacement phone must authenticate and select an authorized worker; it downloads server-acknowledged records, not a fictitious copy of the old local queue.

Offline actions on a lost, wiped or uninstalled device may never reach the server and cannot be reconstructed from server state. Tell the worker which documents/terms need submitting again. If the old phone returns, validate its session and submission relationships before accepting retained actions. Stable IDs deduplicate retries of one action, not independently created actions on two phones.

The current client preserves queued intent after 401 and requires reauthentication. Remote revocation cannot erase private files on a disconnected lost device; OS protection, encryption/retention policy and multi-device conflict handling need further design.

## Sources

The dependency minimum was read from installed `react-native/gradle/libs.versions.toml`; final binary compatibility remains unverified. Store guidance: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and [Google Play User Data](https://support.google.com/googleplay/android-developer/answer/10144311). Recheck policies before any release.
