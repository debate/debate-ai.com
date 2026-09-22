## Tracker Status

_Note: this section (In progress / Completed) previously tracked a long
history of small slices picked up by the standing autonomous-routine prompt
("integrate all the tools into the UI... create user settings and link user
db SQL with the ability to save flows/docs/debates in SQL and link to
users... add tools into where needed in the UI... develop better tool UI").
That history was rebuilt once already after being lost to a bad merge
(`4aa1c03`, "Prod (#863)"), then lost a second time when `2dbb655` ("Update
fmt.Println message from 'Hello' to 'Goodbye'") deleted this whole section
(2,666 lines) under a commit message unrelated to the diff it actually made —
worth a human looking at, since neither the message nor any linked issue
explains the deletion. It is not being reconstructed from memory a second
time — only what's confirmed against the current codebase is recorded from
here on._

### In progress

_No task currently in progress._

### Completed

- **🔓 Progress Unlocks' "last-seen badges" celebration baseline never
  synced to the account — the last remaining `localStorage`-backed,
  per-record-id-keyed store not yet in `debate-data-sync`'s
  `TOOL_RECORD_COLLECTIONS` allowlist.**
  `packages/debate-contributor-progress/src/state/unlockCelebrations.ts`
  persists, per contributor, the badge list `ProgressUnlocksPanel.tsx`'s
  unlock-celebration toast was last shown for — the baseline
  `recordAndGetNewlyEarnedBadges` diffs a contributor's current badges
  against to decide what's "newly earned." It was stored as a plain
  `Record<contributorId, string[]>` map rather than the JSON array of
  id-keyed records every `TOOL_RECORD_COLLECTIONS` entry requires, so it
  couldn't join the catalog the way `coachingSessions`/`dailyMissionResults`
  did before it — a badge already celebrated on one device was celebrated
  again as "new" on a second one, since the "already seen" baseline never
  left the browser that recorded it. Unlike those two precedents (which only
  needed a derived id stamped onto an already-array-shaped record), this
  store needed an actual shape change: from a map to an array.

  Reshaped `unlockCelebrations.ts` to persist
  `{ id: contributorId, badges: string[] }[]` (exported as
  `UnlockCelebrationSeenBadgesRecord`), with `readAll()` also accepting the
  legacy `Record<contributorId, string[]>` shape on read (one record per key
  whose value is a string array) so a baseline recorded before this shipped
  isn't dropped — the next `markBadgesSeen`/`clearAllSeenBadges` call
  rewrites it in the new array shape. The public API
  (`getSeenBadges`/`markBadgesSeen`/`recordAndGetNewlyEarnedBadges`/
  `clearAllSeenBadges`) is unchanged, so `ProgressUnlocksPanel.tsx` (the only
  caller) needed no changes. Added the `unlockCelebrations` entry to
  `TOOL_RECORD_COLLECTIONS` (`storageKey: "unlockCelebrationSeenBadges"`,
  `idField: "id"`, section "Team"). `/cards/progress` (Progress Unlocks)
  isn't itself a registered sidebar destination
  (`tool-record-sync-catalog.test.ts` only accepts hrefs the sidebar links
  to), so — mirroring `dailyQuestTemplates`/`dailyMissionResults`' own
  precedent — the entry's `href` points at `/cards/leaderboard` instead.

  New tests in `unlockCelebrations.test.ts`: the array-shaped persisted
  form, reading back a pre-existing legacy map, rewriting a legacy map into
  the array shape on the next write, and a corrupt legacy entry (a
  non-array value under a key) degrading to "no baseline" for that
  contributor rather than throwing. `tool-record-catalog.test.ts` got the
  new `EXPECTED_ID_FIELDS` entry and a pinning test for the catalog entry
  itself, mirroring `dailyMissionResults`' own.

  Ran the verification gate: `bun install`; the three directly affected
  test files (61/61); the wider `debate-contributor-progress`/
  `debate-data-sync` suites plus `debate-videos`' catalog cross-check
  alongside them (1150/1150); `bun run typecheck` (17/17 packages); `bun run
  test` (510 files, 9479 tests, repo-wide, all passing); and `bun run
  build:web` (production build succeeded, dist/client generated 815 files).
  Docs updated:
  `packages/debate-help-docs/content/docs/features/progress-unlocks.mdx`
  (new "syncs to the account" note in Data flow) and
  `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx`
  ("Which tools sync"'s Team paragraph, and a new struck-through entry in
  "What deliberately does not sync").

  **Follow-up, deliberately not done here:** with this slice, every
  `localStorage`-backed, single-string-id-keyed tool store found in an
  exhaustive repo sweep is now either in `TOOL_RECORD_COLLECTIONS` or has
  its own dedicated `saved_*` table/route — there is no further "orphaned
  store" of this specific shape left to find. The account-sync system's
  other Known gaps (still per-user not per-team; the merge is a once-per-tab
  poll with no push channel; a `mirrorToolRecord*`-uninstrumented store's
  change reaches the account at the watcher's next tick rather than
  immediately) remain open, as does the standing prompt's broader "create
  user settings and link user db SQL with the ability to save flows/docs/
  debates in SQL" framing — flows, rounds, tournament results, drill sets,
  and word-count rounds already have their own dedicated SQL-backed cloud
  save; a next slice in that vein would need a genuinely new gap, not
  another `TOOL_RECORD_COLLECTIONS` entry.

- **🔥 A contributor's Quest Streaks mission-result history never synced to
  the account — even though the panel's own doc already promised the
  signed-in visitor's streak state "follows them to another device."**
  `packages/debate-contributor-progress/src/state/dailyMissionResults.ts`'s
  `DailyMissionResultRecord` (`{ contributorId, dayKey, isComplete }`) is the
  actual day-by-day history `/cards/streaks`' current/longest streak and
  milestone badges are computed from — but it was keyed only by the pair
  `(contributorId, dayKey)`, with no single id field, so it couldn't join
  `debate-data-sync`'s `TOOL_RECORD_COLLECTIONS` allowlist. `quest-streaks.mdx`
  (internals) only ever synced the signed-in visitor's much smaller
  `streakFreezes`/`streakLapseReminders` preferences through a bespoke
  `quest_streak_sync` column on `user_settings` — its own "Account sync, in
  detail" section explained *why* those two stores needed a bespoke sync
  (composite key; a bare `string[]`) but never even mentioned
  `dailyMissionResults` in that reasoning, because the actual history was
  simply never wired to sync at all. A contributor's real streak/badge state
  didn't follow them to a second device even though their freeze usage and
  reminder opt-in already did — exactly the same `(roundId, sideKey)`-keyed,
  no-id shape problem `coachingSessions` had, fixed the same way previously.

  `saveDailyMissionResult` now stamps every record with a derived
  `${contributorId}::${dayKey}` id (mirroring `coachingSessions`' own
  `saveCoachingSession` fix exactly: always overwrite whatever `id` the
  caller passed, never trust it), and returns the saved, id-stamped record
  instead of `void` so `computeAndSavePersistedDailyMissionResult` can hand
  its caller the same value that was actually persisted. Added the
  `dailyMissionResults` entry to `TOOL_RECORD_COLLECTIONS` (`idField: "id"`,
  section "Team", `href: "/cards/leaderboard"` — `/cards/streaks` itself
  isn't a registered sidebar destination, matching how its
  `dailyQuestTemplates`/`groupChallenges` siblings already point at the
  Leaderboard link instead). No other wiring was needed: the sync's whole
  design point is that any catalog entry is enough for
  `state/tool-record-auto-sync.ts`'s watcher to pick up.

  New tests in `dailyMissionResults.test.ts`: the id-stamping behavior
  itself (derived from `contributorId`/`dayKey`, ignoring any id a caller
  passes in) and that `saveDailyMissionResult`/`computeAndSavePersistedDailyMissionResult`
  return the id-stamped record; updated every existing exact-shape `toEqual`
  assertion in that file to include the now-always-present `id`.
  `tool-record-catalog.test.ts` got the new `EXPECTED_ID_FIELDS` entry and a
  pinning test for the catalog entry itself, mirroring `challengeWinEvents`'
  own. `packages/debate-videos/test/tool-record-sync-catalog.test.ts`'s
  existing loop already covers `/cards/leaderboard` being a real sidebar
  destination, so nothing there needed changing.

  Ran the verification gate: `bun install`; the two directly affected test
  files (54/54); the wider `debate-contributor-progress`/`debate-data-sync`
  suites plus `debate-videos`' catalog cross-check alongside them
  (1145/1145); `bun run typecheck` (17/17 packages); `bun run test` (510
  files, 9474 tests, repo-wide, all passing); and `bun run build:web`
  (production build succeeded, `/cards/streaks` listed in the route
  manifest). Docs updated:
  `packages/debate-help-docs/content/docs/internals/quest-streaks.mdx`
  (Data flow, "Account sync, in detail" split into the two separate syncs,
  and Known gaps), `packages/debate-help-docs/content/docs/features/quest-streaks.mdx`
  (Data flow and Known gaps), and
  `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx`
  ("Which tools sync" and the "What deliberately does not sync" struck-through
  entry, mirroring `coachingSessions`' own).

  **Follow-up, deliberately not done here:** the new sync sends this
  browser's *entire* locally-known `dailyMissionResults` history — every
  contributor's row this device has ever computed or received, not just the
  signed-in visitor's own — mirroring how `groupChallenges`/`dailyQuestTemplates`
  already sync their whole shared squad state. A row for a contributor no
  signed-in device has ever locally computed a mission result for still
  can't appear from nowhere; closing that would need a real
  contributor-identity system, which is a much larger change than this
  slice.

- **⏱️ Word limit presets (`debate-round`'s `WordLimitPresetsPanel`) were orphaned — the account-linked settings-page field with no replacement UI, explicitly named as still open by both `user-settings.mdx`'s "What it no longer shows" and the panel's own header comment ("Nothing in `debate-ai.com` mounts this now").** The backend was fully live: `/api/settings`'s `PUT` handler already supported race-safe `addWordLimitPreset`/`updateWordLimitPreset`/`removeWordLimitPreset` ops (400 on a duplicate name or an invalid limit), `useWordLimitPresets` was already reading/writing that endpoint and both consumers (`/word-count`'s form and the live in-round word-limit meter) already resolved a speech's limit through it — but the one component that lets a user actually add, edit, or remove a preset, `packages/debate-round/src/panels/WordLimitPresetsPanel.tsx`, was fully built, exported, and tested, yet rendered nowhere in the app. `/word-count`'s own panel even showed a "manage them in Settings" hint that linked to `/settings`, which had already been repurposed as the CardMirror editor's settings page and no longer had anywhere to put it — a dead link.

  Mounted `WordLimitPresetsPanel` on `apps/debate-ai.com/app/word-count/page.tsx`, in a collapsible "Manage word limit presets" `<details>` section below the existing `WordCountRoundsPanel` — the same `<details>`-as-secondary-editor pattern `debate-videos`' `StandingsPanel` already uses for its "Qualification points table" section, and the page the panel's own doc comment and `word-count-rounds.mdx` already expected it to land on. Fixed `WordCountRoundsPanel.tsx`'s stale "manage them in Settings" hint to point at the new section on the same page instead of the dead `/settings` link, and removed the now-unused `next/link` import.

  No new logic was introduced — `WordLimitPresetsPanel` and `useWordLimitPresets` were already fully covered by `packages/debate-round/test/wordLimitPresets.test.ts` and `useWordLimitPresets.test.ts` (this repo has no `@testing-library/react`, so page composition itself isn't rendering-tested, matching the convention every other page-mount-only slice in this history has followed). Docs updated: `packages/debate-help-docs/content/docs/features/word-count-rounds.mdx` (presets are now managed on this page, not `/settings`) and `user-settings.mdx`'s "What it no longer shows" bullet (now says where the presets are edited instead of "nothing edits them").

  Ran the verification gate: `bun install`; the two directly affected test files plus the full `wordLimitPresets`/`wordCountRounds` filter (115/115); `bun run typecheck` (17/17 packages); `bun run test` (510 files, 9471 tests, repo-wide, all passing); and `bun run build:web` (production build succeeded, `/word-count` listed in the route manifest).

- **🌱 `POST`/`GET /api/admin/videos/seed` had no UI caller — the exact same
  "backend capability, no admin button" gap the previous slice below closed
  for its sibling `recompute-stacks` endpoint, and which that slice's own
  "Follow-up, deliberately not done here" note explicitly named as still
  open.** `apps/debate-ai.com/app/api/admin/videos/seed/route.ts`'s `POST`
  (admin-gated, upsert-safe re-seed from the bundled JSON assets) and `GET`
  (row count, last-seeded timestamp, and whether `/api/videos` is serving
  from SQL or the JSON fallback — its own doc comment says this exists "so
  the admin page can tell whether to seed") had real SDK wrappers
  (`getVideoSeedStatus`/`seedVideos` in `debate-api-client/src/sdk.ts`) and a
  CLI script (`apps/debate-ai.com/scripts/seed-videos.ts`), but
  `AdminDashboard.tsx` — the only admin page — had no card for it, so seeding
  a fresh or YouTube-synced-but-unseeded database required curl, the SDK, or
  wrangler credentials.

  Added a **Seed videos** card to `AdminDashboard.tsx` (`/admin`), between
  "Resync video view counts" and "Recompute video stacks" — the three cards
  that act on the `videos` table. Same shape as those buttons: a button, a
  loading state, and an inline status line, plus (new here, since this
  endpoint's `GET` returns state the others don't) an initial status fetched
  on mount so the card shows whether the table is seeded at all before the
  button is ever pressed. Pulled both the status line and the post-run result
  line into pure `apps/debate-ai.com/lib/videos/format-seed-videos-result.ts`
  functions (`formatSeedVideosStatus`, `formatSeedVideosResult`), mirroring
  `format-recompute-stacks-result.ts`'s reasoning: `AdminDashboard.tsx` has no
  rendering tests of its own (this repo does not use
  `@testing-library/react`), so a pure formatter is what makes the new text
  actually testable. The status formatter renders `lastSeededAt` as a
  UTC `YYYY-MM-DD` day rather than `toLocaleDateString()`, so the test
  assertions don't depend on the reader's timezone or locale.

  New test file
  `apps/debate-ai.com/lib/videos/__tests__/format-seed-videos-result.test.ts`
  (9 tests): the unseeded-table message; a seeded table serving from SQL;
  rows present but still serving from JSON (the `GET` handler's own read-error
  fallback shape); missing/unparseable `lastSeededAt` falling back to
  "unknown" despite nonzero rows; the run-result line's counts and duration;
  singular vs. plural "statement"; and thousands-separator formatting.
  `seedVideosIntoDb`'s own behavior and the route's admin-gating were
  unchanged — no existing test needed updating.

  Ran the verification gate: `bun install`; the new test file directly (9/9);
  `bun run typecheck` (17/17 packages); `bun run test` (510 files, 9471
  tests, repo-wide, all passing); and `bun run build:web` (production build
  succeeded). Docs updated:
  `packages/debate-help-docs/content/docs/internals/video-library.mdx`
  ("Seeding the table" section now describes the button and where its status
  text comes from, replacing the previous wording that implied a UI entry
  point already existed when none did).

- **🗂️ Learn custom decks (CardMirror's flashcard grouping) had zero UI
  anywhere — `createDeck`/`renameDeck`/`deleteDeck`/`setDeckMembership`
  had no caller outside tests, ever, in this package's history.**
  `packages/debate-help-docs/content/docs/features/learn-decks-cloud-sync.mdx`'s
  own Known gap said decks were "created/edited from the home screen's
  scope picker, which has no sync indicator" — checked against the current
  code and found doubly wrong: `home-screen.ts`'s per-scope "due today"
  rows could only ever *display* an existing deck (clicking one started a
  review; nothing there called a deck mutator), and that whole screen has
  been a permanent no-op since 2026-08-26 per its own `show()` doc comment,
  so it wasn't a reachable path regardless. The full deck data model,
  D1-backed account sync (`learn-decks-sync.ts`, `/api/learn-decks`), and
  concurrent-edit-safe op merge already existed and were fully tested
  (`learn-decks-sync.test.ts`, `learn-store.test.ts`) — but a deck could
  only ever come to exist on a device by account sync adopting one created
  *somewhere*, and nowhere could create the first one. Decks were fully
  unreachable end to end.

  Added `packages/debate-editor/src/editor/learn-deck-manage-ui.ts`, mirroring
  `learn-review-log-ui.ts`'s established shape exactly: a `buildDeckManageSection`
  pure-DOM section (injectable `store`/`sync` pair for testability, no React,
  matching this package's vanilla-DOM convention) and an `openDeckManage()`
  overlay wrapper with the same escape-key/click-outside chrome as
  `openReviewLogHistory`. Wired a new **Decks** button into `learn-manage-ui.ts`'s
  bar, next to **History**. The section: lists decks sorted by name with a
  card count; **New deck**/**Rename** (via the shared `promptForText` modal);
  two-click **Delete** (avoids native `confirm`, which Electron disables —
  the same arm/disarm pattern the card list's own delete button already
  uses); and a **Cards** toggle that expands a deck to show its member cards
  (front text, with a **Remove** button — falling back to "(deleted card)"
  for the same soft-reference gap `learn-review-log-ui.ts` already accepts)
  plus an "Add a card…" `<select>` of every card not yet in the deck. Shows
  the same coarse "Synced to your account" / "Not synced — sign in to sync"
  line (`learnDecksSync.isSynced()`) the flashcard list and Review history
  already do — `LearnDecksSync` tracks no per-deck status (pushes/deletes
  are fire-and-forget), so a per-deck sync badge isn't possible without
  adding that state to the sync class first (see Follow-up).

  New test file `learn-deck-manage-ui.test.ts` (14 tests, mirroring
  `learn-review-log-ui.test.ts`'s structure against injected
  `LearnStore`/`LearnDecksSync` instances rather than the app singletons):
  empty state; listing/sorting; live re-render on create/rename/delete;
  destroy stops re-rendering; two-click delete; expanding to show/remove
  cards; the deleted-card placeholder; adding a card via the select; the
  select disappearing once every card is already a member; and the three
  sync-status cases (signed out, signed in once the merge resolves, and
  reusing an already-in-flight `sync.init()`). "New deck" and "Rename"
  themselves open a real `promptForText` modal, which no test in this
  package mocks (matching `learn-manage-ui.ts`'s own untested "New
  card"/"Edit" buttons for the same reason) — covered indirectly by driving
  the store mutations those flows would eventually make and asserting the
  section renders the result.

  Ran the verification gate: `bun install`; the new test file directly
  (12/12); the rest of `debate-editor`'s suite alongside it (901/901);
  `bun run typecheck` (17/17 packages); `bun run test` (509 files, 9462
  tests, repo-wide, all passing); and `bun run build:web` (production build
  succeeded). Docs updated:
  `packages/debate-help-docs/content/docs/features/learn-decks-cloud-sync.mdx`
  (Known gaps, and the correction to the stale "scope picker" description).

  **Follow-up, deliberately not done here:** `LearnDecksSync` has no
  per-deck pending/error state — a failed push or delete is silently
  swallowed (`.catch(() => {})`) with nothing retained anywhere, so the new
  UI can only show one coarse account-wide sync line, not a per-deck badge
  the way a genuine conflict-tracking sync would. Adding a
  `Map<deckId, 'pending' | 'synced' | 'error'>` to the class (populated in
  `handleStoreChange`/`pushDeckChange`'s catch blocks) is a reasonable
  follow-up if a user ever needs to tell "still syncing" apart from
  "actually failed" for a specific deck.

- **🏆 Group Challenge win events never synced to the account — the same
  "per-browser localStorage, not account-synced" gap every other Team
  section store on `/cards/progress-tracking`/`/cards/leaderboard` already
  closed.** `state/challengeWinEvents.ts`'s `ChallengeWinEvent`
  (`{ contributorId, occurredAt }`) had no per-record id — `contributorId`
  repeats across every win a squad member records toward a `win_target`
  `groupChallenges` challenge, so it couldn't join
  `debate-data-sync`'s `TOOL_RECORD_COLLECTIONS` allowlist the way
  `roundContributorFlows`/`contributorAvailability` (both `contributorId`-keyed)
  and `completedResearchTasks` (fixed the same way previously) already did. A
  win recorded on one device was invisible on another even though the
  `groupChallenges` roster it scores against already synced.

  Gave `ChallengeWinEvent` an optional `id` field (`lib/group-challenges.ts`)
  and `recordChallengeWinEvent` (`state/challengeWinEvents.ts`) now stamps
  every new event with a generated
  `challenge-win-event-${Date.now()}-${random}` id, mirroring
  `state/researchProgress.ts#generateCompletedTaskId`'s convention exactly.
  Left `id` optional rather than required on the shared pure type, since
  `lib/group-challenges.ts`'s matching/scoring functions only ever read
  `contributorId`/`occurredAt` and dozens of test object literals across
  `group-challenges.test.ts` build `ChallengeWinEvent`s directly without one —
  a pre-existing persisted event with no id simply stays un-synced until it's
  next touched, the same tolerance `completedResearchTasks` already
  documents. Added the `challengeWinEvents` catalog entry (`idField: "id"`,
  section "Team", href `/cards/leaderboard` — matching its `groupChallenges`
  sibling).

  New tests: `challengeWinEvents.test.ts` (the stamped id shape, and that two
  events for the same contributor at the identical timestamp still get
  distinct ids rather than colliding); `tool-record-catalog.test.ts` (the new
  `EXPECTED_ID_FIELDS` entry and a pinning test for the catalog entry
  itself). Confirmed no other test asserts an exact `ChallengeWinEvent` shape
  that the new field would break, other than the two in
  `challengeWinEvents.test.ts` itself, which were updated to check the id's
  presence/uniqueness rather than its exact value.

  While in the area, fixed a second, unrelated stale doc comment found during
  the same investigation: `state/researchProgressGoals.ts`'s module comment
  still said "Deliberately local-only, not account-synced... a future run can
  add account sync" — false since `hooks/useResearchProgressGoalSync.ts` and
  `lib/research-progress-goal-sync.ts` already sync it through `/api/settings`'
  `researchProgressGoal` field (confirmed wired end to end: `schema.ts`'s
  `research_progress_goal` column, the `/api/settings` route's read/write, and
  `ResearchProgressPanel.tsx` calling the hook). Updated the comment to
  describe the sync that already exists, rather than one still to be added.

  Ran the verification gate: `bun install`; the affected/new test files
  directly (101/101); the wider `debate-data-sync`, `debate-team-collaboration`,
  `debate-contributor-progress` suites plus `debate-videos`' catalog
  cross-check alongside them (2024/2024); `bun run typecheck` (17/17
  packages); `bun run test` (508 files, 9450 tests, repo-wide, all passing);
  and `bun run build:web` (production build succeeded). Docs updated:
  `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx`
  (Team section's "Which tools sync" list) and
  `packages/debate-help-docs/content/docs/features/group-challenges.mdx`
  (noted both its localStorage stores now sync to the account).

- **🔘 No admin UI button called the `/api/admin/videos/recompute-stacks`
  backfill endpoint.** The previous slice below added
  `POST /api/admin/videos/recompute-stacks` (admin-gated, re-derives stacked
  playlists for every row) but left it curl/SDK-only, mirroring
  `/api/admin/videos/seed`'s own missing button — its own "Follow-up,
  deliberately not done here" note named this as "a reasonable small
  follow-up if an admin actually needs the historical backfill".

  Added a **Recompute stacks** card to `AdminDashboard.tsx` (`/admin`),
  next to "Resync video view counts" — same shape as that button and
  "Purge old entries now": a button, a loading state, an inline result
  summary, and an error line. Pulled the two-way "nothing moved" / "N of M
  updated" message into its own pure
  `apps/debate-ai.com/lib/videos/format-recompute-stacks-result.ts` rather
  than building it inline, since `AdminDashboard.tsx` has no rendering tests
  of its own (this repo does not use `@testing-library/react` anywhere — no
  component here does), so a pure formatter is what makes the new behavior
  actually testable with Vitest.

  New test: `lib/videos/__tests__/format-recompute-stacks-result.test.ts`
  (no-changes phrasing, partial-update phrasing, every-row-updated, an empty
  table, and thousands-separator formatting for a large library). The
  underlying `recomputeVideoStacks` and the route's admin-gating were already
  covered by the prior slice's tests; nothing about either changed here.

  Ran the verification gate: `bun install`; the new test file plus the
  existing `recompute-video-stacks.test.ts` directly (9/9); `bun run
  typecheck` (17/17 packages); `bun run test` (508 files, 9448 tests,
  repo-wide, all passing); and `bun run build:web` (production build
  succeeded). Docs updated:
  `packages/debate-help-docs/content/docs/internals/video-library.mdx`
  (Known gaps, noting the button).

- **🎞️ Stacked playlists never formed for any video published outside the
  JSON-asset seed — and a re-seed couldn't fix it either.**
  `debate-data-sync/src/videos/video-stacks.ts`'s `assignVideoStacks` only
  ever ran over rows built fresh from the bundled JSON assets
  (`video-rows.ts#buildVideoRows`, driving `seed-videos-to-db.ts`'s full
  seed). A round published through the live YouTube pipeline
  (`publish-round-video.ts#publishRoundVideos`, behind the admin
  "Publish"/"Publish all" actions, and the legacy single-round `POST
  /api/admin/youtube/videos/publish` endpoint the SDK/OpenAPI spec also
  expose) was inserted with no `stack_key`/`stack_position` at all, and
  running a full JSON re-seed never touched it either, since it was never
  part of the JSON assets to begin with — confirmed against
  `content/docs/internals/video-library.mdx`'s own Known gap, which
  understated this as "no stacks until re-seeded" when a re-seed in fact
  never reached these rows at all.

  Generalized `buildVideoStacks`/`assignVideoStacks` to be generic over a new
  `VideoStackRow` (the six fields stacking actually reads/writes) instead of
  requiring a full `VideoRow`, so a bare SQL projection off the `videos`
  table can be stacked directly. Added
  `debate-data-sync/src/videos/video-stack-sql.ts`'s
  `buildVideoStackUpdateStatements` (a `CASE`/`IN` batched `UPDATE` builder,
  mirroring `view-count-sql.ts`'s shape exactly) and
  `apps/debate-ai.com/lib/videos/recompute-video-stacks.ts`'s
  `recomputeVideoStacks(db)`, which re-derives every row's placement over the
  *whole* table (a round and its analysis are commonly published weeks apart
  by different pipelines, so the link can only be found by looking at
  everything at once) and rewrites only what changed. Wired it into both
  publish paths (`publishRoundVideos` and the legacy single-round route) so
  every future publish keeps stacking current on its own, and added
  `POST /api/admin/videos/recompute-stacks` (admin-gated, mirroring
  `/api/admin/videos/seed`'s shape) so a database whose stacks already fell
  behind can be backfilled in one call — safe to re-run, since an
  already-correct row produces no write.

  New tests: `video-stack-sql.test.ts` (the statement builder: both `CASE`
  columns, a `NULL` key, escaping, dedup-keeps-last, row/byte batching);
  `recompute-video-stacks.test.ts` (against a real in-memory SQLite
  `videos` table: links two previously-unstacked rows, links a row to a
  partner added in a later run, no-ops when nothing moved, clears a stack
  once its partner is deleted); a new `publishRoundVideos stacking` suite in
  `publish-round-video.test.ts` (publishing a round links it to an
  already-stored analysis video; nothing runs when nothing was actually
  published). `video-stacks.test.ts`'s existing suite needed no changes —
  the generic signature is satisfied by the same `VideoRow[]` it already
  passed.

  Ran the verification gate: `bun install`; the affected/new test files
  directly (28/28); the wider video-library suite alongside them (47/47);
  `bun run typecheck` (17/17 packages); `bun run test` (506 files, 9431
  tests, repo-wide, all passing); and `bun run build:web` (production build
  succeeded). Docs updated:
  `packages/debate-help-docs/content/docs/internals/video-library.mdx`
  (Known gaps) and a schema comment in `apps/debate-ai.com/lib/database/schema.ts`.

  **Follow-up, deliberately not done here:** no admin UI button calls the new
  `/api/admin/videos/recompute-stacks` endpoint — mirroring
  `/api/admin/videos/seed`, which also has no button in `AdminDashboard.tsx`
  and is only ever called directly (curl, the SDK, or the CLI script). A
  "Recompute stacks" button alongside "Publish all" would be a reasonable
  small follow-up if an admin actually needs the historical backfill rather
  than relying on the now-automatic per-publish recompute.

- **🔄 The Debate Docs workspace's open chat tabs stayed per-browser.**
  `apps/debate-ai.com/components/qwksearch/useChatTabs.ts` keeps
  `qwksearch-open-chat-tabs` — which chat conversations are open as tabs in
  `/doc`'s sidebar, and their titles — in a plain `localStorage` array of
  `{ id, title, hasMessages? }` records. That's exactly the shape
  `TOOL_RECORD_COLLECTIONS` requires (a JSON array under one key, each record
  keyed by a stable string field), but the store had never been added to the
  catalog, so a tab layout built up on one device was invisible after signing
  in on another — the same "per-browser localStorage, not account-synced" gap
  `tool-data-sync.mdx` documents for a dozen other tools. (The chat
  conversation *content* itself is unaffected — it's owned by the
  third-party `research-agent-ui` package's own backend and fetched by id;
  only the tab list and titles were missing a home.)

  Added one entry (`docsChatTabs`) to
  `packages/debate-data-sync/src/state/toolRecordCollections.ts`'s
  `TOOL_RECORD_COLLECTIONS` allowlist — the sync's whole design point is that
  this is enough: `state/tool-record-auto-sync.ts`'s watcher observes any
  catalog entry and pushes/pulls its changes with no edit to `useChatTabs.ts`
  itself. Updated `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx`'s
  "Which tools sync" table to list it, and added a pinning test to
  `packages/debate-data-sync/test/tool-record-catalog.test.ts` (its
  `EXPECTED_ID_FIELDS` map, and a dedicated `it` asserting the new entry's
  `storageKey`/`idField`/`href`) — the existing
  `packages/debate-videos/test/tool-record-sync-catalog.test.ts` already
  covers that every collection's `href` resolves to a real sidebar link
  (`/doc` does), so nothing there needed changing.

  Ran the verification gate: `bun install`; the two affected test files
  directly (38/38); `packages/debate-videos/test/tool-record-sync-catalog.test.ts`
  plus the rest of `debate-data-sync`'s suite (630/630); `bun run typecheck`
  (17/17 packages); `bun run test` (503 files, 9395 tests, repo-wide, all
  passing); and `bun run build:web` (production build succeeded). No source
  behavior of `useChatTabs.ts` changed — only the catalog and docs.

  ~~**Follow-up, deliberately not done here:** the same `/doc` workspace's
  file browser (`apps/debate-ai.com/components/qwksearch/lib/file-sources.ts`,
  `localStorage` key `REASON-file-sources`) has the identical array-of-records
  shape and is also missing from the catalog, but its records can carry
  plaintext SSH passwords, S3/R2/B2 secret keys and Google OAuth refresh
  tokens (`fileSource-types.ts`'s `FileSource.credentials`). The generic
  `/api/tool-records/[collection]` route only checks for a usable id and
  stores whatever JSON it's handed verbatim — no field-level redaction — so
  adding a plain allowlist entry would put unencrypted storage credentials
  into the shared `saved_tool_records` table. Closing this one needs a
  redaction or encryption pass first (see `editorPreferences`' own precedent
  of deliberately never syncing credentials), not a one-line catalog entry.~~
  **Done:** see the entry below.

- **📝 `Flow Annotations`' "no cloud sync" Known gap was stale — the sync
  already shipped.** `features/flow-annotations.mdx` said "No
  collaborative/live sync — annotations are local `localStorage` only."
  Confirmed false against the current code:
  `packages/debate-practice-drills/src/state/flowAnnotations.ts`'s
  `saveFlowAnnotation`/`deleteFlowAnnotation` already call
  `mirrorToolRecordSave`/`mirrorToolRecordDelete`, `flowAnnotations` is
  already a `TOOL_RECORD_COLLECTIONS` entry (added the same week as this doc
  went stale), and `internals/tool-data-sync.mdx` already lists Flow
  Annotations among the tools that Known gap was closed for. The one thing
  actually missing was `features/flow-annotations.mdx` itself never being
  updated to say so — confirmed by
  `packages/debate-practice-drills/test/tool-record-sync-wiring.test.ts`'s
  pre-existing "flow annotations" suite, which already pins the save+delete
  requests, the still-writes-locally-on-a-500 fallback, and the
  no-request-while-signed-out case; nothing there needed changing.

  Rewrote the doc's Known gaps to describe the real, already-tested
  behavior (with a `~~struck~~` **Fixed:** note, matching this file's own
  convention elsewhere) and linked out to `internals/tool-data-sync.mdx` for
  the gaps that genuinely still apply to every synced tool-record collection
  (per-user, not per-team; next-reload rather than live). Also added the
  mirror hop to the "Data flow" diagram.

  Docs-only change — no source behavior changed, so no new test was needed;
  the existing wiring test already covers the behavior the doc now
  describes. Ran the verification gate: `bun install`; the two affected test
  files directly (21/21); `bun run typecheck` (17/17 packages, including
  `debate-help-docs`' `fumadocs-mdx` MDX compile); `bun run test` (503
  files, 9394 tests, repo-wide, all passing); and `bun run build:web`
  (production build succeeded). Docs updated:
  `packages/debate-help-docs/content/docs/features/flow-annotations.mdx`.

- **🔒 The `/doc` file browser's configured storage backends never synced to
  the account — closing the file-sources follow-up above, with the
  redaction it needed.** `file-sources.ts`'s `REASON-file-sources` store
  (which SSH/S3/R2/B2/Google Docs/Turso sources a user has connected) has the
  catalog's required shape, but a source's `credentials` can hold a plaintext
  SSH password or private key, an S3/R2/B2 secret access key, or a Google
  OAuth refresh token — and `/api/tool-records/[collection]` stores whatever
  JSON a collection hands it verbatim, with no redaction of its own. A plain
  allowlist entry, the way every other collection joins, would have put those
  secrets into `saved_tool_records` unencrypted.

  Gave `ToolRecordCollection` one more, optional field: `redact`, a pure
  `(record) => record` a collection can define to strip fields that must
  never leave this browser. Wired it into all three push sites —
  `mirrorToolRecordSave`/`mirrorToolRecordsSave` (the immediate mirror),
  `hydrateToolRecords`' first-sign-in push of local-only records, and
  `flushToolRecordCollection`'s auto-sync watcher — never into what a tool
  reads back out of its own `localStorage`. Added
  `packages/debate-data-sync/src/state/redact-file-source.ts`'s
  `redactFileSource`: an **allowlist** per `FileSourceType` (host/port/
  username for SSH, region/bucket for S3, …), not a blocklist of
  secret-looking names, so a credential field added to `fileSource-types.ts`
  later defaults to held back rather than defaulting to synced.

  Redacting on the way up only works if the merge doesn't then read the
  account's now-missing field as the account clearing it — the bug a naive
  version of this would have shipped, since `mergeToolRecords` replaces a
  local record wholesale with the account's copy for any id both sides hold.
  Gave it `restoreRedactedFields`: for a `redact`-carrying collection, fills
  back whatever the local copy has that the remote copy doesn't (recursing
  into `credentials` itself), so a password saved on one device survives that
  device's own next reconcile instead of being wiped out by its own redacted
  upload. Added the `fileSources` entry (`idField: "id"`, `href: "/doc"`,
  section "Flowing and writing", alongside the already-synced
  `docsChatTabs`).

  New tests: `redact-file-source.test.ts` (what `redactFileSource` keeps and
  drops per source type, and that it leaves anything not shaped like a File
  Sources record alone); `toolRecordCollections.test.ts` (the redact/restore
  round trip through `mergeToolRecords`, both with a synthetic redact-carrying
  collection and with the real `fileSources` one, plus that a non-redacted
  collection is unaffected); `tool-record-mirror.test.ts` and
  `tool-record-auto-sync.test.ts` (each push site sends the redacted payload,
  not the raw record, including that the watcher's *diff* still runs against
  raw local JSON so a secret-only edit still counts as a change even though
  its redacted payload is identical to what already landed);
  `tool-record-catalog.test.ts` (the new `EXPECTED_ID_FIELDS` entry and a
  pinning test that `fileSources.redact` is actually a function that redacts).
  `debate-videos/test/tool-record-sync-catalog.test.ts`'s existing loop
  already covers `/doc` being a real sidebar destination, so nothing there
  needed changing.

  Ran the verification gate: `bun install`; the five affected/new test files
  directly (113/113); the rest of `debate-data-sync`'s suite plus
  `debate-videos`' catalog cross-check (652/652); `bun run typecheck` (17/17
  packages); `bun run test` (504 files, 9417 tests, repo-wide, all passing);
  and `bun run build:web` (production build succeeded). Docs updated:
  `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx` (new
  "Redacted fields" section, and the `fileSources` entry in "Which tools
  sync").

  **Follow-up, deliberately not done here:** `redactFileSource` still leaves
  a Google Docs source's `email` and `folderIds` synced, and an SSH source's
  `host`/`port`/`username` — connection metadata, not secrets by themselves,
  but enough to identify *who* a user has connected to without their consent
  if the account were ever compromised. Nothing today reads that as a gap
  (every other collection syncs comparably identifying data, e.g. Opponent
  Team Profiles), so this is a note for a future privacy pass, not a blocker.

# Ideas for New Contributors

_The list below predates this file's numbered-idea tracking convention and
is generic starter material, not audited against the current codebase —
treat entries here as inspiration to investigate, not confirmed gaps. See
"Tracker Status" above for the actual, current state of similarly-themed
work in this repo._

### 1. **Real-time Debate Rooms with WebSockets**
- **Description**: Implement live debate rooms where multiple users can join and debate in real-time with typing indicators, presence, and instant message delivery
- **Tech Stack**: WebSockets (Socket.io or native WS), Redis for pub/sub, React/Vue frontend
- **Difficulty**: Medium-High
- **Good First Issue**: Start with basic room creation/joining, then add real-time messaging

### 2. **AI-Powered Argument Analysis & Feedback**
- **Description**: Build a feature that analyzes debate arguments for logical fallacies, evidence quality, and rhetorical strength, providing constructive feedback
- **Tech Stack**: NLP (spaCy, transformers), OpenAI/Anthropic API or local LLMs, Python/FastAPI backend
- **Difficulty**: High
- **Good First Issue**: Implement fallacy detection for common fallacies (ad hominem, straw man, false dichotomy)

### 3. **Debate Tournament & Bracket System**
- **Description**: Create a tournament mode with brackets, seeding, elimination rounds, and leaderboards for competitive debating
- **Tech Stack**: Database (PostgreSQL/MongoDB), bracket generation algorithms, real-time updates
- **Difficulty**: Medium
- **Good First Issue**: Design the data model for tournaments, matches, and participants

### 4. **Multi-language Debate Support with Translation**
- **Description**: Enable debates across languages with real-time translation, allowing global participation
- **Tech Stack**: Translation APIs (Google Translate, DeepL, or LibreTranslate), i18n framework, language detection
- **Difficulty**: Medium
- **Good First Issue**: Add language selection to user profiles and basic UI translation

### 5. **Argument Visualization & Mind Mapping**
- **Description**: Visual representation of debate structure - claim trees, evidence links, rebuttal chains, and argument maps
- **Tech Stack**: D3.js, Cytoscape.js, or React Flow for interactive graphs, export to image/PDF
- **Difficulty**: Medium-High
- **Good First Issue**: Build a simple claim-evidence tree component with expand/collapse

---

## Additional Ideas (Bonus)

### 6. **Mobile-Responsive PWA with Offline Support**
- Service workers, IndexedDB for offline drafting, push notifications for debate updates

### 7. **Voice Debate Mode**
- Speech-to-text for arguments, text-to-speech for reading opponent arguments, voice activity detection

### 8. **Debate Coaching AI Persona**
- Configurable AI personas (Socratic, Devil's Advocate, Fact-Checker) for practice sessions

### 9. **Evidence Library & Citation Manager**
- Shared evidence database, auto-citation formatting, source credibility scoring

### 10. **Analytics Dashboard for Debaters**
- Personal stats: win rate, fallacy frequency, argument length, topic expertise, improvement trends


11. abiltiy to challenge legends - and speculators bet
12. 

---

## Contribution Guidelines

1. **Pick an issue** or propose your own - comment on the issue to claim it
2. **Start small** - break large features into PR-sized chunks
3. **Write tests** - aim for >80% coverage on new code
4. **Follow code style** - run linting/formatting before submitting
5. **Update docs** - README, API docs, and in-code comments
