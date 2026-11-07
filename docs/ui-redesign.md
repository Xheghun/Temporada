# Temporada subsequent UI redesign — SDD-022

This work follows the original assessment and does not change its recorded 299.91-minute endpoint. Native verification, recording and release evidence are separate.

Shared tokens use a warm #FAF9F6 background, #171717 headings, native system fonts and #224638 actions. Secondary functional text uses #62685F rather than the lighter candidate #747970 to maintain contrast. Pages have 24dp padding, 4dp spacing increments and no page-wide card. Buttons have 56dp minimum height; rows and history controls remain comfortably tappable.

`AuthPage`, `Heading`, `Body`, `Field`, `Action` and `ErrorNotice` remain the existing composition surface. `worker-controls` supplies section headings, independent status text, initials avatars, list rows, accessible collapsed disclosures and primary navigation. It accepts presentation props and never accesses transport or persistence.

Implementation checks and native evidence will be recorded as executed. Unexecuted checks are NOT RUN.

Shared controls/auth group: 8 targeted tests, typecheck, lint and arch:check PASS. Actual contrast ratios on #FAF9F6: heading 17.03:1, body 6.97:1, secondary 5.44:1, error 7.43:1; white on primary 10.49:1. Watchman could not access its state directory in the sandbox, so tests use Jest's supported `--watchman=false` option.

Home projects terms and document presentation from one atomic assignment cache read; the documents service supplies feature availability. This avoids asynchronous snapshots mixing identities or revisions. Greeting uses the full actual selected display name with a neutral localized greeting because the identity contract provides no given-name field. Primary navigation replaces routes; secondary screens push onto the existing generation-keyed Stack. My Job uses cached fields and UTC date-only formatting to prevent season dates shifting with device timezone.

Native small-screen inspection led to a shorter empty-photo/preview area, grouped document helper copy and a compact profile avatar. The OTP header has an explicit accessible back action, and Android Back returns through the authentication service. Capture uses contextual back with a Documents fallback for direct entry. Waiting-to-send feedback is not retained after a terms delivery receipt. Home explains unavailable photo capture rather than advertising unsupported work.

Additional native classification coverage is confined to the existing development-only sync proof route. It uses a separate proof database/backend and actual Android files/SQLite/HTTP; one malformed wire field intentionally obtains a real 422 while preserving the stored intent. Production transport and sync policies are unchanged.

Spanish at 130% font scale exposed an awkward split in the Documents tab label. Increasing usable tab width fixed it without disabling scaling. A neutral full-display-name greeting makes clock-boundary checks inapplicable; no time-dependent greeting is rendered.

The complete [changed/added file inventory](ui-redesign-files.md) and [executed Android/check evidence](evidence/ui-redesign/README.md) accompany this change. Human audible TalkBack verification is pending; the user has offered to perform it.

Final diff review confirmed no changes to database schemas/repositories, production synchronization, private file adapters, backend contracts or dependencies. The only auth-state addition is the in-memory verification phone. Capture’s saved feedback now reads the existing document projection rather than retaining a static waiting message after delivery.
