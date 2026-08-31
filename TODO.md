
## Tracker Status

### In progress

_No task currently in progress._

### Completed
- **AI Judge Decision Modes — bulk "clear all history for this round"
  action (idea #5, "a bulk 'clear all history for this round' action,
  and/or a per-round decision count cap").** Prompted by another repeat of
  the standing prompt ("go through the tools and the todo.md ideas and
  incorporate them into the ui... integrate card mirror better into the
  editor and also have its commands in the central menu of Ctrl shift
  space... menu items on top of the top bar like Google docs... create user
  settings and link user db SQL with ability to save flows docs and debates
  in SQL and link to users... add tools into where needed in the ui...
  develop better tool ui"), and finding — like every recent repeat — that
  CardMirror's MenuBar/command-palette integration and the SQL-linked user
  settings/flows/docs/rounds system are already fully built, this slice
  picked up idea #5's own still-open third "Next" bullet (the immediately
  preceding run had already closed the first, the per-round decision
  history log): `JudgeDecisionPanel.tsx` had a per-decision "Clear" action
  but no way to clear an entire round's history at once, so a heavily
  re-judged round could only be emptied one click per decision. Added
  `deleteJudgeDecisionsForRound(roundId)` to
  `packages/debate-round/src/state/judgeDecisions.ts` — removes every record
  for that round in a single `writeAll`, returning the removed ids
  newest-first (a no-op, no write, empty return for a round with no
  history), mirroring `listJudgeDecisionsForRound`'s existing filter/sort.
  `hooks/useJudgeDecisions.ts` gained `deleteRoundHistory(roundId)`: applies
  the bulk removal locally first (matching `deleteDecision`'s local-first
  order), then — only when `remoteAvailable` — best-effort fires one `DELETE
  /api/judge-decisions/[decisionId]` per removed id via the existing
  `deleteSavedJudgeDecisionFromAccount` (no new bulk-delete route needed,
  since the per-decision endpoint already exists and this is a low-frequency
  action). `JudgeDecisionPanel.tsx`'s per-round heading now has a "Clear all
  history for this round" button next to the existing per-decision "Clear"
  buttons. Documented in `docs/features/judge-paradigm-selections.md` (new
  "Bulk clear a round's history" paragraph under "Decision history", noting
  the per-round decision count cap half of this "Next" bullet was
  intentionally left open). Vitest-covered: 3 new cases for
  `deleteJudgeDecisionsForRound` in
  `packages/debate-round/test/judgeDecisions.test.ts` (removes only the
  given round's decisions leaving other rounds untouched, returns removed
  ids newest-first, no-op with an empty return for a round with no history),
  bringing that file to 20 cases. `useJudgeDecisions.ts`'s
  `deleteRoundHistory` and its wiring in `JudgeDecisionPanel.tsx` remain
  intentionally untested, matching this package's existing convention for
  account-synced, `localStorage`-backed hooks and their UI (`deleteDecision`
  and `appendDecision` follow the same pattern already). Verified: `bun
  install` (2258 packages), `bun x vitest run
  packages/debate-round/test/judgeDecisions.test.ts` (20/20 pass) and the
  full `bun run test` (201 files / 3208 tests, all pass, up from 201/3205),
  the whole-repo `bun run typecheck` (12 packages via turbo, all passing),
  a direct `npx tsc --noEmit -p apps/debate-ai.com/tsconfig.json` (35
  pre-existing errors — identical baseline to the immediately preceding
  run's own count, confirming no regression, none touching the files this
  slice changed), and a full production `bun run build:web` (vinext build +
  offline-service-worker build, both complete clean, `/judge-decision`
  present in the route list). **Completed:** 2026-08-31.
- **AI Judge Decision Modes — decision history log per round (idea #5,
  "A decision history log per round instead of only the latest
  result").** Prompted by another repeat of the standing prompt
  ("integrate all the tools and create user settings and link user db SQL
  with ability to save flows docs and debates in SQL and link to users...
  develop better tool ui"), and finding — like every recent repeat — that
  the SQL-linked user settings/flows/docs/rounds system is already fully
  built, this slice picked up idea #5's own still-open "decision history"
  follow-up: before this, `state/judgeDecisions.ts` kept only one
  `JudgeDecisionRecord` per `roundId` (`saveJudgeDecision` overwrote any
  existing entry in place), so requesting a second AI decision for the same
  round silently discarded the first. `JudgeDecisionRecord` gained an `id`
  field (generated as `decision-<timestamp>-<random>`, matching this
  package's existing `FlowAnnotationsPanel`/`FlowEditLogPanel` id-generation
  convention) and the store switched to append-only: `appendJudgeDecision`
  always adds a new entry, `getJudgeDecision`/`deleteJudgeDecision` are now
  keyed by that `id` rather than `roundId`, a new
  `listJudgeDecisionsForRound` returns a round's history newest-first, and
  `buildJudgeDecisionsPanelView` groups every decision by `roundId` (sorted
  by `roundId`, each round's decisions newest-first) for
  `JudgeDecisionPanel.tsx`, which now renders one section per round with a
  "Clear" action per decision instead of one row per round. Also
  account-synced in the same slice, following the exact `saved_flows`
  precedent one more time: a new `saved_judge_decisions` D1 table
  (migration `0016_furry_skrulls.sql`, generated via `drizzle-kit
  generate`) — one row per *decision* (not per round, since a round can
  have many), `clientId` holding the decision's own generated `id` (unique
  per user) and a separate non-unique `roundId` column indexed for
  per-round history lookups, `data` holding the whole `JudgeDecisionRecord`
  JSON-stringified. `GET /api/judge-decisions` returns every synced decision
  in full (small payload, same shape as `/api/word-count-rounds`), and
  `PUT`/`DELETE /api/judge-decisions/[decisionId]` upsert/remove one,
  validated by a new pure `packages/debate-round/src/state/savedJudgeDecisions.ts`
  (`isValidJudgeDecisionRecord`, `MAX_SAVED_JUDGE_DECISION_BYTES`) and a
  fetch wrapper, `round/judge-decisions-client.ts`, mirroring
  `word-count-rounds-client.ts`'s split and 401-tolerant read/throwing-write
  convention. A new local-first hook, `hooks/useJudgeDecisions.ts`, replaces
  `JudgeDecisionPanel`'s direct calls into `state/judgeDecisions.ts`: on
  mount it merges local and remote history by each decision's own `id`
  (deduped across instances via a module-level promise, mirroring
  `useWordCountRounds`) — a remote-only decision is adopted locally via a
  new `adoptJudgeDecision`, and a local-only decision is best-effort pushed
  to the account — then `appendDecision`/`deleteDecision` apply locally
  first and best-effort sync the same change outward. `JudgeDecisionPanel`
  now shows a "Decision history is synced to your account" / "Sign in to
  sync your decision history" hint, mirroring `WordCountRoundsPanel`'s
  existing hint-text convention. See
  `docs/features/judge-paradigm-selections.md`'s new "Decision history"
  section. Vitest-covered: `judgeDecisions.test.ts`'s full rewrite for the
  append-only shape — `appendJudgeDecision`'s id assignment and
  never-overwrites behavior, `listJudgeDecisionsForRound`'s newest-first
  per-round filtering, `adoptJudgeDecision`'s insert/overwrite-by-id
  behavior, `deleteJudgeDecision`'s delete-by-id behavior, and
  `buildJudgeDecisionsPanelView`'s grouping/sorting (17 tests, up from 5);
  `isValidJudgeDecisionRecord`'s full validation surface (new
  `savedJudgeDecisions.test.ts`, 17 cases); and the fetch wrapper's request
  shapes plus 401/error handling (new `judge-decisions-client.test.ts`, 7
  cases) — 41 across these three files. `useJudgeDecisions` and its wiring
  in `JudgeDecisionPanel` remain intentionally untested, matching this
  package's existing convention for account-synced, `localStorage`-backed
  hooks and their UI (`useWordCountRounds` follows the same pattern).
  Verified: `bun install`, the three touched/new test files (44/44 pass),
  the full `bun run test` (201 files / 3205 tests, all pass, up from 199/3171),
  the whole-repo `bun run typecheck` (12 packages via turbo, all
  passing — `apps/debate-ai.com` has no `typecheck` script of its own, so
  its new route files were additionally verified with a direct `tsc
  --noEmit` pass, confirming zero new errors versus the pre-existing
  baseline, which already carries unrelated errors — Cloudflare Workers
  ambient types, `better-auth` client plugin types, missing `.svg`/`.png`
  type declarations — none touching the files this slice added or
  changed), and a full production `bun run build:web` (vinext build +
  service-worker build, both new API routes correctly registered as `λ`
  endpoints) — all passed with no new failures.
- **Word-Count-Only Speech Format — account-sync round history (idea #2,
  "Account-sync round history itself (today `wordCountRounds` is
  local-storage-only, unlike `wordLimitPresets`), so the trend view follows a
  signed-in user across devices instead of staying per-browser").** Prompted
  by another repeat of the standing prompt ("integrate all the tools and
  create user settings and link user db SQL with ability to save flows docs
  and debates in SQL and link to users... develop better tool ui"), and
  finding — like every recent repeat — that the SQL-linked user
  settings/flows/docs/rounds system is already fully built, this slice
  closed idea #2's last remaining follow-up: `state/wordCountRounds.ts`'s
  persisted rounds (and therefore the word-count trend view from the
  previous slice) never left the browser they were saved in. Added a new
  `saved_word_count_rounds` D1 table (migration
  `0015_magenta_microbe.sql`, generated via `drizzle-kit generate`) — one
  row per `(user, roundId)` pair, `data` holding the whole
  `WordCountRoundRecord` JSON-stringified — following the same shape
  `saved_flows`/`saved_rounds` already established, except keyed by a
  `text` `client_id` (the caller-typed string `roundId`) rather than an
  `integer` one. Unlike those two tables' summary-list-then-per-item-fetch
  split, a word-count round's payload is small enough that the new
  `GET /api/word-count-rounds` route returns every record in full, and
  `PUT`/`DELETE /api/word-count-rounds/[roundId]` upsert/remove one
  (`apps/debate-ai.com`), validated by a new pure
  `packages/debate-round/src/state/savedWordCountRounds.ts`
  (`isValidWordCountRoundRecord`, `MAX_SAVED_WORD_COUNT_ROUND_BYTES`) and a
  fetch wrapper, `round/word-count-rounds-client.ts`, mirroring
  `saved-flows-client.ts`'s split and 401-tolerant read/throwing-write
  convention. A new local-first hook, `hooks/useWordCountRounds.ts`,
  replaces `WordCountRoundsPanel`'s direct calls into
  `state/wordCountRounds.ts`: on mount it merges local and remote history
  by `roundId` (deduped across instances via a module-level promise,
  mirroring `useWordLimitPresets`) — a remote-only record is adopted
  locally via a new `adoptWordCountRound` (which preserves the record's own
  `createdAt` rather than stamping a fresh one, unlike
  `saveWordCountRound`, so a round synced from another device still sorts
  correctly in the trend view), and a local-only record is best-effort
  pushed to the account — then `saveRound`/`deleteRound` apply locally
  first and best-effort sync the same change outward. `WordCountRoundsPanel`
  now shows a small "synced to your account" / "sign in to sync" hint,
  mirroring `WordLimitPresetsPanel`'s existing hint-text convention. See
  `docs/features/word-count-rounds.md`'s new "Account-synced round history"
  section. Vitest-covered: `adoptWordCountRound`'s createdAt-preserving and
  overwrite behavior (`wordCountRounds.test.ts`, 25 cases, up from 23);
  `isValidWordCountRoundRecord`'s full validation surface (new
  `savedWordCountRounds.test.ts`, 18 cases); and the fetch wrapper's
  request shapes plus 401/error handling (new
  `word-count-rounds-client.test.ts`, 7 cases) — 50 across these three
  files. `useWordCountRounds` and its wiring in
  `WordCountRoundsPanel` remain intentionally untested, matching this
  package's existing convention for account-synced, `localStorage`-backed
  hooks and their UI (`useWordLimitPresets` follows the same pattern).
  Verified: `bun install` (2258 packages), `bun x vitest run` against the
  three touched/new test files (50/50 pass), full `bun run test` (199
  files / 3171 tests, all pass, up from 197/3144), the whole-repo `bun run
  typecheck` (12 packages via turbo, all cached/passing — `apps/debate-ai.com`
  has no `typecheck` script of its own, so its new route files were
  additionally verified with a direct `tsc --noEmit` pass, confirming zero
  new errors versus the same command run against the pre-existing baseline,
  which already carries 29 unrelated errors — Cloudflare Workers ambient
  types, `better-auth` client plugin types, missing `.svg`/`.png` type
  declarations — none touching the files this slice added or changed), and
  a full production `bun run build:web` (vinext build + service-worker
  build, both new API routes correctly registered as `λ` endpoints) — all
  passed with no new failures.
- **Word-Count-Only Speech Format — word-count trend view (idea #2,
  "A trend view showing a debater's word-count-vs-limit history across past
  submissions").** Prompted by another repeat of the standing prompt
  ("integrate all the tools and create user settings and link user db SQL
  with ability to save flows docs and debates in SQL and link to users...
  develop better tool ui"), and finding — like every recent repeat — that
  the SQL-linked user settings/flows/docs/rounds system is already fully
  built, this slice picked up idea #2's last remaining "next" bullet: past
  word-count submissions were only visible per-round in `/word-count`'s
  persisted-round list, with no way to see a debater's counts trend across
  rounds over time. `WordCountRoundRecord` (`state/wordCountRounds.ts`)
  gained an optional `createdAt?: number`, stamped by `saveWordCountRound`
  the first time a `roundId` is saved and preserved (not overwritten) across
  later updates to that same `roundId` — both existing save sites (the
  standalone form and the live in-round meter's
  `persistWordCountSpeechMode`) already funnel through `saveWordCountRound`,
  so both get dated for free. A record saved before this field existed has
  no `createdAt` and is excluded rather than sorted arbitrarily. A new pure
  `buildWordCountTrendData(presets)` flattens every persisted round's
  submitted speeches into one list sorted by `createdAt`, recomputing each
  entry's count/limit/over-limit status the same way
  `getWordCountRoundStatuses` already does (never stale if a format's limits
  or a user's presets change later), honoring a matching custom preset
  (idea #2's own prior preset-manager slice) the same priority order.
  `WordCountRoundsPanel` renders the result as a new "Word-count trend"
  section below the persisted-round list — a chronological bar-per-
  submission list, hand-rolled with div/CSS bars mirroring
  `VulnerabilityChartsPanel`'s existing chart convention (idea #4) rather
  than pulling in a charting library, since that is this package's
  established pattern (`debate-ui`'s Recharts wrapper is used exactly once,
  outside `debate-round`) — with a speech-name filter dropdown once a
  debater's history spans more than one speech name. No backend/D1 work was
  needed: round history was, and remains, local-storage-only (unlike the
  account-synced `wordLimitPresets`), which is now called out as this idea's
  next follow-up rather than left implicit. See
  `docs/features/word-count-rounds.md`'s new "Word-count trend view"
  section. Vitest-covered in
  `packages/debate-round/test/wordCountRounds.test.ts` — `createdAt`
  stamping on first save and preservation across updates, plus
  `buildWordCountTrendData`'s chronological ordering, legacy-record
  (no-`createdAt`) exclusion, style-mismatch skip, and preset-priority
  cases (23 tests total in the file, up from 16). Verified: the file's own
  Vitest suite, the full `debate-round` package suite (81 files / 1188
  tests), the whole-repo suite (`bun run test`, 197 files / 3144 tests),
  `debate-round`'s and its dependents' `tsc --noEmit` via
  `turbo typecheck --filter=debate-round`, the whole-repo `bun run
  typecheck` (13 packages), and a full production `bun run build:web`
  (vinext build + service-worker build) — all passed with no new failures.
- **Word-Count-Only Speech Format — per-style word-limit preset manager
  (idea #2, "A per-style word-limit preset manager (add/edit/remove custom
  limits instead of only the built-in registry)").** Prompted by another
  repeat of the standing prompt ("integrate all the tools and create user
  settings and link user db SQL with ability to save flows docs and debates
  in SQL and link to users... develop better tool ui"), and finding — like
  every recent repeat — that the SQL-linked user settings/flows/docs/rounds
  system is already fully built, this slice picked up idea #2's own
  still-open preset-manager follow-up: before this, a word-limited speech's
  limit came only from `debate-timer`'s single hardcoded "Public Forum (Word
  Count)" style (`wordCountStyleMap`/`wordCountStyles` in
  `word-count-format.ts`) or a timed-speech estimate — there was no way for a
  user to define their own limit for a speech name. Added a new
  account-linked `wordLimitPresets` field to the `user_settings` D1 row
  (`word_limit_presets` column, migration `0014_add_word_limit_presets.sql`,
  generated via `drizzle-kit generate`), following the exact same
  "JSON-serialized list, replace-not-merge on PUT" shape `favoriteTools`
  already established: a new pure module,
  `packages/debate-round/src/state/wordLimitPresets.ts`
  (`WordLimitPreset = { name, wordLimit }`, `MAX_WORD_LIMIT_PRESETS = 50`,
  name/limit validators, `normalizeWordLimitPresetsPatch`,
  `serializeWordLimitPresets`/`parseWordLimitPresets`, and
  `findPresetWordLimit` — a case-insensitive, trimmed lookup matching the
  same normalization `resolveSpeechWordLimit` already used for the built-in
  registry), wired into `/api/settings`'s `GET`/`PUT` (`route.ts`) alongside
  every other field. `resolveSpeechWordLimit`
  (`round/word-count-speech-mode.ts`) now takes an optional `presets` array
  and checks it *first*, ahead of the authored registry and the timed-speech
  estimate; `getWordCountRoundStatuses` (`state/wordCountRounds.ts`) grew the
  same optional parameter for the persisted-round list. A new
  `hooks/useWordLimitPresets.ts` holds the local-first, best-effort
  account-synced state (mirroring `lib/hooks/useFavoriteTools.ts`'s
  module-level dedup so multiple mounted consumers share one account fetch
  and one same-tab change event), consumed by three places: the new
  **Word limit presets** manager UI on `/settings`
  (`panels/WordLimitPresetsPanel.tsx` — add/edit/remove rows, rendered
  alongside `UserSettingsPanel`/`FavoriteToolsSettings`/
  `EditorPreferencesPanel`), the standalone `/word-count` form
  (`WordCountRoundsPanel`, both the live typing form and the persisted-round
  list below it, plus a small "N custom word limits applied — manage them in
  Settings" hint), and the live in-round meter
  (`useWordCountSpeechMode` — no changes needed in `SpeechHeaderBar` itself,
  since the hook already centralizes limit resolution). `UserSettingsPanel`'s
  own form excludes `wordLimitPresets` from its `FormState` the same way it
  already excludes `favoriteTools`/`newsRead`/`newsLiked` — each has its own
  dedicated settings-page UI instead. Documented in
  `docs/features/word-count-rounds.md` (new "Custom word-limit presets"
  section, an updated "Where the limit comes from" list with the preset
  check as step 0, and a data-flow diagram). Vitest-covered: 21 new cases in
  `packages/debate-round/test/wordLimitPresets.test.ts` (name/limit/list
  validation including the max-size bound and case-insensitive duplicate
  rejection, patch normalization, serialize/parse round-trips and
  degradation, and `findPresetWordLimit` matching), plus preset-priority
  cases added to `word-count-speech-mode.test.ts` (`resolveSpeechWordLimit`/
  `getSpeechWordCountStatus` preferring a preset over both the authored
  registry and the timed estimate) and `wordCountRounds.test.ts`
  (`getWordCountRoundStatuses` preferring a preset). `useWordLimitPresets`
  and `WordLimitPresetsPanel` themselves remain intentionally untested,
  matching this package's existing convention for account-synced,
  `localStorage`-backed hooks and their settings-page UI (see
  `useFavoriteTools`/`FavoriteToolsSettings`, which follow the same
  pattern). Verified: `bun install` (2258 packages), `bun x vitest run`
  against the three touched/new test files (59/59 pass), full `bun run
  test` (197 files / 3137 tests, all pass, up from 196/3111), `bun run
  typecheck` (12/12 in-scope package tasks pass after fixing
  `UserSettingsPanel`'s `FormState` Omit list to also exclude
  `wordLimitPresets`), a direct `npx tsc --noEmit -p
  apps/debate-ai.com/tsconfig.json` (35 pre-existing, unrelated errors —
  identical count to before this change, confirming no regression), and
  `bun run build:web` (production build succeeds, `/settings` and
  `/word-count` both build). No manual browser check was performed in this
  run (no local dev-server session was started); a future run should smoke-
  test the new Settings section and confirm a saved preset actually shifts
  the badge in both `/word-count` and the live round header bar before
  relying on this note alone. **Next:** the two other follow-ups named
  under idea #2 remain open — a 🎤 dictation button on the standalone
  `/word-count` form already exists, but the live in-round
  `SpeechWordCounter` popover's dictation button was closed in an earlier
  run, so the truly open one is "a trend view showing a debater's
  word-count-vs-limit history across past submissions."
- **Legacy Verbatim / Cardmirror Compatibility — printable/exportable
  shortcuts reference (idea #14, "Next: a printable/exportable version of
  the shortcuts reference, since today it's view-only inside the
  editor").** Prompted by another repeat of the standing prompt ("go
  through the tools and the todo.md ideas and incorporate them into the
  ui... integrate card mirror better into the editor and also have its
  commands in the central menu of Ctrl shift space... menu items on top of
  the top bar like Google docs... create user settings and link user db
  SQL with ability to save flows docs and debates in SQL and link to
  users"), and finding — like every recent repeat — that CardMirror's
  MenuBar/command-palette integration and the SQL-linked user
  settings/flows/docs/rounds system are already fully built, this slice
  picked up idea #14's own still-open "Next" bullet: the
  `openShortcutsReference` modal (`reference-ui.ts`) was view-only, with
  no way to get the shortcut list out of the app. Added a
  `collectGroups()` method that gathers the same static-`RIBBON_GROUPS` +
  Plugins data the on-screen list already rendered inline, now as a single
  plain-data source shared by three consumers: the on-screen list itself
  (refactored to build its DOM from `collectGroups()`'s output instead of
  re-deriving it inline), a new **Print** header button that builds an
  off-screen `.pmd-reference-print-root` copy and calls `window.print()`
  (revealed via a `body * { visibility: hidden }` / re-reveal `@media
  print` block in `style.css`, chosen over naming CardMirror's own
  containers since CardMirror can either own the page or be embedded in a
  host panel), and a new **Export…** header button that saves a
  `cardmirror-shortcuts.txt` file through the existing
  `getHost().saveAs()` host abstraction — the same native-picker-or-download
  path Settings → "Export settings…" already uses, so it works identically
  across the browser-tab, PWA, and Electron hosts. The plain-text
  rendering itself lives in a new pure module,
  `reference-export.ts`'s `formatShortcutsReferenceText()`, kept separate
  from the DOM/overlay-lifecycle code specifically so it's fast and easy
  to test directly. Documented in `docs/features/legacy-verbatim-shortcuts.md`
  (new "Printable and exportable reference" section, Data flow entries,
  and a Known gaps note that Print/Export always render the full
  reference regardless of the modal's own search filter, by design).
  Vitest-covered: 5 new cases in
  `packages/debate-editor-cardmirror/test/reference-export.test.ts`
  (title+group rendering, the em-dash fallback for an unbound command, a
  fully-empty group being skipped, an all-empty document collapsing to
  just the title line, and key-column alignment across the widest key in
  the document). `reference-ui.ts`'s `ReferenceModal` class itself remains
  intentionally untested, matching this package's existing convention for
  DOM-heavy modal classes (their pure helpers get direct tests; the modal
  wiring doesn't — see `insert-short-cite.test.ts` for the same pattern
  applied to a sibling command). Verified: `bun install` (2258 packages),
  `bun x vitest run packages/debate-editor-cardmirror/test/reference-export.test.ts`
  (5/5 pass) and full `bun run test` (196 files / 3111 tests, all pass, up
  from 195/3106), `bunx turbo run typecheck --filter=debate-editor-cardmirror`
  (3/3 in-scope package tasks pass), a direct `npx tsc --noEmit -p
  apps/debate-ai.com/tsconfig.json` (35 pre-existing, unrelated errors —
  identical count to before this change, confirming no regression), and
  `bun run build:web` (`debate-ai-web` and its offline-service-worker
  build both complete clean, `/reason-editor` present in the route list).
  **Completed:** 2026-08-31.
- **Top Contributor Awards — cross-tab live-update (idea #17,
  `shared-flow-sync.md` Known gap: "every other localStorage-backed panel
  in this repo still has no cross-tab live-update mechanism").** Prompted
  by another repeat of idea #17's standing request ("create user settings
  and link user db SQL... with ability to save flows docs and debates in
  SQL and link to users... add tools into where needed in the ui... develop
  better tool ui"), and finding — like every recent repeat of this
  prompt — that the "user settings / SQL-linked flows, docs, rounds" half
  is already fully built and documented, this slice audited
  `shared-flow-sync.md`'s running list of panels that already have the
  cross-tab `storage`-event live-update mechanism (`DailyBestCardPanel`,
  `ContributionLeaderboardPanel`, `TaskInboxPanel`, `ProgressUnlocksPanel`,
  `ResearchProgressPanel`, `QuestStreaksPanel`, `NewsStreamPanel`) against
  the panels that don't, and picked `ContributorAwardsPanel` — it shares
  its two backing `localStorage` stores (`contributions`,
  `contributorAwardAnnouncements`) with `DailyBestCardPanel`, which already
  has the mechanism, but itself only ever refreshed on mount. Added
  `CONTRIBUTOR_AWARDS_LIVE_UPDATE_STORAGE_KEYS`/
  `isContributorAwardsLiveUpdateStorageEvent` to
  `packages/debate-card-search/src/state/live-update.ts`, mirroring the
  seven existing key-list/predicate pairs there exactly (true for either
  backing key or a `null` key from `localStorage.clear()`, false otherwise
  — including a same-prefix substring key). Wired a `storage` event
  listener into `ContributorAwardsPanel.tsx` that calls the existing
  `refresh()` closure when the predicate matches, mirroring
  `DailyBestCardPanel`'s identical listener wiring exactly (added/removed
  in its own `useEffect`, separate from the mount-only refresh effect).
  Documented in `docs/features/contributor-awards.md` (new data-flow line
  and "live-updates across browser tabs" paragraph, closed the matching
  Known gaps item) and `docs/features/shared-flow-sync.md` (added
  `ContributorAwardsPanel` to the running list of panels that already have
  the mechanism). Vitest-covered: 4 new cases for
  `isContributorAwardsLiveUpdateStorageEvent` in
  `packages/debate-card-search/test/live-update.test.ts` (every backing-key
  match, the `null`-key clear-all case, an unrelated key, and a
  same-prefix substring key), bringing that file to 32 cases.
  `ContributorAwardsPanel.tsx` itself remains intentionally untested,
  matching every other panel in this repo whose `storage`-listener wiring
  is exercised only through the shared pure predicate's own tests (e.g.
  `DailyBestCardPanel.tsx`). Verified: `bun install` (2258 packages), `bun
  x vitest run packages/debate-card-search/test/live-update.test.ts`
  (32/32 pass) and full `bun run test` (195 files / 3106 tests, all pass,
  up from 195/3102), `bunx turbo run typecheck --filter=debate-card-search
  --filter=debate-ai-web` (11/11 in-scope package tasks pass), a direct
  `npx tsc --noEmit -p apps/debate-ai.com/tsconfig.json` (35 pre-existing,
  unrelated errors — identical count to before this change, confirming no
  regression), and `bun run build:web` (`debate-ai-web` and its
  offline-service-worker build both complete clean, `/cards/awards`
  present in the route list). **Completed:** 2026-08-31.
- **Expandable Heading Structure — dedicated breadcrumb visibility toggle
  (idea #9, `reason-editor-outline-nav.md` Known gap: "No dedicated
  visibility toggle for the breadcrumb").** Prompted by another repeat of
  idea #17's standing request ("create user settings and link user db
  SQL... with ability to save flows docs and debates in SQL and link to
  users... add tools into where needed in the ui... develop better tool
  ui"), and finding — like every recent repeat of this prompt — that the
  "user settings / SQL-linked flows, docs, rounds" half is already fully
  built and documented, this slice instead picked up the one open Known gap
  left by the immediately preceding run's sticky heading breadcrumb
  (idea #9): the breadcrumb always rendered once a heading was in scope,
  with no way to turn it off short of losing the nav pane too. Added a new
  persisted `Settings.showHeadingBreadcrumb` boolean (default true) to
  `packages/debate-editor-cardmirror/src/editor/settings.ts` — unlike
  `navPaneVisible` (per-window/transient), this is a real display
  preference so it's a normal persisted key, following `formatNavPaneByType`'s
  pattern rather than the nav pane's: schema field, default, load-time
  sanitizer (`s.showHeadingBreadcrumb === false ? false : true`), and a
  `SETTING_METADATA` toggle row ("Show heading breadcrumb bar", Appearance
  → "Nav pane & indicators" section — the same section `formatNavPaneByType`
  and `showCitePreview` live in, so it renders in Settings → Appearance for
  free via the existing declarative `renderEntry`/`buildEmbeddedSettingsPanel`
  machinery, no settings-UI code changed). Added a pure
  `shouldShowBreadcrumb(enabled, path)` predicate to `heading-breadcrumb.ts`
  (alongside its existing `computeBreadcrumbPath`) so the "off" case and the
  existing "nothing above the scroll position yet" case share one hide
  decision; `HeadingBreadcrumbBar` in `heading-breadcrumb-bar.ts` gained an
  `enabled` field and a `setEnabled(enabled)` method (off hides immediately
  via `render([])`, reusing the predicate; on re-runs `refresh()` so
  whatever the scroll position currently implies reappears), with `render()`
  itself now deferring to `shouldShowBreadcrumb` instead of a bare
  `path.length === 0` check. Wired in `index.ts`: initial state right after
  `breadcrumbBar` is constructed, and `breadcrumbBar?.setEnabled(s.showHeadingBreadcrumb)`
  alongside the existing `applyNavPaneVisible`/`applyFormatNavPaneByType`
  calls in the settings-change subscriber. Documented in
  `docs/features/reason-editor-outline-nav.md` (new "Breadcrumb visibility
  toggle" paragraph, data-flow entries for both the new predicate and
  `setEnabled`, closed the matching Known gaps bullet). Vitest-covered: 4
  new cases for `shouldShowBreadcrumb` in
  `packages/debate-editor-cardmirror/test/heading-breadcrumb.test.ts`
  (setting off with a non-empty path, setting on with an empty path, both
  off, both satisfied), bringing that file to 12 cases — `HeadingBreadcrumbBar`
  itself remains intentionally untested, matching this repo's documented
  convention for DOM-wiring classes (no jsdom environment is configured for
  this package's Vitest project; the predicate extraction keeps the
  behavior itself testable without one). Verified: `bun install` (2258
  packages), `bun x vitest run packages/debate-editor-cardmirror/test/
  heading-breadcrumb.test.ts` (12/12 pass) and full `bun x vitest run`
  (195 files / 3102 tests, all pass, up from 195/3098), `bunx turbo run
  typecheck --filter=debate-editor-cardmirror --filter=debate-ai-web`
  (11/11 in-scope package tasks pass), a direct `npx tsc --noEmit -p
  apps/debate-ai.com/tsconfig.json` (35 pre-existing, unrelated errors —
  identical count to before this change, confirming no regression), and
  `bun run build:web` (`debate-ai-web` and its offline-service-worker build
  both complete clean, `/settings` and `/settings/editor-panel` both present
  in the route list). **Completed:** 2026-08-31.
- **Round Workspace Tools — cross-links between the four flow-tool pages
  (idea #17, `flow-tools-menu.md` Known gap: "No corresponding menu exists
  on any of the four target pages linking back to the round workspace or
  to each other").** Prompted by another repeat of idea #17's standing
  request ("create user settings and link user db SQL... with ability to
  save flows docs and debates in SQL and link to users... add tools into
  where needed in the ui for users and develop better tool ui"), and
  finding — like every recent repeat of this prompt — that the "user
  settings / SQL-linked flows, docs, rounds" half is already fully built
  and documented, this slice picked up `flow-tools-menu.md`'s one
  remaining open item instead: the round workspace's "Tools for this
  round" menu (added by an earlier idea #17 follow-up (4) slice) links
  from `/debate` to `/outline`, `/outcomes`, `/drills`, and `/coaching`,
  and each of those four pages already links back to `/debate` via its own
  "Back" button, but none of the four linked to each other — a debater who
  followed the menu to one tool had to return to the round workspace first
  to reach a different one. Added a new pure helper, `buildCrossLinks
  (currentHref)`, to `packages/debate-round/src/round/flow-tool-links.ts`
  (alongside its existing `FLOW_TOOL_LINKS`/`buildFlowToolsMenuItems`):
  returns every `FLOW_TOOL_LINKS` entry except the one matching
  `currentHref`, preserving display order. New presentational component
  `packages/debate-round/src/layout/RoundToolsCrossLinks.tsx` renders that
  list as an "Other round tools" row of `next/link` entries (unlike the
  round workspace's own `FlowToolsMenu`, these links are never disabled —
  each target page's own "Generate ... for current round" action already
  handles the no-flow-selected case once there). Both are now exported
  from `debate-round`'s package root (`src/index.ts`), and each of
  `apps/debate-ai.com/app/{outline,outcomes,drills,coaching}/page.tsx` now
  renders `<RoundToolsCrossLinks currentHref="/..." />` next to its
  existing "Back to debate flow" link. Documented in
  `docs/features/flow-tools-menu.md` (new "What it does"/"Data flow"
  paragraphs, closed the matching Known gaps bullet). Vitest-covered: 4 new
  cases for `buildCrossLinks` in
  `packages/debate-round/test/flowToolLinks.test.ts` (excludes the current
  page's own href, preserves `FLOW_TOOL_LINKS` order, returns the full list
  unchanged for an unmatched href, and a table-driven case confirming a
  distinct 3-entry result for each of the four target pages), bringing
  that file to 10 cases. The four `page.tsx` files and
  `RoundToolsCrossLinks.tsx` itself remain intentionally untested, matching
  this repo's documented convention for other thin render/wiring
  components (e.g. `FlowToolsMenu.tsx`). Verified: `bun install` (2258
  packages), `bunx vitest run packages/debate-round/test/
  flowToolLinks.test.ts` (10/10 pass) and full `bun run test` (195 files /
  3098 tests, all pass, up from 195/3094), `bunx turbo run typecheck
  --filter=debate-round --filter=debate-ai-web` (11/11 in-scope package
  tasks pass), a direct `npx tsc --noEmit -p
  apps/debate-ai.com/tsconfig.json` (35 pre-existing, unrelated errors —
  identical count to before this change, confirming no regression), and
  `bun run build:web` (`debate-ai-web` and its offline-service-worker build
  both complete clean, `/outline`/`/outcomes`/`/drills`/`/coaching` all
  present in the route list). **Completed:** 2026-08-31.
- **Round Cloud Save — "via round" cascade-save indicator (idea #17,
  `round-cloud-save.md` Known gap: "no reverse indicator... showing which
  flows got saved as a side effect of a round save").** Prompted by another
  repeat of idea #17's standing request ("create user settings and link
  user db SQL... with ability to save flows docs and debates in SQL and
  link to users... add tools into where needed in the ui... develop better
  tool ui"), and having already found (via today's two prior repeats, see
  the News Stream and `EmptyState` entries below) that the "user settings /
  SQL-linked flows, docs, rounds" half of the request and the "undiscoverable
  tools" and "hand-rolled empty state" audits are all already built, this
  slice picked up `round-cloud-save.md`'s one remaining documented Known
  gap instead: saving a round to the account cascade-saves every flow it
  references, but `FlowHistoryDialog`'s "Saved to account" tab listed a
  cascade-saved flow identically to one saved on its own via its individual
  cloud icon, with no way to tell which was which. Added a new pure helper,
  `mapFlowsToReferencingRound(rounds)`, to
  `packages/debate-round/src/state/bulkRoundSave.ts` (alongside its existing
  `collectFlowsForRounds`/`collectUnreferencedFlows`, following the same
  "rounds ↔ flows" cross-referencing pattern: maps a flow id to the first
  local round whose `flowIds` references it). `FlowHistoryDialog.tsx`'s
  "Saved to account" tab now looks up each listed flow's `clientId` against
  that map and, when found, renders a small `Badge` ("via round", title
  tooltip naming the round via the existing `deriveRoundLabel`) next to the
  flow's label. Purely a client-side local cross-reference — no server
  call, no new D1 column, no change to `SavedFlowSummary`'s shape; a flow
  referenced by more than one round attributes to whichever comes first in
  the local `rounds` list. Documented in `docs/features/round-cloud-save.md`
  (new paragraph plus updated data-flow diagram; closed the matching Known
  gaps bullet). Vitest-covered: 5 new cases for `mapFlowsToReferencingRound`
  in `packages/debate-round/test/bulkRoundSave.test.ts` (no-rounds,
  no-references, single-round, cross-round first-referencing-round-wins,
  and unreferenced-id cases), bringing that file to 23 cases. `FlowHistoryDialog.tsx`
  itself remains intentionally untested, matching this repo's documented
  convention for every other dialog/UI-wiring component. Verified: `bun
  install` (2258 packages), `bunx vitest run packages/debate-round/test/
  bulkRoundSave.test.ts` (23/23 pass) and full `bun run test` (195 files /
  3094 tests, all pass, up from 195/3089), `bunx turbo run typecheck
  --filter=debate-round --filter=debate-ai-web` (11/11 in-scope package
  tasks pass — `debate-ai-web` itself has no `typecheck` script, matching
  prior verification runs), a direct `npx tsc --noEmit -p
  apps/debate-ai.com/tsconfig.json` (35 pre-existing, unrelated errors —
  identical count to before this change, confirming no regression), and
  `bun run build:web` (`debate-ai-web` and its offline-service-worker build
  both complete clean). **Completed:** 2026-08-31.
- **News Stream — account-linked read/like sync (idea #17, `news-stream.md`
  Known gap: "Read/like state is per-browser, not per-account").** Prompted
  by another repeat of idea #17's standing request ("create user settings
  and link user db SQL... with ability to save flows docs and debates in
  SQL, linked to users... add tools into where needed in the ui"), this run
  first re-confirmed (via a full survey of the command palette,
  `MenuBar.tsx`, CardMirror/Reason-Editor integration, the `/tools`
  registry, `/settings`, and the SQL schema) that every specific thing the
  standing request names — a Google-Docs-style top menu bar, the
  Ctrl/Cmd-Shift-Space command palette, CardMirror as the Reason Editor's
  native engine, and per-user SQL-linked settings/flows/rounds/documents —
  is already built and shipped, several times over, exactly as prior
  repeats of this same prompt already found (see the `news-stream.md`,
  `flow-tools-menu.md`, and `legacy-verbatim-shortcuts.md` entries below).
  Rather than re-verify the same "already done" finding a fourth time, this
  slice picked up a genuinely open, previously documented gap instead: News
  Stream's `isNewsItemRead`/`markNewsItemRead`/`toggleNewsItemLiked` viewer
  state (`packages/debate-card-search/src/state/newsStream.ts`) was
  localStorage-only, so a signed-in user's read/liked items reset to
  "everything unread" on a different device — the one piece of News Stream
  not yet linked to the account's SQL row despite `user_settings` already
  carrying `debateStyle`/`colorTheme`/`favoriteTools`/`editorPreferences`
  for every other cross-device preference. Added `newsRead`/`newsLiked`
  JSON-array columns to `user_settings` (migration
  `drizzle/0013_late_jazinda.sql`); new pure validation/serialization
  helpers `packages/debate-card-search/src/lib/news-stream-sync.ts`
  (`normalizeNewsSyncPatch`/`serializeNewsIdList`/`parseNewsIdList`,
  mirroring `state/favoriteTools.ts`'s split, bounded to
  `MAX_NEWS_SYNC_ITEMS` = 500 ids); `state/newsStream.ts` gained
  `listReadIds`/`listLikedIds`/`mergeRemoteViewerState` (a union merge, not
  a replacement, so a browser's own local read/like state is never
  clobbered by a stale or empty account row); `/api/settings` (`GET`/`PUT`)
  now reads/writes the two new columns alongside every existing field; and
  `NewsStreamPanel.tsx` gained an optional `syncRemote` prop
  (`{hydrate, pushRead, pushLiked}`) — the same "app-injected composition
  point" pattern `extraItems` already established on this exact component
  for the coaching-sessions cross-package gap — so this shared package still
  never calls `fetch` itself. `apps/debate-ai.com/lib/hooks/
  useNewsStreamSync.ts` (new) wraps `debate-round`'s existing
  `fetchUserSettings`/`saveUserSettings` client into that adapter shape,
  wired in from `app/news/NewsPageContent.tsx`. `debate-round`'s
  `FullUserSettingsPayload` type gained the two new fields (imported from
  `debate-card-search`, which it already depends on); `UserSettingsPanel`'s
  `FormState` now excludes both, the same way it already excludes
  `favoriteTools` — this is an automatic sync, not a user-editable form
  field. Documented in `docs/features/news-stream.md` (new "Account sync"
  section plus updated Known gaps: the merge is a union so an unlike on one
  device doesn't clear a like on another until that device's own next
  toggle, and every push resends the full id list rather than a diff).
  Vitest-covered: `packages/debate-card-search/test/news-stream-sync.test.ts`
  (new, 20 cases mirroring `favoriteTools.test.ts`'s shape) and five new
  cases in `newsStream.test.ts` for `listReadIds`/`listLikedIds`/
  `mergeRemoteViewerState` (union merge, no-op when nothing changed, missing
  fields treated as empty). The app-level route/hook themselves remain
  intentionally untested, matching this repo's documented convention for
  every other fetch-client/D1-route pair. Verified: `bun install` (2258
  packages), `bunx drizzle-kit generate` (produced exactly the one expected
  migration, correctly journaled), `bunx vitest run packages/debate-card-search
  packages/debate-round` (139 files / 2349 tests pass) and full `bun run
  test` (195 files / 3089 tests, all pass, up from 194/3040), `bunx turbo run
  typecheck --filter=debate-card-search --filter=debate-round
  --filter=debate-ai-web` (11/11 in-scope package tasks pass), a direct
  `npx tsc --noEmit -p apps/debate-ai.com/tsconfig.json` (35 pre-existing,
  unrelated errors — identical count to before this change, confirming no
  regression), and `bun run build:web` (`debate-ai-web` builds clean,
  `/news` and `/api/settings` both present in the route list). **Completed:**
  2026-08-31.
- **Tool-panel UI-polish audit — migrate hand-rolled empty-state
  placeholders to the shared `EmptyState` primitive (idea #17, follow-up
  (4), "bring weaker panel UIs up to the shared `debate-ui` primitive
  conventions" half).** Prompted by another repeat of idea #17's standing
  request ("create user settings and link user db SQL... add tools into
  where needed in the ui... develop better tool ui"); investigating found
  the "user settings / link user db SQL / save flows, docs, and debates to
  SQL, linked to users" half of that request already fully built and
  documented (`user-settings.md`, `flow-cloud-save.md`,
  `round-cloud-save.md`; the native REASON editor's `documents` table was
  already user-linked too), so this slice picked up follow-up (4)'s
  still-open "weaker panel UI" half instead. Two prior slices
  (`flow-tools-menu.md`) had each done one non-exhaustive search pass over
  this and found nothing; this pass searched specifically for panels that
  hand-roll a `rounded-lg border border-dashed ... text-muted-foreground`
  "nothing to show" placeholder instead of using `debate-ui`'s existing
  `EmptyState` primitive (`packages/debate-ui/src/panels/panel-shell.tsx`).
  Found four: `EvidenceLibraryPanel.tsx` ("No entries match this search."),
  `ArgumentLibraryPanel.tsx` ("No cards match this tag filter."),
  `PrepRoomPanel.tsx` (its "no evidence yet" / "no search matches" pair),
  and `apps/debate-ai.com/app/speech-documents/SpeechSendLogPanel.tsx`
  ("Nothing sent yet..." — this one additionally paired its text with a
  leading `Send` icon, a shape `EmptyState` had no prop for). Migrated all
  four to `<EmptyState>`, and gave `EmptyState` an optional `icon` prop
  (mirroring `PanelShell`'s own `icon` prop) rather than leave the one
  icon-carrying panel on bespoke markup — an additive, backward-compatible
  change (every existing call site omits it and renders exactly as before).
  Distinguished true empty-state placeholders from a different existing use
  of the same dashed-border styling — a highlighted form/subsection box, as
  seen in `TopicCoverageDashboardPanel.tsx`, `DailyQuestsPanel.tsx`,
  `TaskInboxPanel.tsx`, and `QuestStreaksPanel.tsx` — and left those alone
  rather than misapply the primitive. Documented in
  `docs/features/flow-tools-menu.md` and `docs/features/user-settings.md`
  (Known gaps, both cross-referenced). No new schema/route changes — this
  slice is UI-only. Vitest-covered: `packages/debate-ui/test/panel-shell.
  test.tsx` gained two cases for `EmptyState`'s new `icon` prop (renders the
  icon and left-aligns; omits the wrapper and centers when no icon is
  given); the four migrated panels are themselves store-driven and were
  already outside this repo's component-test convention (each is covered at
  the pure-logic-module level only, matching every other store-backed panel
  here — see `packages/debate-card-search/test/panels.test.tsx`'s own note
  that store-driven panels are covered by their store's suite, not a render
  test), so no new panel-level test was needed for a pure-JSX swap. Follow-
  up (4)'s broader "bring weaker panel UIs up to the shared primitive
  conventions" half remains open — this was one more targeted search pass
  (the `EmptyState` pattern specifically) across roughly 50 panels, not an
  exhaustive comparison against every shared primitive. Verified: `bun
  install` (2258 packages, no changes), `bunx vitest run packages/debate-ui
  packages/debate-card-search` (63 files / 1202 tests pass), full `bun run
  test` (194 files / 3040 tests, all pass), `bun run typecheck` (12/12
  in-scope package tasks pass — `apps/debate-ai.com` has no `typecheck`
  script, matching every prior slice's note that this app isn't part of the
  typecheck pipeline; a direct `tsc --noEmit -p apps/debate-ai.com/
  tsconfig.json` was run anyway and produced the identical 40 pre-existing,
  unrelated errors before and after this change, confirming no regression),
  and `bun run build` (`debate-ai-web` builds clean, `/speech-documents` and
  every other route present in the route list). **Completed:** 2026-08-31.
- **Fix Round Cloud Save regression — restore `savedRounds` schema/routes
  deleted by an unrelated merge, repair the corrupted drizzle migration
  chain (idea #17, `round-cloud-save.md` Known gap).** Investigating "create
  user settings and link user db SQL... with ability to save flows docs and
  debates in SQL" (idea #17's standing request) for the next slice to build
  found the feature it names was already built and shipped, then silently
  broken by a later, unrelated commit. `7ace3bf` ("Move CardMirror's
  General/Appearance/Accessibility settings to /settings") hit a stale
  merge conflict in `lib/database/schema.ts` — its own branch still carried
  the dead, pre-`saved_rounds` `userSettings`/`rounds` shape from PR #362
  that `e2dbe99` (`#374`) had already correctly identified as dead code and
  removed. `7ace3bf`'s conflict resolution kept its own stale `rounds`
  table/route pair and deleted the real, tested, documented `savedRounds`
  table and `app/api/rounds/[clientId]/route.ts` — its commit message
  claimed this was "restoring the original working rounds-cloud-save
  implementation," inverting `e2dbe99`'s actual finding. From that point,
  `saveRoundToAccount`/`fetchSavedRound`/`deleteSavedRound`
  (`round/saved-rounds-client.ts`, called throughout
  `dialogs/FlowHistoryDialog.tsx`) all 404'd against the now-missing
  `[clientId]` route, and `GET /api/rounds` silently read from the wrong,
  always-empty `rounds` table instead of `saved_rounds` — yet three further
  feature slices ("Save all rounds," "Save flows not in a round," the round
  delete button — the three entries directly below this one) shipped on
  top of the already-broken client across the following days, each one
  verified only via the pure-function unit tests its own new logic added,
  never a live save/load/delete call against the actual route (matching
  this repo's own documented "the route itself is not unit-tested"
  convention for every fetch-client/D1-route pair) — so the regression
  went unnoticed for four commits. The same `7ace3bf` commit also
  generated an orphaned migration, `0011_curious_human_cannonball.sql`,
  that was never added to `drizzle/meta/_journal.json` (so `drizzle-kit
  generate` never tracked it as applied) but *did* overwrite
  `meta/0011_snapshot.json` — the metadata for the correctly-journaled
  `0011_plain_fantastic_four` migration — with a snapshot reflecting the
  regressed (wrong) schema shape, corrupting the diff baseline for any
  future `drizzle-kit generate` call. Fix: restored `savedRounds`/
  `SavedRoundRow` in `schema.ts` and removed the resurrected `rounds`
  table/`RoundRow` type (confirmed unused anywhere outside the one route
  file being replaced); restored `app/api/rounds/route.ts` (GET, listing
  from `saved_rounds`) and recreated `app/api/rounds/[clientId]/route.ts`
  (GET/PUT/DELETE) verbatim from the pre-regression commit; restored the
  correct `meta/0011_snapshot.json` (from `e2dbe99`, the last known-good
  state); deleted the orphaned, unjournaled `0011_curious_human_cannonball.
  sql`; and ran `bunx drizzle-kit generate` against the corrected schema
  (which still legitimately needs the `editor_preferences` column
  `7ace3bf`'s own CardMirror-settings-in-`/settings` feature added to
  `userSettings`), producing a single properly-journaled migration,
  `drizzle/0012_add_editor_preferences.sql` (`ALTER TABLE user_settings ADD
  editor_preferences text` — exactly the one legitimate net schema change,
  confirming the rest of the orphaned file's effects are gone). No data
  loss: `saved_rounds` itself was never dropped by the regression, only the
  app's ability to read/write it via the ORM — any rounds a user
  successfully saved before the regression (or via `wrangler d1 execute`
  applying the orphaned file directly, since `db:migrate:d1` globs every
  `drizzle/*.sql` file rather than following the journal) remain intact and
  are reachable again now that the route/schema are restored. No new
  Vitest coverage added — the restored code is a verbatim revert of
  already-covered logic (`packages/debate-round/src/state/savedRounds.ts`
  and `round/saved-rounds-client.ts` were untouched by the regression and
  still pass their existing suites); the app-level routes themselves remain
  intentionally untested, matching every other fetch-client/D1-route pair
  in this repo. Documented in `docs/features/round-cloud-save.md` (Known
  gaps). Verified: `bun install` (2258 packages), full `bun run test` (194
  files / 3038 tests, all pass, unchanged from before this fix — confirming
  no behavior regression), `bunx turbo run typecheck --filter=debate-round
  --filter=debate-ai-web` (11/11 in-scope package tasks pass), a direct
  `npx tsc --noEmit -p apps/debate-ai.com/tsconfig.json` (35 pre-existing,
  unrelated errors, down from 36 before this fix — the removed error is
  exactly the `savedRounds` missing-export error this fix resolves), and
  `bun run build:web` (`debate-ai-web` succeeds, `/api/rounds` and the
  previously-missing `/api/rounds/:clientId` both present in the route
  list). **Completed:** 2026-08-30.
- **Delete a local round from the Rounds tab, plus a round-id-collision fix
  (idea #17, `round-cloud-save.md` Known gap: "no UI for deleting a local
  round").** Prompted by another repeat of idea #17's standing request
  ("create user settings and link user db SQL... with ability to save
  flows docs and debates in SQL... add tools into where needed in the
  ui... develop better tool ui"). `FlowHistoryDialog`'s "Rounds" tab gains
  a Trash2 delete button on each round row (next to the existing cloud-save
  and Edit buttons), wired to `useFlowStore`'s `deleteRound(id)` action —
  which already existed but had no caller anywhere in the app — behind a
  `confirm()` prompt. Deleting a round only removes it from this browser;
  any cloud-saved copy of the round is untouched (mirroring the "Saved to
  account" tab's own remove button, which likewise only ever touches its
  own side), and the round's flows are never deleted, only unreferenced
  (they stay reachable, and become eligible for the existing "Save flows
  not in a round" bulk action if not already cloud-saved). While adding
  Vitest coverage for the store's previously-untested round CRUD actions,
  found and fixed a real latent bug: `createRound` derived a round's `id`
  from a bare `Date.now()`, so two rounds created within the same
  millisecond got identical ids — `updateRound`/`deleteRound` would then
  silently match every round sharing that id instead of just the intended
  one (reproduced directly: creating 25 rounds back-to-back in a test
  produced duplicate ids before the fix). `createRound` now advances past
  any id already present in the store before assigning it, guaranteeing
  uniqueness within the in-memory round list. Vitest-covered in the new
  `packages/debate-round/test/flowStoreRounds.test.ts` (7 cases:
  `createRound`'s append-with-generated-id/timestamp behavior and its
  back-to-back id-uniqueness regression case; `updateRound`'s
  merge-into-matching-round-only and no-match-is-a-no-op cases;
  `deleteRound`'s remove-only-the-matching-round, no-match-is-a-no-op, and
  never-touches-`flows` cases). The dialog's own button wiring is not
  unit-tested, matching every other fetch-client/dialog pair in this repo.
  Documented in `docs/features/round-cloud-save.md` (Known gaps updated —
  the closed gap is replaced with the fix's own description). Verified:
  `bun install` (2258 packages), `bunx vitest run
  packages/debate-round/test/flowStoreRounds.test.ts
  packages/debate-round/test/bulkRoundSave.test.ts` (25/25 pass), full
  `bun run test` (194 files / 3038 tests, all pass, up from 3031),
  `bunx turbo run typecheck --filter=debate-round` (11/11 in-scope package
  tasks pass), and `bun run build:web` (`debate-ai-web` succeeds, `/debate`,
  `/tools`, and `/settings` present in the route list). No lint script is
  configured anywhere in this repo (`package.json`/`turbo.json`), matching
  every prior slice's verification notes. No UI screenshot/Playwright smoke
  check was run this slice — the new button reuses the exact same
  `Button`/icon pattern as the adjacent cloud-save and Edit buttons on the
  same row, and the only new logic (`deleteRound`'s id-collision fix) is
  what `flowStoreRounds.test.ts` covers directly. Known gaps still open
  (both pre-existing, both apply equally after this slice): no per-round
  dirty tracking in the bulk-save actions, and no optimistic-concurrency
  handling on the cloud-save routes. **Completed:** 2026-08-30.
- **Bulk-save flows not referenced by any round (idea #17,
  `flow-cloud-save.md` Known gap).** Closes the last remaining piece of
  "Save all rounds"'s own Known gap: "a flow with no round referencing it
  still has no bulk path — only its own per-flow cloud icon." Prompted by
  another repeat of idea #17's standing request ("create user settings and
  link user db SQL... with ability to save flows docs and debates in
  SQL... add tools into where needed in the ui... develop better tool
  ui"). Adds `state/bulkRoundSave.ts`'s `collectUnreferencedFlows(rounds,
  flows)`: every locally-available flow whose id no round's `flowIds`
  lists, preserving `flows`' own order — the exact complement of the
  existing `collectFlowsForRounds`. Generalized that module's outcome
  summarizer for reuse across both item kinds:
  `BulkRoundSaveOutcome`/`summarizeBulkRoundSave` renamed to
  `BulkSaveOutcome`/`summarizeBulkSaveOutcomes` (only referenced from
  `FlowHistoryDialog.tsx` and its own test file, so the rename was a clean,
  fully-updated in-place change, not a compat shim). `FlowHistoryDialog`'s
  "Rounds" tab gained a second bulk-save button, "Save flows not in a round
  (N)" (rendered whenever at least one locally-available flow exists that
  no round references, independent of whether any round itself exists),
  next to the existing "Save all rounds" button — its own
  `handleSaveUnreferencedFlowsToAccount` mirrors
  `handleSaveAllRoundsToAccount`'s per-item save/outcome/summary loop
  exactly, just over `collectUnreferencedFlows`'s result instead of
  `collectFlowsForRounds`'s, with its own `bulkFlowSaveStatus`/
  `bulkFlowSaveSummary` state (reset alongside the existing bulk-round-save
  state whenever the dialog opens) so the two actions' in-flight/summary
  states never collide. Deliberately a separate action rather than folding
  into "Save all rounds": the two buttons cover disjoint sets of flows (a
  flow is saved by at most one of them), so no flow is ever redundantly
  `PUT` twice by clicking both. Vitest-covered in
  `packages/debate-round/test/bulkRoundSave.test.ts` (18 cases, up from
  11: `collectUnreferencedFlows`'s no-rounds, no-local-flows,
  single-round/multi-round referenced-vs-unreferenced split, all-referenced,
  flows-list-order-preservation, and missing-local-flow-for-a-referenced-id
  cases, plus the existing `collectFlowsForRounds`/renamed
  `summarizeBulkSaveOutcomes` cases carried over unchanged). The dialog's
  own button wiring is not unit-tested, matching every other fetch-client/
  dialog pair in this repo. Documented in `docs/features/round-cloud-save.md`
  (Nav/What it does/Data flow/Vitest-covered/Known gaps sections updated)
  and `docs/features/flow-cloud-save.md` (its mirrored Known gap marked
  fully closed). Verified: `bun install` (2258 packages), `bunx vitest run
  packages/debate-round/test/bulkRoundSave.test.ts` (18/18 pass), full `bun
  run test` (193 files / 3031 tests, all pass, up from 3016), `bunx turbo
  run typecheck --filter=debate-round` (11/11 in-scope package tasks
  pass), a direct `npx tsc --noEmit -p apps/debate-ai.com/tsconfig.json`
  (35 errors — the same pre-existing, unrelated baseline every prior slice
  has recorded, e.g. `D1Database`/`Fetcher` globals and `debate-ui`'s
  `.svg`/`.png` module declarations — confirmed none in
  `FlowHistoryDialog.tsx` or `bulkRoundSave.ts`), and `bun run build:web`
  (`debate-ai-web` succeeds, `/debate`, `/tools`, and `/settings` present in
  the route list). No UI screenshot/Playwright smoke check was run this
  slice — the new button reuses the exact same `saveFlowToAccount` call and
  `cloudActions` status rendering "Save all rounds" and the per-flow cloud
  icon already exercise (per that entry's own precedent), with only
  `collectUnreferencedFlows` being new logic, and that logic is what
  `bulkRoundSave.test.ts` covers directly. Known gaps still open (both
  pre-existing, both apply equally to the new button): no per-item dirty
  tracking (a full re-`PUT` of every unreferenced flow on every click), and
  no optimistic-concurrency handling. **Completed:** 2026-08-30.
- **Round Cloud Save — "Save all rounds" bulk action (idea #17,
  `round-cloud-save.md` Known gap).** Closed the "No bulk 'save all my
  rounds' action — each round is still saved one at a time via its own
  cloud icon" gap `docs/features/round-cloud-save.md` recorded, prompted by
  another repeat of idea #17's standing request ("create user settings and
  link user db SQL... with ability to save flows docs and debates in
  SQL... add tools into where needed in the ui... develop better tool
  ui"). `FlowHistoryDialog`'s "Rounds" tab gains a "Save all rounds" button
  (rendered whenever at least one local round exists) next to the existing
  per-round cloud-upload icon. New pure module
  `packages/debate-round/src/state/bulkRoundSave.ts`:
  `collectFlowsForRounds(rounds, flows)` (dedups the flows referenced
  across every round — a flow shared by more than one round, or listed
  twice within one round's `flowIds`, is collected exactly once, in
  first-referencing-round order, skipping any `flowIds` entry with no
  matching local flow) and `summarizeBulkRoundSave(outcomes)` (turns a
  per-round save-outcome map into `{ savedCount, errorCount }` for a status
  message). `FlowHistoryDialog`'s new `handleSaveAllRoundsToAccount` calls
  `collectFlowsForRounds` once up front so a shared flow is `PUT` to
  `/api/flows` exactly once regardless of how many rounds reference it
  (rather than once per round, which the existing per-round
  `handleSaveRoundToAccount` would do if simply looped), then saves every
  round — both passes reuse the same `cloudActions`/`cloudRoundActions`
  status maps the individual save buttons already render, so a round's or
  flow's icon updates in place exactly as if saved individually, and a
  short "Saved N rounds." / "Saved N, M failed." summary appears next to
  the button once the pass finishes. Best-effort per item, matching every
  other cloud-save action in this dialog — one flow or round failing to
  save never blocks the others. No schema or route changes — this reuses
  the existing `/api/flows` and `/api/rounds` PUT routes exactly as the
  per-item save buttons already do. Vitest-covered in
  `packages/debate-round/test/bulkRoundSave.test.ts` (11 cases:
  `collectFlowsForRounds`'s empty-rounds, no-flows, single-round,
  cross-round dedup keeping first-referencing-round order, within-round
  duplicate-flow-id dedup, and missing-local-flow-skip behavior;
  `summarizeBulkRoundSave`'s empty/mixed/all-saved/all-error outcome
  counts). The dialog's own button wiring is not unit-tested, matching
  every other fetch-client/dialog pair in this repo — `apps/debate-ai.com`
  still has no vitest project wired up (`vitest.config.ts`'s `projects`
  list is still `["packages/*"]` only). Documented in
  `docs/features/round-cloud-save.md` (data-flow diagram, feature
  description, and Known gaps updated — the closed gap is replaced with a
  narrower one: "Save all rounds" has no per-round dirty tracking, so it
  re-`PUT`s every round unconditionally on each click) and
  `docs/features/flow-cloud-save.md` (its own mirrored Known gap marked
  closed for the common case, with the "a flow with no round referencing
  it still has no bulk path" caveat noted). Verified: `bun install` (2258
  packages), `bunx vitest run packages/debate-round/test/
  bulkRoundSave.test.ts` (11/11 pass), full `bun run test` (192 files /
  3016 tests, all pass), `bunx turbo run typecheck
  --filter=debate-round` (11/11 in-scope package tasks pass), a direct
  `npx tsc --noEmit -p apps/debate-ai.com/tsconfig.json` (35 errors — the
  same pre-existing, unrelated baseline every prior slice has recorded,
  confirmed none in `FlowHistoryDialog.tsx`, `bulkRoundSave.ts`, or
  `index.ts`), and `bun run build:web` (`debate-ai-web` succeeds, `/debate`,
  `/tools`, and `/settings` present in the route list). No UI screenshot/
  Playwright smoke check was run this slice — the change reuses the same
  `saveFlowToAccount`/`saveRoundToAccount` calls and `cloudActions`/
  `cloudRoundActions` status rendering the existing per-item save buttons
  already exercise (covered by the `favoriteTools`/theme-picker Playwright
  check's precedent), with only the aggregation/dedup logic being new and
  that logic is what `bulkRoundSave.test.ts` covers directly. **Completed:**
  2026-08-30.
- **Sticky heading breadcrumb + idea #9 doc/tracker correction (idea #9,
  "Expandable Heading Structure").** Scoping idea #9's first listed
  follow-up ("a settings toggle to make the outline panel on-by-default
  instead of opt-in") found the bullet's whole framing was stale: it and
  `docs/features/reason-editor-outline-nav.md` both described the
  TipTap-era `reason-editor` package's `OutlineNavPanel`/`ReasonEditor`
  `showOutline` prop — dead code, unreachable since PR #338 replaced
  `/reason-editor`'s editor with `debate-editor-cardmirror`'s
  `CardMirrorEditor` (whose own `showOutline`/`documentId` props are
  declared on its prop type but never read anywhere in the
  implementation — a second, independent vestigial no-op from the same
  migration). The real, live outline feature is CardMirror's own native
  `editor/nav-panel.ts` (`NavigationPanel`) — considerably more capable
  than the dead version (drag-and-drop reorder, per-level filtering,
  multi-select, caret-follow highlighting) — and auditing it against
  idea #9's three follow-ups found two already done: `navPaneVisible`
  (its show/hide setting, `toggleNavPane` ribbon command) already
  defaults to visible, and `nav-panel.ts`'s drag/drop already supports
  drag-to-reorder. Only the third — "a sticky breadcrumb showing the
  current heading while scrolling" — was a genuine gap, so that's what
  this slice builds. Adds `editor/heading-breadcrumb.ts`: pure
  `computeBreadcrumbPath(headings, pos)`, a single forward pass over
  `headings.ts`'s existing `collectHeadings()` flat list maintaining a
  level-ordered ancestor stack (pop while the top's level >= the next
  entry's level, then push) — the same sibling-span trick
  `sectionEndFromHeading` already uses, needing no parent pointers. Adds
  `editor/heading-breadcrumb-bar.ts`'s `HeadingBreadcrumbBar`: on scroll
  (rAF-throttled) and on doc update, resolves the doc position at the top
  of the visible scroll area via `view.posAtCoords` and renders the
  resulting ancestor chain as clickable segments (reusing
  `precise-scroll.ts`'s `scrollToHeadingId`, the same jump path
  `nav-panel.ts`'s own row clicks use). Wired into `editor/index.ts` at
  the same touch points `navPanel` itself uses (`attach`/`update` in
  `mountView`, plus the idle-scheduled `scheduleHeavyUpdate` path) and
  into `react/ribbon-template.ts`'s static markup (a new
  `#heading-breadcrumb-bar` div, sibling of `.pmd-editor-row` inside
  `#app` so `position: sticky` pins it to `#app`'s own scroll box, not
  the viewport) plus `editor/style.css`. Single-doc only — multi-pane/
  multi-window aren't wired up (a follow-up, not a regression, since
  neither had a breadcrumb before this file existed). A live Playwright
  pass against a real editor (see Verified below) caught a real bug this
  slice's own unit tests couldn't reach: at `scrollTop: 0`,
  `view.posAtCoords` at the single 4px-below-the-bar probe point
  resolved to `null` (the document's own top padding/margin gap, most
  visible right at the very top before any heading's box begins) — and
  the original code's "keep the last render on a miss" fallback (meant
  for a transient mid-scroll gap) meant the breadcrumb stuck on whatever
  heading was current before the scroll and silently never updated back
  to the first heading. Fixed by probing three increasing offsets (4px/
  20px/48px below the bar) and using the first hit — confirmed via the
  same Playwright flow: a two-Pocket document showed "Pocket One" at
  `scrollTop: 0` and "Pocket Two" at max scroll after the fix, both
  "Pocket Two" before it. Vitest-covered in
  `packages/debate-editor-cardmirror/test/heading-breadcrumb.test.ts` (8
  cases: empty input, pos before every heading, a single root heading, a
  full pocket→hat→block→tag chain at various positions, a shallower
  sibling popping a deeper chain, two top-level headings resetting the
  chain, and an analytic treated the same as a tag). `HeadingBreadcrumbBar`
  itself is not unit-tested — it's DOM/`posAtCoords`-wiring, matching this
  package's existing convention of Vitest-covering pure logic only (no
  `.tsx`/DOM-wiring test exists for `nav-panel.ts` either) — instead
  verified via a manual Playwright pass, which is also how the
  `posAtCoords`-null bug above was actually found. Documented in
  `docs/features/reason-editor-outline-nav.md`, rewritten end to end to
  describe the real CardMirror implementation instead of the dead
  `reason-editor` one, and idea #9's own Product Feature Ideas entry
  above corrected to match. Verified: `bun install` (2258 packages),
  `bunx vitest run --project debate-editor-cardmirror
  test/heading-breadcrumb.test.ts` (8/8 pass), full `bun run test` (191
  files / 3003 tests, all pass, up from 2995), `bunx turbo run typecheck
  --filter=debate-editor-cardmirror` (3/3 in-scope package tasks pass),
  `bun run build:web` (`debate-ai-web` succeeds, `/reason-editor` present
  in the route list), and a headless-Chromium (Playwright) pass against
  `wrangler dev --port 8787` (not `bun run dev:web`'s plain `vinext dev`,
  which has no D1 binding at all — `/api/doc/documents` 500s with "no
  such table: documents" until the repo-root `drizzle/*.sql` migrations
  are applied with `wrangler d1 execute debate-ai-db --local --file=...`
  for each file) covering: creating a document, typing and F4/F5/F6-
  styling a multi-level heading structure, confirming the nav panel and
  breadcrumb both reflect it, scrolling from the very top to the true
  max-scroll bottom of a two-Pocket document and confirming the
  breadcrumb tracks the transition correctly (this is what caught and
  then confirmed the fix for the `posAtCoords`-null bug above), clicking
  a breadcrumb segment and confirming it jumps (`app.scrollTop` reset to
  0 after clicking the first segment), and zero new `pageerror`/
  `console.error` output beyond three pre-existing, unrelated ones (a
  blocked-by-sandbox `fonts.googleapis.com` request and two expected
  401s from `/api/settings` while signed out). Follow-ups: (a) a
  dedicated visibility toggle for the breadcrumb, mirroring
  `toggleNavPane`'s `navPaneVisible` pattern, so a user can hide it
  without also losing the nav panel; (b) a multi-pane/multi-window
  breadcrumb (today single-doc only, since each of those modes has its
  own `.pmd-pane-body` scroller and view). **Completed:** 2026-08-30.
- **My Saved Items — include saved flows (idea #17, `/tools`
  discoverability gap).** Prompted by another repeat of idea #17's standing
  request ("create user settings and link user db SQL... with ability to
  save flows docs and debates in SQL and link to users... add tools into
  where needed in the ui... develop better tool ui"). Auditing the three
  D1-backed save stores that request names — `documents` (REASON editor),
  `saved_flows`, `saved_rounds` — against every place a signed-in user can
  discover their saved data found `app/tools/MySavedItems.tsx` (the "My
  Saved Items" widget atop the `/tools` grid, added by an earlier idea #17
  slice specifically to make cloud saves discoverable) only ever fetched
  `/api/doc/documents` and `/api/rounds`: a user with cloud-saved flows and
  nothing else saw an empty widget despite having real cloud data, and a
  user with all three saw flows silently missing from the merged list.
  `FlowHistoryDialog`'s own "Saved to account" tab (inside `/debate`) always
  showed all three correctly — this was specifically the top-level
  `/tools` widget's gap, not a data or route problem. Extracted the
  merge/sort/label/relative-time logic the widget had inlined (and that a
  fix needed to touch anyway) into a new pure module,
  `packages/debate-round/src/state/cloudLibrary.ts`:
  `parseCloudTimestamp` (normalizes an ISO string or a raw unix-seconds/
  -milliseconds number into milliseconds, matching every timestamp shape
  the three routes can hand back), `buildRecentCloudItems` (merges
  documents/flows/rounds summaries into one newest-first list, capping each
  kind to `perKindLimit` before the merge so one prolific kind can't crowd
  the others out, then the merged result to `limit`, with per-kind default
  hrefs a caller can override and a per-kind "Untitled ..." fallback label),
  and `formatRelativeCloudTime` (the widget's "Today"/"Yesterday"/"Nd ago"
  copy, with an injectable `now` for testability). `MySavedItems.tsx` now
  fetches `/api/flows` alongside the other two routes and calls these
  instead of its own inline merge, picking a `ListTree` icon for the new
  "flow" kind (`FileText` for documents, `Flag` for rounds, unchanged).
  Vitest-covered in `packages/debate-round/test/cloudLibrary.test.ts` (17
  cases: every `parseCloudTimestamp` shape including non-finite numbers and
  unparseable strings, merging+sorting all three kinds together, the
  flows-inclusion regression itself, default and overridden per-kind hrefs,
  per-kind untitled-label fallbacks, `perKindLimit` and `limit` capping
  independently, empty/omitted input, and every `formatRelativeCloudTime`
  boundary including future-timestamp clock-skew tolerance and a
  non-finite input). The fetch calls and the widget's own rendering are not
  unit-tested, matching every other fetch-client/route pair in this repo —
  `apps/debate-ai.com` still has no vitest project wired up (`vitest.
  config.ts`'s `projects` list is still `["packages/*"]` only). Documented
  in `docs/features/flow-cloud-save.md`'s Known gaps (the gap is recorded
  as closed there, alongside a pointer back to this entry). Verified: `bun
  install` (2258 packages), `bunx vitest run
  packages/debate-round/test/cloudLibrary.test.ts` (17/17 pass), full `bun
  run test` (190 files / 2995 tests, all pass, up from 2978), `bunx turbo run
  typecheck --filter=debate-round --filter=debate-ai-web` (12/12 in-scope
  package tasks pass), a direct `npx tsc --noEmit -p
  apps/debate-ai.com/tsconfig.json` (same 34 pre-existing, unrelated errors
  as every prior slice — confirmed none in `MySavedItems.tsx` or the new
  `cloudLibrary.ts`), and `bun run build:web` (`debate-ai-web` succeeds,
  `/tools`, `/settings`, `/api/flows`, `/api/rounds`, and
  `/api/doc/documents` all present in the route list). No UI screenshot/
  Playwright smoke check was run this slice — the change is a pure-logic
  extraction plus a mechanical third `fetch` call, and the existing
  `favoriteTools`/theme-picker Playwright check already exercises
  `/tools`'s sign-in-gated rendering path. **Completed:** 2026-08-30.
- **Insert Short Cite — the one CardMirror shortcut gap idea #14 named
  (`Mod-Shift-k`).** `docs/features/legacy-verbatim-shortcuts.md`'s Known
  gaps flagged this as "the one genuine (not just doc-staleness) gap"
  its audit found: CardMirror never grew a pure "format `Smith 24` and
  insert it at the cursor" command, unlike `F8` (styles already-typed
  text), `Alt-F8` (`copyPreviousCite`, reuses the nearest earlier cite),
  and `Mod-Shift-x` (`aiCreateCite`, formats a full citation from a
  selection via AI) — none of which cover "there's no cite text yet, I
  just want to drop in an author/year tag." Adds
  `packages/debate-editor-cardmirror/src/editor/insert-short-cite.ts`:
  the pure `buildInsertShortCiteTransaction(state, author, year)`
  (inserts the formatted tag at the selection/cursor and marks it
  `cite_mark`, reusing `debate-card-parser`'s existing
  `formatShortCiteTag` rather than reimplementing it — the same pure
  formatter the now-dead `reason-editor` package's equivalent command
  used) and the async `runInsertShortCite(view)`, which prompts for an
  author then a year via two sequential `text-prompt.ts` `promptForText`
  dialogs (the shared modal vocabulary every other prompt-driven
  CardMirror command already uses — never the native `window.prompt`,
  which Electron disables outright) before dispatching the transaction.
  Wired as a full `RibbonCommandId` (`insertShortCite`) through every
  touch point a first-class command needs: `ribbon-commands.ts`'s id
  union/list/label/`Mod-Shift-k` default keybinding/`RibbonContext`
  field/no-op default/dispatch case (no-selection-required, like
  `reformatAllCites`, since this inserts new text rather than acting on
  existing text), `ribbon-groups.ts`'s "Editing utilities" group
  (alongside `copyPreviousCite`, which also auto-registers it in the
  menu bar's Edit dropdown via `menu-bar-categories.ts`'s existing
  title-based mapping), and the real implementation in `editor/index.ts`
  alongside `aiCreateCite`'s. The command-palette
  (`quick-card-search-ui.ts`) and availability gating
  (`ribbon-availability.ts`) needed no changes — both already derive
  from the id/label lists automatically. Added `debate-card-parser` as an
  explicit `debate-editor-cardmirror` dependency (`workspace:*`) to reuse
  `formatShortCiteTag` rather than duplicating it — matches how
  `debate-speech-writer` already depends on the same package. Also
  corrected two other stale bullets under this same idea #14 entry in
  the Product Feature Ideas list above (an in-editor shortcuts reference
  and a keybinding-rebinding settings page both already exist —
  `openShortcutsReference`/`keybindings-editor.ts` — just never pruned
  from the backlog once built) while already touching that section; see
  the updated item 14 entry for what's actually still open there.
  Vitest-covered in
  `packages/debate-editor-cardmirror/test/insert-short-cite.test.ts` (10
  cases: `parseCiteYearInput`'s numeric/blank/non-numeric/whitespace
  branches, and `buildInsertShortCiteTransaction`'s collapsed-cursor
  insert, `cite_mark` application over exactly the inserted range,
  replacing a non-collapsed selection, the `"ND"`/`null` year sentinels,
  and the no-author `null` return). `runInsertShortCite`'s prompt/dispatch
  wiring itself is not unit-tested — this package has no jsdom
  environment wired into Vitest (confirmed: no `vitest.config.ts` exists
  under `packages/debate-editor-cardmirror`, and the root config's
  `projects: ["packages/*"]` picks it up with Vitest's node default) —
  matching this file's own precedent, `link-context-menu-plugin.ts`'s
  `editLink`, which is equally untested for the same reason. Verified:
  `bun install` (2258 packages, adding the new workspace dependency),
  `bunx turbo run typecheck --filter=debate-editor-cardmirror
  --filter=debate-card-parser` then a full `bunx turbo run typecheck`
  (14/14 in-scope package tasks pass), `bunx vitest run --project
  debate-editor-cardmirror` (45/45 pass, up from 35), full `bun run test`
  (189 files / 2978 tests, all pass, up from 2968), a direct `npx tsc
  --noEmit -p apps/debate-ai.com/tsconfig.json` (same 34 pre-existing,
  unrelated errors as every prior slice has recorded — `D1Database`/
  `Fetcher` globals, `debate-ui`'s `.svg`/`.png` module declarations,
  none in any file this slice touched), and `bun run build:web`
  (`debate-ai-web` succeeds, `/reason-editor` present in the route
  list). **Completed:** 2026-08-30.
- **Fix broken production build — two independently-merged idea #17
  branches redeclared `user_settings` and collided on `/api/rounds`
  (data-integrity/build fix, not a new idea slice).** `bun run build:web`
  and `npx tsc --noEmit -p apps/debate-ai.com/tsconfig.json` were both
  broken on `master`: `lib/database/schema.ts` declared `export const
  userSettings`/`export type UserSettingsRow` *twice* (TS2451/TS2300), and
  the vinext build failed outright — "You cannot use different slug names
  for the same dynamic path ('id' !== 'clientId')" — because
  `app/api/rounds/[id]/` and `app/api/rounds/[clientId]/` both existed as
  siblings. Root cause: PR #362 ("Add cloud persistence for FIAT rounds and
  user settings") and the PR #360/361/363/364/365 chain (this same idea
  #17's documented, tested, UI-wired slices above) each independently built
  a full round/user-settings persistence system without visibility into the
  other, and the merge that landed both kept every file from both sides
  instead of reconciling them. Investigated which system was actually live:
  PR #362's `user_settings` columns (`colorMode`/`defaultRoundPrivate`) and
  its `/api/user/settings` route were referenced nowhere outside their own
  files (dead on arrival); its `rounds` table + `/api/rounds/[id]` +
  `useRoundsCloudSync`/`RoundSyncStatus` (an auto-debounced round-sync badge
  mounted on `/debate`) turned out to already be broken *post-merge* too —
  the merge had silently overwritten PR #362's own `/api/rounds/route.ts`
  (GET+POST, `{id,title,format}` shape) with PR #365's `savedRounds`-backed
  version (GET-only, `{clientId,label,updatedAt}` shape), so
  `useRoundsCloudSync`'s POST calls already 405'd and its GET response
  shape no longer matched what it read. Its migration
  (`drizzle/0007_rapid_dragon_man.sql`, which also contained the
  conflicting duplicate `CREATE TABLE user_settings`) was never in
  `drizzle/meta/_journal.json` either — generated on a divergent branch
  state and never reconciled. Also found `app/tools/page.tsx` rendering
  `<MySavedItems />` with no import at all (TS2304) — a "recently saved
  docs/rounds" discoverability card for `/tools`, evidently dropped during
  the same merge. Fix: removed PR #362's entire dead/broken half —
  `app/api/user/settings/route.ts`, `app/api/rounds/[id]/route.ts`,
  `lib/hooks/useRoundsCloudSync.ts`, `components/layout/RoundSyncStatus.tsx`
  (+ its two `/debate` page mounts), the `rounds`/`RoundRow` schema export,
  and the duplicate `userSettings`/`UserSettingsRow` declaration — keeping
  only the tested, documented, UI-wired `saved_rounds`/`/api/settings`
  chain this idea's own history (below) already covers. Fixed
  `MySavedItems`'s missing import and updated its round-summary mapping
  from `r.title` to `r.label` to match the surviving `/api/rounds` route's
  actual (`saved_rounds`-backed) response shape. Deleted the untracked,
  conflicting `0007_rapid_dragon_man.sql` and the also-untracked
  `0010_worthless_raza.sql` (an ad-hoc `saved_rounds` migration that never
  made it into the journal either), then ran `drizzle-kit generate` against
  the now-deduplicated schema to produce a properly journaled
  `0011_plain_fantastic_four.sql` — confirmed via its own dry-run output
  that it emits *only* `CREATE TABLE saved_rounds` (plus its two indexes),
  no unrelated diff — restoring `drizzle/meta/_journal.json`/snapshot chain
  coherence for future `db:generate` runs. No `DROP TABLE`/destructive SQL
  was written anywhere — the retired `rounds` table's own `CREATE TABLE`
  statement is simply no longer regenerated for a fresh database; an
  already-provisioned remote D1 database (if `0007_rapid_dragon_man.sql`
  ever partially ran there before this fix) is left untouched, just
  unreferenced. No new Vitest tests were added — every changed file is
  either dead-code deletion, a route/schema dedup, or app-level UI wiring in
  `apps/debate-ai.com`, which (per every prior slice's own verification
  notes above) still has no vitest project wired up
  (`vitest.config.ts`'s `projects` list is `["packages/*"]` only);
  correctness here is what `tsc`/the production build/the full existing
  suite actually catch, and all three now pass. Verified: `bun install`
  (2258 packages), `npx tsc --noEmit -p apps/debate-ai.com/tsconfig.json`
  (34 errors — the same pre-existing, unrelated baseline every prior slice
  has recorded, down from 39 before this fix: the 4 duplicate-`userSettings`
  lines and the `MySavedItems` TS2304 are gone, nothing new introduced),
  `bunx turbo run typecheck` (13/13 in-scope package tasks pass), full `bun
  run test` (188 files / 2968 tests, all pass — unchanged from before this
  fix, confirming no behavior regression in the packages that were already
  tested), and `bun run build:web` (`debate-ai-web` succeeds — previously
  failed outright with the vinext slug-collision error — with `/api/rounds`,
  `/api/flows`, `/api/settings`, `/debate`, `/tools`, and `/settings` all
  present in the route list). **Completed:** 2026-08-30.
- **Round Workspace — "Tools for this round" menu (idea #17, follow-up
  (4), discoverability-audit half).** Prompted by the same standing "add
  tools into where needed in the ui... develop better tool ui" ask idea
  #17's follow-up (4) was left open for. Audited every route under
  `apps/debate-ai.com/app` against the `/tools` catalog
  (`app/tools/tool-groups.ts`) and found no genuinely undiscoverable tool
  route — everything reachable outside the main dock/Settings menu was
  already listed there. The real gap was the round workspace itself
  (`/debate`): it linked to none of the tools that read its own currently
  selected flow back out (Argument Tree Outline, AI Response-Outcome
  Charts, Practice Drills, AI Coach Mode — each with its own "Generate ...
  for current round" action reading `debate-round`'s `state/store.ts`
  `useFlowStore` directly, per `ArgumentTreePanel.tsx`/
  `VulnerabilityChartsPanel.tsx`/`DrillSetsPanel.tsx`/
  `CoachingSessionsPanel.tsx`), so a debater had to already know a tool
  existed, leave the workspace, find it in the `/tools` grid, then come
  back. Added `debate-round`'s `round/flow-tool-links.ts` (pure
  `FLOW_TOOL_LINKS`/`buildFlowToolsMenuItems`, disabling every entry when
  no flow is selected, mirroring each target panel's own
  `disabled={!currentFlow}` gating) and `layout/FlowToolsMenu.tsx` (a
  wrench-icon dropdown), wired into `layout/FlowPageSidebar.tsx`'s existing
  quick-action button row as a fourth button alongside split-mode/Flow
  History/Edit Round. Also searched every `*Panel.tsx` across
  `debate-round`/`debate-card-search`/`debate-speech-writer` for one not
  importing `debate-ui` (the "bring weaker panel UIs up to the shared
  `debate-ui` primitive conventions" other half of follow-up (4)) and found
  none outside dead code (the old TipTap-era `packages/reason-editor`
  panels, superseded by `debate-editor-cardmirror` since PR #338 and
  imported nowhere in the app) and an unrelated Electron app
  (`debate-flow-ebb`) — that half of follow-up (4) stays open pending a
  more exhaustive pass, or a specific panel a user flags as weak. Also
  found two other open PRs (#362, #365) already in flight for follow-up
  (3)'s remaining "rounds" D1 half as of this run — deliberately not
  duplicated here. Vitest-covered in
  `packages/debate-round/test/flowToolLinks.test.ts` (10 cases:
  `FLOW_TOOL_LINKS` shape/uniqueness, and `buildFlowToolsMenuItems`'s
  enabled/disabled behavior for a selected flow vs. `null`/`undefined`).
  See `docs/features/flow-tools-menu.md`.
- **Integrate Tools into User Settings (idea #17, "integrate tools into
  user settings" follow-up, plus a `/tools` UI-polish pass).** Prompted by
  a request to "integrate tools into the user settings and improve tools
  ui and have more options in user settings." Three parts:
  (1) **Favorite tools**, a new account-linked `favoriteTools` field on the
  same `user_settings` row (`apps/debate-ai.com/lib/database/schema.ts`,
  JSON-array-of-route-paths column, migration
  `drizzle/0010_add_favorite_tools.sql`) — `debate-round`'s new
  `state/favoriteTools.ts` (pure `normalizeFavoriteToolsPatch`/
  `isValidToolHref`/`isValidFavoriteToolsList`/`serializeFavoriteTools`/
  `parseFavoriteTools`, mirroring `state/userSettings.ts` and
  `state/themeSettings.ts`'s split, but validating only an in-app path's
  *shape* — the package doesn't know the app's tool catalog); `/api/settings`
  now reads/writes `favoriteTools` alongside the other fields on the same
  GET/PUT; and a new `lib/hooks/useFavoriteTools.ts` (local-first,
  best-effort account sync, same pattern as `theme-dropdown.tsx`'s
  `useThemeState`, with a same-tab `favorite-tools-changed` window event so
  every mounted instance — star buttons, the favorites strip, the Settings
  list — stays in sync without a shared store). Found via a Playwright
  smoke check (below) that a naive per-instance `fetchUserSettings()` call
  fired ~50 GET `/api/settings` requests on one `/tools` load (one per
  mounted star button); fixed by deduping the account fetch behind a
  module-level `remoteLoadPromise` so every instance awaits the same
  in-flight request — exactly one GET fires per page load regardless of
  how many components mount the hook. (2) **`/tools` UI**: every
  tool card now has a star toggle (`components/tools/FavoriteToolButton.tsx`,
  positioned as a sibling of the card's `<Link>`, not nested inside it, to
  keep the markup valid), and a new "Favorites" strip
  (`components/tools/FavoritesController.tsx`) shows starred tools as
  compact pills above the grid, hidden until a favorite exists. The
  `TOOL_GROUPS` catalog moved out of `app/tools/page.tsx` into a new
  `app/tools/tool-groups.ts` (plus a flattened `ALL_TOOLS`) so both the
  favorites strip and the Settings page below can resolve a starred `href`
  back to its label/icon/description — `page.tsx` itself is otherwise
  unchanged (still the same grid, still `ToolsSearch`'s DOM-attribute
  filtering). (3) **More `/settings` options**: `UserSettingsPanel` gained
  Color theme and Light/dark mode pickers (previously `colorTheme`/
  `themeMode` synced silently through the dock's separate `ThemeDropdown`
  only — follow-up (2) closed the API/sync gap but never gave this form its
  own UI for them) plus a "Reset to defaults" button, and a new
  "Favorite tools" section (`components/settings/FavoriteToolsSettings.tsx`)
  lists and lets you unpin your starred tools right from Settings, closing
  the loop the "integrate tools into user settings" framing asked for
  (favoriting isn't only reachable from `/tools`). `next-themes` — needed
  by `UserSettingsPanel` for `useTheme()` — is now a `debate-round`
  peerDependency/devDependency rather than app-only; bun's
  content-addressable store resolves both the app's and the package's copy
  to the same physical module (confirmed via `readlink -f` on both
  `node_modules/next-themes` symlinks), so it shares one `next-themes`
  React context rather than risking a duplicate-instance split. Vitest-
  covered in `packages/debate-round/test/favoriteTools.test.ts` (47 cases:
  every valid/invalid tool-href shape, list validation including the
  `MAX_FAVORITE_TOOLS` boundary and duplicate rejection, patch
  normalization, and `serializeFavoriteTools`/`parseFavoriteTools`
  round-tripping and malformed-input tolerance). The fetch client, the
  hook's sync wiring, and the D1 route itself are not unit-tested, matching
  every other fetch-client/D1-route pair in this repo. Verified: `bun
  install` (2258 packages, `next-themes` symlinked into
  `packages/debate-round/node_modules`), `bunx vitest run packages/debate-round/test/favoriteTools.test.ts`
  (47/47 pass), full `bun run test` (183 files / 2905 tests, all pass, up
  from 2858), `bunx turbo run typecheck --filter=debate-round` (12/12
  in-scope package tasks pass), a direct `npx tsc --noEmit -p
  apps/debate-ai.com/tsconfig.json` (same 34 pre-existing, unrelated errors
  as before this slice), `bun run build:web` (`debate-ai-web` succeeds,
  `/api/settings`, `/settings`, and `/tools` present in the route list),
  and a headless-Chromium (Playwright) smoke check against the dev server
  covering: starring a tool on `/tools` reveals it in the favorites strip;
  the same favorite appears in `/settings`' Favorite tools list and its
  remove button un-favorites it (list empties back to the "haven't pinned
  any" prompt); the Color theme/Light-dark-mode pickers apply
  (`<html>` gains `theme-cyberpunk dark`, `localStorage['color-theme']`
  updates) and Save shows the local-save confirmation; and zero
  `pageerror`s across all of the above (this check is what caught the
  ~50x duplicate-fetch bug above). Follow-up
  (4) (the standing tool-panel/nav UI-polish audit named by prior slices)
  remains open, undecomposed; this slice's `/tools` UI work overlaps but
  doesn't close it. **Completed:** 2026-08-30.
- **Theme Settings — sync the color-theme/light-dark preference into
  `user_settings` (idea #17, follow-up (2)).** Closes the "Only
  `debateStyle`/`fontSize` are covered" Known gap `docs/features/
  user-settings.md` flagged after the first slice. Prompted by the same
  repeated "create user settings and link user db SQL... add tools into
  where needed in the ui" request that started idea #17. Adds
  `colorTheme`/`themeMode` nullable columns to the existing D1
  `user_settings` table (`apps/debate-ai.com/lib/database/schema.ts`) plus
  migration `drizzle/0009_add_theme_settings.sql`; `debate-round`'s new
  `state/themeSettings.ts` (pure `THEME_NAMES`/`THEME_MODES` registries —
  moved here from `theme-dropdown.tsx`'s own copy, now the single source of
  truth both the picker UI and the account-sync validator read — plus
  `normalizeThemeSettingsPatch`, mirroring `normalizeUserSettingsPatch`'s
  shape); `/api/settings`'s `GET`/`PUT` now validate and persist
  `colorTheme`/`themeMode` alongside `debateStyle`/`fontSize` on the same
  row (a `PUT` can patch either or both concerns in one request); and
  `theme-dropdown.tsx`'s `useThemeState` hook (the dock's actual live theme
  picker, via `CategoryDock`) now calls the same `fetchUserSettings`/
  `saveUserSettings` client `UserSettingsPanel` uses (newly exported from
  `debate-round`'s public index, alongside the `FullUserSettingsPayload`
  type combining both concerns) — on mount, a signed-in user's saved
  `colorTheme`/`themeMode` overrides the local-only value read first;
  on every theme/light-dark change, the new value applies locally first
  (unchanged from before this slice) and then best-effort syncs to the
  account, silently swallowing a failed sync rather than surfacing an
  error, since this is a background dropdown action rather than an
  explicit form Save. No new UI surface was added — the color-theme/
  light-dark picker already exists in the dock; this slice only makes it
  account-aware rather than duplicating a second picker on `/settings`, so
  idea #17's own decomposition ("(2) a follow-up to sync the color-theme/
  light-dark preference... into the same table") is closed without a UI
  change. The standalone `ThemeDropdown` component in the same file (as
  opposed to the `useThemeState` hook it and `CategoryDock` both share) was
  left unwired — confirmed dead code, unused anywhere in the app.
  Vitest-covered in `packages/debate-round/test/themeSettings.test.ts` (27
  cases: every valid/invalid `colorTheme`/`themeMode` value, partial
  patches, unknown-field passthrough, malformed/non-object bodies, and
  `DEFAULT_THEME_SETTINGS` itself validating). The fetch client and
  `useThemeState`'s sync wiring are not unit-tested, matching every other
  fetch-client/D1-route pair in this repo and this same idea's first slice
  — `apps/debate-ai.com` still has no vitest project wired up (`vitest.
  config.ts`'s `projects` list is still `["packages/*"]` only). Documented
  in `docs/features/user-settings.md` (data-flow diagram and Known gaps
  updated). Verified: `bun install` (2258 packages), `bunx vitest run
  packages/debate-round/test/themeSettings.test.ts` (27/27 pass), full
  `bun run test` (182 files / 2858 tests, all pass, up from 2831), `bunx
  turbo run typecheck --filter=debate-round --filter=debate-ai-web` (12/12
  in-scope package tasks pass), a direct `npx tsc --noEmit -p
  apps/debate-ai.com/tsconfig.json` (same 34 pre-existing, unrelated errors
  as before this slice — e.g. `D1Database`/`Fetcher` globals and
  `debate-ui`'s `.svg`/`.png` module declarations — confirmed none in any
  file this slice touched), and `bun run build:web` (`debate-ai-web`
  succeeds, `/api/settings` and `/settings` present in the route list).
  Follow-ups (3) (migrate `useFlowStore`'s `rounds` — the "flows" half is
  already done, see the Flow Cloud Save entry below) and (4) (the standing
  tool-panel/nav UI-polish audit) remain open, undecomposed. **Completed:**
  2026-08-30.
- **Flow Cloud Save (idea #17, follow-up (3), "flows" half).** Lets a
  signed-in user save an individual debate flow to their account and load
  it back on any device they sign in on, continuing idea #17's follow-up
  (3) — "design and migrate specific already-localStorage-only stores that
  make sense as account-linked data onto D1, most notably `useFlowStore`'s
  `rounds`/`flows`." Prompted by a repeat of the same request that started
  idea #17 ("create user settings and link user db SQL... with ability to
  save flows docs and debates in SQL and link to users"). Adds a new D1
  `saved_flows` table (`apps/debate-ai.com/lib/database/schema.ts`, one row
  per (user, flow), unique on `(user_id, client_id)` so re-saving the same
  flow after an edit upserts rather than duplicates, cascade-deleted with
  the account) plus migration `drizzle/0008_tough_wolfsbane.sql`; new
  account-only `/api/flows` (list summaries) and `/api/flows/[clientId]`
  (get/upsert/delete one saved flow) routes — both 401 without a session,
  same as `/api/settings`, since (unlike `documents`) a saved flow only
  exists once explicitly synced to an account; `debate-round`'s new
  `state/savedFlows.ts` (pure `isValidFlow` structural validator — required
  fields plus a recursively-validated, depth-capped `Box` tree — and
  `deriveFlowLabel`, shared by the route and the UI) and
  `round/saved-flows-client.ts` (fetch client, `null` return rather than a
  throw on `401`/`404` for the read calls so a signed-out user degrades
  gracefully); and a "Saved to account" tab plus a per-flow cloud-upload
  icon added to `dialogs/FlowHistoryDialog.tsx`'s existing "Rounds" tab (its
  `activeTab` state existed already but was previously unwired to any
  tab-switcher UI — the never-rendered "history" tab option was dropped in
  the same change since it had no UI either). Saving a flow to the account
  is opt-in per flow (no auto-sync-on-every-edit, which would risk
  clobbering an in-progress local edit with a stale saved copy or
  hammering the API on every keystroke) — a follow-up. `rounds` are not
  migrated by this slice; only individual flows. Vitest-covered in
  `packages/debate-round/test/savedFlows.test.ts` (28 cases: a well-formed
  flow with an empty/nested `Box` tree, every optional field present,
  every required field individually missing, non-object top-level values,
  a non-string entry in `columns`, a non-number entry in `lastFocus`, a
  malformed `Box` at the top level and nested three levels deep, a tree
  past the 200-level recursion cap, and every `deriveFlowLabel` branch
  including the 120-character truncation). The fetch client and the D1
  routes themselves are not unit-tested, matching every other fetch-client/
  D1-route pair in this repo (`round/user-settings-client.ts`,
  `app/api/settings/route.ts`) — `apps/debate-ai.com` still has no vitest
  project wired up (`vitest.config.ts`'s `projects` list is still
  `["packages/*"]` only). Documented in `docs/features/flow-cloud-save.md`.
  Verified: `bun install` (2258 packages), `bunx vitest run
  packages/debate-round/test/savedFlows.test.ts` (28/28 pass), full `bun
  run test` (181 files / 2831 tests, all pass, up from 2803), `bunx turbo
  run typecheck --filter=debate-round --filter=debate-ai-web` (12/12
  in-scope package tasks pass — same pre-existing, unrelated errors as
  before this slice when run via a flat `tsc --noEmit` instead, e.g.
  `D1Database`/`Fetcher` globals and `debate-ui`'s `.svg`/`.png` module
  declarations, none of them in any file this slice touched), and `bun run
  build:web` (`debate-ai-web` succeeds, `/api/flows` and
  `/api/flows/:clientId` present in the route list). Follow-ups: (a) a
  bulk "save this round's flows" action, so a user doesn't have to click
  the cloud icon on every flow of a round individually; (b) migrate
  `rounds` themselves (the tournament/debaters/judges wrapper), which
  idea #17's follow-up (3) also named and this slice explicitly left out —
  needs its own schema design for how a saved round should reference its
  saved flows; (c) idea #17's follow-up (2) (sync the color-theme/
  light-dark preference into `user_settings`) and follow-up (4) (a standing
  UI-polish audit of existing tool panels/nav discoverability) both remain
  open, undecomposed. **Completed:** 2026-08-30.
- **User Settings — account-linked debate preferences (idea #17), first
  slice.** Gives a signed-in user a real settings page for the
  `debateStyle`/`fontSize` preferences `packages/debate-round/src/state/
  settings.ts` already reads throughout the flow editor
  (`DebateRoundPanel`, `SpeechHeaderBar`, `CreateRoundDialog`) but never
  exposed through any UI before this — the gear-icon "Settings" dock menu
  only ever linked to Features/Tools/Theme/Account. Prompted by a request
  to "create user settings and link user db SQL... add tools into where
  needed in the ui." Adds a new D1 `user_settings` table
  (`apps/debate-ai.com/lib/database/schema.ts`, one row per `user.id`,
  cascade-deleted with the account, `debateStyle`/`fontSize` nullable —
  null means "use the client default") plus migration
  `drizzle/0007_left_wiccan.sql`; a new account-only `/api/settings` route
  (GET current row or defaults, PUT validate-and-upsert, both 401 without
  a session — settings are account data, unlike `documents`' anonymous-row
  fallback); `debate-round`'s new `state/userSettings.ts` (pure
  `normalizeUserSettingsPatch`/`applyUserSettingsToLocalStore`/
  `readLocalUserSettings`, validating against the same option lists the
  local `settings` singleton's picker UI already uses, shared by both the
  route and the panel so a rejected value can never reach either side)
  and `round/user-settings-client.ts` (fetch client, `null` return rather
  than a throw on `401` so a signed-out user degrades gracefully instead
  of erroring); and `panels/UserSettingsPanel.tsx`, rendered at a new
  `/settings` route (`apps/debate-ai.com/app/settings/page.tsx`) reachable
  from a new "Preferences" item in the dock's Settings dropdown
  (`components/layout/CategoryDock.tsx`). Saving always applies
  immediately to the local `settings` singleton first — signed-out
  behavior is unchanged from before this slice — then best-effort syncs
  to the account when signed in; a failed account sync is reported inline
  but never blocks the local apply. Vitest-covered in
  `packages/debate-round/test/userSettings.test.ts` (30 cases: every
  valid/invalid `debateStyle`/`fontSize` value including boundaries,
  partial patches, unknown-field passthrough, malformed/non-object
  bodies, and `applyUserSettingsToLocalStore`'s round-trip through a
  mocked `localStorage`). The fetch client and the D1 route itself are
  not unit-tested, matching every other fetch-client/D1-route pair in
  this repo (`round/judge-decision-client.ts`,
  `app/api/evidence-reuse-check/route.ts`) — `apps/debate-ai.com` has no
  vitest project wired up at all (confirmed: `vitest.config.ts`'s
  `projects` list is `["packages/*"]` only, and there is no repo-wide
  typecheck or lint script that covers the app either — `tsc --noEmit -p
  apps/debate-ai.com/tsconfig.json` run directly surfaces only
  pre-existing, unrelated errors, e.g. `D1Database`/`Fetcher` globals and
  `debate-ui`'s `.svg`/`.png` module declarations, none of them in any
  file this slice touched). Documented in
  `docs/features/user-settings.md`. Verified: `bun install` (2258
  packages), `bunx vitest run packages/debate-round/test/
  userSettings.test.ts` (30/30 pass), full `bun run test` (180 files /
  2803 tests, all pass, up from 2773), `bunx turbo run typecheck
  --filter=debate-round --filter=debate-ai-web` (12/12 in-scope package
  tasks pass — `debate-ai-web` itself has no `typecheck` script, so only
  its workspace dependencies ran), and `bun run build:web` (`debate-ai-web`
  succeeds, `/settings` and `/api/settings` present in the route list).
  Follow-ups recorded under idea #17 above: (2) sync the color-theme/
  light-dark preference into the same table; (3) design and migrate
  specific already-localStorage-only stores that make sense as
  account-linked data onto D1, most notably `useFlowStore`'s `rounds`/
  `flows` and the REASON-editor-adjacent `Flow.speechDocs`/
  `sharedSpeeches` fields, each needing its own schema design rather than
  a mechanical repeat of this slice's flat-row pattern; (4) a standing
  UI-polish audit of existing tool panels/nav discoverability, not yet
  decomposed into a specific implementable change. **Completed:**
  2026-08-30.
- **Legacy Verbatim / Cardmirror Compatibility — correct
  `legacy-verbatim-shortcuts.md` for the live CardMirror editor.** Closes
  the staleness `speech-document-target.md`'s Known gaps flagged: "a future
  cycle doesn't have to rediscover it." The doc's "Route"/"Package" lines
  and data-flow diagram described the TipTap-based `reason-editor`
  package's `Mod-Shift-E`/`Mod-Shift-K`/`Mod-Shift-D`/`Alt-ArrowUp`/
  `Alt-ArrowDown` shortcuts as if they ran in the shipped app — they don't;
  `/reason-editor` has rendered `debate-editor`'s shim to
  `debate-editor-cardmirror` since PR #338, and that package's own
  `ribbon-commands.ts` already ships a considerably larger, Verbatim-
  hotkey-faithful command set (F8 Cite / F9 Underline / F10 Emphasis, the
  F3/Alt-F3/Mod-Alt-F3/Mod-Alt-Shift-F3 condense family,
  Mod-Alt-ArrowUp/Down move-container, Alt-F8 copy-previous-cite,
  Mod-Shift-x AI-assisted cite formatting) that predates and supersedes
  the never-wired `Mod-Shift-*` set. Prompted by a request to "integrate
  CardMirror better into the editor" and make sure every tool's own docs
  describe what's actually live, this cycle rewrote
  `docs/features/legacy-verbatim-shortcuts.md` end to end: a corrected
  Route/Package/Nav header, a shortcuts table cross-referencing each
  command to its `MenuBar.tsx` category (Format/Card/Edit/AI — all three
  ways a command is reachable: keybinding, menu-bar dropdown, and the
  Ctrl/Cmd-Shift-Space command palette, which indexes every ribbon command
  by label/alias, not just the `t`-prefixed Workspace links), an explicit
  "how the four never-shipped shortcuts map onto these" section, and an
  updated data-flow diagram pointing at `ribbon-commands.ts`/
  `move-container.ts`/`ribbon-groups.ts`/`menu-bar-categories.ts`/
  `MenuBar.tsx`/`quick-card-search-ui.ts`. Also updated
  `speech-document-target.md`'s own pointer to this doc (it referenced the
  staleness this slice just fixed) and idea #14's status note above. One
  genuine (not just stale-doc) gap surfaced by writing the comparison
  table honestly: CardMirror has no pure "insert a short cite tag at the
  cursor" command — the old `Mod-Shift-K` behavior — so `Known gaps` now
  records that a user has to pick among F8 (style existing text), Alt-F8
  (reuse a prior cite), or Mod-Shift-x (AI-generate one) depending on
  intent, rather than claiming a 1:1 equivalent that doesn't exist.
  Documentation-only slice — no source files changed, so no new test
  cases were needed; the audit that grepped `ribbon-commands.ts`/
  `ribbon-groups.ts`/`menu-bar-categories.ts` for the real command
  ids/keybindings/menu placements before writing the table is what keeps
  the table itself honest. Verified: `bun install` (2258 packages), `bun
  run test` (179 files / 2773 tests, all pass, unchanged), `bunx turbo run
  typecheck --filter=debate-editor-cardmirror --filter=debate-ui
  --filter=debate-ai-web` (12/12 in-scope package tasks pass), and `bun
  run build:web` (`debate-ai-web` succeeds, `/reason-editor` present in
  the route list). No repo-wide `lint` script exists, so that acceptance
  step is N/A. No follow-ups remain open on the doc-staleness gap; the
  short-cite-insertion gap noted above is recorded as a new, narrower
  Known gap rather than a numbered follow-up. **Completed:** 2026-08-26.
- **News Stream — cap sprint notes and Argument Library submissions to the
  20 most recent items each.** Closes the "no volume control" Known gap
  recorded in `docs/features/news-stream.md`: unlike the streak/challenge/
  revision Community sources (each naturally bounded to at most one event
  per contributor per milestone, per challenge, or per day), a Team
  Collaboration Mode prep note or an Argument Library submission posted a
  `NewsItem` every single time one was logged or saved, so a very active
  topic sprint or a busy submission period could flood the whole feed.
  Prompted by the same "flesh out the News Stream's functionality further"
  line of work as the three prior Community-source runs, this cycle picked
  the one already-identified, safely-startable gap left in that doc rather
  than adding a seventh source. `state/newsStream.ts` gains a
  `MAX_COMMUNITY_ITEMS_PER_SOURCE` constant (20) and a `mostRecentBy`
  helper (sorts by timestamp descending, slices to the limit) applied
  inside `sprintNoteNews()` and `argumentLibraryNews()` before mapping to
  `NewsItem`s — a feed-projection cap only: nothing is deleted from
  `sprintNotes.ts`/`evidenceLibraryEntries.ts`, and both tools' own pages
  (`/cards/collaboration`, `/cards/argument-library`) still list every
  record; `argumentLibraryNews()`'s existing "must carry a `createdAt`"
  filter runs first, so the cap always keeps the 20 most recently
  *timestamped* live entries. `sortNewsFeed` still re-sorts the whole feed
  afterward, so `mostRecentBy`'s own output order doesn't matter — only
  which records survive the cap does. Added a `PRODUCT_NEWS` entry
  announcing the change (`product-news-stream-volume-cap`, mirroring the
  five prior "News Stream now ..." announcements) and updated
  `docs/features/news-stream.md` (the "What it shows" bullets for both
  sources now note the cap, and the Known gap is narrowed rather than
  closed outright — the cap is per-source rather than per-topic/
  per-contributor, so one very active topic sprint can still crowd out a
  quieter one's notes within that same 20-item budget, and a burst busier
  than 20 items can still push its own older items out before a viewer
  necessarily sees them). Vitest-covered in `newsStream.test.ts` (two new
  cases: 25 sprint notes/25 Argument Library entries each collapse to
  exactly 20 items in the feed, keeping the newest and dropping the
  oldest by `createdAt`). Verified: `bun install` (2258 packages),
  `bunx vitest run packages/debate-card-search/test/newsStream.test.ts`
  (18/18 pass, up from 16), full `bun run test` (179 files / 2773 tests,
  all pass, up from 2771), `bunx turbo run typecheck --filter=debate-card-
  search --filter=debate-ui` (4/4 in-scope package tasks pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/news` route present, no
  route changes). No repo-wide `lint` script exists, so that acceptance
  step is N/A. No follow-ups remain open on the "no volume control" gap
  specifically; the narrower per-source/per-burst limitation above is
  recorded as a new, smaller Known gap rather than a numbered follow-up.
  **Completed:** 2026-08-26.
- **Speech Documents — replace the dead `reason-editor`-era send target
  with a real history of what CardMirror's send-to-speech actually
  sends.** Closes a disconnect found by the "make sure every tool is
  well-integrated in the live UI" audit, this time inside the REASON
  editor itself: `/speech-documents` (and its `/tools` card) described
  `Mod-Shift-S` / a "→Speech" toolbar button sending text into a
  persisted, find-or-create-by-title `SpeechDocument` record — true of
  the old TipTap-based `reason-editor` package, but `/reason-editor` has
  rendered `debate-editor`'s shim to `debate-editor-cardmirror` (the
  ported-in CardMirror ProseMirror engine that replaced it) for a while
  now, and CardMirror's actual send-to-speech feature is a
  pane-designation model (mark an open doc as the speech doc via the File
  menu's Speech section, then the backtick / Alt-backtick keys insert a
  live slice into it) that never wrote to that old store. The page was
  permanently empty no matter what a user did in the live editor.
  Verified end-to-end by reading the real wiring (`speech-doc-send.ts`'s
  `insertSpeechSlice`, the single call point shared by an in-window send,
  a cross-tab receive, and a cross-window receive) rather than trusting
  the old doc's claims. Since the pane model has no natural "list every
  speech document" concept — the speech doc is just an open Reason
  document, not a separate record — the fix wires in a real, listable
  **send log** instead of resurrecting a rival document-record concept:
  `debate-editor-cardmirror`'s new `editor/speech-send-log.ts` (pure
  `buildSpeechSendLogEntry`/`appendSpeechSendLogEntry`/
  `removeSpeechSendLogEntry`/`sanitizeSpeechSendLog`, capped at
  `MAX_SPEECH_SEND_LOG_ENTRIES`, plus a `WebSharedStore`-backed
  `speechSendLogStore` mirroring `dropzone-store.ts`'s IndexedDB +
  BroadcastChannel pattern, but never session-cleared since this is a
  durable history, not a scratch shelf) is called from `insertSpeechSlice`
  right after a successful dispatch, logging the plain text of the slice
  that actually landed. Re-exported from the package's headless `/engine`
  entry point (no ProseMirror or React in this module) so
  `apps/debate-ai.com/app/speech-documents`'s new `SpeechSendLogPanel.tsx`
  can read/subscribe to it without pulling in the editor bundle. The old
  `reason-editor` package's `SpeechDocumentsPanel` import was dropped from
  the page along with the app's now-unused `reason-editor` dependency
  (the package itself still exists in the monorepo, just no longer
  depended on by the app). Corrected the same "Mod-Shift-S / →Speech
  button" claim in `/tools`'s Speech Documents card, `WORKSPACE_LINKS`,
  and `feature-catalog.ts`'s description, and rewrote
  `docs/features/speech-document-target.md` end to end (plus a pointer
  left in `legacy-verbatim-shortcuts.md`'s Known gaps, which has the same
  stale-route staleness but is out of scope this cycle). Vitest-covered
  in `packages/debate-editor-cardmirror/test/speech-send-log.test.ts` (16
  new cases: preview collapsing/clipping at and past the cap, entry
  building including the blank-text null case, append/evict-oldest at a
  custom and the default cap, remove found/not-found, and sanitize
  filtering malformed persisted entries) — this package had no test
  suite of its own before this slice. `SpeechSendLogPanel.tsx` (a `.tsx`
  panel) verified via the build instead, per convention. Verified: `bun
  install` (2260 packages), `bun run test` (179 files / 2771 tests, all
  pass — 16 new), `bunx turbo run typecheck --filter=debate-editor-
  cardmirror --filter=debate-editor --filter=debate-ui --filter=debate-
  ai-web --filter=reason-editor` (13/13 in-scope package tasks pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/reason-editor` and
  `/speech-documents` both present in the route list). **Completed:**
  2026-08-26.
- **AI Judge Decision Modes — "Get AI judge decision →" deep link from the
  Judge Paradigm Picker.** Closes the `docs/features/judge-paradigm-selections.md`
  Known gap that saving a round's paradigm at `/paradigms` "doesn't itself
  invoke a judge decision" — a user had to remember the round ID, leave the
  page, and retype it into the separate `/judge-decision` panel. Prompted by
  a request to make sure every tool is well-integrated with the others in
  the live UI, not just individually complete. `debate-speech-writer`'s
  `state/judgeParadigmSelections.ts` gains `buildJudgeDecisionDeepLink(roundId)`
  (`/judge-decision?roundId=…`, percent-encoding the id), rendered as a "Get
  AI judge decision →" button next to each saved selection in
  `JudgeParadigmPickerPanel.tsx`. `debate-round`'s `JudgeDecisionPanel.tsx`
  now reads that `roundId` query param via `next/navigation`'s
  `useSearchParams` (the route already wraps the panel in `<Suspense>`) to
  pre-fill its Round ID field on mount — mirroring `debate-card-search`'s
  existing `EvidenceLibraryPanel`/`?checkUrl=`/`buildReuseCheckDeepLink`
  deep-link convention rather than inventing a new one. Used a plain `<a>`
  tag (via the `Button` primitive's `asChild`) instead of `next/link`, since
  `debate-speech-writer` has no dependency on `next` and one link across a
  page boundary didn't justify adding one. A re-run of the "Tools
  discoverability" audit (`feature-catalog.ts`'s `APP_FEATURES` against
  `/tools`'s `TOOL_GROUPS` and the editor's `WORKSPACE_LINKS`) found no
  orphaned routes remain, and every `TOOL_GROUPS` entry already carries
  `highlights` — so this cycle's "add each tool where needed" gap turned out
  to be a cross-tool link, not a missing nav entry. Vitest-covered in
  `packages/debate-speech-writer/test/judgeParadigmSelections.test.ts` (2
  new cases: the plain link shape, and percent-encoding a roundId with
  reserved characters). Verified: `bun install` (2260 packages), `bun run
  test` (178 files / 2755 tests, all pass — 2 new), `bunx turbo run
  typecheck --filter=debate-speech-writer --filter=debate-round` (12/12
  in-scope package tasks pass), and `bun run build:web` (`debate-ai-web`
  succeeds, `/paradigms` and `/judge-decision` both present in the route
  list). **Completed:** 2026-08-26.
- **News Stream — auto-generated "Tool spotlight" posts for every
  unannounced catalog entry.** Closes `docs/features/news-stream.md`'s
  longstanding Known gap: "Product Updates are manually curated — nothing
  detects a newly added route or `feature-catalog.ts` entry and drafts a
  post for it." Prompted by a request to make sure every tool has real
  presence across the UI, not just a card on the Tools page — the News
  Stream's Product Updates category previously only showed a tool if
  someone remembered to hand-write a `PRODUCT_NEWS` entry for it, so most
  of the ~50-entry `feature-catalog.ts` catalog (`debate-ui`'s
  `APP_FEATURES`) had never appeared in the feed at all.
  `lib/news-stream.ts`'s new `buildAutoFeatureNews(features?, announced?)`
  (defaulting to the real `APP_FEATURES` and `PRODUCT_NEWS`) synthesizes a
  generic `"product"`-category "Tool spotlight: …" `NewsItem` for every
  catalog entry whose `href` no hand-curated item already names — closing
  the exact gap wording without inventing a second competing "is this
  announced" registry: `href` overlap with `PRODUCT_NEWS` is the only
  signal. Every synthesized item shares one timestamp — one millisecond
  older than the oldest hand-curated item — so a real announcement (about
  that tool or any other) always sorts above the whole backfilled batch,
  and the batch itself sorts in stable `APP_FEATURES` order beneath it:
  spotlighting every uncovered tool without displacing genuine recent
  updates from the top of the feed. `state/newsStream.ts`'s `buildNewsFeed`
  now folds `buildAutoFeatureNews()` in alongside `PRODUCT_NEWS` (no store
  involved, so no live-update wiring needed — it's pure catalog data,
  identical on every call until either list changes). `debate-card-search`
  already depended on `debate-ui` (used throughout for UI primitives), so
  importing `APP_FEATURES`/`FeatureEntry` from
  `debate-ui/src/features/feature-catalog` needed no new dependency edge or
  cycle workaround, unlike the prior "AI Coach Mode sessions" run's
  `extraItems` composition point. `docs/features/news-stream.md` updated
  (new "What it shows" bullet, data-flow diagram, and the Known gaps
  section — the closed bullet replaced with a narrower one: a spotlight is
  a generic restatement of the catalog description and can't tell "just
  shipped" from "always existed," so a real `PRODUCT_NEWS` entry is still
  the way to say something more specific). Vitest-covered in
  `newsStream.test.ts` (`buildAutoFeatureNews`'s own filtering and
  timestamp-floor behavior against hand-built fixtures, plus one assertion
  against the real `APP_FEATURES`/`PRODUCT_NEWS` lists; the existing
  "returns just the hand-maintained product news" `buildNewsFeed` case
  updated to expect the spotlight batch too). Verified: `bun install`
  (2260 packages), `bun run test` (178 files / 2753 tests, all pass — 4
  new), `bun x turbo run typecheck` (13/13 in-scope package tasks pass),
  and `bun run build:web` (`debate-ai-web` succeeds, `/news` route
  present). **Completed:** 2026-08-26.

- **News Stream — wire a sixth Community category: AI Coach Mode
  sessions.** Closes the "a coaching session" half of the Known gap
  `docs/features/news-stream.md` recorded after the prior "wire a fifth
  Community category" run — that gap existed because `debate-round` (where
  coaching sessions live) already depends on `debate-card-search` (where
  News Stream lives), so a coaching-session source *inside*
  `state/newsStream.ts` would need the reverse dependency, a cycle. Rather
  than restructure the packages, this run gave `buildNewsFeed` an
  `extraItems: NewsItem[] = []` parameter — its composition point for a
  source this package can't produce itself — and added
  `debate-round`'s own `state/coachingSessions.ts`'s `coachingSessionNews()`
  (which that package can write, since it already depends on
  `debate-card-search` for the `NewsItem` type), composed in at the one
  place that already depends on both packages:
  `apps/debate-ai.com/app/news/page.tsx`. `CoachingSessionRecord` gained an
  additive, optional `createdAt` field, stamped by
  `buildAndSaveCoachingSession` on generation, mirroring the prior run's
  `EvidenceLibraryEntry.createdAt` convention (an existing session without
  one is silently skipped rather than backdated). Since `page.tsx` exports
  `metadata` and must stay a server component, the `extraItems` wiring
  itself lives in a new client component, `NewsPageContent.tsx` — calling
  `coachingSessionNews()` directly in its render body is safe (reads `[]`
  server-side, the real persisted sessions once it hydrates in the
  browser) because `NewsStreamPanel` never renders `extraItems` into the
  DOM before its own mount effect runs, so there's no hydration mismatch.
  `NewsStreamPanel` threads the new prop through a ref (not a `useEffect`
  dependency), so a parent passing a fresh array literal each render
  doesn't spuriously re-trigger its mount effect. Added a
  `product-news-stream-coaching-sessions` entry to `PRODUCT_NEWS`,
  mirroring the two prior "News Stream now posts X" announcements. No
  follow-ups remain open on this gap. Vitest-covered in
  `packages/debate-round/test/coachingSessions.test.ts` (the new
  `createdAt` stamp and `coachingSessionNews()` — empty when nothing's
  stored, skipping a session with no `createdAt`, one item per generated
  session across rounds/sides) — `debate-card-search/test/newsStream.test.ts`
  needed no new cases since `buildNewsFeed`'s existing tests already cover
  every in-package source and `extraItems` defaults to `[]`. Full repo test
  suite (2749 tests) and `typecheck` for both touched packages pass.

- **News Stream — wire a fifth Community category: Argument Library
  submissions.** Closes the "a new Argument Library entry ... isn't wired
  in" half of the Known gap `docs/features/news-stream.md` recorded after
  the prior "wire a fourth Community category" run — the other half of that
  gap (a coaching session) stays open: `debate-round` already depends on
  `debate-card-search` (where News Stream lives), so a coaching-session news
  source here would need the reverse dependency, a cycle. Unlike that prior
  gap's `EvidenceLibraryEntry` type, this one had no timestamp field at all
  to source a `NewsItem.timestamp` from, so this run's first move was adding
  one: `lib/shared-evidence-library.ts`'s `EvidenceLibraryEntry.createdAt`
  (optional, epoch milliseconds, same convention as `NewsItem.timestamp`).
  Rather than stamping it inside `state/evidenceLibraryEntries.ts`'s generic
  `saveEvidenceLibraryEntry` upsert (which would have silently added the
  field to every entry any existing test constructs by hand, breaking their
  `toEqual` fixtures), it's stamped at the same layer every other `createdAt`
  in this package already is — the submitting call site,
  `panels/EvidenceLibraryPanel.tsx`'s `handleSubmit`, mirroring
  `SprintNotesPanel.tsx`'s identical `createdAt: Date.now()` convention on a
  brand-new note; an edit preserves the original entry's `createdAt` (looked
  up via `getEvidenceLibraryEntry`) instead of resetting it. `lib/shared-
  evidence-library.ts`'s new `buildEvidenceEntryAnnouncementText` renders the
  announcement line (truncating a long card/block body to 140 characters,
  mirroring `team-collaboration-mode.ts`'s `buildSprintNoteAnnouncementText`,
  and naming the citation for a card but omitting the "citing ..." clause
  for a block, which never has one). `state/newsStream.ts`'s new
  `argumentLibraryNews()` composes both: every "live" (not held back by an
  in-progress peer review, via `isEntryLive`) persisted entry that carries a
  `createdAt` becomes one `NewsItem`, filtered so a pre-existing entry saved
  before this shipped (with no `createdAt`) is silently skipped rather than
  backdated. Added test coverage in `newsStream.test.ts` (a submitted live
  entry appears; a legacy entry with no `createdAt` doesn't) and `shared-
  evidence-library.test.ts` (the announcement-text builder's card/block/
  truncation cases), and a `PRODUCT_NEWS` entry announcing the change.
- **News Stream — wire a fourth Community category: Team Collaboration Mode
  prep notes.** Closes the last "not wired in" example named in
  `news-stream.md`'s Known gaps after the prior "wire the three remaining
  Community categories" run (#340): "other community moments (a new
  Argument Library entry, a Prep Room note, a coaching session) still
  aren't wired in." Of those three, `EvidenceLibraryEntry` (Argument
  Library) has no timestamp field to source an event's `NewsItem.timestamp`
  from, and coaching sessions (`debate-round`'s `coachingSessions.ts`) live
  in a package `debate-card-search` (where News Stream lives) has no
  dependency on — so this run picked the remaining, genuinely available
  gap: `debate-card-search`'s own `sprintNotes.ts`, the "Team Collaboration
  Mode" idea's persisted `SprintNote` store (`/cards/collaboration`), which
  already carries a `createdAt` timestamp, an `authorId`, and a `topic`.
  Unlike the three prior Community sources (quest streak milestones, group
  challenge completions, daily top reviser), which each derive a bounded
  event from a longer history, a `SprintNote` is already the atomic
  event — no derivation needed. Added `team-collaboration-mode.ts`'s
  `buildSprintNoteAnnouncementText` (truncating a long note's text to 140
  characters with an ellipsis so it doesn't dominate the feed's card,
  mirroring the existing per-source announcement-text builders), read by
  `state/newsStream.ts`'s new `sprintNoteNews()`, which maps every
  persisted `listSprintNotes()` record straight to a `"community"`-category
  `NewsItem` and folds it into `buildNewsFeed()`. `state/live-update.ts`'s
  `NEWS_STREAM_LIVE_UPDATE_STORAGE_KEYS` gained `"sprintNotes"` so another
  tab logging a prep note now live-updates the feed too. Added a
  `PRODUCT_NEWS` entry announcing the change and updated
  `docs/features/news-stream.md` (a new "What it shows" bullet, the
  data-flow diagram, the announce-vs-derive explanation, and Known gaps —
  the Argument Library/coaching-session half of the old gap stays open with
  the reason recorded, and a new gap notes that, unlike the other three
  Community sources, nothing bounds how many prep-note items a very active
  topic sprint can post in a short span). Did not touch the "Team
  Collaboration Mode" Product Feature Idea's own status note — that idea
  already has no open follow-ups; this closes a gap recorded against the
  News Stream feature instead. Verified: `bun install` (2260 packages),
  `bun run test` (178 files / 2739 tests, all pass — including 3 new cases
  across `newsStream.test.ts` and `team-collaboration-mode.test.ts`),
  `bun run typecheck` (13/13 in-scope package tasks pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/news` route present).
  **Completed:** 2026-08-26.
- **Tools discoverability — wire up the Speech Documents orphaned route.**
  Prompted by the same "make sure every tool is reachable, not just on the
  Tools page" request that drove the earlier "Tools discoverability — wire
  up three orphaned routes" entry (below), this run re-ran that entry's
  audit method (`packages/debate-ui/src/features/feature-catalog.ts`'s
  `APP_FEATURES` against both `apps/debate-ai.com/app/tools/page.tsx`'s
  `TOOL_GROUPS` and `packages/debate-editor-cardmirror/src/editor/workspace-links.ts`'s
  `WORKSPACE_LINKS`) and found one built, working page still missing from
  both: `/speech-documents` (`SpeechDocumentsPanel`, the "Legacy Verbatim /
  Cardmirror Compatibility" idea's send-to-speech-document destination —
  reachable only by typing the URL directly, `/features`, or noticing the
  "→Speech" toolbar button's confirmation alert). Four other `APP_FEATURES`
  routes (`/videos`, `/cards`, `/debate`, and `/reason-editor` itself) are
  in `feature-catalog.ts` but intentionally absent from both lists — the
  first three are already one click away from anywhere via the global dock
  (`apps/debate-ai.com/components/layout/CategoryDock.tsx`'s
  Videos/Shared/Debate items), and the fourth is the editor's own route —
  so only `/speech-documents` was a genuine gap. Added it to `TOOL_GROUPS`
  (Prep & Practice, next to the other round-analysis tools) with
  description + highlights in the page's existing style, and to
  `WORKSPACE_LINKS` in the same category, so it's now reachable from both
  the Tools page and the Reason Editor's Workspace menu / `t` palette
  prefix — closing the loop on CardMirror's own send-to-speech-document
  command, whose destination page previously had no way back into it short
  of memorizing the URL. Added the missing `- **Nav:**` line to
  `docs/features/speech-document-target.md` (the only feature doc that had
  never had one, since this route had no nav entry to describe until now).
  Verified: `bun install` (2260 packages), `bun run typecheck` (13/13
  in-scope package tasks pass), `bun run test` (178 files / 2736 tests,
  all pass — this is a nav-only change with no new logic, so no test
  additions were needed), and `bun run build:web` (`debate-ai-web`
  succeeds, `/speech-documents` present in the route list).
  **Completed:** 2026-08-26.
- **Feature docs — fix the stale "global dock's Settings menu" Nav claim
  across the remaining ~34 docs.** Flagged as out-of-scope in the prior
  "Tools discoverability — wire up three orphaned routes" entry (see
  below): `llm-card-scoring.md`, `scout-to-strategy.md`, and the new
  `team-rankings.md` were fixed there, but every other `docs/features/*.md`
  page still claimed a Nav path — `SettingsMenu` in
  `apps/debate-ai.com/components/layout/CategoryDock.tsx` — that has never
  linked to individual features; it only ever offered "All Features" and
  "All Tools". Grepped every doc for the claim (35 files matched;
  `features-page.md` was already accurate, since `SettingsMenu`'s "All
  Features" item really does open `/features`) and rewrote the other 34's
  `- **Nav:**` line to match the format the three earlier fixes already
  used: `the Tools page's <category> group; the Reason Editor's Workspace
  menu (`t <keyword>` in Ctrl/Cmd-Shift-Space's command palette)`, with
  `<category>` and a working `<keyword>` (verified by re-implementing
  `quick-card-search-ui.ts`'s `searchToolsSource` label+description
  substring match against `workspace-links.ts`'s `WORKSPACE_LINKS`) derived
  per doc's `Route:` line. `prep-notes.md` covers two routes (`/prep-notes`
  and `/notifications`) in one file and needed both of its two Nav lines
  fixed. Three initial keyword picks (`tracking`, `reviews`, `revisions`)
  didn't actually substring-match their link's label/description and were
  corrected to `research progress`, `review queue`, and `revision`
  respectively after the verification script caught them. No code changed;
  `packages/debate-ui/test/feature-catalog.test.ts` (17 tests, unaffected
  by doc content) still passes. Verified: `bun install` (2260 packages),
  `bunx vitest run packages/debate-ui/test/feature-catalog.test.ts` (17/17
  pass), and a standalone Node script re-checking every fixed doc's
  category against `WORKSPACE_LINKS` and every keyword against the same
  label+description substring match the live palette uses (all 34 pass).
  **Completed:** 2026-08-26.
- **News Stream — wire the three remaining Community categories (quest
  streak milestones, group challenge results, revision incentive
  standings).** Closes the last of `news-stream.md`'s "Only two categories
  currently feed the 'Community' side of the stream" Known gap, flagged as
  not-started follow-up on the earlier News Stream cross-tab PR (#336) and
  matching a request to flesh out the News Stream's functionality further.
  Unlike Daily Best Card/Contributor Awards (which need an explicit
  "announce" action to freeze a day's standings), all three new categories
  are derived fresh every call straight from their own feature's
  already-persisted history, so no new store or UI trigger was needed:
  `gamified-quests.ts` gains `deriveEarnedStreakMilestoneEvents` (the exact
  day a contributor's streak-as-of-that-day first equals a milestone
  length — a streak that keeps extending moves past it the very next day,
  so no separate "already announced" bookkeeping is needed to avoid
  re-reporting), read by `dailyMissionResults.ts`'s new
  `buildQuestStreakMilestoneEvents` across every contributor's stored
  history. `group-challenges.ts` gains `computeChallengeCompletionTimestamp`
  (the timestamp of the `targetCount`-th matching contribution or win
  event) and `buildChallengeCompletionAnnouncementText`, read by
  `challengeWinEvents.ts`'s new `buildCompletedGroupChallengeEvents` across
  every persisted challenge. `revision-incentives.ts` gains
  `buildTopReviserAnnouncementText`, read by `revisionHistory.ts`'s new
  `buildDailyTopReviserAnnouncements`, which groups persisted revisions by
  UTC day (via `revisedAt`) and keeps each day's #1 scorer, skipping a day
  with no rewarded revision. `state/newsStream.ts`'s `buildNewsFeed` merges
  all three into the feed as `"community"`-category items alongside a new
  `PRODUCT_NEWS` entry announcing the change; `state/live-update.ts`'s
  `NEWS_STREAM_LIVE_UPDATE_STORAGE_KEYS` gained the four backing storage
  keys (`dailyMissionResults`, `groupChallenges`, `contributions`,
  `challengeWinEvents`, `revisionHistory`) so another tab's mission
  completion, challenge win, or card revision now live-updates the feed too.
  Also fixed `NewsStreamPanel.tsx`'s filter-tab row, which defined a
  `community` icon and category label but never listed it as a filter tab —
  the new items were reachable only from "All" until this. Docs updated at
  `docs/features/news-stream.md` (new bullets under "What it shows", the
  data-flow diagram, and the announce-vs-derive explanation) with the
  now-closed gap replaced by a narrower one (community events are still
  limited to what this package can detect from its own persisted history —
  other community moments like an Argument Library entry or a Prep Room
  note still aren't wired in). Verified: `bun install` (2260 packages),
  `bun run test` (178 files / 2736 tests, all pass — including new
  `newsStream.test.ts`, the first test coverage `state/newsStream.ts` has
  had, plus extended `gamified-quests.test.ts`, `dailyMissionResults.test.ts`,
  `group-challenges.test.ts`, `challengeWinEvents.test.ts`,
  `revision-incentives.test.ts`, `revisionHistory.test.ts`, and
  `live-update.test.ts`), `bun run typecheck` (13/13 in-scope package tasks
  pass), and `bun run build:web` (`debate-ai-web` succeeds, `/news` route
  present). No repo-wide `lint` script exists. Note found along the way but
  out of scope here: PR #338 ("Confine CardMirror's chrome to its own
  column; bring ebb in as an embeddable panel") landed on `master` without a
  matching entry in this tracker.
  **Completed:** 2026-08-26.
- **Tools discoverability — wire up three orphaned routes (LLM Card Scoring,
  Scout-to-Strategy, Team Rankings).** Prompted by a request to make sure
  every tool is reachable "not just on the Tools page" but from the live
  Reason Editor too. Auditing `packages/debate-ui/src/features/feature-catalog.ts`'s
  `APP_FEATURES` (the full ~50-surface catalog behind `/features`) against
  both `apps/debate-ai.com/app/tools/page.tsx`'s `TOOL_GROUPS` and
  `packages/debate-editor-cardmirror/src/editor/workspace-links.ts`'s
  `WORKSPACE_LINKS` (the Reason Editor's Google-Docs-style Workspace menu
  and its Ctrl/Cmd-Shift-Space palette's `t` prefix — both already existed
  from prior "Legacy Verbatim / Cardmirror Compatibility" work) found three
  built, working pages with no in-app entry point at all: `/cards/scoring`
  (LLM Card Scoring), `/strategy` (Scout-to-Strategy), and `/rank` (Team
  Rankings) — reachable only via `/features` or typing the URL directly;
  two feature docs (`llm-card-scoring.md`, `standings.md`) even claimed a
  "global dock's Settings menu" entry point that `CategoryDock.tsx`'s
  `SettingsMenu` doesn't actually have (it only links to "All Features" and
  "All Tools"). Added all three to `TOOL_GROUPS` (Community & Progress,
  Prep & Practice, and Coaching & Analytics respectively, matching their
  `feature-catalog.ts` category) with description + highlights in the
  page's existing style, and to `WORKSPACE_LINKS` in the same three
  categories, so they're now reachable from both the Tools page and the
  Reason Editor's Workspace menu / `t` palette prefix. Fixed the stale Nav
  line in `llm-card-scoring.md` and added one to `scout-to-strategy.md`
  (which had none); added a new `docs/features/team-rankings.md` (Team
  Rankings previously had no doc at all) and pointed `feature-catalog.ts`'s
  `team-rankings` entry at it. Did not touch the other ~34 feature docs
  that share the same inaccurate "global dock's Settings menu" Nav claim —
  that's a separate cleanup, out of scope here. Verified: `bun install`
  (2062 packages), `bunx tsc --noEmit` clean in `debate-editor-cardmirror`
  and `debate-ui`, `bunx vitest run` across `debate-ui`,
  `debate-editor-cardmirror`, `debate-card-search`, `debate-round`, and
  `debate-videos` (133 files / 2073 tests, all pass — including
  `feature-catalog.test.ts`'s doc-file-suffix and category-membership
  invariants), and `bun run build:web` (`debate-ai-web` succeeds, `/rank`,
  `/strategy`, and `/cards/scoring` all present in the route list).
  **Completed:** 2026-08-26.
- **News Stream — cross-tab live update.** Closes the "No real-time updates
  across browser tabs" Known gap noted in `news-stream.md`, following the
  same mechanism already landed for `DailyBestCardPanel`,
  `ContributionLeaderboardPanel`, `TaskInboxPanel`, `ProgressUnlocksPanel`,
  `ResearchProgressPanel`, and `QuestStreaksPanel`
  (`packages/debate-card-search/src/state/live-update.ts`). Adds
  `NEWS_STREAM_LIVE_UPDATE_STORAGE_KEYS` (`dailyBestCardAnnouncements`,
  `contributorAwardAnnouncements`, `newsStreamViewerState`) +
  `isNewsStreamLiveUpdateStorageEvent` and wires `NewsStreamPanel` to
  subscribe to the browser's `storage` event (fires only in *other*
  same-origin tabs, never the one that made the write), rebuilding the feed
  and re-deriving read/liked state whenever another tab announces a Daily
  Best Card or Contributor Awards winner, or toggles a news item's read/like
  state — so a second tab no longer needs a manual reload to see it. Docs
  updated at `docs/features/news-stream.md` (new "Cross-tab live update"
  section, Known gap removed) and `docs/features/shared-flow-sync.md`
  (cross-reference list extended). Vitest-covered in
  `packages/debate-card-search/test/live-update.test.ts` (every backing-store
  key, the `null`-key clear-all case, and unrelated/substring-matching keys
  staying ignored, for the new predicate). Verified: `bun install` (2062
  packages), `bunx vitest run` in `debate-card-search` (56 files / 1089
  tests, all pass), `bunx tsc --noEmit` in `debate-card-search` (clean), and
  `bun run build:web` (`debate-ai-web` succeeds, `/news` route present).
  Remaining follow-up (not started this run): the other three Known gaps in
  `news-stream.md` — Product Updates are still hand-curated, read/like state
  is still per-browser rather than per-account, and only two categories
  (Daily Best Card, Contributor Awards) feed the "Community" side of the
  stream (quest streak milestones, group challenge results, and revision
  incentive standings aren't wired in yet).
  **PR:** [#336](https://github.com/debate/debate-ai.com/pull/336).
  **Completed:** 2026-08-26.
- **Video library — store the videos JSON in a SQL table (local SQLite +
  Cloudflare D1) and serve the grid one page at a time as it is scrolled.**
  `/api/videos` used to answer every request with the whole library: the four
  `rounds-*.json` assets, `debate-lectures.json`, the top-picks list and the
  topic/champion tables, concatenated and de-duplicated into a single ~1.1 MB
  JSON response that the client had to download in full before rendering a
  card, then filter, search, sort and paginate in the browser. The videos now
  live in a `videos` table (`lib/database/schema.ts`, migration
  `drizzle/0003_tranquil_skaar.sql`), which merges the round and lecture
  assets into one row per video id — rounds win a collision, matching the old
  `dedupeById` behaviour — with `is_top_pick` set from
  `debate-top-picks.json`. Three derived columns keep queries cheap:
  `season_year` (the June-to-June competition season, `0` for legacy pre-2010
  content), `search_text` (lowercased title + channel + description, matched
  with `LIKE`), and `published_ms` (the parsed publish timestamp — one row
  carries a long-form date, "May 14, 2013", that sorts wrongly as text).
  `packages/debate-data-sync/src/videos/video-rows.ts` owns the tuple↔row
  conversion and `video-query.ts` the filter/sort/facet semantics;
  `apps/debate-ai.com/lib/videos/video-repository.ts` expresses the same
  semantics in SQL and falls back to the JSON assets whenever the table is
  missing, unreachable or unseeded, so a fresh clone still renders the whole
  library (the response's `backend` field says which answered). `GET
  /api/videos` now takes `source`, `lecturesOnly`, `topPicks`, `category`,
  `style`, `year`, `q`, `ids`, `sort`, `limit` (default 60, capped at 200),
  `offset` and `facets`, returning `{ videos, total, offset, limit, hasMore,
  facets }` with ties broken by video id so paging never repeats or skips a
  video; the new `GET /api/videos/meta` carries the small fetch-once payload
  (library counts, lecture-category cards, topics/champions/history). On the
  client, `hooks/useVideoFeed.ts` (`useVideoFeed` + `useVideoMeta`, both via
  `grab`) replaces `useVideoData.ts`, `useInfiniteScroll` now asks the feed
  for its next page instead of slicing a fully-loaded array, `useVideoState`
  sheds the row/pagination state it no longer owns, and both panels
  (`LecturesPage`, `DebateVideosPanel`) send their filters to the server.
  Favourites are sent as an explicit `ids` allow-list and hidden videos are
  filtered out of the loaded pages, since neither is known server-side; the
  filter dropdowns read their counts from the response's facets
  (`useVideoSearchCounts` no longer tallies a local array) and the lecture
  category cards from `/api/videos/meta`. `scripts/seed-videos.ts` (`bun run
  db:seed:videos`, `db:seed:videos:d1`) projects the JSON into the table and
  is idempotent — rows are upserted by id and rows the JSON no longer carries
  are pruned — so a re-run after `sync-youtube` mirrors the assets. New
  `docs/features/video-library.md` documents the data flow and its Known
  gaps (LIKE search replaces Fuse.js fuzzy matching, facet counts do not
  deduct locally hidden videos, seeding is a separate step from the YouTube
  sync); `public/debate-openapi.yml` documents both endpoints. Vitest-covered
  in `packages/debate-data-sync/test/video-rows.test.ts` (season and
  timestamp parsing, category slugs, round/lecture tuple mapping, top-pick
  flagging, tuple round-tripping and trailing-slot trimming, asset merging)
  and `test/video-query.test.ts` (each filter, the id tiebreaker, paging over
  every match exactly once, and the facet rules for seasons, styles and
  lecture categories). The two backends were also diffed directly against
  each other over eleven query shapes — same ids, totals, facets and tuples.
  Verified with `bun run test` (164 files, 2381 tests), `bunx tsc --noEmit`
  in `packages/debate-videos` and `debate-data-sync`, and `bunx vinext build`
  for the web app; no `lint` script is configured in this repo.
  Follow-up in the same PR: the `videos` table and its indexes were applied to
  the production D1 database (`debate-ai-db`), and because the seed itself is
  ~1 MB of generated SQL that no local wrangler login could reach from the
  session, `buildVideoSeedStatements` was lifted into
  `debate-data-sync/src/videos/video-seed-sql.ts` and given a second caller:
  `POST /api/admin/videos/seed` (admin-gated, matching the YouTube resync
  route) runs the same statements inside the Worker against its own D1
  binding, seeding from the JSON assets the Worker already bundles — no
  credentials, no data transfer. `GET` on it reports the row count and whether
  the feed is being served from SQL or the fallback. Covered by
  `test/video-seed-sql.test.ts` (literal escaping including quotes, newlines
  and non-ASCII text, column/value alignment, batching, the upsert clause,
  every row emitted once, and the empty-asset case).
  The production D1 database was then seeded through that endpoint and
  verified against the local projection: 2867 rows, 1970 rounds / 897
  lectures, 718 style-less lectures, 167 top picks, 277/347/99/1426 per debate
  style, and identical `sum(length(description))` (349203) and
  `sum(length(search_text))` (537764) — byte-for-byte the same data. The first
  attempt surfaced two defects, both fixed here: batching by row count alone
  produced a 111.8 KB statement (D1 rejects anything over 100 KB), so
  `buildVideoSeedStatements` now flushes on a byte budget as well, and the
  route's error handler now reports the driver's cause instead of the 100 KB
  of echoed SQL drizzle puts in the message. That failed run also left 100
  rows behind, which the docs now record as a known gap: a seed is not atomic,
  so an interrupted run must be re-run rather than left partial.
  **PR:** [#331](https://github.com/debate/debate-ai.com/pull/331).
  **Completed:** 2026-08-25.
- **Progress Unlocks / Research Progress / Quest Streaks — cross-tab live
  update.** Closes, for `ProgressUnlocksPanel`, `ResearchProgressPanel`, and
  `QuestStreaksPanel`, the "Every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap noted in
  `shared-flow-sync.md`, previously closed only for
  `DailyBestCardPanel`/`ContributionLeaderboardPanel`/`TaskInboxPanel`
  (`debate-card-search/src/state/live-update.ts`) and `FlowSpreadsheet`
  (`debate-round/src/flow/live-update.ts`). `state/live-update.ts` gains
  three more helpers: `PROGRESS_UNLOCKS_LIVE_UPDATE_STORAGE_KEYS`
  (`contributions`, `completedResearchTasks`, `dailyMissionResults`) +
  `isProgressUnlocksLiveUpdateStorageEvent`;
  `RESEARCH_PROGRESS_LIVE_UPDATE_STORAGE_KEYS` (`contributions`,
  `completedResearchTasks`, `routedTaskQueues`) +
  `isResearchProgressLiveUpdateStorageEvent`; and
  `QUEST_STREAKS_LIVE_UPDATE_STORAGE_KEYS` (`dailyMissionResults`) +
  `isQuestStreaksLiveUpdateStorageEvent` — mirroring the existing null-key/
  exact-key-match rules. Each of the three panels subscribes to the
  browser's `storage` event (fires only in *other* same-origin tabs/windows,
  never the one that made the write) and re-derives its rendered roster
  when it fires for one of its own keys, so a contribution recorded, task
  completed, topic routed, or mission logged in a second tab now refreshes
  each of these tabs' views without a manual reload. Docs updated at
  `docs/features/progress-unlocks.md`, `docs/features/research-progress-tracking.md`,
  and `docs/features/quest-streaks.md` (new "Cross-tab live update" sections)
  and `docs/features/shared-flow-sync.md` (cross-reference list extended).
  Vitest-covered in `packages/debate-card-search/test/live-update.test.ts`
  (every backing-store key per predicate, the `null`-key clear-all case, and
  unrelated/substring-matching keys staying ignored, for all three new
  predicates). Verified: `bun install` (2062 packages), `bun run test` (174
  files / 2636 tests, all pass), `bun run typecheck` (12 of 12 in-scope
  packages pass), and `bun run build:web` (`debate-ai-web` succeeds,
  `/cards/progress`, `/cards/progress-tracking`, `/cards/streaks` routes
  present) all pass. No repo-wide `lint` script exists. Remaining follow-up
  (not started this run): the same treatment for the other ~13
  `debate-card-search` panels and every `debate-round`/`debate-data-sync`/
  `debate-speech-writer` panel that still lacks this mechanism
  (`RevisionIncentivesPanel`, `ArgumentLibraryPanel`, `EvidenceLibraryPanel`,
  `GroupChallengesPanel`, `ReviewQueuePanel`, `TopicCoverageDashboardPanel`,
  `DailyQuestsPanel`, `ContributionsFeedPanel`, `ContributorAwardsPanel`,
  `PrepRoomPanel`, `BrainstormBoardPanel`, `SprintNotesPanel`,
  `CardScoringPanel`, `StandingsPanel`, `OpponentTeamProfilesPanel`,
  `JudgeProfilesPanel`, `CoachingProgramsPanel`, `CoachingSessionsPanel`,
  `DrillSetsPanel`, `StrategyPanel`, `PracticeRoundSimulatorPanel`,
  `ArgumentTreePanel`, `OutlineNavPanel`, `VulnerabilityChartsPanel`,
  `FlowSummariesPanel`, `AiVersusRoundPanel`, `JudgeDecisionPanel`,
  `JudgeParadigmPickerPanel`, `OpponentPersonaPickerPanel`,
  `WordCountRoundsPanel`, `PreRoundBriefingsPanel`, `CoachMaterialsPanel`,
  `SpeechDocumentsPanel`, `PrepNotesPanel`, `PrepNoteNotificationsPanel`,
  `FlowAnnotationsPanel`). PR:
  https://github.com/debate/debate-ai.com/pull/328 (opened for this
  change).
- **Task Inbox — cross-tab live update.**
  Closes, for `TaskInboxPanel`, the "Every other localStorage-backed panel
  in this repo still has no cross-tab live-update mechanism" Known gap
  noted in `shared-flow-sync.md`, previously closed only for
  `DailyBestCardPanel`/`ContributionLeaderboardPanel`
  (`debate-card-search/src/state/live-update.ts`) and `FlowSpreadsheet`
  (`debate-round/src/flow/live-update.ts`). `state/live-update.ts` gains a
  third helper alongside the existing `isDailyBestCardLiveUpdateStorageEvent`/
  `isContributionLeaderboardLiveUpdateStorageEvent`:
  `TASK_INBOX_LIVE_UPDATE_STORAGE_KEYS` (`routedTaskQueues`,
  `pendingTaskVerifications`, `trackedArguments` — the three persisted
  stores `TaskInboxPanel`'s `buildTaskInboxView`/
  `listPendingTaskVerifications`/`listTrackedTopics` calls read from) plus
  `isTaskInboxLiveUpdateStorageEvent`, mirroring the existing null-key/
  exact-key-match rules. `TaskInboxPanel.tsx` subscribes to the browser's
  `storage` event (fires only in *other* same-origin tabs/windows, never
  the one that made the write) and re-derives `topics`/`pending`/
  `trackedTopics` when it fires for one of those keys, so a teammate
  routing a topic, marking a task done, or verifying one in a second tab
  now refreshes this tab's Task Inbox view without a manual reload. Docs
  updated at `docs/features/task-inbox.md` (new "Cross-tab live update"
  section) and `docs/features/shared-flow-sync.md` (cross-reference).
  Vitest-covered in `packages/debate-card-search/test/live-update.test.ts`
  (every backing-store key, the `null`-key clear-all case, and unrelated/
  substring-matching keys staying ignored). Verified: `bun install` (2062
  packages), `bun run test` (174 files / 2624 tests, all pass), `bun run
  typecheck` (12 of 12 in-scope packages pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/cards/inbox` route present) all pass. No
  repo-wide `lint` script exists. PR:
  https://github.com/debate/debate-ai.com/pull/327 (opened for this
  change).
- **Collaboration Prep Room — signed-in identity prefill for "Your ID".**
  Continues the signed-in identity wiring series (PRs #318-#323). The Prep
  Room's "Your ID" presence field (feeds the "I'm active here" heartbeat)
  was the last free-form contributor-id field in the Research hub never
  wired to the real better-auth session. `PrepRoomPanel` gains an optional
  `signedInContributorId` prop (mirroring `ReviewQueuePanel`/
  `GroupChallengesPanel`'s existing convention) that seeds "Your ID" from
  `deriveContributorIdFromSessionIdentity` — a starting value only, never
  clobbering a visitor's own typed edit — and
  `apps/debate-ai.com/components/research/PrepRoomWithIdentity.tsx` wires
  the real session in, used by `ResearchHub.tsx`'s Prep Room tab. The
  standalone `/cards/prep-room` route still mounts the raw `PrepRoomPanel`
  without this prefill, recorded as a Known gap in
  `docs/features/collaboration-prep-room.md`. PR:
  https://github.com/debate/debate-ai.com/pull/325. Verified with
  `bunx turbo typecheck --filter=debate-card-search --filter=debate-ai-web`
  (12/12 passed), `bunx vitest run packages/debate-card-search` (55 files /
  1062 tests passed), and `bunx turbo build --filter=debate-ai-web`
  (passed); no lint script exists in this repo. No follow-ups remain open
  on this bullet beyond the recorded Known gap.
- **Contribution Leaderboard — cross-tab live update.**
  Closes, for this panel, the "Every other localStorage-backed panel in
  this repo still has no cross-tab live-update mechanism" Known gap noted
  in `shared-flow-sync.md`, which only `DailyBestCardPanel`
  (`debate-card-search/src/state/live-update.ts`) and `FlowSpreadsheet`
  (`debate-round/src/flow/live-update.ts`) had closed for their own stores.
  `state/live-update.ts` gains a second helper alongside the existing
  `isDailyBestCardLiveUpdateStorageEvent`:
  `CONTRIBUTION_LEADERBOARD_LIVE_UPDATE_STORAGE_KEYS` (`contributions`,
  `completedResearchTasks`, `dailyMissionResults` — the three persisted
  stores `ContributionLeaderboardPanel`'s roster is built from, via
  `state/researchProgress.ts#buildPersistedLeaderboardWithCompletedTasks`
  and `lib/unlock-streak-status.ts#buildContributorUnlockStatusWithStreakFromStore`)
  and `isContributionLeaderboardLiveUpdateStorageEvent`, mirroring the
  existing helper's null-key/exact-key-match rules exactly.
  `ContributionLeaderboardPanel` now subscribes to the browser's `storage`
  event (which the spec fires only in *other* same-origin tabs, never the
  one that made the write) and re-derives its whole roster via the existing
  `buildLeaderboardRows()` when a relevant key changes — so a contribution,
  a completed research task, or quest/streak activity logged in a second
  tab now shows up on the leaderboard without a manual reload. No new
  persisted store or scoring logic was needed; this is wiring only, mirroring
  `DailyBestCardPanel`'s identical pattern.
  `docs/features/contribution-leaderboard.md` gained a new "Cross-tab live
  update" section, and `shared-flow-sync.md`'s Known gaps entry was updated
  to note this panel (and `DailyBestCardPanel`) as no longer part of "every
  other" panel lacking the mechanism. Verification: full `bun run test`
  (171 files / 2591 tests passed, 4 new — `live-update.test.ts`'s
  `isContributionLeaderboardLiveUpdateStorageEvent` covering every tracked
  key, the `null`-key clear-all case, an unrelated key, and a
  substring-matching key staying ignored), `bun x turbo typecheck` (12/12
  package tasks passed), and `bun run build:web` (clean production + SSR +
  service-worker build). No repo-wide `lint` script exists. **Completed:**
  2026-08-25. PR: [#324](https://github.com/debate/debate-ai.com/pull/324).

- **Team Collaboration Mode — Topic Sprint "Your contributor id" session
  prefill.**
  Continues the "Signed-in identity wiring" series (PRs #318–#322): a full
  survey of every panel's exported props found exactly one remaining
  free-form "my id" field with no session prefill — `ResearchHub.tsx`'s
  Sprint tab "Your contributor id" input, a plain `useState("me")` field
  that feeds `TopicSprintPanel`'s `authorId` prop (distinct from
  `SprintNotesWithIdentity`'s already-wired "Author ID"/"Your ID" fields on
  the same tab). `ResearchHub.tsx` now calls `useSession()` and
  `debate-card-search`'s `deriveContributorIdFromSessionIdentity` directly
  (it's already an app-level component, so no separate `*WithIdentity`
  wrapper was needed) and seeds the field from the signed-in identity only
  when no `localStorage`-saved value exists and the visitor hasn't typed
  into it yet this session — a `hasSetContributorId` flag mirrors
  `TaskInboxPanel`'s `hasEditedMyId` convention so a manual edit or a
  restored saved value is never clobbered by a later session read. A
  signed-out visitor still sees the field default to `"me"`, unchanged.
  Docs updated at `docs/features/team-collaboration-mode.md`. No new pure
  library function was needed (`deriveContributorIdFromSessionIdentity` is
  reused as-is, already covered by
  `packages/debate-card-search/test/session-identity.test.ts`), so this is
  app-level wiring only, mirroring PR #318's identical scope. Verification:
  full `bun run test` (171 files / 2587 tests passed, unchanged — no
  package-level logic changed), `bun run typecheck` (12/12 packages
  passed), and `bun run build:web` (clean production + SSR + service-worker
  build). No repo-wide `lint` script exists. **Completed:** 2026-08-25.
  PR: [#323](https://github.com/debate/debate-ai.com/pull/323).

- **Daily Quests — recurring-quest reset.**
  Closes the "no recurring-quest concept exists in this repo" Known gap left
  open by the earlier quest-expiry addition
  (`docs/features/daily-quests.md`): an expired quest template used to just
  stop appearing and stop scoring rather than being reset for a new cycle.
  `packages/debate-card-search/src/lib/daily-quests.ts` gains
  `QuestTemplate.recurrence?: "daily" | "weekly"` and the pure
  `rolloverRecurringQuestTemplate(template, dayKey)`, which advances an
  expired recurring template's `expiresOn` forward by whole cycles until it
  lands on/after `dayKey` instead of leaving it expired — since a quest's
  progress is already scored against just that day's contributions
  (`computeQuestProgress`), the rolled-over quest is automatically back at
  0/target for its fresh cycle with no separate "reset the count" step
  needed. `state/dailyQuests.ts`'s new
  `rolloverExpiredRecurringQuestTemplates(now)` applies that to the whole
  persisted roster and is called by both `buildPersistedDailyQuestBoard`
  (so a recurring quest reappears on its own the next time anyone loads the
  board — no cron/scheduled-job infra exists in this repo, matching every
  other "manual trigger" feature here) and `pruneExpiredQuestTemplates` (so
  the "Clean up expired quests" action can never delete a recurring
  template out from under a team). `DailyQuestsPanel`'s "Add quest" form
  gained a "Recurs" picker (Doesn't recur / Daily / Weekly), shown once an
  expiry date is set, and each board row shows a "Recurs daily"/"Recurs
  weekly" badge alongside its "Expires" badge when it has one.
  Verification: full `bun run test` (171 files / 2587 tests passed, 13 new
  — `daily-quests.test.ts`'s `rolloverRecurringQuestTemplate` covering no
  recurrence, no `expiresOn` anchor, not-yet-expired, daily rollover, weekly
  rollover, and a multi-cycle weekly rollover; `dailyQuests.test.ts`'s
  `rolloverExpiredRecurringQuestTemplates`/updated
  `pruneExpiredQuestTemplates`/`buildPersistedDailyQuestBoard` covering
  empty storage, a non-recurring template staying untouched, a single and
  several recurring rollovers, prune never deleting a recurring template,
  and the board showing a rolled-over quest at fresh 0 progress), `bun run
  typecheck` (12/12 package tasks passed — same `apps/debate-ai.com`
  typecheck-gate exclusion noted on prior PRs applies here too), and `bun
  run build:web` (production web build passed).
  PR: [#322](https://github.com/debate/debate-ai.com/pull/322).
- **Signed-in identity wiring — Review Queue, Team Collaboration Mode, Team
  Brainstorm Assist, Group Challenges.**
  Closes the follow-up PR #320 flagged as still open: "every other panel's
  identical 'no auth/identity system' Known gap (Leaderboard, Progress
  Unlocks, Research Progress, Daily Quests, Standings, Judge/Opponent
  Profiles, Review Queue, Prep Notes, Contribution Leaderboard, and others)
  remain open." A survey of every candidate panel found the cleanest,
  unambiguous "my own id" fields (same shape as the ones PR #318/#319/#320
  already wired) live on `ReviewQueuePanel` (`actingReviewerId`, per-card
  `commentDrafts[].reviewerId`), `SprintNotesPanel` (`draft.authorId`, the
  "Your ID" presence field `myId`), `BrainstormBoardPanel`
  (`draft.contributorId`), and `GroupChallengesPanel` (per-challenge
  `winContributorId`). Standings, Judge Profiles, Opponent Team Profiles,
  Prep Notes, and Coaching Programs were surveyed too but their only
  free-form id fields identify someone *other* than the signed-in visitor
  (a team, a judge, an assignee) — not a fit for this exact pattern without
  a product decision on what field to add, so they're intentionally left
  out of this PR and still carry the open gap.
  All four panels gain an optional `signedInContributorId` prop, reusing
  the existing `debate-card-search`'s `lib/session-identity.ts`'s
  `deriveContributorIdFromSessionIdentity` directly (no new pure helper was
  needed): `ReviewQueuePanel`'s "Your reviewer ID" and each card's comment
  "Reviewer ID" field, `SprintNotesPanel`'s "Author ID" and "Your ID"
  presence field, and `BrainstormBoardPanel`'s "Contributor ID" all follow
  the established "prefill the field's *initial* value only, tracked via a
  `hasEdited*` flag so a visitor's own typed edit is never overwritten"
  convention `TaskInboxPanel`/`DailyQuestsPanel` already use.
  `GroupChallengesPanel`'s per-challenge `winContributorId` is keyed by
  challenge id, so it uses an equivalent "fall back to the signed-in id
  until that challenge's own field is explicitly touched" record pattern
  instead of a single flag. `BrainstormBoardPanel`'s post-submit form reset
  now restores the prefilled id (instead of clearing to blank) so a
  signed-in visitor can submit several ideas in a row without retyping it.
  `apps/debate-ai.com` gains four thin `"use client"` wrappers —
  `components/research/ReviewQueueWithIdentity.tsx`,
  `SprintNotesWithIdentity.tsx`, `BrainstormBoardWithIdentity.tsx`, and
  `GroupChallengesWithIdentity.tsx` — mirroring `TaskInboxWithIdentity.tsx`
  exactly; the four panels' standalone `app/cards/{reviews,collaboration,
  brainstorm,group-challenges}/page.tsx` routes and `ResearchHub.tsx`'s
  Review/Sprint/Quests tabs now render the wrappers instead of the bare
  panels. A signed-out visitor sees the exact same blank fields as before.
  `docs/features/{review-queue,team-collaboration-mode,brainstorm-board,
  group-challenges}.md` updated with new "Signed-in prefill" data-flow
  sections and revised Known gaps sections. Verification: `bun x turbo
  typecheck` (12/12 package tasks passed — same `apps/debate-ai.com`
  typecheck-gate exclusion noted on PR #318/#319/#320 applies here too),
  full `bun run test` (171 files / 2574 tests passed — unchanged from PR
  #320, since this PR reuses `session-identity.ts`'s existing, already
  Vitest-covered helper rather than adding new pure functions of its own;
  this package's Vitest environment is `node`-only with no jsdom/
  testing-library, so — consistent with every prior PR in this series —
  the new prop-prefill wiring itself isn't covered by a render test, only
  by the reused helper's existing coverage plus typecheck/build), and `bun
  run build:web` (production build succeeded, all four `/cards/*` routes
  present, no route changes). This repo has no `lint` script configured,
  so that acceptance step is N/A. The same underlying "free-form id, not an
  authenticated permission check, no server-side session enforcement on
  these calls" limitation is unchanged and remains documented in each
  panel's own Known gaps, alongside Standings/Judge Profiles/Opponent Team
  Profiles/Prep Notes/Coaching Programs/Contribution Leaderboard's
  still-open identical gap.
- **Task Inbox — real identity gate on task verification.**
  [PR #320](https://github.com/debate/debate-ai.com/pull/320). Closes the
  verifier half of the "no contributor identity/permission checks" Known
  gap recorded in `docs/features/task-inbox.md` and flagged as still open
  on PR #318/#319: "nothing stops a visitor from overwriting it or from
  verifying under someone else's typed id — that would need this repo's
  auth to actually gate the action, not just suggest a starting value."
  `debate-card-search`'s `lib/session-identity.ts` gains
  `deriveLockedVerifierId` (reuses the existing `isOwnContributorRow`
  check), exported from the package root and Vitest-covered in
  `test/session-identity.test.ts`. `TaskInboxPanel`'s existing
  `signedInContributorId` prop (already used to prefill "My tasks") now
  also gates each pending verification's "Verifier id" field: when signed
  in, the field is locked read-only to that identity instead of staying a
  free-form suggestion, and the **Verify** button is disabled outright
  with an inline explanation for a task the signed-in visitor completed
  themself, instead of only failing `assertVerifierAllowed` after the
  click. A signed-out visitor (no `signedInContributorId`) keeps the
  original fully free-form verifier field unchanged, so this is additive,
  not a breaking change — and no app-level wrapper changes were needed
  since `TaskInboxWithIdentity.tsx` already passed the same prop.
  `docs/features/task-inbox.md` updated: new "Signed-in verifier gate"
  data-flow section, and the Known gaps section revised to record the
  verifier half as closed while the "My tasks" filter itself stays a
  prefill only, plus a new gap noting the client-side-only enforcement
  boundary (no server-side session check on the underlying calls, same
  trust boundary every other localStorage-backed action in this repo
  has). Verification: `bunx vitest run
  packages/debate-card-search/test/session-identity.test.ts
  packages/debate-card-search/test/task-verification.test.ts` (21 tests),
  `bun x turbo typecheck` (12/12 package tasks passed — same
  `apps/debate-ai.com` typecheck-gate exclusion noted on PR #318/#319
  applies here too), full `bun run test` (171 files / 2574 tests passed,
  up from 171/2569), and `bun run build:web` (production build succeeded,
  `/cards/inbox` route present, no route changes). This repo has no
  `lint` script configured, so that acceptance step is N/A. The "My
  tasks" filter's own identity gate and every other panel's identical
  "no auth/identity system" Known gap (Leaderboard, Progress Unlocks,
  Research Progress, Daily Quests, Standings, Judge/Opponent Profiles,
  Review Queue, Prep Notes, Contribution Leaderboard, and others) remain
  open, unchanged, as documented in each panel's own Known gaps.
- **Signed-in identity wiring — Leaderboard, Progress Unlocks, Research
  Progress, Daily Quests.**
  [PR #319](https://github.com/debate/debate-ai.com/pull/319).
  Closes the follow-up PR #318 (Task Inbox's signed-in identity prefill)
  flagged as still open: "the same 'no auth/identity system' Known gap is
  recorded on the Leaderboard, Progress Unlocks, Research Progress
  Tracking, and Daily Quests panels and remains open there as a follow-up
  for a future run." `debate-card-search`'s `lib/session-identity.ts`
  gains `isOwnContributorRow` (case-insensitive, trims both sides, `false`
  whenever either side is blank), exported from the package root and
  Vitest-covered in `test/session-identity.test.ts`.
  `ContributionLeaderboardPanel`, `ProgressUnlocksPanel`, and
  `ResearchProgressPanel` all gain an optional `signedInContributorId`
  prop — unlike Task Inbox's "My tasks" field, these three are
  all-contributor rosters with no existing free-form id field to prefill,
  so a matching row is highlighted with a "You" badge instead of being
  filtered; every other contributor's row is unaffected.
  `DailyQuestsPanel` already had a free-form "Your streak" contributor-id
  field, so it gains the same `signedInContributorId` prop wired the way
  `TaskInboxPanel` prefills "My tasks": the field's *initial* value only
  (via a new `hasEditedContributorId` flag), and the panel eagerly loads
  that contributor's streak on mount. `apps/debate-ai.com` gains four thin
  `"use client"` wrappers —
  `components/research/ContributionLeaderboardWithIdentity.tsx`,
  `ProgressUnlocksWithIdentity.tsx`, `ResearchProgressWithIdentity.tsx`,
  and `DailyQuestsWithIdentity.tsx` — each reading the real session via
  `lib/hooks/useSession.ts` and passing the derived id through, mirroring
  `TaskInboxWithIdentity.tsx` exactly; `ResearchHub.tsx`'s Progress,
  Quests, and Rewards tabs and the four standalone `app/cards/{leaderboard,
  progress,progress-tracking,quests}/page.tsx` routes now render the
  wrappers instead of the bare panels, so the panels themselves stay
  app-agnostic. A signed-out visitor sees the exact same rosters/fields as
  before. `docs/features/{contribution-leaderboard,progress-unlocks,
  research-progress-tracking,daily-quests}.md` updated (new "Signed-in
  row highlight"/"Signed-in prefill" data-flow sections, revised "Known
  gaps" — each now explicitly notes this is a highlight/prefill, not a
  permission check). Verification: `bunx vitest run
  packages/debate-card-search/test/session-identity.test.ts` (18 tests),
  `bun x turbo typecheck` (12/12 package tasks passed — same
  `apps/debate-ai.com` typecheck-gate exclusion noted on PR #318 applies
  here too), full `bun run test` (171 files / 2569 tests passed, up from
  170/2557), and `bun run build:web` (production build succeeded, all
  four `/cards/*` routes present, no route changes). This repo has no
  `lint` script configured, so that acceptance step is N/A. This closes
  every panel PR #318 flagged as carrying the gap; the same underlying
  "free-form id, not an authenticated permission check" limitation is
  unchanged and remains documented in each panel's own Known gaps.
- **Task Inbox — signed-in identity prefill for "My tasks."**
  [PR #318](https://github.com/debate/debate-ai.com/pull/318).
  Closes the auth half of the "🧭 Research Task Routing" bullet's follow-up
  (e) in this file's Research Crowdsourcing Organizer Features section —
  the "My tasks" filter used to be a free-form typed id "since this repo
  has no auth/identity system." That stopped being true once
  `apps/debate-ai.com` gained a real better-auth-backed sign-in (Google One
  Tap, magic link, anonymous sessions). `debate-card-search` gains
  `lib/session-identity.ts`'s `deriveContributorIdFromSessionIdentity`
  (name → email local-part → account id → `""`), exported from the package
  root and Vitest-covered in `test/session-identity.test.ts`.
  `panels/TaskInboxPanel.tsx` gains an optional `signedInContributorId`
  prop that seeds the "My tasks" field's *initial* value only — a visitor
  who edits the field (tracked via a new `hasEditedMyId` flag) keeps
  whatever they typed for the rest of the panel's life, so this is a
  prefill, not a login or a permission gate. `apps/debate-ai.com` gains
  `components/research/TaskInboxWithIdentity.tsx`, a `"use client"` wrapper
  that reads the real session via `lib/hooks/useSession.ts` and passes the
  derived id through; both `app/cards/inbox/page.tsx` and `ResearchHub.tsx`'s
  Routing tab now render that wrapper instead of `TaskInboxPanel` directly,
  so the panel itself stays app-agnostic. A signed-out visitor sees the
  exact same empty free-form field as before. `docs/features/task-inbox.md`
  updated (new "Signed-in prefill" data-flow section, revised "Known gaps").
  Verification: `bun run vitest run packages/debate-card-search/test/session-identity.test.ts
  packages/debate-card-search/test/routedTaskQueues.test.ts` (31 passed),
  full `bun run test` (171 files / 2564 tests passed), `bun run typecheck`
  (12/12 package tasks passed — `apps/debate-ai.com` has no `typecheck`
  script of its own and its `next.config`'s `typescript.ignoreBuildErrors:
  true` means it isn't part of this repo's typecheck gate; a scoped `tsc
  --noEmit` run against it surfaced only pre-existing, unrelated errors —
  CSS side-effect imports, `D1Database`/`Fetcher` ambient types, an
  installed `better-auth` version mismatch — none in the files this task
  touched), and `bun run build:web` (production build succeeded). This
  repo has no `lint` script configured, so that acceptance step is N/A.
  This is the first slice; the same "no auth/identity system" Known gap is
  recorded on the Leaderboard, Progress Unlocks, Research Progress
  Tracking, and Daily Quests panels and remains open there as a follow-up
  for a future run.

- **Task Inbox — verification step before a task counts complete.**
  [PR #316](https://github.com/debate/debate-ai.com/pull/316).
  Closes the "No reviewer/verification step before a task is marked
  complete — any visitor can mark any assignment done" Known gap recorded
  in `docs/features/task-inbox.md` under the "🧭 Research Task Routing"
  bullet in this file's Research Crowdsourcing Organizer Features section —
  the only safely-startable open follow-up left anywhere in this file; every
  other idea/bullet was already marked "No follow-ups remain open," and the
  remaining four (idea #1's Tabroom scraper, idea #12's real data sources,
  and the Opponent Team Profiles/Judge Profiles bullets' real data sources)
  are recorded as a confirmed, out-of-scope blocker in "Confirmed blocker:
  Tabroom results/pairings/ballot data" above. `packages/debate-card-search`
  gains `lib/task-verification.ts`'s `assertVerifierAllowed` — mirroring
  `lib/peer-review.ts`'s self-review guard on approve/reject/publish — which
  requires a verifier id different from a task's own assignee, throwing
  `VerifierIdRequiredError`/`SelfVerificationNotAllowedError` otherwise. A
  new `state/pendingTaskVerifications.ts` store holds a task marked done but
  not yet verified, with `markRoutedTaskAwaitingVerification` composing the
  existing `completePersistedRoutedTask` (still removes the assignment from
  its active queue and decrements the assignee's `activeTaskCount`
  immediately) without crediting it. `state/researchProgress.ts` gains
  `verifyAndRecordResearchTask`, which only appends a `CompletedTaskRecord`
  (now also carrying `markedDoneAt`/`verifiedBy`) once the guard passes,
  removing the pending record. The existing `completeAndRecordResearchTask`
  is unchanged — still credits a completion immediately with no
  verification required — so this is additive, not breaking: every other
  existing caller (including the unrelated `topicSprints.test.ts`/
  `unlock-streak-status.test.ts` fixture setup) keeps working exactly as
  before. `panels/TaskInboxPanel.tsx`'s "Mark complete" action is now "Mark
  done," which moves a task into a new "Awaiting verification" section; a
  "Verify" action there (a per-row verifier-id field) calls the gated path
  and shows an inline error (still pending) if the guard rejects it. Vitest-
  covered in new `test/task-verification.test.ts` (the guard: trims,
  requires a non-blank id, rejects self-verification) and
  `test/pendingTaskVerifications.test.ts` (mark-done's queue/activeTaskCount
  side effects and pending-store CRUD, mirroring `routedTaskQueues.test.ts`'s
  conventions), plus new cases in `test/researchProgress.test.ts`
  (`verifyAndRecordResearchTask` credits on a valid different verifier,
  returns `undefined` for a topic/argBlock with nothing pending, throws and
  leaves the task pending for a blank or self-matching verifier id, and
  leaves `completeAndRecordResearchTask`'s direct/unverified credit path
  unaffected). Docs updated in `docs/features/task-inbox.md`: "What it
  shows" and the data-flow section describe the mark-done/verify two-step
  flow, and the Known gap is struck as closed (noting verification is still
  a free-form id, not an authenticated reviewer — the same gap every other
  free-form-id action in this repo has). `bun install` (2062 packages),
  `bun x turbo typecheck` (all 12 typecheck-enabled packages pass),
  `bunx vitest run` on the four new/changed test files (87 tests pass),
  `bun run test` (170 files / 2557 tests, all pass, up from 167 files / 2527
  tests), and `bun run build:web` (`debate-ai-web`, succeeds, `/cards/inbox`
  route present, no route changes) all pass. No repo-wide `lint` script
  exists. **Completed:** 2026-08-25.
- **CX NDCA Standings — custom qualification points table.**
  [PR #315](https://github.com/debate/debate-ai.com/pull/315).
  Advances idea #1's follow-up (b) ("a real, circuit-sourced
  `QualificationPointsTable`") recorded in `docs/features/standings.md`'s
  Known gaps. No public, authoritative NDCA point table exists for this
  repo to hardcode, so instead this closes the "stuck with a fixed
  illustrative table" half of that gap: a new
  `packages/debate-data-sync/src/state/qualificationPointsTable.ts` persists
  a user's own circuit-sourced `QualificationPointsTable` to localStorage
  (`getPersistedQualificationPointsTable`/
  `savePersistedQualificationPointsTable`/
  `resetPersistedQualificationPointsTable`/
  `getEffectiveQualificationPointsTable`), validating every required numeric
  field on read so corrupt or incompletely-shaped stored JSON degrades to
  "none saved" (falling back to `DEFAULT_QUALIFICATION_POINTS_TABLE`)
  instead of throwing, mirroring this repo's existing localStorage-store
  convention. `state/tournamentResults.ts`'s `buildStandingsFromStore` now
  defaults its `pointsTable` to `getEffectiveQualificationPointsTable()`
  whenever a caller doesn't pass one explicitly, so every existing caller
  (and the standings dashboard) picks up a saved custom table automatically
  without any new required argument. `panels/StandingsPanel.tsx`
  (`/standings`) gains a "Points table" section above the results form: one
  editable number input per outround finish plus points-per-prelim-win and
  the bid-level bonus rate, seeded from `getEffectiveQualificationPointsTable()`
  on mount, with **Save points table** (validates every field is a finite
  number before persisting and re-scoring) and **Reset to default**
  (disabled once nothing custom is saved) actions; the panel's intro copy
  now names whether standings are currently scored with the saved table or
  the illustrative default. Vitest-covered in a new
  `packages/debate-data-sync/test/qualificationPointsTable.test.ts`
  (get/save/reset, corrupt JSON, missing required fields, a non-finite
  field, and the default-fallback behavior) and two new cases added to
  `test/tournamentResults.test.ts` (`buildStandingsFromStore` scores with a
  persisted custom table when none is passed explicitly, and an explicitly
  passed `pointsTable` still wins over a persisted custom one). No component
  test exists for `StandingsPanel.tsx` itself, matching this repo's existing
  convention of Vitest-covering pure state/engine logic rather than `.tsx`
  panel components (verified instead via `bun run build:web`). Follow-up
  (a) (a real Tabroom/NDCA scraper producing `TournamentResult`s
  automatically) and the "no genuinely authoritative default table can
  exist here" half of follow-up (b) remain open, as documented in
  `docs/features/standings.md`'s Known gaps. Verified: `bun install` (2062
  packages), `bun x turbo typecheck` (all packages), `bun x vitest run`
  (2538 tests, repo-wide), `bun run build:web`.
- **Coach Materials — conversation history for "Ask the coach".**
  [PR #314](https://github.com/debate/debate-ai.com/pull/314).
  Closes the "No conversation history — each question is answered
  independently; a prior question/answer isn't persisted or fed back into a
  later one" Known gap recorded in `docs/features/coach-materials.md` for
  idea #8 ("Video-Lecture-Training Coach AI"). `packages/debate-speech-writer/src/coach/team-coach-materials.ts`
  gains a `CoachConversationTurn` type (question, answer, askedAt) and a
  pure `buildCoachConversationMessages(question, matches, history, options)`
  that composes the most recent `maxHistoryTurns` (default 6) history turns
  as alternating `{ role: "user" }`/`{ role: "assistant" }` messages,
  followed by the current question's own `buildGroundedCoachPrompt` output
  as the final user turn. `coach/team-coach-client.ts`'s
  `requestTeamCoachAnswer` now accepts an optional `history` through its
  existing `options` object (so its call signature stays backward
  compatible — the existing endpoint-override test call was untouched) and
  sends the full multi-turn `messages` array `buildCoachConversationMessages`
  builds instead of always a single user message; no change was needed to
  `/api/reason-ai`, whose `{ system, messages, maxTokens }` contract already
  accepted multiple turns. A new localStorage-backed
  `state/coachConversation.ts` persists turns (`listCoachConversationTurns`/
  `appendCoachConversationTurn`/`clearCoachConversationHistory`), capped at
  the 50 most recently stored turns, mirroring `state/coachMaterials.ts`'s
  persistence convention. `CoachMaterialsPanel` ("Ask the coach" section,
  `/coach-materials`) now renders the persisted conversation above the
  question field, passes it as `requestTeamCoachAnswer`'s `history` option
  on every question, appends the new turn once a real answer comes back, and
  adds a "Clear conversation" action. Vitest-covered in
  `test/team-coach-materials.test.ts` (`buildCoachConversationMessages`'s
  no-history/with-history/cap/omit-history/excerptLength-passthrough
  behavior), `test/team-coach-client.test.ts` (history sent as real
  alternating messages), and a new `test/coachConversation.test.ts`
  (list/append/clear, the storage cap, and corrupt/non-array JSON handling)
  — a UI-wiring-only change to the panel itself introduced no new pure
  logic beyond what those three files cover, matching this repo's
  convention. Docs updated in `docs/features/coach-materials.md`: "What it
  shows" and the data-flow section describe the new conversation history,
  and the Known gap is struck as closed (noting history stays per-browser
  localStorage, the same gap every other localStorage-backed panel in this
  repo has). `bun install`, `bun run typecheck` (12 of 13 in-scope packages
  have a typecheck script; all pass), `bunx vitest run` on the three
  new/changed test files (47 tests pass), `bun run test` (167 files / 2527
  tests, all pass, up from 166 files / 2512 tests), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/coach-materials` route present, no route
  changes) all pass. No repo-wide `lint` script exists. **Completed:**
  2026-08-25.
- **Team Brainstorm Assist — choose any idea as a merge target.**
  [PR #313](https://github.com/debate/debate-ai.com/pull/313).
  Closes the `docs/features/brainstorm-board.md` Known gap: "'Merge into
  top idea' always targets the board's own highest-ranked idea; a duplicate
  pair that both rank below the board's actual top idea can't be merged
  directly into each other without first merging one of them up."
  `packages/debate-card-search/src/panels/BrainstormBoardPanel.tsx`'s
  per-idea "Merge into top idea" button is now a "Merge into…" select
  populated with every other idea on that board; choosing one calls the
  already-persisted `mergePersistedBrainstormIdeas(targetId, duplicateId)`.
  No changes were needed to `lib/team-brainstorm-assist.ts`'s
  `mergeBrainstormIdeas` or `state/brainstormIdeas.ts`'s
  `mergePersistedBrainstormIdeas` — both already accepted an arbitrary
  target id and already enforce the same-id/cross-board guards, and both
  are already Vitest-covered in
  `packages/debate-card-search/test/team-brainstorm-assist.test.ts` and
  `packages/debate-card-search/test/brainstormIdeas.test.ts` — this was a
  UI-wiring-only change, matching this repo's convention of not adding a
  separate test for a `.tsx` panel when it introduces no new pure logic.
  Docs updated in `docs/features/brainstorm-board.md`: the "What it shows"
  and data-flow sections describe the new picker, and the Known gap about
  only merging into the top idea is struck. `bun install`, `bun run test`
  (166 files / 2512 tests, all pass, including the pre-existing
  `brainstormIdeas.test.ts`/`team-brainstorm-assist.test.ts` merge-logic
  coverage), `bun run typecheck` (12 of 13 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`,
  succeeds, `/cards/brainstorm` route present, no route changes) all pass.
  No repo-wide `lint` script exists. **Completed:** 2026-08-25.
- **Flow Annotations — video title on cross-recording jumps.**
  [PR #312](https://github.com/debate/debate-ai.com/pull/312).
  Closes the "Now playing: `<videoId>`" Known gap recorded in
  `docs/features/flow-annotations.md` — switching the persistent video
  player to a different recording via `jumpToAnnotation` used to always
  fall back to the bare `videoId` as the player's displayed title, since no
  stored catalog mapped a `videoId` to a title. `packages/debate-round/src/flow/flow-annotations.ts`'s
  `FlowAnnotation`/`CreateFlowAnnotationInput` gain an optional
  `videoTitle`, trimmed and omitted-if-blank exactly like the existing
  `videoId` field; `jumpToAnnotation` now calls `deps.setActiveVideo(videoId,
  annotation.videoTitle ?? annotation.videoId, ...)`. `FlowAnnotationsPanel`'s
  `handleAdd` passes the live player's `activeVideoTitle` (from
  `useVideoPlayerStore`) through alongside `activeVideoId` when dropping an
  annotation at the current playback position, so a title captured live is
  available for a later cross-recording jump to reuse. No new
  video-id-to-title lookup service was added — an annotation dropped without
  the live player active, or created before this change, still falls back to
  the bare id, as documented in the doc's Known gaps. Verified: `bun install`,
  `bun run test packages/debate-round/test/flow-annotations.test.ts` (31
  tests, 2 new), `bun run test` (166 files / 2512 tests, all pass), `bun run
  typecheck` (12 of 13 in-scope packages have a typecheck script; all pass),
  and `bun run build:web` (`debate-ai-web`, succeeds, `/annotations` route
  present, no route changes) all pass. **Completed:** 2026-08-25.
- **Prep Notes — "jump to argument" failure message.**
  [PR #311](https://github.com/debate/debate-ai.com/pull/311).
  Closes the "If a note's `boxPath` no longer resolves to a real grid row
  (e.g. the flow was edited since the note was made), `jumpToBoxInGrid`
  silently returns `false`... nothing scrolls or flashes, and no error is
  shown" Known gap recorded in `docs/features/prep-notes.md`.
  `packages/debate-round/src/flow/edit-cells.ts` gains a bounded retry
  budget for the Prep Notes "jump to argument" deep link: a new
  `MAX_BOX_JUMP_ATTEMPTS` constant (5), `hasExhaustedBoxJumpAttempts`, and
  `buildBoxJumpFailedMessage` (the user-facing text). `hooks/useJumpToPrepNoteBox.ts`
  now retries `jumpToBoxInGrid` every 200ms — instead of the old single
  `setTimeout(0)` attempt plus a one-shot `onGridReady` retry — until it
  succeeds or the retry budget is exhausted, at which point it reports a new
  `jumpFailed` boolean (and a `dismissJumpFailed` action) instead of quietly
  giving up forever. Along the way this also fixes a latent bug: the old
  retry effect depended on `[selected, gridApiRef]` only, so a second jump
  to a different note in the *same* already-selected flow tab never
  re-triggered a retry attempt at all; the effect now also depends on the
  jump's `targetKey`. `DebateFlowPage` (`panels/DebateRoundPanel.tsx`) wires
  `jumpFailed`/`dismissJumpFailed` into a small dismissible banner above the
  flow grid, showing `buildBoxJumpFailedMessage()`'s text with a "×" button.
  Docs updated in `docs/features/prep-notes.md`: the "Jump to argument"
  section documents the retry budget and failure banner, and the Known gaps
  section's "silently returns `false`... no error is shown" bullet is struck
  through. No repo-wide `lint` script exists (checked root/app/package
  `package.json` scripts) so none was run. `useJumpToPrepNoteBox`/
  `DebateFlowPage` are hooks/panel components, not pure logic, so — matching
  this repo's existing convention of Vitest-covering pure state/engine logic
  rather than React hooks or `.tsx` panel components directly (e.g.
  `reason-editor-outline-nav.md`'s identical note about `OutlineNavPanel`) —
  they're verified via `bun run build:web` instead; the new pure
  `hasExhaustedBoxJumpAttempts`/`buildBoxJumpFailedMessage` helpers are
  Vitest-covered directly. Verified: `bun install`, `bun run test` (166
  files / 2510 tests, all pass — 4 new), `bun run typecheck` (12 of 13
  in-scope packages have a typecheck script; all pass), and `bun run
  build:web` (`debate-ai-web`, succeeds, `/debate` and `/prep-notes` routes
  present, no route changes) all pass. **Completed:** 2026-08-25.
- **Shared Flow Sync — live-sync toggle in `SharedFlowSyncPanel`.**
  [PR #310](https://github.com/debate/debate-ai.com/pull/310).
  Closes the "`SharedFlowSyncPanel`/`CoachHub` do not surface the sync
  toggle or status — it lives only in `FlowEditLogPanel`'s own form,
  scoped to that form's Flow ID field" Known gap recorded in
  `docs/features/shared-flow-sync.md`. `SharedFlowSyncPanel` gains the
  same "Live sync on/off" toggle + status pill `FlowEditLogPanel` already
  had, reusing the existing `hooks/useFlowSyncPolling.ts` hook directly —
  no new sync logic — scoped automatically to the panel's own `flow.id`
  prop (unlike `FlowEditLogPanel`'s free-typed Flow ID field, this panel
  already knows which flow it's previewing). A pulled edit calls a new
  optional `onSyncPulled` prop, mirroring `FlowEditLogPanel`'s existing
  `onChange` convention; `CoachHub.tsx` wires its existing
  `refreshFlowEdits` (from `useStoreSnapshot`) into it, the same callback
  it already passes to `FlowEditLogPanel` as `onChange`, so the merge
  preview refreshes in step with a teammate's synced edit. The two
  toggles are independent `syncEnabled` state, but both poll (and write
  into) the same `state/flowEdits.ts` store for the same flow, so either
  one being on is enough for a teammate's edits to show up everywhere.
  Docs updated in `docs/features/shared-flow-sync.md`: a new "Live sync
  toggle in `SharedFlowSyncPanel`" section documents the change, and the
  Known gaps section's "do not surface the sync toggle or status" bullet
  is struck through. No repo-wide `lint` script exists (checked root/app/
  package `package.json` scripts) so none was run. Verified: `bun
  install`, `bun run test` (166 files / 2506 tests, all pass — 1 new),
  `bun run typecheck` (12 of 13 in-scope packages have a typecheck
  script; all pass), and `bun run build:web` (`debate-ai-web`, succeeds,
  `/coach` route present, no route changes) all pass. **Completed:**
  2026-08-25.
- **Opponent Team Profiles — undo/redo a logged-round edit.**
  Closes the "Editing a round is all-or-nothing per round: there is no
  history of what a round looked like before an edit, so a correction can't
  be undone" Known gap recorded in
  `docs/features/opponent-team-profiles.md`, the same gap Judge Profiles
  closed across PR #304 (undo) and PR #308 (redo).
  `packages/debate-data-sync/src/state/opponentRoundRecords.ts` gains two
  new localStorage stores mirroring `debate-speech-writer`'s
  `judgeRoundRecords.ts` exactly: `opponentRoundRecordEditHistory` (keyed by
  round id, capped at the 10 most recent prior versions per round) and
  `opponentRoundRecordRedoHistory` (same cap), plus
  `hasOpponentRoundRecordEditHistory`/`listOpponentRoundRecordEditHistory`/
  `undoLastOpponentRoundRecordEdit` and
  `hasOpponentRoundRecordRedoHistory`/`listOpponentRoundRecordRedoHistory`/
  `redoLastOpponentRoundRecordEdit`. `updateOpponentRoundRecord` now pushes
  the version it just replaced onto the round's undo stack and clears any
  pending redo (a fresh edit invalidates redo, the standard undo/redo rule);
  `undoLastOpponentRoundRecordEdit` pushes the version it just replaced onto
  the redo stack, and `redoLastOpponentRoundRecordEdit` pops it back off,
  pushing what *it* replaces back onto the undo stack so a further undo can
  revert the redo. `deleteOpponentRoundRecord` discards both stacks for the
  deleted round. Unlike Judge Profiles (which shipped undo in PR #304 and
  had to add a separate PR #308 for the "Undo has no matching redo" follow-up
  gap), both stacks are added together here in one slice, since the pattern
  was already fully proven. `OpponentTeamProfilesPanel.tsx` gains matching
  "Undo last edit"/"Redo" actions next to Edit/Delete in the logged-rounds
  table, shown only when `hasOpponentRoundRecordEditHistory`/
  `hasOpponentRoundRecordRedoHistory` say one exists for that row. Docs
  updated in `docs/features/opponent-team-profiles.md`: the "Correcting a
  logged round" and "Data flow" sections document the new actions and
  stores, and the Known gaps section's "no history... can't be undone"
  bullet is struck through. No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run. Verified: `bun
  install`, `bun run test` (166 files / 2505 tests, all pass — 21 new),
  `bun run typecheck` (12 of 13 in-scope packages have a typecheck script;
  all pass), and `bun run build:web` (`debate-ai-web`, succeeds, `/opponents`
  route present, no route changes) all pass. **Completed:** 2026-08-24.
- **Judge Profiles — redo a logged-round edit.**
  [PR #308](https://github.com/debate/debate-ai.com/pull/308).
  Closes the "Undo has no matching 'redo'" Known gap recorded in
  `docs/features/judge-profiles.md`, the sole remaining follow-up under the
  "⚖️ Judge Profiles" bullet (Research Crowdsourcing Organizer Features).
  `packages/debate-speech-writer/src/state/judgeRoundRecords.ts` gains a
  fourth localStorage store, `judgeRoundRecordRedoHistory` (keyed by round
  id, capped at the same 10-per-round limit as the existing undo stack),
  plus `hasJudgeRoundRecordRedoHistory`/`listJudgeRoundRecordRedoHistory`/
  `redoLastJudgeRoundRecordEdit` mirroring the existing
  `hasJudgeRoundRecordEditHistory`/`listJudgeRoundRecordEditHistory`/
  `undoLastJudgeRoundRecordEdit` trio exactly. `undoLastJudgeRoundRecordEdit`
  now pushes the version it just replaced onto that round's redo stack, and
  `redoLastJudgeRoundRecordEdit` pops it back off, pushing what *it* replaces
  back onto the undo stack so a further undo can revert the redo — a
  standard undo/redo stack pair. `updateJudgeRoundRecord` (a fresh edit) and
  `deleteJudgeRoundRecord` both discard a round's redo stack, the same way
  they already touch its undo stack, so a fresh correction after an undo
  can't leave a stale "redo" pointing at a version that's no longer
  reachable. `JudgeProfilesPanel.tsx` gains a "Redo" action next to "Undo
  last edit," shown only when `hasJudgeRoundRecordRedoHistory` says one
  exists for that row. Docs updated in `docs/features/judge-profiles.md`:
  the "Correcting a logged round" and "Data flow" sections document the new
  action and store, and the Known gaps section's "no matching redo" bullet
  is struck through. No repo-wide `lint` script exists (checked root/app/
  package `package.json` scripts) so none was run. Verified: `bun install`,
  `bun run test` (166 files / 2484 tests, all pass — 11 new), `bun run
  typecheck` (12 of 13 in-scope packages have a typecheck script; all pass),
  and `bun run build:web` (`debate-ai-web`, succeeds, `/judges` route
  present, no route changes) all pass. **Completed:** 2026-08-24.
- **Word-Count-Only Speech Format — microphone dictation for the live
  in-round word-limit popover.**
  Closes the "The live in-round word-limit popover — `debate-timer`'s
  `SpeechWordCounter`, opened from `SpeechHeaderBar` — is a separate
  component in a different package and still has no dictation button; its
  speech text is typed or pasted only" Known gap recorded in
  `docs/features/word-count-rounds.md`, the last remaining half of the
  "Speech text is typed or pasted; there is no transcription path feeding
  the word counter" gap from idea #2 ("Word-Count-Only Speech Format") —
  the standalone `/word-count` form half was already closed by PR #305.
  `debate-timer` has no dependency on `debate-round` (the reverse is true —
  `debate-round`'s `SpeechHeaderBar` imports `SpeechWordCounter` from
  `debate-timer`), so this adds a `debate-timer`-local copy of the dictation
  wiring rather than importing `debate-round`'s: new
  `packages/debate-timer/src/timers/microphone-transcription.ts` (pure
  feature-detection, error-message, and text-joining helpers — a byte-for-byte
  copy of `debate-round/src/round/microphone-transcription.ts`, matching the
  same per-package-copy pattern `debate-speech-writer/src/coach/microphone-transcription.ts`
  already established) and new
  `packages/debate-timer/src/hooks/useMicrophoneTranscription.ts` (the
  matching React wiring around the browser's own
  `SpeechRecognition`/`webkitSpeechRecognition` API). `SpeechWordCounter.tsx`
  wires this into a "🎤 Record"/"Stop recording" button in its popover, below
  the speech textarea, dictating appended segments into the same `text`/
  `onTextChange` props the textarea already uses; the button is hidden in a
  browser without `SpeechRecognition` support, a dictation error renders as a
  small message under the button, and recording stops automatically if the
  popover is closed while still listening (only one `SpeechWordCounter`
  instance is ever rendered at a time, so no cross-speech "only one dictates"
  coordination is needed here, unlike the multi-textarea `/word-count` form).
  No changes to `formats/word-count-format.ts`, `hooks/useWordCountSpeechMode.ts`,
  or the persisted `wordCountRounds` schema. Docs updated in
  `docs/features/word-count-rounds.md`: the "Word-limit mode in the live
  round" section documents the new button, and the "Known gaps" section's
  remaining bullet is struck through — both halves of the word-count
  dictation gap are now closed, closing out idea #2's transcription
  follow-up entirely. No repo-wide `lint` script exists (checked root/app/
  package `package.json` scripts) so none was run. Verified: `bun install`,
  `bun run test` (166 files / 2473 tests, all pass — 16 new), `bun run
  typecheck` (12 of 13 in-scope packages have a typecheck script; all pass),
  and `bun run build:web` (`debate-ai-web`, succeeds, `/word-count` and
  `/debate` routes present, no route changes) all pass. **Completed:**
  2026-08-24.
- **Outline Filters and Argument Tree View — heuristic argument-type
  suggestion.**
  [PR #306](https://github.com/debate/debate-ai.com/pull/306).
  Closes the "nothing infers a tag — every row is tagged by hand from the
  context menu; there is no heuristic or AI pass that proposes an argument
  type from the row's own content" Known gap recorded in
  `docs/features/argument-tree-outline.md`, the sole remaining follow-up on
  idea #10 ("Outline Filters and Argument Tree View").
  `packages/debate-round/src/flow/argument-tagging.ts` gains
  `inferArgumentType(content)`, a pure, deterministic keyword heuristic
  (ordered turn → extension → answer → impact → link → contention rules,
  most-specific first, case-insensitive substring matching) that suggests an
  `ArgumentType` from a row's own content, or `undefined` when nothing
  matches. `ArgumentTagPopover.tsx` gains an optional `content` prop and
  shows a "Suggested: turn — use it"-style link under the Argument type
  select whenever a suggestion exists and differs from the currently
  selected type; clicking it only fills the form field, never auto-applies
  or auto-saves, matching this repo's established suggestion convention
  (e.g. `flow-note-suggestions.ts`'s Common Argument Library suggestions).
  `FlowSpreadsheet.tsx` threads the row's own content into the popover.
  No change to `authorId`/`evidenceStatus` inference, and no AI/LLM call —
  purely a deterministic heuristic, matching this gap's sibling
  suggestions (bulk section tag, neighbour preview). Vitest-covered in
  `packages/debate-round/test/argument-tagging.test.ts` (each keyword rule,
  rule-priority ordering, case-insensitivity, and no match for
  empty/whitespace/unmatched content) and
  `packages/debate-round/test/ArgumentTagPopover.test.tsx` (the suggestion
  renders when it differs from the current selection, and is hidden for
  unmatched content or when the row is already tagged with the suggested
  type). Docs updated in `docs/features/argument-tree-outline.md`: a new
  "Suggested argument type" section documents the heuristic and its data
  flow, and the "Known gaps" section's "nothing infers a tag" bullet is
  replaced with a closed-gap note. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install`, `bun run test` (165 files / 2457 tests, all
  pass — 10 new), `bun run typecheck` (12 of 13 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`,
  succeeds, `/outline` route present, no route changes) all pass.
  **Completed:** 2026-08-24.
- **Word-Count-Only Speech Format — microphone dictation for the standalone
  submission form.**
  [PR #305](https://github.com/debate/debate-ai.com/pull/305).
  Closes the "Speech text is typed or pasted; there is no transcription path
  feeding the word counter" Known gap recorded in
  `docs/features/word-count-rounds.md`, for the standalone `/word-count`
  form half of it — mirroring the identical fix already shipped for idea
  #6's ("Speech Transcript Summaries and Answers") and idea #8's
  ("Video-Lecture-Training Coach AI") forms.
  `packages/debate-round/src/panels/WordCountRoundsPanel.tsx` wires the
  existing `hooks/useMicrophoneTranscription.ts` (backed by
  `round/microphone-transcription.ts`'s `appendDictatedSegment` and the
  browser's own `SpeechRecognition`/`webkitSpeechRecognition` API — no new
  logic module) into a "🎤 Record"/"Stop recording" button on every speech's
  textarea, dictating directly into that speech's draft text. Only one
  speech dictates at a time — starting a different speech's recording is
  disabled while another is still listening, and switching the round's style
  or saving the round stops any active recording. No changes to
  `round/microphone-transcription.ts`, `hooks/useMicrophoneTranscription.ts`,
  word-count/limit logic, or the persisted `wordCountRounds` schema — this is
  UI wiring only, reusing already-tested helpers, matching every other
  microphone-dictation panel in this repo (none of which carry their own new
  Vitest coverage for the untested `"use client"` React wiring itself, per
  this repo's established convention — see `hooks/useMicrophoneTranscription.ts`'s
  own file doc). Docs updated in `docs/features/word-count-rounds.md`: the
  new "🎤 Record" button documented under "What it shows," and the "Known
  gaps" section corrected — its stale first bullet (the mobile
  `FlowPageHeader` countdown) already turned out to be moot (`FlowPageHeader.tsx`
  is dead code, established by the "Word-Count-Only Speech Format —
  live-round word-limited speech mode" entry below, but the doc file itself
  was never corrected until now), and its second bullet now notes dictation
  is closed for this standalone form while the live in-round word-limit
  popover (`debate-timer`'s `SpeechWordCounter`, opened from
  `SpeechHeaderBar`) — a separate component in a different package — still
  has no dictation button, recorded as the one remaining Known gap. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run. Verified: `bun install`, `bun run test` (165
  files / 2447 tests, all pass — no new tests, per the no-new-logic note
  above), `bun run typecheck` (12 of 13 in-scope packages have a typecheck
  script; all pass), and `bun run build:web` (`debate-ai-web`, succeeds,
  `/word-count` route present, no route changes) all pass. **Completed:**
  2026-08-24.
- **Judge Profiles — undo a logged-round edit.**
  Closes the "editing a ballot is all-or-nothing per round... a correction
  can't be undone" Known gap recorded in `docs/features/judge-profiles.md`.
  `packages/debate-speech-writer/src/state/judgeRoundRecords.ts` gains a
  small per-round undo history (a separate `judgeRoundRecordEditHistory`
  localStorage store, keyed by round id, capped at the 10 most recent prior
  versions): `updateJudgeRoundRecord` now saves a round's pre-edit version
  there before overwriting it, and the new `undoLastJudgeRoundRecordEdit`
  pops the most recent saved version and restores it, re-aggregating the
  affected judge's profile (or both judges', if that edit had reassigned
  the round) the same way `updateJudgeRoundRecord` does.
  `hasJudgeRoundRecordEditHistory`/`listJudgeRoundRecordEditHistory` expose
  whether/what history exists; `deleteJudgeRoundRecord` now also discards a
  round's undo history when the round itself is deleted.
  `JudgeProfilesPanel.tsx` (`/judges`) gains an "Undo last edit" action in
  the Logged rounds table, shown only on a round with at least one edit
  still undoable. No change to `judge-profile.ts`'s aggregation logic; no
  redo. Vitest-covered in
  `packages/debate-speech-writer/test/judgeRoundRecords.test.ts` (history
  recording/ordering/capping, single and multi-step undo, reassignment
  re-aggregation, no-op cases for an unedited or unknown round, and history
  cleanup on delete). Docs updated in `docs/features/judge-profiles.md`
  ("Undo last edit" row and data-flow entries added; Known gaps updated —
  the old "can't be undone" bullet is replaced with the new undo
  mechanism's own no-redo/10-edit-cap limits). No repo-wide `lint` script
  exists (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install`, `bun run test` (165 files / 2447 tests, all
  pass — 10 new), `bun run typecheck` (12 of 13 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`,
  succeeds, no route changes) all pass. **Completed:** 2026-08-24.
- **Shared Evidence Library — normalize a typed tag to its existing casing.**
  [PR #303](https://github.com/debate/debate-ai.com/pull/303).
  Closes the remaining half of the tag-identity Known gap recorded in
  `docs/features/evidence-library.md`: a tag typed directly into a
  submission form (bypassing autocomplete) still coined a new casing
  instead of landing on whichever casing was already in use.
  `packages/debate-card-search/src/lib/argument-library.ts` gains
  `normalizeTagsToKnownCasing(tags, knownTags)`, a pure case-insensitive
  lookup that rewrites each tag to an existing casing when one is present
  in the known-tags corpus, leaving an unmatched tag unchanged. Wired into
  both submission forms' submit handlers — `EvidenceLibraryPanel`
  (`/cards/library`, against `listPersistedTags()`) and
  `ContributionsFeedPanel` (`/cards/contributions`, against
  `listCombinedPersistedTags()`) — the same corpora each form's existing
  tag-autocomplete already reads, so a hand-typed tag now lands on the same
  casing a contributor would get by picking an autocomplete suggestion.
  Vitest-covered in
  `packages/debate-card-search/test/argument-library.test.ts`
  (`normalizeTagsToKnownCasing`: rewriting a typed tag to its existing
  casing, leaving an unmatched tag unchanged, leaving an already-correct
  casing unchanged, normalizing several tags independently, a
  first-encountered-casing tie-break, and both empty-input cases). Docs
  updated in `docs/features/evidence-library.md` ("Typed-tag
  normalization" section added; Known gaps updated — no follow-up remains
  open on that bullet). No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run. Verified:
  `bun install`, `bun run test` (165 files / 2437 tests, all pass — 7 new),
  `bun run typecheck` (12 of 13 in-scope packages have a typecheck script;
  all pass), and `bun run build:web` (`debate-ai-web`, succeeds, no route
  changes) all pass. **Completed:** 2026-08-24.
- **Online Debate Versus AI — regenerate any delivered AI speech.**
  [PR #302](https://github.com/debate/debate-ai.com/pull/302).
  Closes the Known gap recorded in `docs/features/ai-versus-rounds.md`:
  "Regenerate last AI speech" only ever replaced the most recently
  submitted speech — there was no way to regenerate an earlier AI speech
  mid-round without also discarding every speech (the user's included)
  submitted after it. `debate-round`'s `state/aiVersusRounds.ts` replaces
  its narrower `canRegenerateLastAiSpeech`/`replaceLastAiSpeech` pair with
  index-based `canRegenerateAiSpeechAt(record, index)`/
  `replaceAiSpeechAt(record, index, text)`, which work for any submitted
  speech position, not just the last one. `AiVersusRoundPanel.tsx`
  (`/versus-ai`) now renders an independent "Regenerate" button next to
  every delivered AI speech in the round's turn-order list, instead of a
  single button that only ever targeted the most recent speech.
  Regenerating a speech rebuilds the exact same `buildAiResponseRequest`
  originally used for it (from the speeches delivered before that index)
  and swaps only that speech's text in place — every other speech, earlier
  or later, including the user's own, is left untouched, so redoing an
  early AI speech no longer discards the rest of the round. No new
  request/response shape or AI-calling logic was introduced; this is a
  pure generalization of the existing regenerate mechanism from "last
  speech only" to "any delivered speech." Vitest-covered in
  `packages/debate-round/test/aiVersusRounds.test.ts` (9 cases:
  `canRegenerateAiSpeechAt` for no speeches / a user's speech at that
  index / an AI speech at that index / an out-of-range index / an earlier
  AI speech with later speeches also present, and `replaceAiSpeechAt` for
  the swap itself, an earlier-speech swap leaving later speeches
  untouched, non-mutation of the input record, and the three throwing
  cases). Docs updated in `docs/features/ai-versus-rounds.md` (data flow
  and Known gaps, now closed). No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run. Verified:
  `bun install`, `bun run test` (165 files / 2430 tests, all pass — 3 new),
  `bun run typecheck` (12 of 13 in-scope packages have a typecheck script;
  all pass), and `bun run build:web` (`debate-ai-web`, succeeds, `/versus-ai`
  route present, no new route) all pass.
- **Team Brainstorm Assist — duplicate-idea merge action + per-board AI generation.**
  [PR #301](https://github.com/debate/debate-ai.com/pull/301).
  Closes both Known gaps recorded in `docs/features/brainstorm-board.md`:
  "no reviewer/moderator merge action for ideas flagged as likely
  duplicates" and "the AI-generation call requires an argument block to
  already be filled in on the form; it doesn't infer one from an existing
  board." `packages/debate-card-search/src/lib/team-brainstorm-assist.ts`
  gains a pure `mergeBrainstormIdeas(target, duplicate)` that returns a
  copy of `target` with the two ideas' upvote counts combined (throwing on
  a same-id or cross-board merge attempt), and
  `state/brainstormIdeas.ts`'s new `mergePersistedBrainstormIdeas(targetId,
  duplicateId)` applies it against the persisted store and deletes the
  merged-away duplicate. `BrainstormBoardPanel.tsx` wires this into a
  "Merge into top idea" button shown on any idea flagged
  `isLikelyDuplicate` that isn't already its board's own top-ranked idea,
  turning the previously informational-only badge into a real moderator
  action. The panel also gains a second "Generate AI ideas" button on every
  rendered board's own header (alongside the existing form-driven one) that
  calls the same `requestTeamBrainstormAiIdeas` request using that board's
  own `argBlock`/`category` directly, so drafting AI ideas for an
  already-visible board no longer requires first typing its argument block
  into the form. Vitest-covered in
  `packages/debate-card-search/test/team-brainstorm-assist.test.ts`
  (`mergeBrainstormIdeas`: combining upvotes onto a copy of the target, not
  mutating either input, throwing on a same-idea merge, throwing on a
  cross-board merge) and
  `packages/debate-card-search/test/brainstormIdeas.test.ts`
  (`mergePersistedBrainstormIdeas`: folding upvotes and deleting the
  duplicate, and a no-op when either id isn't stored). See the "🧠 Team
  Brainstorm Assist" bullet under Research Crowdsourcing Organizer Features
  below and `docs/features/brainstorm-board.md` for the full data flow.
  **Completed:** 2026-08-24.
- **Daily Quests — quest-template expiry.**
  [PR #300](https://github.com/debate/debate-ai.com/pull/300).
  Closes the "a quest template has no expiry — it keeps scoring
  every day until removed, rather than resetting or archiving after one
  'daily' cycle" Known gap documented in `docs/features/daily-quests.md`.
  `lib/daily-quests.ts`'s `QuestTemplate` gains an optional `expiresOn` (a
  UTC day key, the same `getUtcDayKey` convention used throughout this
  module) and a new pure `isQuestTemplateExpired(template, dayKey)` — a
  template with no `expiresOn` never expires, and one with an `expiresOn`
  expires the day *after* it (it still counts on that day itself).
  `buildDailyQuestBoard` now filters out an expired template before scoring,
  so an expired quest simply stops appearing on the board rather than
  continuing to score forever — no "reset for a new cycle" concept was
  introduced, since no recurring-quest model exists in this repo.
  `packages/debate-card-search/src/state/dailyQuests.ts` adds
  `pruneExpiredQuestTemplates(now)`, which removes every persisted template
  whose `expiresOn` has passed and returns how many were removed, archiving
  them out of the stored roster the same way `researchProgress.ts`'s
  `deleteCompletedTaskHistoryForTopic` prunes stale history elsewhere in
  this package. `DailyQuestsPanel.tsx`'s "Add quest" form gained an optional
  "Expires on" date field, each board row shows an "Expires <date>" badge
  when its template has one, and a new "Clean up expired quests" action
  calls `pruneExpiredQuestTemplates` and shows a short result message. No
  scoring, streak, or seeding logic changed beyond the new expiry filter,
  and no new route was added. Vitest-covered in
  `packages/debate-card-search/test/daily-quests.test.ts` (4 new cases:
  `isQuestTemplateExpired` with no `expiresOn`, on/before/after its expiry
  day; `buildDailyQuestBoard` excluding an expired template and still
  including one on its own expiry day) and
  `packages/debate-card-search/test/dailyQuests.test.ts` (5 new cases for
  `pruneExpiredQuestTemplates`: no-op on empty storage, removes an expired
  template and returns the count, leaves a never-expiring template
  untouched, leaves a not-yet-expired template (including today) untouched,
  and removes only the expired template among several saved). Docs updated
  in `docs/features/daily-quests.md` (data flow, narrative, and Known gaps).
  No repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run. Verified: `bun install`, `bun run test` (165
  files / 2419 tests, all pass — 9 new), `bun run typecheck` (12 of 13
  in-scope packages have a typecheck script; all pass), and
  `bun run build:web` (`debate-ai-web`, succeeds, `/cards/quests` route
  present, no new route) all pass.
- **Online Debate Versus AI — microphone dictation for speech submission.**
  Closes the "text-only" half of the "Speech submission is text-only...
  no transcription pipeline exists in this repo" Known gap recorded in
  `docs/features/ai-versus-rounds.md` — a gap this run's `docs/features/*.md`
  audit found was already solved elsewhere in the repo (idea #6 "Speech
  Transcript Summaries", PR #297, and idea #8 "Video-Lecture-Training Coach
  AI", PR #298, both added browser-microphone dictation via
  `debate-round`'s `round/microphone-transcription.ts` +
  `hooks/useMicrophoneTranscription.ts`) and just never wired into
  `AiVersusRoundPanel`. `AiVersusRoundPanel`'s (`/versus-ai`) speech
  submission field now has a "🎤 Record"/"Stop recording" button next to
  the existing "Type the ⟨speech⟩…" textarea, dictating directly into the
  same `speechText` state the "Submit speech" button already reads, with a
  disabled "Microphone dictation isn't supported in this browser" fallback
  when neither `SpeechRecognition` constructor exists and an inline error
  message on recognition failure — mirroring `FlowSummariesPanel`'s
  identical wiring exactly, duplicating no logic (the existing
  `round/microphone-transcription.ts` and
  `hooks/useMicrophoneTranscription.ts` were reused unchanged). No new pure
  logic was introduced, so no new test file was added; the existing
  16-case `packages/debate-round/test/microphone-transcription.test.ts`
  suite already covers every code path this panel now exercises. Docs
  updated at `docs/features/ai-versus-rounds.md`. This closes the entire
  "Speech submission is text-only" Known gap; the separate "'Regenerate
  last AI speech' only replaces the most recently submitted speech" Known
  gap remains open, untouched. Verified: `bun install` (2062 packages),
  `bun run test` (165 files / 2408 tests, all pass — no new tests, none
  needed), `bun run typecheck` (12 of 12 in-scope packages pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/versus-ai` route
  present) all pass. No repo-wide `lint` script exists, so none was run,
  matching every prior PR's verification notes. PR:
  https://github.com/debate/debate-ai.com/pull/299.
- **Video-Lecture-Training Coach AI — microphone dictation for the Coach Materials upload
  form.** Closes the "recording" half of follow-up (a) named under idea #8
  ("Video-Lecture-Training Coach AI") in this file's Product Feature Ideas list — "audio/video
  transcription... remains open — not started; no transcription service exists in this
  repo" — the same gap idea #6's "Speech Transcript Summaries" microphone dictation (PR
  #297) closed for `debate-round`'s `FlowSummariesPanel`. `debate-speech-writer` gained
  its own `coach/microphone-transcription.ts` (feature detection via
  `getSpeechRecognitionConstructor`/`isMicrophoneTranscriptionSupported`, dictated-segment
  joining via `appendDictatedSegment`, and readable recognition-error messages via
  `describeMicrophoneTranscriptionError`) and `hooks/useMicrophoneTranscription.ts`, wiring
  the browser's own Web Speech API — duplicated rather than imported from `debate-round`
  because `debate-round` already depends on `debate-speech-writer` and the reverse import
  would be circular. `CoachMaterialsPanel`'s (`/coach-materials`) Material text field now has
  a "🎤 Record"/"Stop recording" button next to the existing "Upload a document" button,
  dictating directly into the same `form.text` state, with a disabled "Microphone dictation
  isn't supported in this browser" fallback and an inline error message on recognition
  failure. Vitest-covered in `packages/debate-speech-writer/test/microphone-transcription.test.ts`
  (16 cases, mirroring `debate-round`'s identical suite): preferring the unprefixed
  constructor over the webkit-prefixed one, falling back to the webkit-prefixed one, no
  constructor, an `undefined`/SSR host; feature-detection true/false variants including a
  non-function value; dictated-segment joining — empty existing text, normal join,
  trailing-whitespace collapse, an empty/whitespace-only segment as a no-op, both empty;
  every known recognition-error code mapping to a distinct message, plus the unknown-code
  fallback. The React hook itself is not directly unit-tested, matching every other
  browser-API hook in this repo — there is no jsdom environment in this repo's Vitest setup.
  Docs updated at `docs/features/coach-materials.md`. No follow-ups remain open on the
  "recording" half of idea #8's follow-up (a); an *uploaded* audio/video recording *file*
  still has no transcription path (no server-side/paid transcription service exists in this
  repo), recorded as the sole remaining Known gap on that follow-up. Verified: `bun install`
  (2062 packages), `bun run test` (165 files / 2408 tests, all pass — 16 new), `bun run
  typecheck` (12 of 12 in-scope packages pass), and `bun run build:web` (`debate-ai-web`
  succeeds, `/coach-materials` route present) all pass. No repo-wide `lint` script exists, so
  none was run, matching every prior PR's verification notes. PR:
  https://github.com/debate/debate-ai.com/pull/298.
- **Speech Transcript Summaries — microphone dictation for the transcript-extraction form.**
  Closes the "recording" half of follow-up (a) named under idea #6 ("Speech
  Transcript Summaries and Answers") in this file's Product Feature Ideas
  list: "audio/video transcription (the extraction form above requires an
  already-transcribed speech text, not a recording), remains open — not
  started." This repo has no server-side/paid transcription service, so
  `debate-round` gained `round/microphone-transcription.ts`
  (`isMicrophoneTranscriptionSupported`/`getSpeechRecognitionConstructor` for
  feature detection, `appendDictatedSegment` for joining dictated segments
  onto existing textarea text without doubled whitespace, and
  `describeMicrophoneTranscriptionError` for readable recognition-error
  messages) and `hooks/useMicrophoneTranscription.ts`, wiring the browser's
  own Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition` — neither
  exists in `lib.dom.d.ts`, so this hook carries its own minimal ambient
  type). `FlowSummariesPanel`'s existing "Generate from raw speech text" form
  (`/summaries`) now has a "🎤 Record"/"Stop recording" button next to the
  Transcript text field that dictates directly into the same
  `extractTranscriptText` state the AI extraction already reads, with a
  disabled "Microphone dictation isn't supported in this browser" fallback
  when neither constructor exists, and an inline error message on
  recognition failure (e.g. mic permission denied). No follow-ups remain
  open on this idea's text-extraction path; idea #8's ("Video-Lecture-
  Training Coach AI") identical "recording" follow-up in
  `docs/features/coach-materials.md` is a separate, still-open gap, left
  untouched to keep this change small and reviewable. Vitest-covered in
  `packages/debate-round/test/microphone-transcription.test.ts` (16 cases:
  preferring the unprefixed constructor over the webkit-prefixed one,
  falling back to the webkit-prefixed one, no constructor, an `undefined`/SSR
  host; feature-detection true/false variants including a non-function
  value; dictated-segment joining — empty existing text, normal join,
  trailing-whitespace collapse, an empty/whitespace-only segment as a no-op,
  both empty; every known recognition-error code mapping to a distinct
  message, plus the unknown-code fallback). The React hook itself
  (`hooks/useMicrophoneTranscription.ts`) is not directly unit-tested,
  matching every other browser-API hook in this repo (e.g. `debate-timer`'s
  `useSpeechRecorder`) — there is no jsdom environment in this repo's Vitest
  setup. Docs updated at `docs/features/flow-summaries.md`. Verified: `bun
  install` (2062 packages), `bun run test` (164 files / 2392 tests, all
  pass — 16 new), `bun run typecheck` (12 of 12 in-scope packages pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/summaries` route present)
  all pass. No repo-wide `lint` script exists, so none was run, matching
  every prior PR's verification notes. PR:
  https://github.com/debate/debate-ai.com/pull/297.
- **Research Progress Tracking — prune a topic's completed-task history.**
  Closes the "a completed task's history record is never deleted (e.g. if
  its topic's queue is deleted), so `completedResearchTasks` only grows"
  Known gap recorded in `docs/features/research-progress-tracking.md` —
  one of the "4 real, small, non-external-infra-blocked gaps" a previous
  run's doc/tracker-drift audit found and logged for a future run (the
  other three — a "Regenerate last AI speech" action in AI-Versus Rounds,
  the Flow Annotations "Jump to" action not switching videos, and the
  Response-Outcome Charts AI counsel call ignoring an active "what if"
  hypothetical — were already closed in prior runs). `debate-card-search`'s
  `state/researchProgress.ts` gained `deleteCompletedTaskHistoryForTopic(topic)`,
  mirroring `routedTaskQueues.ts`'s existing `deleteRoutedTaskQueue(topicId)`
  filter-and-rewrite pattern: it removes every `CompletedTaskRecord` for one
  topic from the `completedResearchTasks` localStorage store, leaving every
  other topic's history and the topic's still-active
  `routedTaskQueues.ts` queue untouched. `ResearchProgressPanel`
  (`/cards/progress-tracking`) now renders a "Clear completed history"
  action next to each topic badge that has at least one completed task,
  calling it and re-reading `buildPersistedResearchProgressBoard()`
  afterward. Vitest-covered (4 new cases in
  `packages/debate-card-search/test/researchProgress.test.ts`'s
  `deleteCompletedTaskHistoryForTopic` suite: removing a topic's records,
  leaving another topic's history untouched, a no-op on a topic with no
  completed-task history, and not touching the active-queue store for that
  topic). Verified with `bun install` (2062 packages), `bun run test` (163
  files / 2376 tests, all pass — 4 new cases), `bun run typecheck` (12
  in-scope packages pass), and `bun run build:web` (`debate-ai-web`
  succeeds, `/cards/progress-tracking` route present) all pass. No
  repo-wide `lint` script exists, so none was run, matching every prior
  PR's verification notes. Docs updated at
  `docs/features/research-progress-tracking.md`; no known gaps remain open
  on this bullet's persistence layer besides the still-open, shared
  "no contributor identity/auth scoping yet" gap. PR:
  https://github.com/debate/debate-ai.com/pull/296.
- **Common Argument Library — tag case-variant merge suggestions.**
  Closes the "nothing merges two casings already in use" half of the
  tag-identity Known gap recorded in `docs/features/evidence-library.md`
  ("Tag identity is still exact-string everywhere: `warming` and `Warming`
  are two different tags, in the library's collections, in the
  autocomplete corpus, and in a rename"). The manual "Rename/merge tag"
  form (`ArgumentLibraryPanel`, `/cards/argument-library`) already merges
  two exact tag strings together, but required a contributor to already
  know both casings existed. `debate-card-search`'s
  `lib/argument-library.ts` gained `findTagCaseVariantGroups(collections)`,
  a pure helper that scans a library's `TagCollection[]` for tags whose
  lowercased form repeats under more than one exact casing, grouping them
  with the most-used casing (by card count, alphabetical tie-break) sorted
  first as the suggested merge target; a tag used under only one casing
  never appears in the result. `ArgumentLibraryPanel` now renders a
  "Possible duplicate tags" section driven by that helper, offering a
  one-click "Merge … into …" button per variant that runs the same
  `renameTagAcrossCombinedPersistedStores` call the manual form already
  used (rewriting the tag across both the evidence-library repository and
  the Contributions Feed store), and the section is hidden entirely when
  no case-variant tags exist. This closes only the discoverability half of
  the Known gap — matching everywhere else tags are compared (autocomplete
  ranking, `buildTagCollections` grouping, `filterCardsByTags`) is still
  exact-string, and a tag typed directly into a submission form still
  coins a new casing instead of being normalized to an existing one; both
  remain open, noted in `docs/features/evidence-library.md`'s Known gaps.
  Vitest-covered in
  `packages/debate-card-search/test/argument-library.test.ts`
  (`findTagCaseVariantGroups`: grouping case variants, most-used-first
  ordering, an alphabetical card-count tie-break, excluding tags with only
  one casing, multiple groups each sorted by their own merge target, and
  an empty input). Docs updated at `docs/features/evidence-library.md`
  (new "Duplicate-tag merge suggestions" section, plus the Known gaps
  entry above). Verified from a clean install: `bun install` (2050
  packages), `bun run test` (163 files / 2372 tests, all pass), `bun run
  typecheck` (11 of 12 in-scope packages have a typecheck script; all
  pass), and `bun run build:web` (`debate-ai-web`, succeeds,
  `/cards/argument-library` route present, no new route) all pass. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run, matching every prior PR's verification notes.
- **On Page Card Reuse Search — server-backed reuse index + browser extension.**
  Closes the last open follow-up (a) under idea #7 ("On Page Card Reuse
  Search") in TODO.md's Product Feature Ideas list — "an actual browser
  extension that calls this same check automatically against the current
  tab's URL." The previously-completed first slice's check
  (`checkPersistedPageForExistingCards`) only ever saw entries saved to one
  browser's own `localStorage`, so it couldn't answer "has anyone on the
  team cut this" across devices — this slice adds a small, dedicated
  server-backed reuse index rather than a full server mirror of
  `EvidenceLibraryEntry`. `apps/debate-ai.com`'s `lib/database/schema.ts`
  adds an `evidenceReuseIndex` D1 table (`id`/`sourceUrl`/`normalizedUrl`/
  `cite`/`argBlock`/`topic`/`contributorId`, upserted by `id`), generated via
  `drizzle-kit generate` into `drizzle/0003_superb_onslaught.sql`. A new
  `app/api/evidence-reuse-check/route.ts` exposes `GET ?url=` (whether that
  URL has already been cut, plus matches) and
  `POST { id, sourceUrl, cite, argBlock, topic, contributorId }` (registers a
  cut card's source URL), mirroring `app/api/flow-sync/route.ts`'s
  D1-backed API-route conventions. `debate-card-search` adds
  `lib/evidence-reuse-check-client.ts`'s `checkRemotePageForExistingCards`/
  `registerRemoteReuseEntry`, wired into `EvidenceLibraryPanel`'s "Check this
  page" box (a new "Team-wide check" section alongside the existing local
  check, degrading gracefully on a network failure) and its submission form
  (best-effort registers a submitted `sourceUrl` into the shared index). A
  new dependency-free Manifest V3 browser extension,
  `apps/browser-extension` (not part of this repo's `bun`/`turbo`
  workspaces — no build step), calls the same `GET` route against the active
  tab's URL from its popup, with an Options page for a non-production API
  base URL. No follow-ups remain open on this idea. Vitest-covered in
  `packages/debate-card-search/test/evidence-reuse-check-client.test.ts`
  (`checkRemotePageForExistingCards`, `registerRemoteReuseEntry`, including
  endpoint-override and error-message cases). Verified with `bun install`
  (2050 packages), `bun run test` (153 files / 2103 tests, all pass),
  `bun run typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script), and `bun run build:web` (registers the new
  `/api/evidence-reuse-check` route). Docs updated at
  `docs/features/evidence-library.md` and `apps/browser-extension/README.md`.
  No repo-wide `lint` script exists so none was run.
  PR: not yet opened (see repo push instructions for this session).
- **On Page Card Reuse Search — browser extension + deep-link wiring.**
  Closes follow-up (a) under idea #7 ("On Page Card Reuse Search") in the
  Product Feature Ideas list — "an actual browser extension that calls this
  same check automatically against the current tab's URL." The evidence
  repository is persisted in `debate-ai.com`'s own browser localStorage, a
  different origin an extension can't read directly, and this repo has no
  server-side API for the evidence library, so the extension deep-links
  into the app instead of reimplementing the check against data it has no
  access to. `debate-card-search`'s `lib/shared-evidence-library.ts` gained
  `buildReuseCheckDeepLink(appOrigin, pageUrl)`, and `EvidenceLibraryPanel`
  now reads an optional `?checkUrl=` query param (via `next/navigation`'s
  `useSearchParams`, added as a new peer/dev dependency on this package) on
  mount, pre-filling and auto-running the existing "Check this page" box
  when present. A new unpacked (not store-published) Manifest V3 browser
  extension, `extension/card-reuse-checker` (outside every workspace glob,
  so it doesn't participate in `bun install`/typecheck/build), reads the
  active tab's URL on toolbar-icon click and opens that deep link in a new
  tab; its `deep-link.js` keeps a manually-synced plain-JS mirror of
  `buildReuseCheckDeepLink` since it has no bundler to import the TS
  package directly. An Options page lets a user override the default
  `https://debate-ai.com` origin for a self-hosted/local-dev deployment.
  Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts`
  (`buildReuseCheckDeepLink`: origin/page-URL trimming, trailing-slash
  stripping, and percent-encoding of special characters). The extension
  itself has no automated tests — Chrome-extension-API code isn't
  exercisable in this repo's Vitest/jsdom setup; this gap is recorded in
  the extension's own README. Docs added at
  `docs/features/on-page-card-reuse-search.md` and
  `extension/card-reuse-checker/README.md`, and
  `docs/features/evidence-library.md`'s "Known gaps" updated to point at
  them instead of saying no extension exists. No follow-ups remain open on
  this idea. Verified from a clean install: `bun install`, `bun run test`
  (154 files / 2145 tests, all pass), `bun run typecheck` (11 of 12
  in-scope packages have a typecheck script; all pass), and
  `bun run build:web` (`debate-ai-web`, succeeds, `/cards/library` route
  present) all pass. No repo-wide `lint` script exists, so none was run.
- **Outline Filters and Argument Tree View — "Generate from current round" trigger.**
  Closes the "Nothing in the live round-flowing page (`DebateFlowPage`/
  `FlowMainContent`) calls `buildAndSaveArgumentTree` yet" gap previously
  recorded in `docs/features/argument-tree-outline.md`'s Known gaps (idea #10,
  "Outline Filters and Argument Tree View," already had no lettered
  follow-ups open in `TODO.md`'s Product Feature Ideas list — this closes a
  documented UI gap on that idea rather than a numbered follow-up). Every
  other derived-data panel this repo has already shipped either composes its
  data entirely from other persisted stores (no live `Flow` needed) or, like
  `FlowSummariesPanel`, exposes a manual generation form of its own; this
  panel and a few siblings (`CoachingSessionsPanel`, `DrillSetsPanel`, the
  `/outcomes` vulnerability-report panel) had no such affordance at all — a
  record only ever appeared once some other test or caller invoked its
  `buildAndSave*` function directly. `state/argumentTrees.ts` adds
  `buildAndSaveArgumentTreeFromCurrentFlow(flow)`, a thin, independently
  Vitest-covered wrapper over the existing `buildAndSaveArgumentTree` that
  keys the saved record by the flow's own `id` (stringified) rather than a
  separately-tracked `Round` entity — mirroring
  `state/roundContributorFlows.ts`'s `buildAndSaveRoundContributorFlow`
  convention, the one other place in this package that already reads the
  live round-flowing page's `state/store.ts` `useFlowStore` directly (from
  `CoachingProgramsPanel`'s "Save current flow" action). `ArgumentTreePanel`
  (`/outline`) reads that same store for the currently selected flow and
  gets a "Generate from current round" button — shown both above the outline
  list and in the empty state, disabled until a flow is selected — that
  calls the new helper and refreshes the panel. No live-flow-derivation
  trigger was added to `DebateFlowPage`/`FlowMainContent` itself: every
  derived-data panel in this package is deliberately self-contained (reading
  `useFlowStore` from the panel, not from the round-flowing page), matching
  the one existing precedent rather than introducing a new "Tools" surface
  on the core flow page. Vitest-covered in
  `packages/debate-round/test/argumentTrees.test.ts` (keys the saved record
  by the flow's `id`; persists an empty tree without throwing for a flow
  with no rows). Verified with `bun install` (2050 packages), `bun run test`
  (154 files / 2132 tests, all pass), `bun run typecheck` (11 in-scope
  packages pass — `debate-ai-web` has no `typecheck` script), and
  `bun run build:web` (`debate-ai-web` succeeds, `/outline` route present).
  Docs updated at `docs/features/argument-tree-outline.md`. Follow-up:
  `CoachingSessionsPanel` (`/coaching`), `DrillSetsPanel` (`/drills`), and
  the vulnerability-report panel (`/outcomes`) have the identical
  "no affordance to generate a new record for a round" gap recorded in their
  own docs (`coaching-sessions.md`, `drill-sets.md`,
  `response-outcome-charts.md`) — unlike this one, those three also need a
  `sideKey` picker (or a "generate for every side present in the flow" loop)
  since their persistence records are keyed by `roundId` + `sideKey`, not
  `roundId` alone. Not started.
  PR: [#257](https://github.com/debate/debate-ai.com/pull/257).
- **Shared Evidence Library — cache the search index across calls.**
  Closes the last open follow-up named under the "📋 Shared Evidence
  Library" bullet in TODO.md's Research Crowdsourcing Organizer Features
  list ("caching the index across calls instead of rebuilding it on every
  search remains open — not started; this store still has no write-time
  hook to invalidate a cache"), and the matching "Known gaps" entry in
  `docs/features/evidence-library.md`. `state/evidenceLibraryEntries.ts`'s
  `searchPersistedEvidenceLibraryWithIndex` now reuses a cached
  `EvidenceSearchIndex` across calls instead of rebuilding it from scratch
  on every search, via a new `state/evidenceSearchIndexCache.ts` module
  (split out on its own so `evidenceLibraryEntries.ts` and `peerReviews.ts`
  can both invalidate the shared cache without a circular import between
  them). The cache is invalidated by `saveEvidenceLibraryEntry`/
  `deleteEvidenceLibraryEntry` (this store's own writes) and by
  `peerReviews.ts`'s `savePeerReview`/`deletePeerReview` (since a
  review-status change can move an entry into or out of this store's "live"
  gating, which the cached index is built from) — a cache-and-rebuild
  strategy, not true incremental indexing. Vitest-covered in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts` with a
  new "index cache" suite asserting the cached index is reused by reference
  across repeated searches with no intervening write, and rebuilt (a new
  object) after each of the three invalidating write paths; the existing
  test file's `beforeEach` now also resets the module-level cache between
  tests. PR: [#259](https://github.com/debate/debate-ai.com/pull/259) — landed
  after master had already grown a more complete version of this same cache:
  it fingerprints both stores' raw persisted JSON (so any write path
  invalidates, not just calls through the two stores' own functions) and
  applies `evidence-search-index.ts`'s incremental add/remove/update instead
  of a full rebuild. The merge therefore kept master's implementation and
  dropped this branch's `state/evidenceSearchIndexCache.ts` module and its
  explicit `invalidateEvidenceSearchIndexCache` hooks in `peerReviews.ts`;
  master's own tests already cover each behaviour this branch's tests
  asserted.
- **Shared Evidence Library — tag-autocomplete on the Contributions Feed's
  Tags field.**
  Found via this run's own audit of `docs/features/*.md` "Known gaps"
  sections (this repo has no `IDEAS.md`; the "Product Feature Ideas"/
  "Research Crowdsourcing Organizer Features" sections of this tracker are
  the backlog): `docs/features/evidence-library.md` said "A Contributions
  Feed submission tagged for the Argument Library gets no tag-autocomplete
  affordance of its own (that only exists on the dedicated `/cards/library`
  form's Tags field) — it's a plain comma-separated text input."
  `debate-card-search`'s `state/evidenceLibraryEntries.ts` gained
  `listCombinedPersistedTags()`, which merges the existing
  `listPersistedTags()` evidence-library corpus with every tag already used
  across `state/contributions.ts`'s persisted Contributions Feed submissions
  (via `listContributions`), including a contribution tagged without a
  `topic`/`caseArea`. `ContributionsFeedPanel.tsx`'s Tags field now wires
  `lib/argument-library.ts`'s existing `parseTagsInput`/`suggestTags`/
  `applyTagSuggestion` against that combined corpus — the same
  suggestion-button affordance `EvidenceLibraryPanel.tsx`'s Tags field
  already had, refreshed on mount and after each submission. Vitest-covered
  in `packages/debate-card-search/test/evidenceLibraryEntries.test.ts` (new
  `listCombinedPersistedTags` describe block: empty-store case, merged/
  deduped/sorted tags across both stores, a tagged-but-untopiced
  contribution still contributing tags, and a contribution with no `tags`
  field being ignored). Verified with `bun x vitest run` (162 files, 2328
  tests), `bunx turbo typecheck --filter=debate-card-search
  --filter=debate-ai-web`, and `bunx turbo build --filter=debate-ai-web`; no
  `lint` script is configured in this repo.
  **PR:** [#287](https://github.com/debate/debate-ai.com/pull/287) — landed
  after [#289](https://github.com/debate/debate-ai.com/pull/289), which had
  independently implemented the same `listCombinedPersistedTags` corpus and
  Contributions Feed suggestion row (plus the cross-store tag rename). The
  merge therefore kept #289's implementation and folded in only this branch's
  one additional case — a contribution with no `tags` field at all.
- **Daily Best Card Challenge — cross-tab live update.**
  Found via this run's own audit of `docs/features/*.md` "Known gaps"
  sections (this repo has no `IDEAS.md`; the "Product Feature Ideas"/
  "Research Crowdsourcing Organizer Features" sections of this tracker are
  the backlog): `docs/features/daily-best-card.md` said "No real-time
  updates across browser tabs/sessions — like every other localStorage-backed
  panel in this repo, the panel reflects a snapshot as of its last load or
  action." `debate-card-search` gained `state/live-update.ts`'s
  `isDailyBestCardLiveUpdateStorageEvent`, mirroring `debate-round`'s
  existing `flow/live-update.ts#isFlowLiveUpdateStorageEvent` fix for the
  identical class of gap on `FlowSpreadsheet`'s badges: it recognizes a
  cross-tab browser `storage` event (which never fires in the tab that made
  the write, only other same-origin tabs) touching the `contributions`/
  `dailyBestCardAnnouncements` keys, or a `null` key from
  `localStorage.clear()`. `DailyBestCardPanel` now listens for that event
  and calls its existing `refresh()`, so a card submitted or a winner
  announced in another tab now shows up without a manual reload. The doc's
  Known gaps section was updated to close this bullet (matching the existing
  strikethrough convention used in `flow-annotations.md`). Vitest-covered in
  `packages/debate-card-search/test/live-update.test.ts` (matching keys, the
  `null`-key clear case, an unrelated key, and a key that merely contains a
  tracked store name as a substring). Verified with `bun x vitest run` (163
  files, 2328 tests), `bunx turbo typecheck --filter=debate-card-search`, and
  `bunx turbo build --filter=debate-ai-web`; no `lint` script is configured
  in this repo.
  **PR:** [#288](https://github.com/debate/debate-ai.com/pull/288).
- **AI Practice Opponent — custom opponent-persona authoring flow.**
  Found via this run's own audit of `docs/features/*.md` "Known gaps"
  sections (this repo has no `IDEAS.md`; the "Product Feature Ideas"/
  "Research Crowdsourcing Organizer Features" sections of this tracker are
  the backlog): `docs/features/practice-opponent.md` said "Only the four
  built-in personas are selectable; there is no custom opponent-persona
  authoring flow (unlike the Judge Paradigm Picker's custom paradigm
  option)." `debate-speech-writer`'s `opponent/opponent-personas.ts` gained
  `OpponentPersonaId` (`BuiltinOpponentPersonaId | "custom"`, replacing
  `OpponentPersona.id`'s previously builtin-only type),
  `CustomOpponentPersonaInput`, and `buildCustomOpponentPersona` — a direct
  mirror of `judge/judge-paradigms.ts`'s `buildCustomJudgeParadigm`: it
  sanitizes/trims/clamps a user-supplied name and free-text style
  description, throws on either being empty after sanitization, and carries
  the notes verbatim into `instructions` for a future AI speech-generation
  prompt. `panels/OpponentPersonaPickerPanel.tsx` gained a "Custom opponent
  persona" radio option with persona-name and debating-style fields,
  mirroring `JudgeParadigmPickerPanel.tsx`'s custom-paradigm form; saving
  builds the persona via `buildCustomOpponentPersona` and stores it through
  the already-persisted `saveOpponentPersonaSelection` unchanged (it already
  stores a full `OpponentPersona`, not just a builtin id), and
  `practice-round-simulator.ts`'s `resolveOpponentPersona` needed no changes
  since it already accepts a full `OpponentPersona | BuiltinOpponentPersonaId`
  union. Both new symbols are re-exported from `debate-speech-writer`'s
  `index.ts`. `docs/features/practice-opponent.md` was updated (intro,
  "What it shows", data-flow section, and a new closing paragraph) to
  describe the new form and close this Known gap. Vitest-covered in
  `packages/debate-speech-writer/test/opponent-personas.test.ts` (new
  `describe("buildCustomOpponentPersona")` block: builds from name/notes,
  trims whitespace and strips control characters, clamps overly long notes,
  throws on empty name, throws on empty notes, and produces a prompt via the
  existing `buildOpponentPersonaPrompt`). Verified with `bun run test`
  (162 files, 2330 tests, up from 2324), `bun run typecheck` (11 packages),
  and `bun run build:web` (production build); no `lint` script is configured
  in this repo. **PR:** [#286](https://github.com/debate/debate-ai.com/pull/286)
  — all checks pass (Vitest + coverage, codecov, Vercel, `Workers Builds:
  debate-ai-com`) except a newly-appeared `Workers Builds:
  debate-ai-production` check, which fails identically on both this PR's
  commits (including a docs-only commit) and doesn't appear at all on the
  two prior merged PRs (#284, #285); documented on the PR as an unrelated
  Cloudflare dashboard config issue, not a code problem, mirroring the
  unrelated Vercel rate-limit note on PR #217 earlier in this tracker.
  **Completed:** 2026-08-24.
- **Common Argument Library — tag autocomplete on the Contributions Feed,
  and tag rename/merge across both persisted tag stores.**
  Found via this run's own audit of `docs/features/*.md` "Known gaps"
  sections (this repo has no `IDEAS.md`; the "Product Feature Ideas"/
  "Research Crowdsourcing Organizer Features" sections of this tracker are
  the backlog): `docs/features/evidence-library.md` recorded two open gaps —
  "A Contributions Feed submission tagged for the Argument Library gets no
  tag-autocomplete affordance of its own (that only exists on the dedicated
  `/cards/library` form's Tags field)" and "A tag rename/merge tool now
  exists … but it only rewrites this evidence-library repository's own
  entries — a Contributions Feed submission's tags are a separate
  store/form and aren't rewritten by it." Both matter because
  `ArgumentLibraryPanel` (`/cards/argument-library`) already composes *two*
  persisted stores into one library via
  `buildCombinedPersistedArgumentLibrary`, so a tag listed there can come
  from either one. `state/contributions.ts` gained `listContributionTags()`
  (every distinct tag on a persisted contribution, deduped and sorted) and
  `renameTagAcrossPersistedContributions(oldTag, newTag)` (reusing
  `argument-library.ts`'s pure `renameTagInList` per contribution, with the
  same write-back-only-when-changed behavior and the same
  blank/identical-tag validation as the evidence-library side);
  `state/evidenceLibraryEntries.ts` gained `listCombinedPersistedTags()`
  (the union of both stores' tags) and
  `renameTagAcrossCombinedPersistedStores(oldTag, newTag)` (returning
  `{ entriesChanged, contributionsChanged, totalChanged }`, validating
  before either store is written). `ContributionsFeedPanel.tsx`'s Tags
  field now carries the same suggestion row `EvidenceLibraryPanel` already
  had, driven by the same `parseTagsInput`/`suggestTags`/
  `applyTagSuggestion` helpers over the combined corpus, and
  `ArgumentLibraryPanel.tsx`'s "Rename/merge tag" form now calls the
  combined rename and reports each store's count.
  `docs/features/evidence-library.md` was updated: "Tag rename/merge"
  rewritten, a new "Tag autocomplete on the Contributions Feed" section
  added, and both Known gaps closed (replaced by the remaining
  exact-string tag-identity note — `warming` and `Warming` stay two
  different tags). Vitest-covered in
  `packages/debate-card-search/test/contributions.test.ts` (new
  `listContributionTags`/`renameTagAcrossPersistedContributions` describe
  blocks: empty store, contributions with no tags, deduped sorted list,
  rewrite-and-persist, merge-dedup, a true no-write no-op, and throwing on
  a blank or identical tag pair) and
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts` (new
  `listCombinedPersistedTags`/`renameTagAcrossCombinedPersistedStores`
  describe blocks: empty stores, the deduped union, a contribution
  excluded from the library still contributing its tags, both stores
  rewritten with per-store counts, one store changed while the other
  carries nothing, a both-stores no-op, and a throw leaving both stores
  untouched). Verified with `bun x vitest run` (162 files, 2338 tests),
  `bunx turbo typecheck --filter=debate-card-search`, and `bunx turbo build
  --filter=debate-ai-web`; no `lint` script is configured in this repo.
  **PR:** [#289](https://github.com/debate/debate-ai.com/pull/289).
  **Completed:** 2026-08-24.

- **Judge Profiles and Opponent Team Profiles — "did you mean" suggestion
  and datalist autocomplete on the logged-rounds ID filter.**
  Found via this run's own audit of `docs/features/*.md` "Known gaps"
  sections (this repo has no `IDEAS.md`; the "Product Feature Ideas"/
  "Research Crowdsourcing Organizer Features" sections of this tracker are
  the backlog): both `docs/features/judge-profiles.md` and
  `docs/features/opponent-team-profiles.md` said "The logged-rounds filter
  is a free-text substring match on the judge id [team id], not a picker of
  the judges [teams] actually on record — a typo shows an empty list rather
  than suggesting the nearest judge [team]." `debate-speech-writer`'s
  `state/judgeRoundRecords.ts` gained `listJudgeIds()` (every distinct
  logged judge id, sorted alphabetically) and `findNearestJudgeId(query)` (a
  small case-insensitive Levenshtein edit-distance search over that list,
  returning `null` for a blank query or when nothing is logged yet);
  `debate-data-sync`'s `state/opponentRoundRecords.ts` gained the mirrored
  `listOpponentTeamIds()`/`findNearestOpponentTeamId(query)`, duplicated
  locally in each package the same way the two round-record stores already
  mirror each other's wrapped-record convention (there is no shared
  low-level package either depends on). `JudgeProfilesPanel.tsx`'s and
  `OpponentTeamProfilesPanel.tsx`'s "Filter by judge/team ID" `Input` now
  carries a `list` attribute pointing at a `<datalist>` of the ids actually
  on record, and the "No logged rounds match" empty state now shows a
  clickable "Did you mean `<id>`?" suggestion (from `findNearest…Id`) that
  refills the filter, shown only when a real suggestion exists. Both docs'
  Known gaps sections were updated to close this bullet and describe the new
  behavior. Vitest-covered in
  `packages/debate-speech-writer/test/judgeRoundRecords.test.ts` and
  `packages/debate-data-sync/test/opponentRoundRecords.test.ts` (new
  `listJudgeIds`/`listOpponentTeamIds` and
  `findNearestJudgeId`/`findNearestOpponentTeamId` describe blocks:
  alphabetical dedup, a typo resolving to the right id, and the
  blank-query/no-data `null` cases). Verified with `bun x vitest run` (162
  files, 2324 tests), `bunx turbo typecheck --filter=debate-speech-writer
  --filter=debate-round --filter=debate-data-sync`, and `bunx turbo build
  --filter=debate-ai-web`; no `lint` script is configured in this repo.
  **PR:** [#285](https://github.com/debate/debate-ai.com/pull/285).
  **Completed:** 2026-08-20.

- **Outline Filters and Argument Tree View — auto-sync the argument tree
  as a round is flowed, not just on a manual "Generate outline" click.**
  Found via this run's own audit of `docs/features/*.md` "Known gaps"
  sections (this repo has no `IDEAS.md`; the "Product Feature Ideas"/
  "Research Crowdsourcing Organizer Features" sections of this tracker are
  the backlog): `docs/features/argument-tree-outline.md` said
  `ArgumentTreePanel.tsx`'s "Generate outline for current round" action was
  still a manual trigger — "the live round-flowing page
  (`DebateFlowPage`/`FlowMainContent`) still doesn't call
  `buildAndSaveArgumentTree` automatically as a round is flowed" — left open
  by PR #277. `state/argumentTrees.ts` gained
  `buildAndSaveArgumentTreeIfChanged(flow, roundId)`, which derives the tree
  the same way `buildAndSaveArgumentTree` does but skips the localStorage
  write (returning `undefined`) when the result is structurally identical to
  what's already stored for that round, so a periodic auto-sync tick doesn't
  thrash storage when nothing actually changed. `hooks/useFlowEffects.ts`
  gained `useArgumentTreeAutoSync(flows, selected)` — a 1.5s-debounced
  effect on the selected flow, mirroring the debounce convention already
  used by `debate-card-search`'s `useSearchState.ts` — wired into
  `DebateFlowPage` (`panels/DebateRoundPanel.tsx`) alongside its existing
  `useFlowPersistence` effect. The manual "Generate outline for current
  round" button in `ArgumentTreePanel.tsx` is unchanged. No follow-ups
  remain open on this Known gap. Vitest-covered in
  `packages/debate-round/test/argumentTrees.test.ts` (saving on a first
  sync, skipping the write and returning `undefined` when the derived tree
  is unchanged, and saving+returning the new record on a real change).
  Verified with `bun x vitest run` (162 files, 2314 tests),
  `bunx turbo typecheck --filter=debate-round`, and
  `bunx turbo build --filter=debate-ai-web`; no `lint` script is configured
  in this repo. **PR:** [#284](https://github.com/debate/debate-ai.com/pull/284).
  **Completed:** 2026-08-20.

- **Outline Filters and Argument Tree View — neighbour preview + bulk
  "tag every row in this section" action.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used; this repo has no `IDEAS.md`, so the
  "Product Feature Ideas"/"Research Crowdsourcing Organizer Features"
  sections below are the backlog): `docs/features/argument-tree-outline.md`
  said "A row's tags aren't shown in the `ArgumentTagPopover` for the row's
  neighbours, and there is no bulk 'tag every row in this section' action,"
  the last two open Known gaps for idea #10 ("Outline Filters and Argument
  Tree View") that didn't require new infrastructure (auth, transcription,
  or a scheduled-job runner) this repo doesn't have. `debate-round`'s
  `flow/argument-tagging.ts` gained `getSectionRowIndexes(flow, rowIndex)`
  (every content-row index in the same heading-bounded "section" as
  `rowIndex`, derived positionally from `Box.isHeading` the same way
  `dataTransform.ts`'s `parentHeadingId` and `argument-tree.ts`'s
  `buildArgumentTree` heading-nesting already do — no new `Box` field was
  needed), `getSectionRowPreviews(flow, rowIndex)` (those neighbours' own
  content + current tags, for display), and `setRowsArgumentTags(flow,
  rowIndexes, tags)` (a bulk form of the existing `setRowArgumentTags`,
  which now delegates to it). `flow/ArgumentTagPopover.tsx` gained an
  optional `sectionRows` prop rendering each neighbour's content and tag
  label plus an "Also tag these N rows…" checkbox, and its `onSave`
  signature grew a second `applyToSection` argument. `flow/FlowSpreadsheet.tsx`'s
  `handleSaveArgumentTags` now applies the chosen tags to
  `getSectionRowIndexes(flow, rowIndex)` instead of just `rowIndex` when
  that checkbox is checked. No follow-ups remain open on this Known gap.
  Vitest-covered in `packages/debate-round/test/argument-tagging.test.ts`
  (section boundaries around single/multiple headings, a heading-row
  target, leading rows before any heading, an out-of-range row, the bulk
  apply's duplicate/out-of-range-index handling and its all-invalid no-op,
  and the section-preview label truncation) and
  `packages/debate-round/test/ArgumentTagPopover.test.tsx` (the neighbour
  list and checkbox render when `sectionRows` is non-empty, and neither
  renders when it's empty). Verified: `bun run vitest run` (2311 tests,
  all packages), `bun run typecheck` (11 packages), `bun run build:web`
  (production build). [PR #283](https://github.com/debate/debate-ai.com/pull/283).

- **Outline Filters and Argument Tree View — tag an argument's
  type/contributor/evidence status from the live flow grid.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used; this repo has no `IDEAS.md`, so the
  "Product Feature Ideas"/"Research Crowdsourcing Organizer Features"
  sections below are the backlog):
  `docs/features/argument-tree-outline.md` said "Nothing in the live
  flow-editing UI (`FlowSpreadsheet` or elsewhere) lets a user actually set
  a `Box`'s `argumentType`/`authorId`/`evidenceStatus` yet — these fields
  exist in the schema and are read/filtered/rendered end-to-end here, but
  populating them today requires setting them directly on a `Box`," which
  left the Argument Tree Outline panel's three newest filters with nothing
  to filter on.
  A new `packages/debate-round/src/flow/argument-tagging.ts` holds the pure
  helpers — `getRowArgumentTags`, `setRowArgumentTags` (returns a new `Flow`
  with the row's root box replaced, mirroring `applyMergedEditsToFlow`; a
  tag left `undefined` or a whitespace-only `authorId` is *cleared*, and an
  out-of-range row index is a no-op returning the flow unchanged),
  `formatArgumentTags`, and `listAuthorIdsInFlow`. Tagging is deliberately
  row-level rather than per-cell: `flow-transcript-summary.ts`'s
  `summarizeFlowRow` already reads all three fields off a row's *root* box,
  so that is what `buildArgumentTree`/`filterArgumentTree` and the panel
  see.
  `flow/ArgumentTagPopover.tsx` is the overlay (argument-type select,
  evidence-status select, and a `datalist`-backed contributor field
  suggesting ids already used in the same flow), opened from a new **Tag
  Argument…** entry in `FlowSpreadsheet`'s row context menu — labelled with
  the row's current tags — and saved through the existing `onUpdate`
  callback, so tags live on the flow itself rather than in a new store.
  `FirstColumnCellRenderer.tsx` renders a row's tags as a compact
  `link · cited · alex` label beside the existing annotation/edit/prep-note
  badges. `dataTransform.ts`'s `buildRowData`/`rowDataToBoxes` now carry the
  three fields as well — without that, an ordinary cell edit (which rebuilds
  every `Box` from the grid's flat row data) silently dropped a row's tags.
  Vitest-covered (15 new cases:
  `packages/debate-round/test/argument-tagging.test.ts` covers reading a
  row's tags, setting all three without touching siblings, clearing a tag
  and a whitespace-only contributor, the out-of-range-row no-op, tags
  actually feeding `filterArgumentTree`, the `buildRowData` →
  `rowDataToBoxes` round trip tagged and untagged, label formatting, and the
  contributor roster; `packages/debate-round/test/ArgumentTagPopover.test.tsx`
  render-tests the overlay's options, seeding from existing tags, the
  contributor datalist, and viewport clamping).
  Documented in `docs/features/argument-tree-outline.md` (new "Tagging an
  argument from the flow grid" section with its own data-flow block; the
  closed gap replaced with the real remaining scope — tags are row-level
  rather than per-speech, nothing infers a tag, the contributor id is
  free-form rather than authenticated, and there is no bulk
  tag-a-whole-section action).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (161 files / 2300 tests, all pass), `bun run typecheck` (11 in-scope
  packages pass — `debate-ai-web` has no `typecheck` script; this repo has
  no `lint` script), and `bun run build:web` (production build) all pass.
  PR: [#281](https://github.com/debate/debate-ai.com/pull/281) (merged), with
  the popover render test and this tracker move following in a small
  follow-up PR.
- **Judge Profiles & Opponent Team Profiles — edit or delete an
  already-logged round from the app.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used; this repo has no `IDEAS.md`, so the
  "Product Feature Ideas"/"Research Crowdsourcing Organizer Features"
  sections below are the backlog). Two sibling gaps, both created by the
  logging forms the last two runs added:
  `docs/features/judge-profiles.md` said "No delete/edit affordance in the
  panel for an already-logged round — `deleteJudgeRoundRecord` … exists and
  is covered, but nothing in the UI calls it, so a mistyped ballot can only
  be corrected by logging further rounds," and
  `docs/features/opponent-team-profiles.md` said "A logged round can be
  deleted but not edited in place" plus "The logged-rounds list shows every
  team's rounds together, with no per-team filter."
  Both stores gain one new function —
  `packages/debate-speech-writer/src/state/judgeRoundRecords.ts`'s
  `updateJudgeRoundRecord` and
  `packages/debate-data-sync/src/state/opponentRoundRecords.ts`'s
  `updateOpponentRoundRecord` — which replaces one persisted record by `id`
  *in place* (keeping its position in the history) and then re-aggregates
  the affected judge/team through the existing
  `rebuildJudgeProfileFromRecords`/`rebuildOpponentTeamProfileFromRecords`.
  Reassigning a round to a different judge/team re-aggregates **both**, so
  the previous entity's derived profile is dropped rather than left
  zero-round when that was its last round; an unknown `id` is a no-op
  returning `null`. No new profile-scoring or scouting logic was
  introduced — every roster column stays a derived value, so there is still
  deliberately no direct aggregate editing.
  `JudgeProfilesPanel.tsx` gains the "Logged rounds" table its sibling
  panel already had, now with **Edit** and **Delete** actions, and
  `OpponentTeamProfilesPanel.tsx`'s existing table gains the matching
  **Edit**. On both panels the log form doubles as the edit form: Edit
  loads the round back into it ("Edit logged round", with **Save
  changes**/**Cancel**), saving routes to `update…` instead of `record…`,
  and deleting the round currently being edited cancels the edit. Both
  logged-rounds lists also gain a per-judge/per-team filter (a
  case-insensitive substring match on the id), closing the opponent panel's
  "no per-team filter" gap.
  Vitest-covered (10 new cases, 5 per store, in
  `packages/debate-speech-writer/test/judgeRoundRecords.test.ts` and
  `packages/debate-data-sync/test/opponentRoundRecords.test.ts`: in-place
  replacement preserving history order, the updated profile matching a
  direct `buildJudgeProfile`/`buildOpponentTeamProfile` over the corrected
  round, reassignment re-aggregating both entities, the previous entity's
  profile being deleted when the reassigned round was its last, and the
  unknown-id no-op).
  Documented in `docs/features/judge-profiles.md` and
  `docs/features/opponent-team-profiles.md` (new "Correcting a logged
  round" section in each, data-flow blocks extended with `update…`; the
  edit/delete-affordance and per-team-filter Known gaps closed and replaced
  with the real remaining scope — the filter is free-text rather than a
  picker of the ids actually on record, and an edit has no undo/history).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (160 files / 2285 tests, all pass — 10 new cases), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including `/judges` and `/opponents`) all
  pass.
  PR: [#280](https://github.com/debate/debate-ai.com/pull/280).
- **Opponent Team Profiles — "Log a scouted round" form, the in-app way to
  create an opponent scouting profile.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used; this repo has no `IDEAS.md`, so the
  "Product Feature Ideas"/"Research Crowdsourcing Organizer Features"
  sections below are the backlog):
  `docs/features/opponent-team-profiles.md`'s Known gaps said "No profile
  editing/creation UI here — this panel only renders existing persisted
  profiles," the exact counterpart of the judge-profiles gap closed last run
  in [#278](https://github.com/debate/debate-ai.com/pull/278), so an
  `OpponentTeamProfile` could only ever reach `/opponents` if something
  called `saveOpponentTeamProfile` programmatically. The blocker was that
  `state/opponentTeamProfiles.ts` persists only the *aggregate*, never the
  rounds behind it, so there was nothing for a form to append to. A new
  store, `packages/debate-data-sync/src/state/opponentRoundRecords.ts`,
  persists the raw `OpponentRoundRecord` history (each entry carrying its
  own `id`, since a team plays many rounds — mirroring
  `debate-speech-writer`'s `judgeRoundRecords.ts` and this package's own
  `tournamentResults.ts` wrapped-record convention), and re-derives the
  affected team's profile from its *full* history through the existing
  `buildOpponentTeamProfile`/`saveOpponentTeamProfile`:
  `recordOpponentRound` (append + re-aggregate),
  `rebuildOpponentTeamProfileFromRecords` (re-aggregate alone, deleting the
  derived profile rather than leaving a zero-round one when no rounds
  remain), and `deleteOpponentRoundRecord` (remove + re-aggregate). No new
  scouting logic was introduced — every roster column stays a derived value,
  so there is deliberately no direct aggregate editing. The store is scoped
  to *opposing* teams and stays separate from `debate-round`'s
  `state/ownRoundHistory.ts`, which persists the same record type from this
  team's own perspective for pre-round briefings.
  `OpponentTeamProfilesPanel.tsx` gains the "Log a scouted round" form (team
  id, tournament, date, division, side debated, a "they won this round"
  switch, optional comma-separated argument tags, optional case name, and an
  optional head-to-head opponent id) and now renders the form above the
  roster in the empty state too, instead of returning early — plus a "Logged
  rounds" table whose Delete action calls `deleteOpponentRoundRecord`, so
  the store's delete path has a real UI caller rather than repeating the
  judge panel's still-open "no delete affordance" gap.
  Vitest-covered (12 new cases in
  `packages/debate-data-sync/test/opponentRoundRecords.test.ts`: persist +
  derive, re-aggregation across rounds/tournaments/sides, argument-tag and
  case re-ranking, per-team isolation, rebuild matching a direct
  `buildOpponentTeamProfile`, profile deletion when no rounds remain,
  delete-and-re-aggregate, delete of the last round, unknown-id no-op,
  another team left untouched, and the corrupt-JSON / non-array storage
  degradations).
  Documented in `docs/features/opponent-team-profiles.md` (new "Logging a
  scouted round" section, rewritten data-flow block covering both stores;
  the editing/creation-UI Known gap closed and replaced with the real
  remaining scope — no in-place edit of a logged round, no per-team filter
  on the logged-rounds list, per-browser storage with no identity checks,
  and follow-up (a)'s still-open real round-history data source).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (160 files / 2275 tests, all pass — 12 new cases), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including `/opponents`) all pass.
  PR: [#279](https://github.com/debate/debate-ai.com/pull/279).
- **Judge Profiles — "Log a judged round" form, the in-app way to create a
  judge profile.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/judge-profiles.md`'s
  Known gaps said "No profile editing/creation UI here — this panel only
  renders existing persisted profiles," so a `JudgeProfile` could only ever
  reach `/judges` if something called `saveJudgeProfile` programmatically.
  The blocker was that `state/judgeProfiles.ts` persists only the
  *aggregate*, never the ballots behind it, so there was nothing for a form
  to append to. A new store,
  `packages/debate-speech-writer/src/state/judgeRoundRecords.ts`, persists
  the raw `JudgeRoundRecord` history (each entry carrying its own `id`,
  since a judge decides many rounds — mirroring `debate-data-sync`'s
  `tournamentResults.ts` wrapped-record convention that backs the Standings
  panel's own "record a result" form), and re-derives the affected judge's
  profile from their *full* history through the existing
  `buildJudgeProfile`/`saveJudgeProfile`: `recordJudgeRound` (append +
  re-aggregate), `rebuildJudgeProfileFromRecords` (re-aggregate alone,
  deleting the derived profile rather than leaving a zero-round one when no
  rounds remain), and `deleteJudgeRoundRecord` (remove + re-aggregate). No
  new profile-scoring logic was introduced — every roster column stays a
  derived value, so there is deliberately no direct aggregate editing.
  `JudgeProfilesPanel.tsx` gains the "Log a judged round" form (judge id,
  tournament, date, division, winning side, both sides' speaker points,
  optional pace wpm, optional tagged paradigm from the existing
  `judgeParadigms` catalog, and theory raised/won switches — where turning
  "raised" off clears and disables "won", so a round can't be logged as
  won-but-never-raised) and now renders the form above the roster in the
  empty state too, instead of returning early.
  Vitest-covered (10 new cases in
  `packages/debate-speech-writer/test/judgeRoundRecords.test.ts`: persist +
  derive, re-aggregation across rounds/tournaments/pace, per-judge
  isolation, rebuild matching a direct `buildJudgeProfile`, profile deletion
  when no rounds remain, delete-and-re-aggregate, delete of the last round,
  unknown-id no-op, and the corrupt-JSON / non-array storage degradations).
  Documented in `docs/features/judge-profiles.md` (new "Logging a judged
  round" section, rewritten data-flow block covering both stores; the
  editing/creation-UI Known gap closed and replaced with the real remaining
  scope — no in-UI delete/edit affordance for an already-logged round, and
  follow-up (a)'s still-open real ballot data source).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (159 files / 2263 tests, all pass — 10 new cases), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including `/judges`) all pass.
  PR: [#278](https://github.com/debate/debate-ai.com/pull/278).
- **Outline Filters and Argument Tree View — wire "generate outline for
  current round" trigger.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/argument-tree-outline.md`'s
  Known gaps said "nothing in the live round-flowing page calls
  `buildAndSaveArgumentTree` yet" — the derive-and-persist helper already
  existed (and was already Vitest-covered) but had no real caller anywhere
  in the app, so a round's outline at `/outline` only ever appeared if
  something computed and saved it programmatically. `ArgumentTreePanel.tsx`
  gains a "Generate outline for current round" action, reading the round
  workspace's currently selected flow via `state/store.ts`'s `useFlowStore`
  — the same mechanism `VulnerabilityChartsPanel`'s "Generate report for
  current round" action already uses — and calling the existing
  `buildAndSaveArgumentTree(flow, roundId)` to derive and persist that
  round's tree. No new tree-derivation or persistence logic was introduced;
  this composes the existing helper directly, so no new Vitest cases were
  needed beyond `buildAndSaveArgumentTree`'s existing coverage in
  `packages/debate-round/test/argumentTrees.test.ts`. Docs updated at
  `docs/features/argument-tree-outline.md` (new data-flow paragraph; Known
  gaps' "nothing... calls `buildAndSaveArgumentTree`" bullet replaced with
  the real remaining scope — the trigger is still manual, not automatic as
  a round is flowed). Verified from a clean install: `bun install` (2050
  packages), `bun run test` (158 files / 2253 tests, all pass — no new
  cases, matching the "no new logic introduced" scope), `bun run typecheck`
  (11 in-scope packages pass — `debate-ai-web` has no `typecheck` script;
  this repo has no `lint` script), and `bun run build:web` (production
  build, including `/outline`) all pass.
  PR: [#277](https://github.com/debate/debate-ai.com/pull/277).
- **Flow-in-Speech Flow Annotations / Shared, Ai-Generated Debate Flow —
  cross-tab live update for FlowSpreadsheet's annotation/edit/prep-note
  badges.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): both `docs/features/flow-annotations.md`
  and `docs/features/shared-flow-sync.md` documented the same gap — the
  `FlowSpreadsheet` grid's `AnnotationBadge`/`EditBadge` (and, incidentally,
  `PrepNoteBadge`) read straight from `localStorage` at cell-render time and
  never live-update if a *different browser tab* logs a new annotation,
  edit, or prep note while the grid is open; only the same-tab,
  logged-through-its-own-popover case (the prior "force-refresh FlowSpreadsheet
  EditBadge after logging via popover" run, PR #270) was fixed. This closes
  that cross-tab half: a new pure helper,
  `packages/debate-round/src/flow/live-update.ts`'s
  `isFlowLiveUpdateStorageEvent`, recognizes the browser's `storage`
  event — which the spec fires only in *other* same-origin tabs, never the
  tab that made the write — for the three badge-backing `localStorage` keys
  (`flowAnnotations`, `flowEdits`, `prepNotes`), plus the `null`-key
  `localStorage.clear()` case. `FlowSpreadsheet.tsx` now subscribes to that
  event and calls `gridRef.current.api.refreshCells({ force: true })` across
  the whole grid when it fires (a cross-tab event carries no row/column to
  target the way the existing same-tab refresh does). This is additive only:
  it doesn't change what any badge shows, only how promptly a *different*
  open tab picks up someone else's change; it still doesn't help a different
  device/browser see the edit (that's what the existing, separate Live Sync
  server transport is for).
  Vitest-covered (4 new cases in
  `packages/debate-round/test/live-update.test.ts`: every backing-store key
  recognized, the `null`-key clear-all case, an unrelated store's key
  ignored, and a key that merely contains a badge-store name as a substring
  also ignored).
  Documented in `docs/features/shared-flow-sync.md` (new "Cross-tab live
  update" data-flow section) and `docs/features/flow-annotations.md` (both
  files' "Known gaps" cross-tab bullets closed and cross-referenced to each
  other).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (158 files / 2253 tests, all pass — 4 new cases), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including `/debate`) all pass.
  PR: [#276](https://github.com/debate/debate-ai.com/pull/276).
- **Shared Evidence Library — tag rename/merge tool.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/evidence-library.md`'s
  Known gaps said there was "No tag rename/merge tool — the Tags field's
  autocomplete only suggests reusing an existing tag while typing; renaming
  or merging a tag already applied to existing entries would mean rewriting
  every entry that carries it, and isn't implemented." This adds exactly
  that: two new pure helpers in `packages/debate-card-search/src/lib/argument-library.ts`,
  `renameTagInList` (rewrites a single card's tag list, deduping if the
  target tag is already present) and `renameTagAcrossCards` (applies it
  across a `LibraryCard[]`, returning each unaffected card as the exact same
  object reference and throwing on a blank or identical old/new tag), plus a
  persisted `renameTagAcrossPersistedEntries` in
  `state/evidenceLibraryEntries.ts` that applies the rewrite to the real
  evidence repository and writes back only when something actually changed.
  `panels/ArgumentLibraryPanel.tsx` (`/cards/argument-library`, where the
  tag collections themselves are browsable) gets a new "Rename/merge tag"
  form: a dropdown of existing tags plus a new-name field, showing how many
  entries changed (or that nothing did) after each rename. Renaming into an
  already-used tag name merges the two rather than erroring or duplicating.
  This only rewrites the evidence-library repository's own entries — a
  Contributions Feed submission's tags are a separate store/form and are
  left untouched, as documented in the panel's own copy and in
  `docs/features/evidence-library.md`.
  Vitest-covered (8 new cases in
  `packages/debate-card-search/test/argument-library.test.ts`:
  `renameTagInList` for replace/unchanged-reference/dedupe-merge, and
  `renameTagAcrossCards` for a multi-card rename leaving an unrelated card
  untouched by reference, merging into an existing tag, a true no-op when
  the tag is unused anywhere, and throwing on a blank old tag, a blank new
  tag, and identical old/new tags; 4 new cases in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`:
  `renameTagAcrossPersistedEntries` for rewrite-and-persist, merge, a true
  no-write no-op verified against the raw `localStorage` string, and
  throwing on a blank new tag).
  Documented in `docs/features/evidence-library.md` (new "Tag rename/merge"
  data-flow section; Known gaps' "No tag rename/merge tool" bullet closed
  and replaced with the real remaining scope — Contributions Feed tags
  aren't covered).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (157 files / 2249 tests, all pass — 12 new cases), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including `/cards/argument-library`) all
  pass.
  PR: [#275](https://github.com/debate/debate-ai.com/pull/275).
- **Online Debate Versus AI — "Regenerate last AI speech" affordance.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/ai-versus-rounds.md`'s
  Known gaps said the AI speech-generation call had no retry/regenerate
  action if the generated speech was unsatisfactory — a user had to clear
  the whole round and start over, losing every already-delivered speech
  (the user's own included) along with it. This adds exactly the narrower
  "regenerate affordance" that gap bullet named, without touching any
  existing turn-order, validation, or persistence logic: two new pure
  helpers in `packages/debate-round/src/state/aiVersusRounds.ts`,
  `canRegenerateLastAiSpeech` (true only when a round's most recently
  submitted speech was the AI's) and `replaceLastAiSpeech` (returns a copy
  of the round record with that last speech's text swapped in place —
  keeping its slot name/speaker and every earlier speech, including any of
  the user's, untouched — throwing if the last speech wasn't the AI's).
  `panels/AiVersusRoundPanel.tsx` wires a new "Regenerate last AI speech"
  button that appears whenever `canRegenerateLastAiSpeech` is true
  (regardless of whose turn is next, including after the round is
  complete): it rebuilds the exact same `AiSpeechRequest` that
  `buildAiResponseRequest` produced when that speech was first generated
  (by passing `submittedCount - 1` and the speeches delivered before it,
  so the regeneration responds to the same context the original call did,
  carrying no memory of the text it's replacing), calls the existing
  `requestAiVersusSpeech`/`requestAiVersusSpeechWithPersona` client exactly
  as "Generate AI speech" does, and saves the result through
  `replaceLastAiSpeech`. The "Generate AI speech" and "Regenerate" buttons
  now disable each other while either request is in flight.
  Vitest-covered (6 new cases in
  `packages/debate-round/test/aiVersusRounds.test.ts`: `canRegenerateLastAiSpeech`
  for no submitted speeches, a user-authored last speech, and an
  AI-authored last speech; `replaceLastAiSpeech` for the text swap itself,
  non-mutation of the input record, throwing when the last speech isn't
  the AI's, and throwing when there are no submitted speeches yet).
  Documented in `docs/features/ai-versus-rounds.md` (new "Regenerating the
  last AI speech" data-flow section and "What it shows" paragraph; Known
  gaps' "no retry/regenerate action" bullet closed and replaced with the
  real remaining gap — only the most recently submitted speech can be
  regenerated, not an earlier one mid-round, since `submittedSpeeches` is a
  flat, append-only array with no per-slot identity beyond position).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (157 files / 2236 tests, all pass — 6 new cases), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including every existing route, `/versus-ai`
  among them) all pass.
  PR: [#274](https://github.com/debate/debate-ai.com/pull/274).
- **Prep Notes — note-creation UI directly on the live flow.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/prep-notes.md`'s
  Known gaps section said there was "no note-creation UI" — a `PrepNote`
  could only be created programmatically (e.g. in a test), never through
  the app itself; `PrepNotesPanel` only surfaced and updated existing
  notes. Rather than the "future flow-view affordance" that gap bullet
  speculated about, this adds exactly that affordance to the existing
  `FlowSpreadsheet` grid, mirroring the `EditBadge`/`EditReviewPopover`
  pattern already used for `FlowEdit`s: a new `flow/PrepNoteBadge.tsx`
  (always-visible per-cell badge, showing a note count once any exist)
  renders next to the existing annotation/edit badges in both
  `FirstColumnCellRenderer` and `AnnotationCellRenderer`; clicking it opens
  a new `flow/PrepNotePopover.tsx` (lists the box's existing notes, plus an
  "author id" + "text" form) positioned via `FlowSpreadsheet.tsx`'s new
  `handleOpenPrepNote`/`prepNoteBoxNotes`/`handlePrepNoteCreated`, which
  mirror the file's existing edit-review state exactly (including
  force-refreshing just the affected cell via `gridCellForBoxPath` after a
  note is created, so the badge's count updates immediately). Submitting
  the popover's form calls `strategy-sync-notes.ts`'s already-existing
  `createPrepNote` and `state/prepNotes.ts`'s already-existing
  `savePrepNote` directly — no new mutation logic, only a new
  `listPrepNotesForBox(flowId, boxPath)` query helper (wrapping
  `strategy-sync-notes.ts`'s existing `getNotesForBox`) added to
  `state/prepNotes.ts` to feed the badge/popover. A note created this way
  is the same persisted `PrepNote` store `PrepNotesPanel` already reads, so
  it immediately shows up there too, groupable/assignable/cycleable exactly
  like a note created any other way.
  Vitest-covered (6 new cases: 2 in
  `packages/debate-round/test/prepNotes.test.ts` for `listPrepNotesForBox`
  — filtering by exact flow+box path, and an empty-box case; 4 in the new
  `packages/debate-round/test/PrepNoteBadge.test.tsx`, mirroring
  `EditBadge.test.tsx` — the always-rendered zero-notes affordance, the
  badge's title listing every note oldest-first, singular vs. plural
  wording). `PrepNotePopover` itself has no dedicated test file, matching
  this repo's existing convention for `EditReviewPopover` (no test file
  either) — popover components here are verified via the production build
  only. Documented in `docs/features/prep-notes.md` (new "Create a note"
  section; Known gaps' "No note-creation UI" bullet closed and replaced
  with the real remaining gap — the popover's "Author ID" field is
  free-form/unauthenticated, same as every other id field in this
  auth-less repo). Verified from a clean install: `bun install` (2050
  packages), `bun run test` (157 files / 2229 tests, all pass — 6 new
  cases), `bun run typecheck` (11 in-scope packages pass — `debate-ai-web`
  has no `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including every existing route, `/debate`
  and `/prep-notes` among them) all pass.
  PR: [#273](https://github.com/debate/debate-ai.com/pull/273).
- **Prep Notes — "jump to argument" link back to a note's flow box.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/prep-notes.md`'s
  Known gaps section said `PrepNotesPanel` had no "jump to argument" link
  back to the flow box a note is about, since that panel is cross-flow and
  doesn't mount a live `Flow` for `resolvePrepNoteBox` to resolve against.
  Rather than mounting a `Flow` into the cross-flow panel, the link instead
  hands off to `/debate`, which already owns one. Added
  `flow/strategy-sync-notes.ts`'s `buildPrepNoteJumpHref`/
  `parsePrepNoteJumpParams` (a `/debate?flowId=&boxPath=` deep link and its
  tolerant inverse — returns `null` rather than throwing on a
  missing/malformed param) and `flow/edit-cells.ts`'s `jumpToBoxInGrid`
  (scrolls to and flashes a box's AG Grid cell via the existing
  `gridCellForBoxPath`, returning `false` as a no-op if the row isn't in
  the grid's current row model yet). A new
  `hooks/useJumpToPrepNoteBox.ts`, mounted by `DebateFlowPage` alongside
  the existing `useRoundFromSlug`/`useSyncUrlWithRound` URL-sync hooks,
  reads the deep link's `flowId`/`boxPath`, selects the matching flow tab
  by id (`flows.findIndex`, not the store's array-index `selected`), and
  retries `jumpToBoxInGrid` both immediately (grid already mounted) and via
  a new `onFlowGridReady` callback threaded through `FlowMainContent` (for
  a flow whose grid hasn't mounted yet). `PrepNotesPanel.tsx` renders a
  "Jump to argument" link per note using `buildPrepNoteJumpHref`.
  Vitest-covered (10 new cases: 8 in
  `packages/debate-round/test/strategy-sync-notes.test.ts` for
  `buildPrepNoteJumpHref`/`parsePrepNoteJumpParams` — round-tripping,
  single-segment paths, and missing/non-numeric/negative-segment
  malformed-param cases each returning `null`; 2 in
  `packages/debate-round/test/edit-cells.test.ts` for `jumpToBoxInGrid`
  against a fake grid API — a successful scroll+flash, and the no-op
  `false` case when the row isn't found). Documented in
  `docs/features/prep-notes.md` (new "Jump to argument" section; Known
  gaps' "No 'jump to argument' link" bullet closed and replaced with the
  real remaining gap — a stale `boxPath` silently no-ops rather than
  erroring). Verified from a clean install: `bun install` (2050 packages),
  `bun run test` (156 files / 2224 tests, all pass — 10 new cases), `bun
  run typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including every existing route,
  `/prep-notes` and `/debate` among them) all pass.
  PR: [#272](https://github.com/debate/debate-ai.com/pull/272).
- **Shared Evidence Library — true incremental search-index updates instead
  of a full rebuild on every cache invalidation.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/evidence-library.md`'s
  Known gaps section said `state/evidenceLibraryEntries.ts`'s cached
  `EvidenceSearchIndex` still fell back to a full
  `buildEvidenceSearchIndex` re-tokenize-everything pass over every live
  entry whenever its cache-invalidation fingerprint changed, even when a
  write only actually touched one entry. Added
  `lib/evidence-search-index.ts`'s `addEntryToIndex`/`removeEntryFromIndex`/
  `updateEntryInIndex`, each mutating an `EvidenceSearchIndex` in place and
  touching only the postings lists the affected entry itself contributes to
  (tracked per-entry via a new `entryTermsById` map on the index, so
  `removeEntryFromIndex` never has to scan the full vocabulary) —
  `buildEvidenceSearchIndex` itself is now just `addEntryToIndex` called
  once per entry into an empty index. `getCachedEvidenceSearchIndex` now
  diffs the live-entry set its cached index was last built/updated from
  (`cachedLiveEntriesById`, keyed by id) against the current one and applies
  the incremental functions only for entries actually added, removed, or
  changed (by content, not just presence) — an unrelated write (e.g. a
  different entry's peer-review transition) leaves every other entry's
  postings untouched, and `buildEvidenceSearchIndex` is now only ever called
  for the very first build. Vitest-covered (7 new cases in
  `packages/debate-card-search/test/evidence-search-index.test.ts`:
  add/replace without duplicating postings, remove drops only the removed
  entry's own terms while leaving a shared term's other postings intact,
  removing a term's last entry drops it from the postings map entirely,
  removing an unindexed id is a no-op, update drops stale terms and adds new
  ones, and an index built purely via repeated `addEntryToIndex` calls
  matches one built directly; 4 existing cache tests in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts` rewritten
  to assert `buildEvidenceSearchIndex` is *not* called again on a
  save/delete/peer-review-transition/edit while the matching incremental
  function *is*, alongside the existing result-correctness assertions).
  Documented in `docs/features/evidence-library.md` (new "Incremental
  indexing" section; Known gaps' entry for this closed — no further
  follow-up remains open on the "📋 Shared Evidence Library" bullet).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (156 files / 2214 tests, all pass), `bun run typecheck` (11 in-scope
  packages pass — `debate-ai-web` has no `typecheck` script; this repo has
  no `lint` script), and `bun run build:web` (production build, including
  every existing route) all pass.
- **Shared, Ai-Generated Debate Flow — force-refresh the `FlowSpreadsheet`
  `EditBadge` cell after logging through its own popover.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/shared-flow-sync.md`'s
  Known gaps section said the `EditBadge` "doesn't refresh in place after
  logging one through its own popover until the grid next re-renders that
  cell" — a same-tab staleness bug, distinct from the cross-tab gap it was
  bundled with. AG Grid's React cell renderers (`AnnotationCellRenderer`)
  read `state/flowEdits.ts` directly from `localStorage` at render time and
  don't re-render on their own when a sibling React state change happens;
  `FlowSpreadsheet.tsx` already had an `editReviewRefreshToken` bump for the
  popover's own edit list, but nothing told AG Grid to redraw the grid cell
  itself. Added `flow/edit-cells.ts`'s `gridCellForBoxPath(boxPath)`, a pure
  helper mapping a box path to its AG Grid `row-${index}` id and `col_${j}`
  field (mirroring `dataTransform.ts#buildRowData`'s and
  `useFlowGridConfig.ts`'s existing conventions — the same pair
  `annotation-cells.ts#boxPathForCell` derives a `boxPath` from). Wired a new
  `handleEditLogged` callback into `EditReviewPopover`'s `onLogged` prop that
  bumps the existing refresh token and calls
  `gridRef.current.api.refreshCells({ rowNodes, columns, force: true })` for
  exactly that cell. Vitest-covered (3 new cases in
  `packages/debate-round/test/edit-cells.test.ts`'s `gridCellForBoxPath`
  suite: first-row/first-column mapping, a later row/column pair, and a
  round-trip through `boxPathForCell` for arbitrary indices). Verified with
  `bun run test` (156 files / 2206 tests, all pass — 3 new cases), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no `typecheck`
  script; this repo has no `lint` script), and `bun run build` (both
  buildable packages pass). Docs updated at
  `docs/features/shared-flow-sync.md` (new "EditBadge same-tab refresh"
  section; Known gaps narrowed to the remaining cross-tab case, now
  explicitly distinguished from Live Sync's cross-*contributor* mechanism).
  PR: https://github.com/debate/debate-ai.com/pull/270.
- **Practice Round Simulator — wire post-round feedback generation to a live round flow.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/practice-round-simulator.md`'s
  Known gaps section was itself stale — it still said follow-up (a)'s AI
  opponent-speech and AI judge-decision calls were "not started," but both
  already existed and were wired into `PracticeRoundSimulatorPanel.tsx`
  ("Generate AI opponent speech" / "Get AI judge decision"). Doc text
  corrected. Underneath that stale half, the doc's real remaining claim —
  "feedback generation isn't wired to a live round flow in this app yet" —
  was accurate: `buildPracticeRoundFeedback` (which needs an already-flowed
  `Flow`) had no caller anywhere in the app, so every practice round's card
  permanently showed "no post-round feedback yet." Added
  `buildAndSavePracticeRoundFeedback(flow, roundId, sideKey)` to
  `packages/debate-round/src/state/practiceRounds.ts`, which derives a
  round's `PracticeRoundFeedback` (judged under that round's own already-
  saved `setup.judgeParadigm`) and saves it onto the round's persisted
  record — returning `undefined` without writing anything if no record is
  stored for that `roundId` yet. `PracticeRoundSimulatorPanel.tsx` gained a
  "Generate post-round feedback for current round" form per round, reading
  the round workspace's currently selected flow via `state/store.ts`'s
  `useFlowStore` — the same mechanism `CoachingSessionsPanel`'s "Generate
  coaching session for current round" action already uses — enabled only
  while the selected flow's id matches that card's `roundId`. No new
  coaching-session or judge-paradigm logic was introduced; this composes
  the existing `buildPracticeRoundFeedback` (itself built on `flow/coach-mode.ts`'s
  `buildCoachingSession`) directly. Vitest-covered (4 new cases in
  `packages/debate-round/test/practiceRounds.test.ts`'s
  `buildAndSavePracticeRoundFeedback` suite: no-op + `undefined` for an
  unstored `roundId`, deriving feedback under the round's own judge
  paradigm and saving it, preserving the record's other fields (`setup`,
  `judgeDecision`) when saving feedback, and overwriting previously
  generated feedback). Verified with `bun run test` (156 files / 2203
  tests, all pass — 4 new cases), `bun run typecheck` (11 in-scope packages
  pass — `debate-ai-web` has no `typecheck` script; this repo has no `lint`
  script), and `bun run build` (both buildable packages pass, `/practice-round`
  present in the route list). Docs updated at
  `docs/features/practice-round-simulator.md` (Known gaps section now reads
  "No known gaps remain for this idea"). PR:
  https://github.com/debate/debate-ai.com/pull/269.
- **Features page — one page that outlines everything the app does.** Nothing
  in the app listed every surface it ships: the global dock exposes four
  destinations plus a Settings menu that is a flat, unexplained list of
  forty-odd items; `/research` and `/coach` each tab across the panels of one
  package; and `/community-hub` covers only the 17 spaces named under this
  file's "Research Crowdsourcing Organizer Features" heading, deliberately
  omitting the core workspaces (card search, the flow spreadsheet, the video
  archive, the Reason editor) and the standings/rankings surfaces. So a
  debater arriving at the app had no way to learn what it does short of
  clicking through every Settings entry. Added `/features`: a searchable,
  category-grouped outline of all 50 user-facing surfaces, each with its
  title, one-line description, route, and a link to its long-form
  `docs/features/*.md` doc where one exists. Pure data and helpers live in
  `packages/debate-ui/src/features/feature-catalog.ts` (`APP_FEATURES`,
  `buildFeatureSections`, `searchFeatures`, `featureDocUrl`,
  `buildFeatureCatalogSummaryText`) — modelled on `debate-card-search`'s
  narrower `lib/community-research-hub.ts` directory, and like it storeless,
  since every entry links to a surface that already manages its own state.
  `packages/debate-ui/src/features/FeaturesPanel.tsx` renders it (search box,
  jump-to-category row, one card per feature) holding only the query in local
  state, and `apps/debate-ai.com/app/features/page.tsx` mounts it. Titles and
  descriptions are copied from each route's own `metadata` export (or its
  feature doc's opening lines) so a card reads the same as the page it links
  to; each entry can also carry `tags` — search terms absent from the visible
  copy, so "elo" finds Team Rankings, "rfd" finds AI Judge Decision, and
  "verbatim" finds the Reason Editor and Speech Documents. `debate-ui` is the
  home for both files because the catalog names surfaces from `debate-round`,
  `debate-card-search`, `debate-videos`, `debate-speech-writer` and
  `reason-editor` (so it can't live in any one of them without inverting the
  dependency graph), `debate-core` is deliberately React-free, and the app
  itself sits outside the root Vitest projects, which only cover
  `packages/*`. The dock's Settings menu gained **All Features** as its first
  item, above the flat list it explains. Verified the catalog against the
  filesystem: every one of the app's 55 `page.tsx` routes is either in the
  catalog or intentionally out of it (`/` redirects to `/videos`, `/login` is
  a step rather than a feature, `/features` is the page itself, and
  `/debate/[tournament]/[teams]`/`/videos/[category]` are children of
  catalogued parents). Vitest-covered (22 new cases across
  `packages/debate-ui/test/feature-catalog.test.ts` — catalog invariants,
  section grouping/ordering, search across all four matched fields, doc-URL
  building, summary pluralization — and
  `packages/debate-ui/test/features-panel.test.tsx`, which renders the panel
  and asserts every catalogued route, the headings, the summary line, a docs
  link, the jump nav, and that a one-entry catalog renders without it).
  Verified with `bun run test` (158 files / 2221 tests, all pass — 22 new
  cases), `bun run typecheck` (11 in-scope packages pass — `debate-ai-web`
  has no `typecheck` script; this repo has no `lint` script), and
  `bun run build` (both buildable packages pass, `/features` present in the
  route list). Docs added at `docs/features/features-page.md`; the sole
  Known gap is that the catalog is a hand-maintained registry, so a new route
  has to be added to it as well — nothing fails if it isn't, because the app
  is outside the packages Vitest runs over.
- **Flow Annotations — switch video on cross-recording "Jump to".** Closes
  one of the four "Newly discovered small gaps" logged by the previous run's
  doc/tracker drift audit (see the entry below): `FlowAnnotationsPanel.handleJump`
  (`packages/debate-round/src/panels/FlowAnnotationsPanel.tsx`) and the
  matching `FlowSpreadsheet.handleJumpToAnnotation`
  (`packages/debate-round/src/flow/FlowSpreadsheet.tsx`) only seeked within
  the already-active video — if an annotation's own recording wasn't the one
  loaded in the persistent player, "Jump to" showed a disabled/no-op
  affordance instead of opening the right video first. Added a pure,
  dependency-injected `jumpToAnnotation(annotation, deps)` helper in
  `packages/debate-round/src/flow/flow-annotations.ts`: same-video jumps
  still seek in place via `sendYouTubeCommand("seekTo", ...)` +
  `"playVideo"`; a different (or no) video loaded instead calls
  `deps.setActiveVideo(videoId, videoId, undefined, timestampMs / 1000)`
  (falling back to the bare `videoId` as the title, since no stored catalog
  maps one to a title — `FlowAnnotation` itself never carried one). Both
  `FlowAnnotationsPanel` and `FlowSpreadsheet` now call this one helper
  instead of duplicating the guard, and the panel's "Jump to" button is
  disabled only when the annotation has no `videoId` at all. `debate-videos`'s
  `useVideoPlayerStore.setActiveVideo`
  (`packages/debate-videos/src/state/videoPlayerStore.ts`) gained an optional
  4th `startTimeSeconds` param that overrides its saved-resume-timestamp
  lookup, feeding the existing `&start=` YouTube-embed URL param — chosen
  over firing a `seekTo` postMessage immediately after switching, because
  research this run confirmed the iframe's new document isn't guaranteed to
  have loaded yet and this codebase has no "player ready" signal anywhere to
  gate on (no prior "switch then seek" pattern existed to reuse). No new
  annotation-model or persistence logic; `AnnotationBadge`/`AnnotationCellRenderer`
  needed no changes (they're pure/props-driven, with no video-matching gate
  of their own). Vitest-covered (4 new cases in
  `packages/debate-round/test/flow-annotations.test.ts`'s `jumpToAnnotation`
  suite, using fake injected deps: same-video seek, cross-video switch,
  switch when nothing is loaded, and the no-`videoId` no-op). Verified with
  `bun run test` (156 files / 2199 tests, all pass — 4 new cases),
  `bun run typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run build`
  (both buildable packages pass, `/annotations` present in the route list).
  Docs updated at `docs/features/flow-annotations.md` (new "Cross-recording
  'Jump to'" section; the sole remaining Known gap is the same
  title-fallback caveat noted above — a video catalog mapping `videoId` to a
  title doesn't exist anywhere in this repo yet). PR:
  https://github.com/debate/debate-ai.com/pull/268.
- **AI Response-Outcome Charts — AI counsel panel now scores an active "what if" hypothetical.**
  Closes one of the four "Newly discovered small gaps" logged by the
  previous run's doc/tracker drift audit (see that entry below):
  `docs/features/response-outcome-charts.md`'s Known gap that
  `VulnerabilityChartsPanel.handleGetCounselPanel`
  (`packages/debate-round/src/panels/VulnerabilityChartsPanel.tsx`) built
  its AI counsel request's top arguments from `record.report` — the
  original persisted report — instead of `effectiveReport`, the report
  with the panel's own "what if" (Extend/Answer/Concede) hypothetical
  adjustments applied via `applyHypotheticalAdjustments`. The chart and
  side summary above the counsel-panel button already rendered
  `effectiveReport`, so an active hypothetical was silently ignored by the
  AI counsel call even though the rest of the card reflected it.
  Extracted the inline top-arguments derivation (previously duplicated
  logic in the panel) into a new pure helper,
  `buildCounselPanelTopArguments(report, options)` in
  `packages/debate-round/src/flow/response-outcome.ts`, which composes the
  existing `buildVulnerabilityChartDataFromReport` + a per-row field trim
  in one step. `handleGetCounselPanel` now takes `effectiveReport` as a
  parameter (passed from the render scope where it's already computed) and
  calls `buildCounselPanelTopArguments(effectiveReport)` instead of
  rebuilding the list from `record.report` inline. No change to the
  vulnerability-scoring heuristic itself. Vitest-covered (3 new cases in
  `packages/debate-round/test/response-outcome.test.ts`'s
  `buildCounselPanelTopArguments` suite: ranked top-N trimmed to the
  counsel-request fields, the default limit of 10, and reflecting a
  hypothetical-adjusted report's recomputed score/unanswered status instead
  of the original report's). Verified with `bun run test` (156 files /
  2195 tests, all pass — 3 new cases), `bun run typecheck` (11 in-scope
  packages pass — `debate-ai-web` has no `typecheck` script; this repo has
  no `lint` script), and `bun run build` (both buildable packages pass,
  `/outcomes` present in the route list). Docs updated at
  `docs/features/response-outcome-charts.md` (closes its only Known gap;
  the section now reads "No known gaps remain for this idea"). PR:
  https://github.com/debate/debate-ai.com/pull/267.
- **AI Coach Mode — "generate coaching session for current round" form.**
  Closed `docs/features/coaching-sessions.md`'s only remaining Known gap —
  the same doc/tracker-drift pattern the three most recent runs already
  closed for Pre-Round Briefings, Practice Drills, and Response-Outcome
  Charts, found via a systematic audit this run of every `docs/features/*.md`
  "Known gaps" section against the actual current code (see "Doc/tracker
  drift audit" note below for what else that audit surfaced).
  `CoachingSessionsPanel.tsx` (`/coaching`) now has a "Generate coaching
  session for current round" form (a side input + button, disabled with an
  inline hint when no flow is currently selected), reading the round
  workspace's currently selected flow via `state/store.ts`'s `useFlowStore`
  — the same mechanism `DrillSetsPanel`'s "Generate drills for current
  round" action already uses. It calls one new helper,
  `buildAndSaveCoachingSession` in
  `packages/debate-round/src/state/coachingSessions.ts`, which composes the
  existing `buildCoachingSession` (from `flow/coach-mode.ts`) +
  `saveCoachingSession` in one step (mirroring `drillSets.ts`'s
  `buildAndSaveDrillSet`) — no new coaching-prompt derivation logic.
  Vitest-covered (4 new cases in
  `packages/debate-round/test/coachingSessions.test.ts`: deriving and
  persisting a session from a flow, overwriting an existing record for the
  same round+side pair, keeping sessions for different sides of the same
  round distinct, and `collapseLimit` passing through to
  `buildCoachingSession`). Verified with `bun run test` (156 files / 2192
  tests, all pass — 4 new cases), `bun run typecheck` (11 in-scope packages
  pass — `debate-ai-web` has no `typecheck` script; this repo has no `lint`
  script), and `bun run build` (both buildable packages pass, `/coaching`
  present in the route list). Docs updated at
  `docs/features/coaching-sessions.md`; no follow-ups remain open on this
  bullet. PR: https://github.com/debate/debate-ai.com/pull/266.

  Doc/tracker drift audit (systematic pass this run over all 39
  `docs/features/*.md` files with a "Known gaps" section, verifying each
  listed gap against the actual current code rather than trusting the doc's
  own claim):
  - 4 stale docs found and fixed this run (doc claimed a gap that was
    already closed in code): `reason-editor-outline-nav.md` (the
    ProseMirror decoration plugin that hides collapsed ranges,
    `collapsedHeadingsPlugin`, already exists and is wired in),
    `judge-paradigm-selections.md` (the AI judge-decision call using
    `buildJudgeParadigmPrompt` already exists — `judge-decision-ai.ts` /
    `judge-decision-client.ts` / `judge-decision-store-wiring.ts`, wired
    into `JudgeDecisionPanel.tsx`/`PracticeRoundSimulatorPanel.tsx`),
    `contributor-awards.md` (a real submitted-contribution flow already
    exists via `ContributionsFeedPanel.tsx`), and `group-challenges.md`
    (`CoachingProgramsPanel.tsx` already reads through this store via
    `state/persistedCoachingProgramBoard.ts`'s `listGroupChallenges` call).
  - 4 real, small, non-external-infra-blocked gaps were also found and
    logged below as new backlog items for a future run (not implemented
    this run, to keep this run's diff to the one task above): a missing
    "regenerate AI speech" action in AI-Versus Rounds, completed
    research-task history that's never pruned, the Flow Annotations "Jump
    to" action not switching videos, and the Response-Outcome Charts AI
    counsel call ignoring an active "what if" hypothetical. See "Newly
    discovered small gaps" below.
  - Every other audited doc's "Known gaps" section checked out as accurate
    against the current code — either still genuinely open, or already
    correctly documented as blocked on external infrastructure this repo
    doesn't have (Tabroom authentication, audio/video transcription, no
    reviewer/auth system). See "Remaining backlog audit" below for the
    external-infra items, unchanged from prior runs.

  Newly discovered small gaps (found by this run's doc/tracker drift audit;
  each is small and not blocked by external infrastructure — good
  candidates for a future run's "select a new idea" step before reaching
  for `IDEAS.md`/Product Feature Ideas):
  - `docs/features/ai-versus-rounds.md`: `AiVersusRoundPanel.tsx` has no way
    to replace a just-generated AI speech — only "Generate AI speech" to
    append one. Add a "Regenerate" action (re-calling
    `requestAiVersusSpeech`/`requestAiVersusSpeechWithPersona` and
    overwriting the last `submittedSpeeches` entry) gated to when the last
    speech is AI-authored.
  - `docs/features/research-progress-tracking.md`:
    `state/researchProgress.ts` has no way to delete a topic's completed-task
    history records — they accumulate forever. Add a
    `deleteCompletedTaskHistoryForTopic(topic)` export.
  - `docs/features/flow-annotations.md`: `FlowAnnotationsPanel.handleJump`
    (and the matching `FlowSpreadsheet` badge) only seeks within the
    already-active video — if the annotation's video isn't loaded, it gives
    up instead of switching videos first via `debate-videos`'s
    `useVideoPlayerStore.setActiveVideo(videoId, title, meta?)`.
  - `docs/features/response-outcome-charts.md`:
    `VulnerabilityChartsPanel.handleGetCounselPanel`
    (`packages/debate-round/src/panels/VulnerabilityChartsPanel.tsx:128-142`)
    builds its AI counsel request's `topArguments` from `record.report` (the
    original persisted report) instead of `effectiveReport` (the report with
    the panel's own "what if" hypothetical adjustments applied via
    `applyHypotheticalAdjustments`) — so an active what-if adjustment is
    silently ignored by the AI counsel call even though the rendered chart
    reflects it.
- **AI Response-Outcome Charts — add a "generate report for current round" form.**
  TODO.md's idea #4 ("AI Response-Outcome Charts") already said "No
  follow-ups remain open," but `docs/features/response-outcome-charts.md`'s
  "Known gaps" still listed one — the same doc/tracker drift the two most
  recent runs closed for Pre-Round Briefings and Practice Drills: "No
  affordance in this panel to generate a new vulnerability report for a
  round — a report only appears here once something elsewhere calls
  `getArgumentVulnerabilityReport` and `saveVulnerabilityReport` for that
  round." `VulnerabilityChartsPanel` (`/outcomes`) now has a "Generate
  report for current round" form (a button, disabled with an inline hint
  when no flow is currently selected), reading the round workspace's
  currently selected flow via `state/store.ts`'s `useFlowStore` — the same
  mechanism `DrillSetsPanel`'s "Generate drills for current round" action
  already uses. It calls one new helper,
  `buildAndSaveVulnerabilityReport` in
  `packages/debate-round/src/state/vulnerabilityReports.ts`, which composes
  the existing `getArgumentVulnerabilityReport` + `getFlowSideKeys` +
  `saveVulnerabilityReport` in one step (mirroring `drillSets.ts`'s
  `buildAndSaveDrillSet`) — no new vulnerability-scoring logic. Unlike the
  Drill Sets form, no side-key input is needed since a vulnerability report
  scores every side's arguments in one pass. Vitest-covered (3 new cases in
  `packages/debate-round/test/vulnerabilityReports.test.ts`: deriving and
  persisting a report from a flow, overwriting an existing record for the
  same round, and `sideKeys` deriving correctly via `getFlowSideKeys`).
  Verified with `bun run test` (156 files / 2188 tests, all pass — 3 new
  cases), `bun run typecheck` (11 in-scope packages pass — `debate-ai-web`
  has no `typecheck` script), and `bun run build` (both buildable packages
  pass, `/outcomes` present in the route list). Docs updated at
  `docs/features/response-outcome-charts.md`; no follow-ups remain open on
  this bullet. The remaining backlog audited by prior runs (Tabroom-
  authentication-gated data sources, missing transcription service, and the
  browser-extension idea) is unaffected and still accurate — see the
  Pre-Round Briefings entry below for the full audit.

- **Pre-Round Briefings — persist and wire in a team's own round history.**
  Closes the real (not form-oversight) gap the previous run documented in
  `docs/features/pre-round-briefings.md`'s "Known gaps": the "create
  briefing" form's "Prior meetings" section always rendered "No recorded
  prior meetings" even when an opponent profile was picked, because
  `round/pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores` already
  supported a head-to-head `ownRecords`/`opponentTeamId` history when
  called directly, but no persisted store of a team's own round history
  existed for it to read from. Added
  `packages/debate-round/src/state/ownRoundHistory.ts`, a new
  `OpponentRoundRecord`-per-logged-round localStorage store (append-only,
  synthetic id per record, mirroring `debate-data-sync`'s
  `tournamentResults.ts` convention) with `listOwnRoundHistory`/
  `saveOwnRoundHistoryRecord`/`deleteOwnRoundHistoryRecord`/
  `getOwnRoundHistoryAgainst`. `buildPreRoundBriefingFromStores` now
  resolves `ownRecords` from this store by `opponentTeamId` the same way it
  already resolved `opponentProfile`/`judgeProfile` by id — no new
  head-to-head computation logic; it still delegates to the existing
  `getHeadToHeadRecords`/`summarizePriorMeetings`. `PreRoundBriefingsPanel`
  (`/briefings`) gained a "Log a round" form (tournament, date, division,
  side, an opponent picked from an already-persisted Opponent Team Profile,
  and Won/Lost), with a "Remove" action per logged round — otherwise the
  store would have been just as unreachable from the shipped app as the
  briefing store was before last run's "create briefing" form. Vitest-
  covered: a new `packages/debate-round/test/ownRoundHistory.test.ts` (10
  cases covering empty/corrupt/non-array storage, append-not-overwrite,
  delete, and head-to-head filtering including records with no
  `opponentTeamId`), plus 2 new cases in
  `packages/debate-round/test/pre-round-briefing.test.ts` covering
  `buildPreRoundBriefingFromStores` resolving `ownRecords` from the store
  and an explicitly supplied `ownRecords` still taking precedence over it.
  Verified with `bun run test` (156 files / 2186 tests, all pass — 1 new
  file, 12 new cases), `bun run typecheck` (11 in-scope packages pass —
  `debate-ai-web` has no `typecheck` script), and `bun run build` (both
  buildable packages pass). Docs updated at
  `docs/features/pre-round-briefings.md`; no follow-ups remain open on this
  gap. The remaining backlog audited by the previous run (Tabroom-
  authentication-gated data sources, missing transcription service, and the
  browser-extension idea) is unaffected and still accurate — see that
  entry below.

- **Practice Drills — add a "generate drills for current round" form.** The
  "📚 AI Drill Generator" bullet in TODO.md's Research Crowdsourcing
  Organizer Features list said "No follow-ups remain open," but
  `docs/features/drill-sets.md`'s "Known gaps" still listed one: "No
  affordance in this panel to generate a new drill set for a round — a set
  only appears here once something elsewhere calls `buildDrillSet` and
  `saveDrillSet` for that round" — the same doc/tracker drift idea #12's
  Pre-Round Briefings form closed last run. `DrillSetsPanel` (`/drills`) now
  has a "Generate drills for current round" form (a side-key input plus a
  button, disabled with an inline hint when no flow is currently selected),
  reading the round workspace's currently selected flow via
  `state/store.ts`'s `useFlowStore` — the same mechanism
  `CoachingProgramsPanel`'s "Save current flow" action already uses. It
  calls one new helper, `buildAndSaveDrillSet` in
  `packages/debate-round/src/state/drillSets.ts`, which composes the
  existing `buildDrillSet` + `saveDrillSet` in one step (mirroring
  `roundContributorFlows.ts`'s `buildAndSaveRoundContributorFlow`) — no new
  drill-generation logic. Vitest-covered (3 new cases in
  `packages/debate-round/test/drillSets.test.ts`: deriving and persisting a
  drill set from a flow, overwriting an existing record for the same round,
  and `collapseLimit` passing through to `buildDrillSet`). Verified with
  `bun run test` (155 files / 2174 tests, all pass), `bun run typecheck` (11
  in-scope packages pass — `debate-ai-web` has no `typecheck` script), and
  `bun run build` (both buildable packages pass). Docs updated at
  `docs/features/drill-sets.md`; no follow-ups remain open on this bullet.

- **Pre-Round Briefings — add a "create briefing" form.** Idea #12
  ("Pre-Round Intelligence Panel")'s follow-up (b) was only partly closed:
  `docs/features/pre-round-briefings.md`'s "Known gaps" said "No affordance
  in this panel to generate a new briefing for a round" — `savePreRoundBriefing`
  and `buildPreRoundBriefingFromStores` existed and were Vitest-covered, but
  were called only from tests, so `/briefings` was permanently empty for a
  real user. Added a "create briefing" form to `PreRoundBriefingsPanel`
  (round ID, tournament/division/round-label/side/room/opponent-label,
  optional picks from already-persisted Opponent Team Profiles / Judge
  Profiles, free-text prep notes), backed by one new pure helper,
  `buildPreRoundBriefingRecordFromDraft` in
  `packages/debate-round/src/state/preRoundBriefings.ts`, which validates
  the draft and delegates to the existing `buildPreRoundBriefingFromStores`
  — no new briefing-composition logic. Vitest-covered (12 new cases in
  `packages/debate-round/test/preRoundBriefings.test.ts`: minimal valid
  draft, whitespace/missing-field validation, optional room/opponent-
  label/prep-notes, resolving an opponent/judge profile by id, and the
  "no data on file" fallback for an unresolved id). Documented in
  `docs/features/pre-round-briefings.md`, including the still-open gap that
  the form doesn't collect this team's own round history, so "Prior
  meetings" always renders "No recorded prior meetings" even when an
  opponent profile is picked — `buildPreRoundBriefingFromStores` supports a
  head-to-head `ownRecords`/`opponentTeamId` history when called directly,
  but no persisted store of a team's own round history exists yet for the
  form to read from; a real follow-up, not a form oversight.

- **AI Practice Opponent — `docs/features/practice-opponent.md`.** Every
  idea in TODO.md's Product Feature Ideas and Research Crowdsourcing
  Organizer Features lists already has "No follow-ups remain open"
  implementations except for a handful explicitly documented as blocked on
  an external dependency this repo doesn't have (see below); of those
  already-closed ideas, the "AI Practice Opponent" persona picker
  (`OpponentPersonaPickerPanel` at `/practice-opponent`, in the global
  dock's Settings menu) was the one implemented slice missing its
  `docs/features/*.md` entry — every sibling idea (e.g. "AI Judge Decision
  Modes" → `judge-paradigm-selections.md`) has one. Added
  `docs/features/practice-opponent.md`, documenting the route, nav
  location, the four built-in personas, the full save/clear/AI-speech data
  flow (including `round/opponent-persona-speech-wiring.ts`'s
  `getOpponentPersonaForRound`), and existing Vitest coverage. No code
  changed; this is a documentation-only completion.

  Remaining backlog audit (for future runs, so this isn't re-discovered):
  every other open follow-up left in TODO.md is blocked on an external
  dependency, not on missing implementation effort —
  - Idea #1 "CX NDCA Standings" follow-up (a), a real Tabroom/NDCA scraper:
    confirmed via a live fetch this run that Tabroom's tournament-results
    pages (e.g. `/index/tourn/results/index.mhtml?tourn_id=...`) require an
    authenticated Tabroom login and render only a login form to an
    unauthenticated request — unlike the public `/index/index.mhtml`
    tournament-name index `sync-tournaments.ts` already scrapes. No
    Tabroom credentials exist in this repo, so a real per-team results
    scraper can't be built or tested against real data right now. Follow-up
    (b), a real circuit-sourced `QualificationPointsTable`, has the same
    blocker noted in `ndca-standings.ts` — no authoritative public source
    this repo can cite is available.
  - "Opponent Team Profiles" and "Judge Profiles" follow-up (a), a real
    Tabroom pairings/ballots data source: same authentication blocker as
    above (pairings/ballots live behind the same login-gated Tabroom
    pages).
  - Idea #12 "Pre-Round Intelligence Panel" follow-up (a), real tournament
    results/pairings/event-details/room-assignment data sources: same
    Tabroom authentication blocker.
  - Idea #6 "Speech Transcript Summaries" and idea #8 "Video-Lecture-
    Training Coach AI," each idea's remaining audio/video-transcription
    half of follow-up (a): no transcription service (e.g. Whisper-style
    API) exists in this repo or its dependencies, and the browser-native
    Web Speech API only transcribes live microphone input, not an uploaded
    recording — not a safe, testable slice without a real service
    dependency.
  - Idea #7 "On Page Card Reuse Search" follow-up (a), an actual browser
    extension: this is a genuinely new project (manifest, content script,
    packaging) rather than a vertical slice of the existing Next.js app,
    and the existing check logic reads a client-side `localStorage` store
    that a separate extension origin can't reach without a new backend API
    endpoint first — too large to safely scope as one incremental slice.

- **Shared Evidence Library — cache the search index across calls.**
  Closes the remaining follow-up named under the "📋 Shared Evidence
  Library" bullet in TODO.md's Research Crowdsourcing Organizer Features
  list ("caching the index across calls instead of rebuilding it on every
  search"), and the matching "Known gaps" entry in
  `docs/features/evidence-library.md`. `state/evidenceLibraryEntries.ts`'s
  `searchPersistedEvidenceLibraryWithIndex` no longer rebuilds
  `EvidenceSearchIndex` on every call — a new `getCachedEvidenceSearchIndex`
  reuses the previously built index unless the data it depends on could have
  changed. Liveness depends on two independently-written stores (this
  store's own `EvidenceLibraryEntry` records, and `state/peerReviews.ts`'s
  `CardReview` records — a review transition can flip an entry's liveness
  with no write to this store at all), so rather than a write-time counter
  on each store's own write functions (which would miss any storage change
  made outside them), the cache compares each store's raw persisted JSON
  string against the strings it was built from —
  `state/peerReviews.ts`'s new `getPeerReviewsRawSnapshot()` exposes the
  peer-review side of that fingerprint. Vitest-covered in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts` (a
  repeat call with nothing changed reuses the cached index rather than
  calling `buildEvidenceSearchIndex` again; saving an entry, deleting an
  entry, and a peer-review transition that flips an entry's live status
  each force a rebuild whose results reflect the change) and
  `packages/debate-card-search/test/peerReviews.test.ts`
  (`getPeerReviewsRawSnapshot` changes value on save/delete and stays
  identical across repeat calls with nothing changed). Verified with
  `bun run test` (155 files / 2165 tests, all pass), `bun run typecheck` (11
  in-scope packages pass — `debate-ai-web` has no `typecheck` script), and
  `bun run build` (both buildable packages pass). Docs updated at
  `docs/features/evidence-library.md`. Remaining gap, recorded there: a
  cache-invalidating rebuild is still a full pass over every live entry, not
  true incremental indexing that updates only the entries a write actually
  touched.
- **Shared Evidence Library — wire `EvidenceLibraryPanel` to the real search index.**
  Closes the remainder of follow-up (c) named under the "📋 Shared Evidence
  Library" bullet in TODO.md's Research Crowdsourcing Organizer Features
  list, and the matching "Known gaps" entry in
  `docs/features/evidence-library.md` ("`EvidenceLibraryPanel` isn't wired
  to it yet — the panel still calls the original keyword-overlap
  `searchPersistedEvidenceLibrary`"), left open by PR #256.
  `EvidenceLibraryPanel`'s two search call sites (the live-filter effect and
  `refreshResults`, used after every submit/edit/delete/reuse-check) now
  call `state/evidenceLibraryEntries.ts`'s `searchPersistedEvidenceLibraryWithIndex`
  instead of the original `searchPersistedEvidenceLibrary` — a drop-in swap,
  since both share the same `EvidenceSearchQuery` input and
  `EvidenceSearchResult` output shape and non-text filter semantics, so the
  panel's search box, kind filter, and topic/case-area/tags filters are now
  all served by PR #256's TF-IDF-ranked inverted index instead of a full
  keyword-overlap re-scan on every keystroke. `searchPersistedEvidenceLibrary`
  stays exported, unchanged, for any other caller. Vitest-covered in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts` with a
  new suite exercising the panel's actual call shape —
  `buildEvidenceSearchFormQuery`'s output fed straight into
  `searchPersistedEvidenceLibraryWithIndex` — covering a combined
  text+topic+tags filter match, a filter combination that narrows past every
  entry, and peer-review gating through that same query shape (the
  indexed search's own unit tests, filter-by-filter, were already added in
  PR #256). Verified with `bun run test` (155 files / 2157 tests, all pass),
  `bun run typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script), and `bun run build` (both buildable packages pass).
  Docs updated at `docs/features/evidence-library.md`. Follow-up remaining,
  recorded there: caching the index across calls instead of rebuilding it on
  every search is not started — this store still has no write-time hook to
  invalidate a cache.
  PR: [#258](https://github.com/debate/debate-ai.com/pull/258).
- **Shared Evidence Library — real search index.**
  Closes follow-up (c) named under the "📋 Shared Evidence Library" bullet in
  TODO.md's Research Crowdsourcing Organizer Features list ("a real search
  index (e.g. Typesense) once entries are persisted at scale"). Adds
  `packages/debate-card-search/src/lib/evidence-search-index.ts`'s
  `buildEvidenceSearchIndex`/`searchEvidenceLibraryWithIndex` — a real
  token → postings-list inverted index ranked by TF-IDF (term frequency ×
  inverse document frequency across the indexed corpus), so ranking a query
  no longer means re-scoring every entry's full text on every call (only
  entries sharing a query term are ever visited) and a rarer, more
  distinctive term outranks one nearly every entry shares — unlike
  `searchEvidenceLibrary`'s existing presence/absence keyword-overlap ratio.
  Kept a drop-in alternative: same `EvidenceSearchQuery` input,
  `EvidenceSearchResult` output shape, and kind/topic/caseArea/tags filter
  semantics (reusing `filterCardsByTags` directly, same as the original).
  `state/evidenceLibraryEntries.ts`'s new `searchPersistedEvidenceLibraryWithIndex`
  composes it against the persisted repository with the same "live"/peer-
  review gating `searchPersistedEvidenceLibrary` already uses, added
  alongside — not replacing — that existing function, so no current caller's
  behavior changes. The index is rebuilt fresh from the live entries on
  every call rather than cached (this store has no write-time hook to
  invalidate a cached index); that's still the query-time win the follow-up
  asked for, since ranking no longer requires visiting every entry. Vitest-
  covered in `packages/debate-card-search/test/evidence-search-index.test.ts`
  (index construction, postings/term-frequency correctness, TF-IDF ranking
  including a dedicated case showing a rarer term outranks a common one,
  every filter combination, and candidate-set parity against
  `searchEvidenceLibrary` on a shared fixture) and new cases in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
  (mirroring `searchPersistedEvidenceLibrary`'s own suite: peer-review
  gating, empty-repository, kind filtering, empty-text-query). Verified with
  `bun run test` (155 files / 2154 tests, all pass), `bun run typecheck` (11
  in-scope packages pass — `debate-ai-web` has no `typecheck` script), and
  `bun run build` (both buildable packages pass). Docs updated at
  `docs/features/evidence-library.md`. Follow-up remaining, recorded there:
  `EvidenceLibraryPanel` still calls the original `searchPersistedEvidenceLibrary`,
  not the indexed version — wiring the panel to it (or caching the index
  across calls instead of rebuilding it on every search) is not started.
  PR: [#256](https://github.com/debate/debate-ai.com/pull/256).
- **Peer Review System — reviewer permission gating for approve/reject/publish.**
  Closes follow-up (b) named under the "🗣️ Peer Review System" bullet in
  TODO.md's Research Crowdsourcing Organizer Features list ("reviewer
  identity/permission checks once auth/roles exist") and the matching
  "Known gaps" entry in `docs/features/review-queue.md` ("No reviewer
  identity/permission checks (no auth/roles in this repo yet), so any
  visitor can act as any reviewer and take any lifecycle action").
  No auth/roles system exists in this repo, so rather than fabricating a
  role model this slice derives a reviewer's permission from their own
  contribution record — the same "derive eligibility from a contributor's
  own track record instead of a caller-supplied value" approach
  `lib/tiered-task-routing.ts` already uses to derive a contributor's
  `SkillLevel` for task routing. `debate-card-search` adds
  `lib/reviewer-permissions.ts`'s `MIN_REVIEWER_TIER` (`"veteran"`),
  `hasReviewerPermission`, `InsufficientReviewerPermissionError`,
  `deriveReviewerTier` (looks a reviewer's `ContributorStats` up in a
  leaderboard and runs `progress-unlocks.ts`'s `computeContributorTier`;
  a reviewer with no stats is `"novice"`, not an error), and
  `approveReviewAsReviewer`/`rejectReviewAsReviewer`/`publishReviewAsReviewer`
  — permission-checked wrappers that throw before the underlying
  `lib/peer-review.ts` transition runs, so the state machine's own
  `InvalidReviewTransitionError`/`UnresolvedBlockingCommentsError` checks
  still apply after the gate. `state/peerReviews.ts` adds
  `derivePersistedReviewerTier` (composes `deriveReviewerTier` against
  `state/contributions.ts`'s `buildPersistedLeaderboard`) plus
  `approvePersistedReviewAsReviewer`/`rejectPersistedReviewAsReviewer`/
  `publishPersistedReviewAsReviewer`, which apply a gated transition to the
  stored review and save it — returning `undefined` for an unknown `cardId`
  (mirroring `state/contributions.ts`'s `applyPersistedContributionUpdate`
  convention) and re-throwing without saving when the gate or the state
  machine rejects. `ReviewQueuePanel` (`/cards/reviews`) gets a "Your
  reviewer ID" field; its Approve/Reject/Publish buttons now route through
  the gated store functions, while Submit/Resubmit/Request changes/comment
  actions stay open to anyone. Vitest-covered in
  `packages/debate-card-search/test/reviewer-permissions.test.ts` (tier
  comparison at/above/below the threshold, caller-supplied minimum tier,
  `deriveReviewerTier`'s missing-reviewer and real-stats paths, each gated
  wrapper's allow/deny path, and that the state machine still rejects an
  illegal transition once permission is granted) and new cases in
  `packages/debate-card-search/test/peerReviews.test.ts` (derived tier from
  real persisted contributions, each persisted wrapper's save-on-success,
  unknown-`cardId` `undefined`, and that a denied action leaves the stored
  review's status untouched). Verified with `bun run test` (154 files / 2130
  tests, all pass), `bun run typecheck` (11 in-scope packages pass —
  `debate-ai-web` has no `typecheck` script), and `bun run build` (both
  buildable packages pass). Docs updated at
  `docs/features/review-queue.md`. Remaining gap, recorded there rather
  than as a follow-up on this bullet: reviewer identity is a free-form
  typed id, not an authenticated user, so the tier gate reflects that id's
  record but nothing stops a visitor from typing someone else's — a real
  identity check needs an auth system this repo doesn't have.
  PR: [#254](https://github.com/debate/debate-ai.com/pull/254).
- **Peer Review System — reviewer identity/self-review guard, composed with PR #254's tier gate.**
  A second, concurrently-developed slice closing the same follow-up (b) as
  PR #254 above, reconciled into one combined gate rather than shipped as a
  duplicate: `lib/peer-review.ts`'s `CardReview` now also carries an
  optional `authorId` (set by `createCardReview`) and `reviewedBy`.
  `approveReview`/`rejectReview`/`publishReview` — the same three
  transitions PR #254 tier-gates — each now also require a `reviewerId`
  argument, validated by a new `assertReviewerAllowed`: empty throws
  `ReviewerIdRequiredError`, and a reviewer id matching the review's own
  `authorId` throws `SelfReviewNotAllowedError`. A review with no author id
  (the Author ID field on the start-review form left blank, or a review that
  predates it) has nothing to guard against and accepts any reviewer id,
  matching this repo's "works standalone, gated further once the gating
  data exists" convention. The reviewer id that successfully completes a
  gatekeeping action is stamped on `CardReview.reviewedBy` and surfaced in
  `buildReviewSummary`. `requestChanges` stays ungated (no reviewer id),
  matching PR #254's "submitting, requesting changes, commenting, and
  resolving comments stay open to anyone" design. `lib/reviewer-permissions.ts`'s
  `approve/reject/publishReviewAsReviewer` wrappers now take a `reviewerId`
  and forward it into the underlying `lib/peer-review.ts` call, so a
  reviewer must clear both gates — the tier check first, then the
  self-review guard — to approve, reject, or publish; `ReviewQueuePanel`'s
  existing "Your reviewer ID" field (from PR #254) now also satisfies this
  guard, and gained an optional Author ID field on the start-review form
  plus an authorId badge on each review row. Vitest-covered in
  `packages/debate-card-search/test/peer-review.test.ts` (reviewedBy
  stamping and the empty-reviewer-id/self-review failure paths on
  approve/reject/publish, and that a different reviewer id or a missing
  author id is unaffected), `packages/debate-card-search/test/reviewer-permissions.test.ts`
  (updated call sites, plus that the self-review guard still fires once the
  tier check passes), and the pre-existing
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts` (updated
  call sites only, no behavior change). Docs updated in
  `docs/features/review-queue.md`. Verified: `bun install` (2050 packages),
  `bun run test` (153 files / 2118 tests, all pass), `bun run typecheck` (11
  of 12 in-scope packages have a typecheck script; all pass), and
  `bun run build:web` (`debate-ai-web`, succeeds, `/cards/reviews` route
  present, no new route) all pass. No repo-wide `lint` script exists, so
  none was run.
- **Community Research Hub — searchable directory of every crowdsourcing and pre-round/practice space.**
  Closes the "🧩 Community Research Hub" bullet ("A shared space where
  debaters contribute cards, evidence, and summaries to a common argument
  pool") under Research Crowdsourcing Organizer Features in TODO.md — the
  only bullet in that section with no recorded status, because every
  sibling bullet under it already shipped its own dedicated panel/route
  and closed itself out independently, and `/research`'s `ResearchHub`
  already tabs across the card-search-side ones, but nothing tied all of
  them — including the round/practice-side spaces `ResearchHub` doesn't
  cover (Opponent/Judge Profiles, AI Coach Mode, Practice Round Simulator,
  AI Drill Generator) — into one place a debater could browse or search.
  `debate-card-search` adds `lib/community-research-hub.ts`'s
  `COMMUNITY_RESEARCH_HUB_ENTRIES` (a static registry of all 17 sibling
  spaces' title/description/route, taken from each route's own page
  metadata), `buildCommunityResearchHubSections` (groups entries into five
  categories — Evidence & Cards, Team Collaboration, Pre-Round
  Intelligence, Practice & Coaching, Recognition & Progress),
  `searchCommunityResearchHubEntries` (case-insensitive title/description
  substring filter), and `buildCommunityResearchHubSummaryText`. A new
  `CommunityResearchHubPanel` renders a search box over the categorized
  directory at `/community-hub`, added to the global dock's Settings menu
  alongside Research Workspace. This panel has no store of its own — every
  entry just links out to a space that already persists (or doesn't need
  to persist) its own state. Vitest-covered in
  `packages/debate-card-search/test/community-research-hub.test.ts`
  (registry shape, section grouping/ordering, search matching/case-
  insensitivity/empty-query, and summary-text pluralization). Verified
  with `bun run test` (153 files / 2107 tests, all pass), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script), and `bun run build` (both buildable packages pass,
  `/community-hub` present in the route list). Docs added at
  `docs/features/community-research-hub.md`. No repo-wide `lint` script
  exists so none was run. No follow-ups open on this bullet; idea #7's
  browser extension and the round/practice spaces' own remaining
  follow-ups (real Tabroom/ballot-sourced data, audio/video transcription)
  are unrelated to this bullet and untouched here.
  PR: [#252](https://github.com/debate/debate-ai.com/pull/252).
- **On Page Card Reuse Search — page-URL reuse-check first slice.**
  Closes the first slice of idea #7 ("On Page Card Reuse Search") in
  TODO.md's Product Feature Ideas list — "See if any one has cut this
  article in the chrome ext." `debate-card-search`'s
  `lib/shared-evidence-library.ts` adds an optional `sourceUrl` field to
  `EvidenceLibraryEntry`, `normalizeSourceUrl` (strips scheme, a leading
  `www.`, query string/fragment, and a trailing slash so tracking
  parameters and scheme/`www.` differences don't defeat a match),
  `findEntriesBySourceUrl`, `checkPageForExistingCards` (a
  `{ url, alreadyCut, matches }` result), and `buildPageReuseCheckSummaryText`.
  `state/evidenceLibraryEntries.ts`'s new `checkPersistedPageForExistingCards`
  composes that pure check against the persisted repository, gated to "live"
  entries the same way `searchPersistedEvidenceLibrary` already is (an entry
  held under an in-progress peer review doesn't count as "already cut"
  either). `EvidenceLibraryPanel` (`/cards/library`) gets a new optional
  Source URL field on the submission form and a "Check this page" box — paste
  a URL, see whether it's already been cut plus every matching entry — the
  reuse check a browser extension would eventually run automatically against
  the current tab's URL; no chrome extension exists in this repo, so this
  panel is the check's only caller today and the pure/persisted functions
  are the extension-callable first slice. No follow-ups remain open except
  (a), the actual browser extension itself, not started. Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts`
  (`normalizeSourceUrl`, `findEntriesBySourceUrl`, `checkPageForExistingCards`,
  `buildPageReuseCheckSummaryText`) and
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
  (`checkPersistedPageForExistingCards`, including the peer-review-gating
  case). Verified with `bun install` (2050 packages), `bun run test` (152
  files / 2096 tests, all pass), `bun run typecheck` (11 in-scope packages
  pass — `debate-ai-web` has no `typecheck` script), and `bun run build`
  (both buildable packages pass). Docs updated at
  `docs/features/evidence-library.md`. No repo-wide `lint` script exists so
  none was run.
  PR: [#251](https://github.com/debate/debate-ai.com/pull/251).
- **Shared, Ai-Generated Debate Flow — server-backed live sync transport.**
  Closes follow-up (a) under idea #16 ("Shared, Ai-Generated Debate Flow")
  in TODO.md's Product Feature Ideas list — "a live transport (WebSocket or
  similar) that turns local edits into a shared stream across a
  room/team" — the only follow-up open on that idea, and closes
  `docs/features/shared-flow-sync.md`'s "Known gaps" entry for it.
  `apps/debate-ai.com/lib/database/schema.ts` adds a `flowSyncEdits` D1
  table (one row per `FlowEdit`, upserted by its caller-assigned `id`,
  indexed by `flowId`), generated via `drizzle-kit generate` into
  `drizzle/0002_first_mister_sinister.sql`. A new
  `app/api/flow-sync/route.ts` exposes `GET ?flowId&sinceMs` (every edit
  for that flow newer than `sinceMs`, oldest first, capped at 500) and
  `POST { id, flowId, boxPath, authorId, content, timestampMs }`
  (validates and upserts by `id`), mirroring `app/api/doc/documents/route.ts`'s
  `getDBFromContext()`/drizzle convention — a short-poll transport rather
  than a WebSocket/Durable Object push channel, consistent with this app's
  existing serverless (Cloudflare Workers + D1) architecture and the
  follow-up's own "WebSocket or similar" wording. `debate-round` adds
  `flow/flow-sync-client.ts` (`pullRemoteFlowEdits`/`pushFlowEditToServer`,
  the fetch layer, mirroring `round/coach-feedback-client.ts`'s
  pure-module/fetch-client split), `flow/flow-sync-cursor.ts`
  (`advanceSyncCursor`, the pure next-`sinceMs` bookkeeping), and
  `hooks/useFlowSyncPolling.ts` (the poll-loop/push binding —
  `status`/`lastError`/`pushEdit`, ~4s interval). `FlowEditLogPanel.tsx`
  gets a "Live sync on/off" toggle (scoped to the form's current Flow ID)
  and a status pill: while on, it polls for other contributors' edits to
  that flow and folds them into the existing local `state/flowEdits.ts`
  store (`saveFlowEdit` already dedups by id), and pushes newly logged
  edits to the server; a pull/push failure only updates the status
  pill — local logging keeps working regardless of network conditions.
  Vitest-covered in `packages/debate-round/test/flow-sync-client.test.ts`
  (pull/push request shape, endpoint overrides, empty-`edits`-field
  fallback, server-error-message propagation, non-JSON-error-body
  fallback) and `packages/debate-round/test/flow-sync-cursor.test.ts`
  (`advanceSyncCursor`: no-op on an empty pull, advances to the latest
  pulled timestamp, never moves backwards). The polling hook and the API
  route are not directly Vitest-covered, matching this repo's convention
  for other React hooks (e.g. `useWordCountSpeechMode`) and D1-backed API
  routes — instead verified by package typecheck, the production build
  (`/api/flow-sync` appears in the built route list), and a manual
  end-to-end run against the local D1 emulation (`bun run dev` +
  `wrangler d1 execute debate_db --local --file=drizzle/0002_first_mister_sinister.sql`):
  GET before any data returns `{"edits":[]}`, POST persists and returns the
  edit, GET with `sinceMs=0` returns it, GET with `sinceMs` at the edit's
  own timestamp correctly excludes it, and re-POSTing the same `id` with
  new content upserts in place rather than duplicating. Verified from a
  clean install: `bun install` (2050 packages), `bun run test` (152 files /
  2077 tests, all pass), `bun run typecheck` (11 in-scope packages pass —
  `debate-ai-web` has no `typecheck` script, so `app/api/flow-sync/route.ts`
  is covered by the build instead), and `bun run build` (both buildable
  packages pass, `/api/flow-sync` appears in the built route list). Docs
  updated at `docs/features/shared-flow-sync.md`. No repo-wide `lint`
  script exists (checked root/app/package `package.json` scripts) so none
  was run.
  PR: [#250](https://github.com/debate/debate-ai.com/pull/250).
- **Coaching Programs and Group Challenges — member practice-round setup/feedback wiring.**
  Closes idea #13's remaining "(c) wiring a member's practice-round
  setup/feedback (Practice Round Simulator) into the space" follow-up in
  TODO.md's Product Feature Ideas list, and closes
  `docs/features/coaching-programs.md`'s "Known gaps" entry (it had already
  been marked "no known gaps remain" prematurely — this was the one real gap
  left). `round/coaching-program.ts` adds a `CoachingProgramMemberPracticeRound`
  type (`contributorId` + `practice-round-simulator.ts`'s `PracticeRoundSetup`
  + optional `PracticeRoundFeedback`) and an optional `memberPracticeRounds`
  input/output on `buildCoachingProgramBoard`, composed the same way as the
  existing `memberFlows`/`memberDrills` pair — scoped to the program roster,
  keyed by `contributorId`. `state/roundContributorFlows.ts`'s new
  `buildCoachingProgramMemberPracticeRounds(memberIds)` resolves this
  entirely from already-persisted state: a roster member's recorded
  `RoundContributorFlowRecord.roundId` (added for the prior "roundId-to-contributor
  mapping" slice) already names the same id `state/practiceRounds.ts` keys its
  `PracticeRoundRecord`s by, so this just joins the two existing stores rather
  than needing a new contributorId-keyed practice-round store — a member
  whose recorded round has no persisted `PracticeRoundRecord` (no Practice
  Round Simulator session started for it) is simply excluded.
  `state/persistedCoachingProgramBoard.ts`'s `buildPersistedCoachingProgramBoard`
  now defaults `memberPracticeRounds` to that resolution (still overridable
  by an explicit argument, e.g. for tests), mirroring `memberFlows`'s
  existing default. `CoachingProgramsPanel.tsx`'s roster now shows a
  "Practice round recorded" badge per member (upgrading to "Practice round +
  feedback" once feedback has been generated), alongside the existing "Flow
  recorded" badge. `buildCoachingProgramSummaryText` gains a
  "N member practice round(s) recorded" status line, and a new
  `buildMemberPracticeRoundSummaryText` renders one member's setup (plus
  feedback once generated) as text, mirroring `buildMemberDrillSummaryText`.
  Vitest-covered in `packages/debate-round/test/roundContributorFlows.test.ts`
  (the join, roster filtering, missing-`PracticeRoundRecord` exclusion, and
  feedback inclusion), `packages/debate-round/test/coaching-program.test.ts`
  (board composition, roster scoping, summary-text pluralization, and the new
  per-member summary helper), and
  `packages/debate-round/test/persistedCoachingProgramBoard.test.ts`
  (defaulting from persisted state, excluding a flow with no matching
  practice round, and an explicit `memberPracticeRounds` argument overriding
  the persisted lookup). Docs updated at `docs/features/coaching-programs.md`.
  Verified from a clean install: `bun install` (2050 packages), `bun run test`
  (150 files / 2064 tests, all pass), `bun run typecheck` (11 in-scope
  packages pass), and `bun run build` (both buildable packages pass,
  `/coaching-programs` appears in the built route list). No repo-wide `lint`
  script exists (checked root/app/package `package.json` scripts) so none was
  run.
  PR: [#248](https://github.com/debate/debate-ai.com/pull/248).
- **Coaching Programs and Group Challenges — roundId-to-contributor mapping for member drill sets.**
  Closes the remaining "(b-continued, remaining)" follow-up named under idea
  #13 ("Coaching Programs and Group Challenges") in TODO.md's Product
  Feature Ideas list — "a roundId-to-contributor mapping so a member's
  already-flowed practice round can generate a drill set on this board" —
  and closes `docs/features/coaching-programs.md`'s "Known gaps" entry. A
  new `packages/debate-round/src/state/roundContributorFlows.ts` adds a
  `contributorId`-keyed localStorage store (`listRoundContributorFlows`/
  `getRoundContributorFlow`/`saveRoundContributorFlow`/
  `deleteRoundContributorFlow`/`buildAndSaveRoundContributorFlow`), mirroring
  the existing `argumentTrees.ts`/`vulnerabilityReports.ts` roundId-keyed
  persistence convention but keyed by contributor instead, so saving a new
  flow for a member overwrites their previous one rather than accumulating
  every round they've ever flowed — matching `round/coaching-program.ts`'s
  `CoachingProgramMemberFlow`, which only wants one current flow per member.
  Its `buildCoachingProgramMemberFlows(memberIds)` resolves a program
  roster's member flows straight from that store. `state/persistedCoachingProgramBoard.ts`'s
  `buildPersistedCoachingProgramBoard` now defaults its `memberFlows`
  parameter to that resolution (still overridable by an explicit argument,
  e.g. for tests) instead of always passing an empty list, so a program's
  live board picks up real member drill sets automatically.
  `CoachingProgramsPanel.tsx` gets a "Member flows" roster under each open
  program's board: a side-key input and "Save current flow" action per
  roster member that reads the live round workspace's currently selected
  flow (`state/store.ts`'s `useFlowStore`, imported directly — the one
  exception to this package's panels otherwise being self-contained, mirroring
  how `apps/debate-ai.com/components/coach/CoachHub.tsx` already documents
  `SharedFlowSyncPanel` as its one such exception) and records it via
  `buildAndSaveRoundContributorFlow`, showing a "Flow recorded"/"No flow
  recorded" badge per member plus a "Clear" action. No follow-ups remain open
  on idea #13. Vitest-covered in
  `packages/debate-round/test/roundContributorFlows.test.ts` (list/get/save/
  upsert/delete, `buildAndSaveRoundContributorFlow`, and
  `buildCoachingProgramMemberFlows` filtering to a given roster and excluding
  non-roster contributors) and new cases added to
  `packages/debate-round/test/persistedCoachingProgramBoard.test.ts`
  (defaulting member flows from a roster member's persisted record,
  excluding a persisted flow for a contributor outside the roster, and an
  explicit `memberFlows` argument still overriding the persisted lookup).
  Docs updated at `docs/features/coaching-programs.md`. Verified from a
  clean install: `bun install` (2050 packages), `bun run test` (150 files /
  2049 tests, all pass), `bun run typecheck` (11 in-scope packages pass), and
  `bun run build` (both buildable
  packages pass, `/coaching-programs` appears in the built route list). No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run.
  PR: [#246](https://github.com/debate/debate-ai.com/pull/246).
- **Video-Lecture-Training Coach AI — document-upload text extraction.**
  Closes the "document" half of follow-up (a) named in
  `team-coach-materials.ts`'s file doc-comment for idea #8
  ("Video-Lecture-Training Coach AI") in TODO.md's Product Feature Ideas
  list: "transcription/parsing that turns an uploaded recording or document
  into a `CoachMaterial`'s `text`." A new
  `packages/debate-speech-writer/src/coach/document-material-extraction.ts`
  adds `detectDocumentKind`/`extractMaterialTextFromDocument`, dispatching
  an uploaded file by extension — `.txt`/`.md`/`.markdown` are read
  directly via `Blob#text()`, `.docx` goes through `debate-card-parser`'s
  existing `convertDocxToHTML(file, { plainTextOnly: true })` (the same
  Verbatim-parsing pipeline `docx-to-cards.ts` already uses), reusing that
  OOXML pipeline rather than reimplementing it. `debate-speech-writer` now
  depends on `debate-card-parser` (`workspace:*`), mirroring
  `reason-editor`'s existing identical dependency. The extracted text is
  whitespace-normalized and validated non-empty, throwing a plain `Error`
  for an unsupported extension or a document with no readable text.
  `CoachMaterialsPanel.tsx` gets an "Upload a document" button next to the
  Material text field (mirroring `debate-round`'s `FileExportDialog.tsx`
  hidden-file-input convention) that fills the text field — and the title
  field, if still empty — from the extraction result, showing a plain error
  message on failure. Recording (audio/video) transcription, the other half
  of follow-up (a), remains open — no transcription service exists in this
  repo. `convertDocxToHTML`'s default renderer (`docx-preview`) needs a
  browser `DOMParser`, so the `.docx` path only works from this
  `"use client"` panel in a real browser; `extractMaterialTextFromDocument`
  takes an injectable `convertDocx` option so its dispatch/validation logic
  stays Vitest-covered under this repo's Node test environment without
  needing a DOM (confirmed by directly invoking `convertDocxToHTML` outside
  a DOM environment, which throws `ReferenceError: DOMParser is not
  defined` — the same reason no test exists anywhere in this repo for
  `debate-card-parser`'s own `docx-to-html.ts`). Vitest-covered in
  `packages/debate-speech-writer/test/document-material-extraction.test.ts`
  (`detectDocumentKind`: text/docx extensions, case-insensitivity, an
  unsupported or missing extension; `extractMaterialTextFromDocument`: a
  string text file's content whitespace-normalized, a `Blob` text file's
  content, an empty text file throws, an unsupported extension throws, a
  `.docx` file's text extracted through an injected `convertDocx` stub
  (asserting it's called with `{ plainTextOnly: true }`) and
  whitespace-normalized, and a `.docx` file yielding no readable text
  throws). Docs updated at `docs/features/coach-materials.md`. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run. Verified from a clean install: `bun install`
  (2050 packages), `bun run test` (149 files / 2033 tests, all pass),
  `bun run typecheck` (11 in-scope packages pass), and `bun run build`
  (both buildable packages pass, `/coach-materials` appears in the built
  route list). PR: [#244](https://github.com/debate/debate-ai.com/pull/244).
- **Shared Evidence Library — topic/case-area/tag filter controls.**
  Closes the "no topic/case-area/tag filter controls in the search half of
  the panel — only free text and kind are exposed" gap named in
  `docs/features/evidence-library.md`'s "Known gaps" for the "📋 Shared
  Evidence Library" bullet in TODO.md's Research Crowdsourcing Organizer
  Features list. `packages/debate-card-search/src/lib/shared-evidence-library.ts`
  adds `buildEvidenceSearchFormQuery`, a pure helper that narrows a search
  panel's five raw filter-field values (free text, kind, topic, case area,
  comma-separated tags) into an `EvidenceSearchQuery` — trimming
  `topic`/`caseArea` and parsing `tags` into a list, and omitting any blank
  field so it doesn't narrow the search — rather than requiring the panel to
  hand-assemble that query itself. `panels/EvidenceLibraryPanel.tsx` gains
  Topic/Case area/Tags filter inputs alongside the existing free-text search
  box and kind filter, all combined through this one helper; `searchEvidenceLibrary`
  and `searchPersistedEvidenceLibrary` already supported every one of these
  fields (no new search/ranking logic). Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts` (blank
  fields omitted from the built query, kind/topic/caseArea/tags each included
  when set, whitespace-only topic/caseArea trimmed away, comma-separated
  tags parsed and empty entries dropped, and the combined query verified
  against `searchEvidenceLibrary` directly). Docs updated at
  `docs/features/evidence-library.md`. Verified from a clean install:
  `bun install`, `bun run test` (148 files / 2023 tests passed), `bun run
  typecheck` (11 packages passed), `bun run build` (both buildable packages
  passed, `/cards/library` appears in the built route list) — no repo-wide
  `lint` script exists.
- **Coaching Programs and Group Challenges — coaching-program board UI.**
  Closes the dashboard-view half of the "(b-continued)" follow-up named
  under idea #13 ("Coaching Programs and Group Challenges") in the Product
  Feature Ideas list: "a dashboard view that renders each program's full
  `buildCoachingProgramBoard`, wiring `debate-round`'s `CoachingProgramsPanel`
  to this new store and a live topic-sprint composition." `debate-round`'s
  new `state/persistedCoachingProgramBoard.ts` adds
  `buildPersistedCoachingProgramBoard`, composing a program's config
  (`state/coachingPrograms.ts`), its topic sprint's inputs
  (`debate-card-search`'s `state/topicSprints.ts`'s
  `readPersistedTopicSprintInputs`), the persisted group-challenge roster
  (`state/groupChallenges.ts`), the real, persisted contribution feed
  (`state/contributions.ts`), and persisted win events
  (`state/challengeWinEvents.ts`) directly with `round/coaching-program.ts`'s
  existing `buildCoachingProgramBoard` — mirroring `topicSprints.ts`'s own
  "compose every input from its own store" convention — rather than requiring
  a caller to assemble all four. `CoachingProgramsPanel` now has a "View
  board" action per program that opens a topic input and renders the
  composed board's summary (via the existing `buildCoachingProgramSummaryText`)
  once a topic is entered, reusing `PrepRoomPanel`'s topic-switcher +
  `whitespace-pre-line` summary-text convention. `memberFlows` stays an
  empty, caller-supplied list — no `roundId`-to-contributor mapping for a
  member's flowed practice round is persisted anywhere in this repo yet, so
  member drills render as "No member drill sets yet" until that mapping
  exists — leaving the rest of the "(b-continued)" follow-up open, as noted
  in `docs/features/coaching-programs.md`'s "Known gaps." Vitest-covered in
  `packages/debate-round/test/persistedCoachingProgramBoard.test.ts`
  (undefined for an unknown program id, an empty topic sprint/challenge
  board when nothing else is stored, the persisted challenge roster/
  contribution feed/win events composed into live challenge-board standings,
  a contribution with no `submittedAt` excluded, and `memberDrills` staying
  empty with no supplied `memberFlows`). Documented at
  `docs/features/coaching-programs.md` (new). Verified from a clean install:
  `bun install`, `bun run test` (148 files / 2015 tests passed), `bun run
  typecheck` (11 packages passed), `bun run build` (both buildable packages
  passed, `/coaching-programs` appears in the built route list) — no
  repo-wide `lint` script exists.
- **Coaching Programs and Group Challenges — persisted challenge win events +
  live standings in the Group Challenges panel.** Closes the "persisted
  challenge win events" half of the "(b-continued)" follow-up named under
  idea #13 ("Coaching Programs and Group Challenges") in the Product Feature
  Ideas list: "a dashboard view that renders each program's full
  `buildCoachingProgramBoard` (still needs persisted challenge win events and
  topic-sprint contributions in a form the board could read live... none of
  which exist yet)". `debate-card-search`'s new `state/challengeWinEvents.ts`
  persists `group-challenges.ts`'s `ChallengeWinEvent` records to
  localStorage as one flat, squad-wide list — mirroring
  `group-challenges.ts`'s own design, where a win event isn't scoped to one
  challenge but matched against any `win_target` challenge whose roster and
  window contain it, the same way a `contribution_target` challenge matches
  against the shared contribution feed. Its new
  `buildPersistedGroupChallengeBoard` composes the persisted challenge
  roster (`state/groupChallenges.ts`), the real, persisted contribution feed
  (`state/contributions.ts`, reusing `dailyQuests.ts`'s `hasSubmittedAt`
  guard convention), and this store's persisted win events into a live
  `GroupChallengeProgress[]` board. `GroupChallengesPanel.tsx` now renders
  each challenge's live standings (via `group-challenges.ts`'s own
  `buildGroupChallengeSummaryText`, plus a per-member standing list with an
  MVP marker) below its config, and a `win_target` challenge gets a "Record a
  win" action (contributor ID + button) wired to `recordChallengeWinEvent` —
  closing the panel's own previously-noted gap: "it doesn't render
  `computeGroupChallengeProgress`'s live standings, since those need
  caller-supplied contributions/win events that aren't persisted in a form
  this panel could read live yet." The rest of the "(b-continued)" follow-up
  — wiring `CoachingProgramsPanel` (in `debate-round`) to render a program's
  full `buildCoachingProgramBoard` off this and the topic-sprint composition,
  plus a `roundId`-to-contributor mapping for member drills — remains open,
  not started; `debate-round` would need to depend on this new store the
  same way `coaching-program.ts` already depends on `group-challenges.ts`.
  Vitest-covered in
  `packages/debate-card-search/test/challengeWinEvents.test.ts`
  (`listChallengeWinEvents`: empty/corrupt/non-array storage; `recordChallengeWinEvent`:
  appends and accumulates events; `buildPersistedGroupChallengeBoard`: empty
  roster, a persisted win event reflected in a `win_target` challenge's
  standings, a win event outside the roster or window excluded, a persisted
  contribution reflected in a `contribution_target` challenge's standings,
  and a contribution with no `submittedAt` excluded). Verified from a clean
  install: `bun install`, `bun run test` (2010 tests passed), `bun run
  typecheck` (11/11 packages passed), `bun run build:web` (built
  successfully). PR: #240.

- **Peer Review System — gate a card's Shared Evidence Library visibility on
  its review lifecycle.** Closes follow-up (c) named under the "🗣️ Peer
  Review System" bullet in the Research Crowdsourcing Organizer Features
  list: "wiring a review's lifecycle to whatever eventually persists
  submitted cards, so `publishReview` can gate a card actually going live."
  `debate-card-search`'s `lib/peer-review.ts` now has `isCardLive`, a pure
  helper treating a card with no `CardReview` at all as live (peer review is
  opt-in, not required, mirroring this repo's other "works standalone, gated
  further once the gating feature exists" slices) and a card with an
  in-progress review (anything short of `published`) as not-yet-live.
  `state/evidenceLibraryEntries.ts`'s new `isEntryLive`/
  `listPendingReviewEntries` look up an `EvidenceLibraryEntry`'s review by
  treating its `id` as the review's free-form `cardId`, and
  `searchPersistedEvidenceLibrary` now filters to only live entries before
  searching — starting a review on an already-submitted card pulls it out of
  the shared library's search results until `publishReview` moves it to
  `published`. `EvidenceLibraryPanel` renders every held-back entry in a new
  "Pending review" section (still editable/deletable) so its author doesn't
  lose track of it. Follow-up (b), reviewer identity/permission checks, stays
  open — it still needs an auth/identity system this repo doesn't have, same
  as every other follow-up gated on that. Vitest-covered in
  `packages/debate-card-search/test/peer-review.test.ts` (`isCardLive`) and
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
  (`isEntryLive`, `listPendingReviewEntries`, and
  `searchPersistedEvidenceLibrary`'s new gating cases). Docs updated at
  `docs/features/review-queue.md` and `docs/features/evidence-library.md`.
  Verified: `bun run test` (146 files / 2000 tests passed), `bun run
  typecheck` (11 packages passed), `bun run build` (both buildable packages
  passed) — no repo-wide `lint` script exists.
  [PR #239](https://github.com/debate/debate-ai.com/pull/239).
- **Research Task Routing — "my tasks" inbox filter.** Closes follow-up (e)
  named under the "🧭 Research Task Routing" bullet in the Research
  Crowdsourcing Organizer Features list: "scoping the inbox to 'my tasks'
  once contributor identity/auth exists." This repo still has no
  auth/identity system, so — mirroring the "🔄 Strategy Sync Notes" assignee
  notification's identical free-form-id workaround — `debate-card-search`'s
  `state/routedTaskQueues.ts` now has `filterTaskInboxViewByContributor`,
  which scopes a `buildTaskInboxView` result down to one contributor's own
  assignments (dropping a topic entirely once none of its assignments
  match that contributor, and clearing `unassignedTasks` since an
  unassigned task isn't anyone's yet). `TaskInboxPanel` now has a "My
  tasks" field — a free-form contributor-id filter, not a login — that
  scopes the rendered inbox to it, closing the last open follow-up on the
  "Research Task Routing" bullet. Vitest-covered in
  `packages/debate-card-search/test/routedTaskQueues.test.ts` (empty view,
  a mixed-assignee topic keeping only the requested contributor, a topic
  with no matching assignments dropped entirely, `unassignedTasks` cleared
  on a surviving topic). Docs updated at
  `docs/features/task-inbox.md`. Verified: `bun run test` (146 files /
  1989 tests passed), `bun run typecheck` (11 packages passed), `bun run
  build` (both buildable packages passed) — no repo-wide `lint` script
  exists.
  [PR #238](https://github.com/debate/debate-ai.com/pull/238).
- **Strategy Sync Notes — assignee notification.** Closes follow-up (b)
  named under the "🔄 Strategy Sync Notes" bullet in the Research
  Crowdsourcing Organizer Features list: "an assignee notification once a
  notification system exists." No notification system existed anywhere in
  this repo before this slice; it adds the first one, scoped narrowly to
  the one event that follow-up named — a `PrepNote` being assigned to a
  teammate — rather than a speculative, general-purpose system for events
  that don't exist yet. `debate-round` now has
  `flow/prep-note-notifications.ts`'s `PrepNoteNotification` data model
  plus `createPrepNoteAssignedNotification`/`markNotificationRead`/
  `getNotificationsForRecipient`/`getUnreadNotifications`/
  `countUnreadForRecipient`/`buildNotificationSummaryText`, mirroring
  `flow/strategy-sync-notes.ts`'s own pure-model conventions. A persisted
  store, `state/prepNoteNotifications.ts`, saves `PrepNoteNotification`
  records to localStorage and adds `recordPrepNoteAssignedNotification`,
  which `state/prepNotes.ts`'s `assignPersistedPrepNote` now calls on every
  real assignment (not an unassignment), so assigning a note to a teammate
  actually notifies them instead of requiring a caller to build and save
  the notification itself. A new `PrepNoteNotificationsPanel` renders a
  recipient's notifications (looked up by a free-form teammate id, since
  this repo has no auth/identity system) newest first at `/notifications`,
  with a "Mark read" action per unread notification, wired into the global
  dock's Settings menu and mounted at
  `apps/debate-ai.com/app/notifications/page.tsx`. No follow-ups remain
  open on the "🔄 Strategy Sync Notes" bullet. Vitest-covered in
  `packages/debate-round/test/prep-note-notifications.test.ts` (the pure
  model), `packages/debate-round/test/prepNoteNotifications.test.ts` (the
  persisted store), and new cases added to
  `packages/debate-round/test/prepNotes.test.ts` (an assignment records a
  notification for the new assignee; an unassignment and an assignment to
  an unknown note id do not). Docs updated at
  `docs/features/prep-notes.md`. Verified: `bun run test` (146 files /
  1985 tests passed), `bun run typecheck` (11 packages passed), `bun run
  build` (both buildable packages passed, `/notifications` appears in the
  built route list) — no repo-wide `lint` script exists.
- **Speech Transcript Summaries and Answers — AI extraction from raw speech
  text.** Closes the AI-call half of follow-up (a) named under idea #6 in
  the Product Feature Ideas list: "audio/video transcription plus an AI
  call to extract claims/warrants/impacts/evidence from raw speech text
  rather than relying on a manually flowed grid." This slice adds the
  AI-call half only (a pasted transcript, not audio/video) — the
  transcription half stays open as a further follow-up, mirroring this
  repo's established "AI call now, richer input source later" slicing
  (e.g. Video-Lecture-Training Coach AI). `debate-round` now has
  `round/transcript-extraction-ai.ts` (prompt-build + parse, mirroring
  `judge-decision-ai.ts`'s structured-JSON split) and
  `round/transcript-extraction-client.ts` (the `/api/reason-ai` network
  call, mirroring `coach-feedback-client.ts`), converting extracted
  claim/warrant/impact/evidence arguments into synthetic `FlowRowSummary`
  rows (`buildFlowRowSummariesFromExtraction`) appended to a round's
  persisted flow summary via the existing `saveFlowSummary`. A "Generate
  from raw speech text" form is now wired into `FlowSummariesPanel`, so an
  extracted argument gets the same cross-exam/extension suggestions as any
  row derived from a manually flowed grid — no new panel-rendering logic
  was needed. Vitest-covered in
  `packages/debate-round/test/transcript-extraction-ai.test.ts` and
  `packages/debate-round/test/transcript-extraction-client.test.ts`. Docs
  updated at `docs/features/flow-summaries.md`. Verified: `bun run test`
  (144 files / 1959 tests passed), `bun run typecheck` (11 packages
  passed), `bun run build` (both buildable packages passed) — no
  repo-wide `lint` script exists.
- **Top Contributor Awards — finer-grained `ContributionKind` for original
  arguments and refutations.** Closes follow-up (a) named in
  `lib/contributor-awards.ts` and under the "🏆 Top Contributor Awards"
  bullet in the Research Crowdsourcing Organizer Features list in TODO.md: a
  finer-grained `ContributionKind` (or separate tag) for "original argument"
  and "refutation" contributions, neither of which exists as a distinct kind
  today. Adds `"original-argument"` and `"refutation"` to
  `community-rating.ts`'s `ContributionKind` union, extends
  `contributor-awards.ts`'s `DEFAULT_AWARD_CATEGORY_LABELS`/`kindOrder` with
  "Best Original Argument"/"Best Refutation" categories, and wires the two
  new kinds into every existing kind picker (`ContributionsFeedPanel`,
  `DailyQuestsPanel`, `GroupChallengesPanel`), so a contributor can now
  submit — and win an award for — an original-argument or refutation
  contribution, closing the last open follow-up on the "Top Contributor
  Awards" bullet. Vitest-covered in
  `packages/debate-card-search/test/contributor-awards.test.ts` (new cases
  for both kinds plus the extended stable-order assertion). Docs updated at
  `docs/features/contributor-awards.md`. Verified from a clean install:
  `bun install`, `bun run test` (142 files / 1937 tests passed), `bun run
  typecheck` (11 packages passed), `bun run build` (both buildable packages
  passed) — no repo-wide `lint` script exists.
  [PR #235](https://github.com/debate/debate-ai.com/pull/235).

- **Top Contributor Awards — announce/freeze action.** Closes follow-up (b)
  named under the "🏆 Top Contributor Awards" bullet in the Research
  Crowdsourcing Organizer Features list in TODO.md: "a scheduled job that
  periodically calls `buildTopContributorAwards` and persists/announces the
  winners." This repo has no scheduled-job infrastructure (same caveat
  already noted for the Daily Best Card Challenge's identical follow-up), so
  `debate-card-search` adds `state/contributorAwardAnnouncements.ts`'s
  `buildPersistedTopContributorAwards`/`announceContributorAwards`/
  `listAnnouncedContributorAwards`/`getAnnouncedContributorAwards`, mirroring
  `state/dailyBestCardAnnouncements.ts`'s idempotent-per-UTC-day
  freeze-on-announce pattern exactly: `announceContributorAwards` persists
  the current award standings under a separate
  `contributorAwardAnnouncements` storage key keyed by day, and a later
  same-day contribution that would change the live standings does not
  retroactively change an already-announced result. `ContributorAwardsPanel`
  now shows the live (unannounced) standings plus an "Announce today's
  awards" action (disabled when there's nothing to announce yet) that
  freezes them, and renders the announced history below, reusing
  `buildTopContributorAwardsFromStore` for the live view exactly as before —
  no new scoring or grouping logic. Vitest-covered in
  `packages/debate-card-search/test/contributorAwardAnnouncements.test.ts`
  (empty-store cases, announce-and-persist, the idempotent freeze against a
  later stronger same-day contribution, and the history/lookup helpers).
  Docs updated at `docs/features/contributor-awards.md`. Follow-up (a),
  a finer-grained `ContributionKind` (or separate tag) for "original
  argument" and "refutation" contributions, remains open — already being
  addressed by a separate, independent PR
  ([#228](https://github.com/debate/debate-ai.com/pull/228)) at the time
  of this entry. `bun run typecheck` (11 packages, all pass), `bun run
  test` (142 files / 1936 tests, all pass), and `bun run build` all pass.
  No repo-wide `lint` script exists (checked root/package `package.json`
  scripts), matching this bullet's prior entries. PR:
  [#233](https://github.com/debate/debate-ai.com/pull/233).
- **Legacy Verbatim / Cardmirror Compatibility — send-to-speech-document
  command.** Closes follow-up (b) named under idea #14 ("Legacy Verbatim /
  Cardmirror Compatibility") in the Product Feature Ideas list: "a 'send
  selected evidence to a speech document' command" — the last open gap
  noted in `docs/features/legacy-verbatim-shortcuts.md`'s "Known gaps"
  section. `reason-editor` adds `engine/speech-document.ts`'s
  `SpeechDocument`/`SpeechDocumentBlock` model plus
  `createSpeechDocument`/`buildSpeechDocumentBlock` (null for
  blank/whitespace-only text)/`appendSpeechDocumentBlock`/
  `removeSpeechDocumentBlock`/`buildSpeechDocumentText`, and
  `state/speechDocuments.ts` (mirroring the existing
  `collapsedHeadings.ts` localStorage-persistence convention — the second
  such store in this package) for list/get/save/delete plus
  `findSpeechDocumentByTitle` and `sendSelectionToSpeechDocument`
  (find-or-create by title, then build+append+save a block). A new
  `Mod-Shift-S` keyboard shortcut and "→Speech" toolbar button
  (`verbatim-shortcuts-extension.ts`'s
  `sendSelectionToSpeechDocumentViaPrompt`, wired into
  `Toolbar.tsx`) send the live editor selection — tagged with the
  editor's `exportName` as the block's `sourceLabel` — to a
  named speech document, prompting for its title and confirming with a
  short alert. A new `SpeechDocumentsPanel` renders every persisted speech
  document with its blocks (per-block "Remove"), a plain-text preview, and
  a per-document "Delete" action, mounted at `/speech-documents`.
  Vitest-covered in `packages/reason-editor/test/speech-document.test.ts`
  (model/pure-helper success and blank-text/no-op cases) and
  `packages/reason-editor/test/speechDocuments.test.ts` (persistence
  CRUD, corrupt/non-array storage, case-insensitive title matching,
  find-or-create send semantics, blank-text no-op). No follow-ups remain
  open on idea #14.
- **Shared, Ai-Generated Debate Flow — Common Argument Library flow-note
  suggestions.** Closes follow-up (c) named under idea #16 ("Shared,
  Ai-Generated Debate Flow") in the Product Feature Ideas list: "composing
  the Common Argument Library's tagged card corpus to suggest (not
  auto-apply) a pre-filled flow note from matching evidence." `debate-round`
  adds `flow/flow-note-suggestions.ts`'s `deriveLibraryCardKeywords`
  (mirroring `debate-card-search`'s `llm-card-scoring.ts#deriveArgBlockKeywords`
  — each of a `LibraryCard`'s `argBlock`/`topic`/`caseArea`/`tags` phrases
  kept whole plus its individual words over two characters),
  `suggestFlowNotesFromLibrary` (scores every card in a corpus against a
  query by reusing `scoreRelevance` directly, dropping zero-score cards,
  ranking by score with a deterministic id tie-break, and capping at a
  limit), and `buildFlowNoteFromCard` (formats a matched card into
  insertable note text). `debate-card-search`'s
  `state/evidenceLibraryEntries.ts` adds `listCombinedPersistedLibraryCards`,
  the same evidence-library-plus-tagged-contributions corpus
  `buildCombinedPersistedArgumentLibrary` already composed, now exposed flat
  for a caller (like this one) that scores individual cards instead of
  browsing the organized library; `buildCombinedPersistedArgumentLibrary`
  itself now composes that new function rather than duplicating the logic.
  `FlowEditLogPanel` loads the combined corpus on mount and, as the
  contributor types the edit's Content field, renders a "Suggested from
  Common Argument Library" list (recomputed via `useMemo`) with an Insert
  action per suggestion that fills Content with the card's formatted note —
  still fully editable before logging, never applied to the box
  automatically, keeping this idea's "keep humans in control of the actual
  flow" requirement intact. This is the last open follow-up on idea #16;
  only follow-up (a) (a live transport syncing edits across a room/team in
  real time) remains open. Vitest-covered in
  `packages/debate-round/test/flow-note-suggestions.test.ts` (keyword
  derivation, blank-query/no-match/matching/ranking/limit/tie-break cases,
  and note-formatting with and without tags) and a new
  `listCombinedPersistedLibraryCards` describe block in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`. Docs
  updated at `docs/features/shared-flow-sync.md`. `bun run test` (1898
  tests), `bun run typecheck` (11 packages), and `bun run build` all pass;
  no repo-wide `lint` script exists (checked root/package `package.json`
  scripts) so none was run, matching this bullet's prior entries.

- **Topic Coverage Dashboard — Contributions Feed as a second real
  argBlock/word-count source.** Closes follow-up (a) named under the
  "📊 Topic Coverage Dashboard" bullet in the Research Crowdsourcing
  Organizer Features list: "an `argBlock`/word-count field wired into a
  real card-submission flow beyond the existing `/cards/library`
  evidence-library form." `lib/contribution-leaderboard.ts`'s
  `AttributedContribution` gains an optional `wordCount` field, matching
  `topic-coverage.ts`'s `CoverageCardSummary.wordCount` tagging.
  `ContributionsFeedPanel` gains an optional "Content" body-text field
  (with a live word-count readout) that stamps `wordCount` on submission
  via the existing `computeWordCount` helper — the same one
  `EvidenceLibraryPanel` already uses. `state/trackedArguments.ts`'s
  `buildPersistedTopicCoverageReport` now composes every topic-scoped
  Contributions Feed entry carrying both `argBlock` and `wordCount`
  alongside the existing evidence-library entries into the coverage
  report, so a card submitted through either flow counts toward a
  topic's coverage. A contribution missing either field (both stay
  optional, matching the rest of that form) is silently excluded rather
  than counted with a fabricated word count. Vitest-covered by four new
  cases in `packages/debate-card-search/test/trackedArguments.test.ts`.
  Docs updated at `docs/features/topic-coverage-dashboard.md`. `bun run
  test` (1885 tests), `bun run typecheck` (11 packages), and `bun run
  build` all pass; no repo-wide `lint` script exists (checked
  root/package `package.json` scripts), matching this bullet's prior
  entries.

- **Shared, Ai-Generated Debate Flow — FlowSpreadsheet edit-review/log
  affordance.** Closes the remaining half of follow-up (b) named under idea
  #16 ("Shared, Ai-Generated Debate Flow") in the Product Feature Ideas
  list: "a `FlowSpreadsheet`-grid affordance for logging/reviewing an edit
  (today's `FlowEditLogPanel` is a separate form, not part of the grid
  itself)." `debate-round` adds `flow/edit-cells.ts`'s
  `sortEditsNewestFirst` (reusing `annotation-cells.ts`'s
  `boxPathForCell`/`columnIndexFromField` directly — box-path derivation is
  generic to any per-cell, box-addressed feature, not specific to
  annotations), `state/flowEdits.ts`'s `listFlowEditsForBox` (mirroring
  `flowAnnotations.ts#listFlowAnnotationsForBox`), `flow/EditBadge.tsx` (a
  commit-icon badge that, unlike `AnnotationBadge`, always renders — a box
  with zero edits is exactly when a contributor wants to log one), and
  `flow/EditReviewPopover.tsx` (a fixed-position overlay mirroring
  `GridContextMenu`'s click-outside/Escape-to-close pattern, since an AG
  Grid cell clips normal in-flow content). `AnnotationCellRenderer` and
  `FirstColumnCellRenderer` now render `EditBadge` alongside the existing
  `AnnotationBadge`, and `useFlowGridConfig`/`FlowSpreadsheet` wire an
  `onOpenEditReview` callback (positioning the popover from the clicked
  badge's event, the same way `onCellContextMenu` positions
  `GridContextMenu`) into both renderers. A contributor can now see and log
  a box's proposed edits directly from the live grid instead of switching
  to the separate `FlowEditLogPanel` form on the Coach hub. Vitest-covered
  in `packages/debate-round/test/edit-cells.test.ts`,
  `packages/debate-round/test/EditBadge.test.tsx`, and a new
  `listFlowEditsForBox` describe block in
  `packages/debate-round/test/flowEdits.test.ts`. Docs updated at
  `docs/features/shared-flow-sync.md`. `bun run test` (1881 tests), `bun
  run typecheck` (11 packages), and `bun run build` all pass; no
  repo-wide `lint` script exists (checked root/package `package.json`
  scripts) so none was run, matching this bullet's prior entries.

- **LLM Card Scoring — real argument-block keywords and a real submitted-card
  corpus.** Closes follow-up (b) named under the "🧠 LLM Card Scoring" bullet
  in the Research Crowdsourcing Organizer Features list: "wiring real
  argument-block keywords and a real submitted-card corpus into the scorer."
  `lib/llm-card-scoring.ts` adds `deriveArgBlockKeywords`, a pure helper
  turning a topic's tracked argument-block labels (e.g. "Warming DA") into
  `scoreRelevance`-ready keywords — the label itself plus its individual
  words (longer than two characters, so short tags like "DA"/"CP" don't
  drown out real words). `state/cardScores.ts` adds
  `deriveArgBlockKeywordsForTopic`, composing that pure helper against a
  topic's already-persisted tracked-argument checklist
  (`state/trackedArguments.ts`), and `buildRealCorpusTexts`, pulling every
  persisted Shared Evidence Library entry's text
  (`state/evidenceLibraryEntries.ts`) as the real, site-wide uniqueness
  comparison corpus — `buildPersistedCardScoreRanking` now passes that corpus
  into `rankCardScores` by default, so a submitted card is flagged as a
  likely duplicate against the team's actual shared card repository, not
  just other cards submitted through this scoring form. `CardScoringPanel`
  gains a topic switcher (mirroring `TopicCoverageDashboardPanel`'s pattern)
  and a "Use tracked keywords" action that fills the keywords field from
  `deriveArgBlockKeywordsForTopic`, still editable before submitting — a
  topic with no tracked arguments yet, or no topic chosen at all, still
  falls back to hand-typed keywords so ad hoc scoring keeps working. No
  follow-ups remain open on this bullet. Docs updated at
  `docs/features/llm-card-scoring.md`. `bun run test` (1859 tests), `bun run
  typecheck` (11 packages), and `bun run build` all pass; no repo-wide
  `lint` script exists (checked root/package `package.json` scripts) so
  none was run, matching this bullet's prior entries.

- **Team Collaboration Mode — persisted topic-sprint composition.** Closes
  follow-up (b) named under the "🤝 Team Collaboration Mode" bullet in the
  Research Crowdsourcing Organizer Features list: "persisting a topic
  sprint's other inputs (so the full `buildTopicSprint` composition can be
  rendered, not just the note thread)." Previously
  `panels/TopicSprintPanel.tsx` — an existing panel rendering
  `team-collaboration-mode.ts`'s full `buildTopicSprint` composition (quest
  board, task routing, progress board, notes) — required its caller to
  hand-supply `quests`/`contributions`/`coverageReport`/`assignments` on
  every render; only `contributors` and `notes` already defaulted to
  persisted state. Its one real caller, `apps/debate-ai.com/components/
  research/ResearchHub.tsx`'s Sprint tab, worked around this by hand-
  deriving a coverage report straight from the evidence library and always
  passing `contributions: []`, so the quest board could never show real
  progress and the coverage report ignored the topic's own tracked-argument
  checklist. `debate-card-search` adds `state/topicSprints.ts`
  (`readPersistedTopicSprintInputs`/`buildPersistedTopicSprint`), composing
  all six `buildTopicSprint` inputs from their own already-persisted
  stores — `state/dailyQuests.ts`'s quest templates, `state/contributions.ts`'s
  timestamped contributions, `state/trackedArguments.ts`'s
  `buildPersistedTopicCoverageReport`, `state/contributorAvailability.ts`,
  a new `state/researchProgress.ts` `listTrackedAssignmentsForTopic`
  (this topic's completed-plus-still-active assignments, scoped down from
  the same completed-task history and routed queues
  `buildPersistedResearchProgressBoard` already reads across every topic),
  and `state/sprintNotes.ts` — mirroring `state/prepRooms.ts`'s
  `buildPersistedPrepRoom` "compose every input from its own store"
  convention rather than requiring a caller to assemble them.
  `TopicSprintPanel` now makes those four props optional, re-reading
  `readPersistedTopicSprintInputs` whenever its `topic` prop changes and
  falling back to it for any prop the caller doesn't override, and
  `ResearchHub.tsx`'s Sprint tab now just passes a `topic`, dropping its
  hand-derived coverage report, quest list, and routing-based assignment
  list entirely. `sprint.routing` itself is unchanged — it's still a live
  re-route of the topic's current coverage gaps against current contributor
  availability, not a readback of whatever was last routed and saved to
  `routedTaskQueues.ts`; only `sprint.progressBoard` reads the persisted
  routed/completed assignments. Vitest-covered in
  `packages/debate-card-search/test/topicSprints.test.ts` (each input read
  individually against an empty store and a populated one, plus an
  end-to-end composed sprint) and a new `listTrackedAssignmentsForTopic`
  describe block in `test/researchProgress.test.ts` (empty/combined/topic-
  scoped-exclusion cases). No follow-ups remain open on this bullet. Docs
  updated at `docs/features/team-collaboration-mode.md`. `bun run test`
  (1848 tests), `bun run typecheck`, and `bun run build` all pass; no
  repo-wide `lint` script exists (checked root/package `package.json`
  scripts) so none was run, matching this bullet's prior entries.

- **Common Argument Library — Contributions Feed topic/caseArea/tags
  wiring.** Closes follow-up (a) named under the "📚 Common Argument
  Library" bullet in the Research Crowdsourcing Organizer Features list:
  "wiring a `topic`/`caseArea`/`tags` field into wherever submitted cards
  are eventually persisted beyond the existing evidence-library store."
  Previously the Common Argument Library (`/cards/argument-library`) only
  organized entries submitted through the dedicated `/cards/library`
  Evidence Library form — a contribution submitted through the more
  general-purpose Contributions Feed (`/cards/contributions`) had no way to
  be filed into a topic folder or tag collection, since
  `contribution-leaderboard.ts`'s `AttributedContribution` carried no
  `topic`/`caseArea`/`tags` fields at all. `contribution-leaderboard.ts`
  adds optional `topic`/`caseArea`/`tags` fields to
  `AttributedContribution`, mirroring its existing optional `argBlock`
  convention. `argument-library.ts` adds `contributionToLibraryCard` (a
  pure conversion from a tagged contribution to a `LibraryCard`, excluding
  a contribution missing `topic` or `caseArea` — both required on
  `LibraryCard` but optional on a contribution, since not every
  contribution is filed into the library — and falling back to
  `"Untagged"`/`0` for `argBlock`/`wordCount`, since a contribution carries
  no card body to measure a real word count from) and
  `buildLibraryCardsFromContributions`. `state/evidenceLibraryEntries.ts`
  adds `buildCombinedPersistedArgumentLibrary`, composing the persisted
  evidence-library repository with every persisted, tagged Contributions
  Feed submission (via `state/contributions.ts`'s already-exported
  `listContributions`) into one combined library.
  `ContributionsFeedPanel.tsx`'s submission form gains optional Topic/Case
  area/Tags fields (plumbed the same optional-spread way as the existing
  Argument block field) and a per-entry badge row rendering
  `topic`/`caseArea`/`tags` when present. `ArgumentLibraryPanel.tsx` now
  reads through `buildCombinedPersistedArgumentLibrary` instead of the
  evidence-library-only `buildPersistedArgumentLibrary` (which remains,
  unchanged, for any other caller). No follow-ups remain open on this
  bullet. Vitest-covered in
  `packages/debate-card-search/test/argument-library.test.ts`
  (`contributionToLibraryCard`'s tagged/defaulted/missing-topic/
  missing-caseArea/both-missing cases, `buildLibraryCardsFromContributions`'
  filtering) and `evidenceLibraryEntries.test.ts` (`buildCombinedPersistedArgumentLibrary`'s
  empty/evidence-only/combined/excluded-contribution cases). `bun run test`
  (1847 tests), `bun run typecheck`, and `bun run build` all pass; no
  repo-wide `lint` script exists, matching this file's prior entries.

- **Outline Filters and Argument Tree View — argument-type/contributor/
  evidence-status tagging.** Closes follow-up (b) named under the "Outline
  Filters and Argument Tree View" bullet (idea #10) in the Product Feature
  Ideas list: "finer argument-type tagging (link/impact/turn/answer/
  extension) and contributor/evidence-status fields, none of which exist in
  the `Box`/`Flow` schema today." Previously `argument-tree.ts`'s
  `ArgumentTreeNode`/`ArgumentTreeFilter` could only distinguish
  heading-vs-argument rows and filter by speech/side/unanswered status,
  since `debate-core`'s `Box` type carried no argument-role, authorship, or
  evidence-support metadata. `packages/debate-core/src/types/flow.ts` adds
  an `ArgumentType` union (`"contention" | "link" | "impact" | "turn" |
  "answer" | "extension"`), an `EvidenceStatus` union (`"cited" |
  "contested" | "unverified"`), and three new optional `Box` fields —
  `argumentType`, `authorId` (mirroring `FlowEdit.authorId`'s existing
  per-edit attribution convention from idea #16), and `evidenceStatus`.
  `flow-transcript-summary.ts`'s `summarizeFlowRow` now reads these off a
  row's underlying `Box` (the same box `isHeading` is already read from)
  onto `FlowRowSummary`, `argument-tree.ts`'s `toNode` carries them onto
  `ArgumentTreeNode`, and `ArgumentTreeFilter` gained matching
  `argumentType`/`authorId`/`evidenceStatus` fields applied in
  `argumentMatches` alongside the existing checks — a heading is still kept
  whenever it has at least one surviving descendant, so the new filters
  compose with the existing heading-grouping behavior for free.
  `ArgumentTreePanel` gets three new filter selects (Argument type,
  Contributor, Evidence status — the first two populated from the tree's
  own distinct values, mirroring the existing Side/Speech select pattern)
  and per-row badges (argument-type badge, contributor id, evidence-status
  badge with "contested" rendered as a destructive badge). No follow-ups
  remain open on this idea; nothing in the live flow-editing UI lets a user
  set these new `Box` fields yet (populating them today requires setting
  them directly on a `Box`), as noted in
  `docs/features/argument-tree-outline.md`'s "Known gaps". Vitest-covered
  in `packages/debate-round/test/flow-transcript-summary.test.ts` (pass-
  through and undefined-when-unset) and `argument-tree.test.ts` (node
  pass-through plus filtering by each new field individually and combined
  with `kind: "argument"`). `bun run test` (1836 tests), `bun run
  typecheck`, and `bun run build` all pass; no repo-wide `lint` script
  exists (checked root/package `package.json` scripts) so none was run,
  matching this bullet's prior entries.

- **Scout-to-Strategy Workflow — AI-panel case-choice evaluation.** Closes
  follow-up (c) named under the "🧭 Scout-to-Strategy Workflow" bullet in the
  Research Crowdsourcing Organizer Features list: "an actual AI-panel
  evaluation of case choice instead of the tag-overlap heuristic." Previously
  `StrategyPanel.tsx`'s case recommendation came entirely from
  `scout-to-strategy.ts`'s deterministic tag-overlap heuristic — no AI
  evaluation of case fit against the judge's tendencies or the matchup's
  risk factors. Adds `round/case-choice-ai.ts` (`buildCaseChoiceAiUserPrompt`/
  `parseCaseChoiceAiResponse`, mirroring `judge-decision-ai.ts`'s
  prompt/parse split) and `round/case-choice-client.ts`
  (`requestCaseChoiceEvaluation`, posting to the existing `/api/reason-ai`
  Anthropic proxy). The prompt composes an already-built
  `StrategyRecommendation`'s own case rankings (name, tags, opponent-tag
  overlap score), judge-adaptation notes, and risk level/factors — no new
  scouting data source is introduced — asking the model to weigh a case's
  fit against the judge's tendencies and the matchup's risk factors, not
  just the raw overlap score. `StrategyPanel.tsx` gets a "Get AI case-choice
  evaluation" action per matchup that calls this and saves the parsed
  `recommendedCase`/`reasoning`/`caseAssessments` on
  `state/strategyRecommendations.ts`'s new
  `StrategyRecommendationRecord.aiCaseChoice` field via the new
  `saveStrategyRecommendationAiCaseChoice` (additive/optional, mirroring
  `drillSets.ts`'s `aiScripts` convention), rendering it alongside the
  deterministic recommendation. Vitest-covered in
  `packages/debate-round/test/case-choice-ai.test.ts` (prompt composition,
  fallback text for empty case options/risk factors, tolerant JSON
  parsing — well-formed, fenced, prose-wrapped, malformed-entry filtering),
  `case-choice-client.test.ts` (the `/api/reason-ai` request contract,
  endpoint override, error propagation, unparseable-response handling,
  mirroring `judge-decision-client.test.ts`), and additions to
  `strategyRecommendations.test.ts` covering
  `saveStrategyRecommendationAiCaseChoice` (set/overwrite/no-op-when-missing/
  leaves-other-matchups-untouched). No follow-ups remain open on this idea.
  `docs/features/scout-to-strategy.md` updated. `bun run test` (1828 tests),
  `bun run typecheck`, and `bun run build` all pass; no repo-wide `lint`
  script exists (checked root/package `package.json` scripts) so none was
  run, matching this bullet's prior entries.

- **Scout-to-Strategy Workflow — side-aware risk heuristic.** Closes
  follow-up (b) named under the "🧭 Scout-to-Strategy Workflow" bullet in
  the Research Crowdsourcing Organizer Features list: "wiring
  `ourSide`/likely opponent side into the risk heuristic." Previously
  `assessMatchupRisk` in `packages/debate-round/src/round/scout-to-strategy.ts`
  flagged any notable opponent side preference or judge side bias as risky,
  without knowing which side our team is running — so it couldn't tell
  whether the opponent's strong side or the judge's favored side was
  actually the side we'd face. `scout-to-strategy.ts` adds
  `getLikelyOpponentSide` (the side opposite `ourSide`, since a round is
  two-sided) and threads an optional `ourSide?: DebateSide` through
  `BuildStrategyRecommendationInput`/`BuildStrategyRecommendationFromStoresInput`
  into `assessMatchupRisk`. When `ourSide` is known, the opponent-side check
  is scoped to their win rate specifically on the likely-opponent side (≥2
  recorded rounds there, ≥65% win rate) instead of any notable side
  preference, and the judge-side check only flags a bias toward the
  likely-opponent side — a bias toward our own side is no longer treated as
  a risk factor. Without `ourSide`, both checks fall back to the prior
  side-agnostic behavior, so existing callers are unaffected.
  `StrategyPanel.tsx` gets an "Our side" selector (Aff/Neg/Unspecified)
  wired into the build action. Vitest-covered in
  `packages/debate-round/test/scout-to-strategy.test.ts` (`getLikelyOpponentSide`
  both directions; `assessMatchupRisk`/`buildStrategyRecommendation`/
  `buildStrategyRecommendationFromStores` with `ourSide` supplied: flags the
  opponent's strong record on the likely-opponent side, does not flag their
  strong record on the side they won't face us on, ignores a likely-side
  record below the 2-round minimum, flags a judge bias toward the
  likely-opponent side, and does not flag a judge bias toward our own
  side). Follow-up (c) — an actual AI-panel evaluation of case choice
  instead of the tag-overlap heuristic — remains open, not started. Docs
  added at `docs/features/scout-to-strategy.md`. No repo-wide `lint` script
  exists (checked root/app/package `package.json` scripts) so none was run.
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (133 files / 1806 tests, all pass), `bun run typecheck` (all 11
  in-scope packages pass), and `bun run build:web` (`debate-ai-web`
  succeeds, `/strategy` route present) all pass. PR:
  [#222](https://github.com/debate/debate-ai.com/pull/222).
- **Shared, Ai-Generated Debate Flow — Flow Edit Log + real merge-preview
  data source.** Closes the data-source gap called out under "Feature
  panels" (PR #214) for idea #16 ("Shared, Ai-Generated Debate Flow") in
  Product Feature Ideas: `SharedFlowSyncPanel` merged and flagged
  conflicts in whatever `FlowEdit[]` it was handed, but nothing recorded
  one, so `CoachHub` always passed an empty array and the panel only ever
  rendered its own-edits empty state. `debate-round`'s
  `flow/shared-flow-sync.ts` adds `createFlowEdit`/`CreateFlowEditInput`,
  mirroring `flow-annotations.ts#createFlowAnnotation`'s validation style
  (non-empty `boxPath`, non-blank `authorId`, `content` trimmed and
  length-clamped). A new `state/flowEdits.ts` persists `FlowEdit` records
  to localStorage (`listFlowEdits`/`listFlowEditsForFlow`/`saveFlowEdit`/
  `deleteFlowEdit`/`clearFlowEditsForFlow`), mirroring the existing
  `flowAnnotations.ts`/`prepNotes.ts` convention. A new
  `panels/FlowEditLogPanel.tsx` renders a log-an-edit form (Flow ID,
  Author ID, Box path, Content) plus every logged edit grouped by flow,
  with a "Clear" action per group and an optional `onChange` callback for
  a composing screen. `apps/debate-ai.com/components/coach/CoachHub.tsx`
  now reads every logged edit through `debate-ui`'s `useStoreSnapshot`,
  filters to the round workspace's currently selected flow, hands the
  result to `SharedFlowSyncPanel` as real `edits` (replacing the
  hardcoded `edits={[]}`), mounts `FlowEditLogPanel` alongside it wired to
  refresh that snapshot, and wires `SharedFlowSyncPanel`'s `onApply` to
  write the merged flow back into the round workspace's `useFlowStore`
  and clear the flow's logged edits so an applied edit doesn't linger and
  get re-offered for merging next time. `SharedFlowSyncPanel` itself is
  unchanged — still the only panel driven entirely by props. Follow-ups
  (a) a live transport (e.g. WebSocket) and (c) suggesting a pre-filled
  flow note from matching evidence remain open, not started; follow-up
  (b)'s `FlowSpreadsheet`-grid affordance (as opposed to the separate
  `FlowEditLogPanel` form) is also still open. Vitest-covered in
  `packages/debate-round/test/shared-flow-sync.test.ts` (`createFlowEdit`:
  valid input, trimming, empty-content clearing, length-clamping,
  empty-`boxPath`/blank-`authorId` validation errors) and
  `packages/debate-round/test/flowEdits.test.ts` (empty/corrupt/non-array
  storage, cross-flow listing/ordering, upsert-by-id, delete,
  clear-by-flow). Docs added at `docs/features/shared-flow-sync.md`. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run. Verified: `bun install` (2050 packages),
  `bun run test` (133 files / 1798 tests, all pass), `bun run typecheck`
  (all 11 in-scope packages pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/coach` route present) all pass. PR:
  [#221](https://github.com/debate/debate-ai.com/pull/221).
- **Flow-in-Speech Flow Annotations — `FlowSpreadsheet` annotation
  affordance.** Closes follow-up (b) under idea #15 ("Flow-in-Speech Flow
  Annotations") in Product Feature Ideas: "a flow-grid affordance
  (`FlowSpreadsheet`) that surfaces annotations on their box via
  `listFlowAnnotationsForBox` and links back to the timestamp." New
  `debate-round`'s `flow/annotation-cells.ts` adds `boxPathForCell` (derives
  a grid cell's `boxPath` from its row's `originalIndex` and column index,
  matching how `dataTransform.ts#buildRowData` flattens a box chain via
  `children[0]`), `columnIndexFromField`, and `pickJumpAnnotation` (earliest
  annotation by timestamp). `flow/AnnotationBadge.tsx` renders a small clock
  badge (tooltip listing every annotation's formatted timestamp + note) on
  any cell whose box has a persisted `FlowAnnotation`; a new
  `flow/AnnotationCellRenderer.tsx` wires it into every `FlowSpreadsheet`
  column after the first, and `FirstColumnCellRenderer.tsx` now renders the
  same badge alongside its existing heading/indent/chevron behavior.
  Clicking a badge calls a new `handleJumpToAnnotation` in
  `FlowSpreadsheet.tsx` that reuses `FlowAnnotationsPanel.handleJump`'s
  exact `sendYouTubeCommand`/`useVideoPlayerStore` mechanism and guard
  (seeks/plays only when the annotation's `videoId` matches the recording
  currently loaded in the persistent player; otherwise a no-op). No new
  annotation data model or persistence changes — this composes the
  already-existing `flow/flow-annotations.ts` +
  `state/flowAnnotations.ts` with the live grid. No follow-ups remain open
  on idea #15. Vitest-covered in
  `packages/debate-round/test/annotation-cells.test.ts` (box-path
  derivation including the negative-column-index clamp, field parsing, and
  earliest-annotation selection including a non-mutation check) and
  `packages/debate-round/test/AnnotationBadge.test.tsx` (empty vs.
  populated render, singular/plural wording, tooltip content). Verified:
  `bun run test` (132 files / 1781 tests, all pass), `bun run typecheck`
  (11 of 12 in-scope packages have a typecheck script; all pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/debate` and
  `/annotations` routes present) all pass. No repo-wide `lint` script
  exists, so none was run.
  PR: [#220](https://github.com/debate/debate-ai.com/pull/220).
- **Common Argument Library — tag-autocomplete affordance.** Closes
  follow-up (c), "a tag-autocomplete/tag-management affordance," under the
  "📚 Common Argument Library" bullet in Research Crowdsourcing Organizer
  Features. `debate-card-search`'s `lib/argument-library.ts` adds
  `parseTagsInput` (splits a comma-separated tags field into its
  already-completed tags and the in-progress fragment still being typed
  after the last comma), `applyTagSuggestion` (replaces that fragment with a
  chosen suggestion, leaving a trailing `", "` so typing can continue), and
  `suggestTags` (ranks a known-tag corpus against the in-progress fragment —
  case-insensitive prefix matches first, then substring matches, each group
  alphabetical — excluding tags already added to the field and the exact tag
  already typed in full, capped at a default of 8). `state/
  evidenceLibraryEntries.ts`'s new `listPersistedTags` supplies that corpus
  by reusing `buildTagCollections` over the persisted evidence repository
  directly, rather than introducing a separate tag registry. `
  EvidenceLibraryPanel`'s Tags field now renders the live suggestions (and
  refreshes its known-tag corpus after every save) as click-to-append
  buttons beneath the input, so a contributor reuses an existing tag instead
  of coining a near-duplicate, without changing the field's existing
  free-text, comma-separated shape. Tag renaming/merging across existing
  entries — the fuller "tag-management" half of the follow-up's name — is
  out of scope; nothing in this repo persists a separate tag registry to
  manage, and rewriting every entry that carries a renamed tag is a
  separate, riskier slice than autocomplete. Vitest-covered in
  `packages/debate-card-search/test/argument-library.test.ts` (`
  parseTagsInput`'s trailing-comma/blank-segment/no-comma cases,
  `applyTagSuggestion`'s first-tag/mid-field/trailing-comma cases, and
  `suggestTags`'s empty-query, prefix-vs-substring ranking, case-insensitive
  matching, exclude-already-added, exclude-exact-match, default/explicit
  limit, and case-insensitive-dedup cases). Verified: `bun run test` (130
  files / 1769 tests, all pass), `bun run typecheck` (11 of 12 in-scope
  packages have a typecheck script; all pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/cards/library` route present) all pass. No
  repo-wide `lint` script exists, so none was run.
  PR: [#219](https://github.com/debate/debate-ai.com/pull/219).
- **Team Collaboration Mode / Collaboration Prep Room — shared "active now"
  presence signal.** Closes follow-up (c) under the "🤝 Team Collaboration
  Mode" bullet in Research Crowdsourcing Organizer Features ("a
  presence/live-status signal for who's currently active") and, reusing the
  exact same primitive, follow-up (b) under the "🧑‍🤝‍🧑 Collaboration Prep
  Room" bullet ("a live presence/who's-active signal") — TODO.md's own
  earlier note on the Prep Room entry already flagged these as the same
  signal. There's no WebSocket (or other live-transport) infrastructure
  anywhere in this repo, so presence is modeled as an explicit,
  caller-recorded heartbeat rather than a push signal: new
  `debate-card-search`'s `lib/topic-presence.ts` adds a `PresenceHeartbeat`
  model (one heartbeat per topic + contributor pair, upserted via
  `recordPresenceHeartbeat`) and `listActiveContributors`, which treats a
  contributor as "active" only while their most recent heartbeat for that
  topic is within a freshness window (5 minutes by default, via
  `DEFAULT_PRESENCE_STALE_AFTER_MS`). `state/topicPresence.ts` persists
  heartbeats to localStorage under `topicPresenceHeartbeats`, mirroring the
  existing `sprintNotes.ts`/`prepNotes.ts` persistence convention. Wired into
  both already-shipped panels: `SprintNotesPanel.tsx` (`/cards/collaboration`)
  now renders each topic group's live "active now" roster plus a "Your ID" +
  "I'm active here" control per topic, and `PrepRoomPanel.tsx`
  (`/cards/prep-room`) renders the same roster/control for its single open
  topic — both re-poll `listPersistedActiveContributors` every 30 seconds
  client-side so a contributor who goes quiet drops off the roster without
  needing a new write. No changes to either panel's existing note/search/
  routing behavior. Vitest-covered in
  `packages/debate-card-search/test/topic-presence.test.ts` (pure
  heartbeat-upsert and freshness-window logic, including the exact
  stale-boundary millisecond and future-timestamped clock-skew cases) and
  `test/topicPresence.test.ts` (the persisted store, including corrupt/
  non-array localStorage recovery). No follow-ups remain open on either
  bullet. Verified: `bun run test` (130 files / 1751 tests, all pass),
  `bun run typecheck` (11 of 12 in-scope packages have a typecheck script;
  all pass), and `bun run build:web` (`debate-ai-web` succeeds, both
  `/cards/collaboration` and `/cards/prep-room` routes present) all pass. No
  repo-wide `lint` script exists, so none was run.
  PR: [#218](https://github.com/debate/debate-ai.com/pull/218).
- **Daily Quests and Targets — streak/reward layer on the quest board.**
  Closed follow-up (c) under the "🎯 Daily Quests and Targets" bullet in
  Research Crowdsourcing Organizer Features: "a streak/reward layer once
  the Gamified Quests idea's streak logic is composed in." Added
  `buildStreakRewardText` to `lib/gamified-quests.ts` — a pure helper that
  renders a contributor's already-computed `ContributorQuestStreak` as a
  reward line, calling out a badge earned exactly today separately from
  badges earned on prior days — and wired a "Your streak" section into
  `DailyQuestsPanel` with a "Record today's mission" action that composes
  the existing `computeAndSavePersistedDailyMissionResult`/
  `buildPersistedContributorQuestStreak` from `state/dailyMissionResults.ts`
  (the same helpers `QuestStreaksPanel` already used). No changes to any
  persistence or streak-computation logic — this is a composition and
  reward-messaging layer only. No follow-ups remain open on this bullet.
  Merged as [PR #217](https://github.com/debate/debate-ai.com/pull/217).
  Vitest-covered in `packages/debate-card-search/test/gamified-quests.test.ts`
  (6 new cases: no streak yet, continuing an existing streak, a plain
  non-milestone completion, a freshly-earned milestone badge, not
  re-announcing a badge earned on a prior day, and a custom milestone
  list). Docs added in `docs/features/daily-quests.md`. Verified:
  `bun run test` (125 files / 1701 tests, all pass), `bun run typecheck`
  (11 of 12 in-scope packages have a typecheck script; all pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/cards/quests` route
  present) all pass; `codecov/patch` and `codecov/project` both reported
  success on the PR. No repo-wide `lint` script exists, so none was run.
  The PR's only failing check was `Vercel` (account-wide "Deployment rate
  limited — retry in 24 hours"), the same infra-level daily quota that hit
  PR #209 earlier the same day — unrelated to this diff, confirmed via the
  identical error message and target URL, and nothing to fix in code.
- **Word-Count-Only Speech Format — live-round word-limited speech mode.**
  Closed follow-up (b) under idea #2 ("Word-Count-Only Speech Format"):
  "extending `useTimerState`/`SpeechTimer` to support a non-timed,
  word-limited speech mode in the live round timer itself." Added
  `round/word-count-speech-mode.ts` (limit resolution, mode state, store
  round-trip through the existing `wordCountRounds` store),
  `hooks/useWordCountSpeechMode.ts`, and `debate-timer`'s
  `SpeechWordCounter`, wiring a word-limit toggle into `SpeechHeaderBar`
  that replaces the live countdown with a `words / limit` meter. Merged as
  [PR #209](https://github.com/debate/debate-ai.com/pull/209). Vitest-covered
  in `packages/debate-round/test/word-count-speech-mode.test.ts` (18 tests).
  Verified: `bun run test`, `bun run typecheck`, `bun run build:web` all
  pass. Correction to this PR's own docs: `docs/features/word-count-rounds.md`
  had flagged "the mobile `FlowPageHeader` countdown is unchanged" as a known
  gap, but `FlowPageHeader.tsx` is dead code — it is not imported or rendered
  anywhere in the app. The component actually used for both desktop and
  mobile (via its `onMobileMenuClick` prop, wired in `DebateRoundPanel.tsx`
  whenever `state.isMobile`) is `SpeechHeaderBar` itself, which already
  renders the word-limit toggle and `SpeechWordCounter` in every layout mode
  (split view and spreadsheet view alike). So the mobile experience already
  has the word-limit meter; no further follow-up is needed on this idea.
- **Community-Rated Summaries and Highlights — real reviewer-credibility
  system.** Closes follow-up (b) under idea #11 ("Community-Rated Summaries
  and Highlights") in the Product Feature Ideas list: "a real
  reviewer-credibility system instead of a caller-supplied weight per
  endorsement (the feed's 'Endorse' button records a fixed full-credibility
  placeholder)". `debate-card-search`'s `lib/community-rating.ts` gains
  `computeReviewerCredibility(reviewerContributions, weights?)` (pure) —
  derives a 0-1 endorsement-credibility weight from a reviewer's own scored
  contribution history: the average blended helpfulness score of their own
  contributions (via the existing `computeHelpfulnessBreakdown`), dampened
  toward a `MIN_REVIEWER_CREDIBILITY` (0.1) floor while their contribution
  count is below a saturation threshold (5), so one or two lucky
  contributions can't buy full endorsement weight immediately, and a
  reviewer with no contributions of their own still gets a low, non-zero
  floor weight rather than nothing. `state/contributions.ts` gains
  `recordPersistedEndorsementFromReviewer(id, reviewerId)`, composing this
  with the existing `listContributionsByContributor`/`recordPersistedEndorsement`
  to look up the endorsing reviewer's own persisted contributions, derive
  their credibility, and record the endorsement — the existing
  `recordPersistedEndorsement(id, reviewerWeight)` (raw-weight) function is
  unchanged and still used internally. `ContributionsFeedPanel.tsx`'s
  "Endorse" action now requires a typed "Reviewer ID" (mirroring
  `ReviewQueuePanel`'s existing reviewer-id-input convention) instead of
  always recording a fixed `reviewerWeight: 1`. Vitest-covered in
  `packages/debate-card-search/test/community-rating.test.ts`
  (`computeReviewerCredibility`: no-history floor, dampened low-history
  case, saturated high-history case, history-count cap, strong-vs-weak
  track record ordering, never exceeds 1) and
  `packages/debate-card-search/test/contributions.test.ts`
  (`recordPersistedEndorsementFromReviewer`: derives weight from the
  reviewer's real persisted history, floors at `MIN_REVIEWER_CREDIBILITY`
  for an unknown reviewer, no-op for a missing contribution id). Docs
  updated at `docs/features/contribution-leaderboard.md`'s "Known gaps".
  Verified: `bun install` (2050 packages), `bun run test` (123 files / 1670
  tests, all pass), `bun run typecheck` (all 12 in-scope packages pass),
  and `bun run build:web` (`debate-ai-web` succeeds) all pass. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run. PR: [#216](https://github.com/debate/debate-ai.com/pull/216).
- **Feature panels — shared panel kit, two workspace hubs, and the two
  remaining slice panels.**
  [PR #214](https://github.com/debate/debate-ai.com/pull/214).
  `packages/debate-ui/src/panels/panel-shell.tsx` adds the shared panel
  vocabulary (`PanelShell`/`PanelSection`/`StatGrid`/`StatTile`/`MeterBar`/
  `Pill`/`PanelRow`/`EmptyState`/`SummaryText`/`LabeledField`, with one
  five-value tone scale — neutral/info/positive/warning/critical — that the
  coverage, status and risk vocabularies across the slices all map onto), and
  `packages/debate-ui/src/panels/use-store-snapshot.ts` adds the hook a
  props-free panel reads a store through: it defers the `localStorage` read to
  an effect after mount so a server render and the first client render agree,
  and hands back a `refresh()` for panels that write.
  <br />
  This PR was opened against a tree where almost no slice had a screen yet and
  proposed one panel per slice. By the time it merged, every one of those
  slices had already grown its own panel on master, mounted on its own route
  and — for card scoring, the AI-versus round, the evidence library, the
  brainstorm board and flow annotations — wired to a real `/api/reason-ai`
  call this PR's versions did not have. Those panels were kept as they are;
  only the two panels covering a slice with no screen at all landed here:
  `debate-card-search`'s `TopicSprintPanel` (the full `buildTopicSprint`
  composition — quest board, routing, per-contributor progress and the shared
  note wall for one topic, where `SprintNotesPanel` renders only the notes,
  closing follow-up (b) under "🤝 Team Collaboration Mode") and
  `debate-round`'s `SharedFlowSyncPanel` (a merge preview over
  `flow/shared-flow-sync.ts`, flagging boxes two partners edited within the
  same conflict window). Each package's `src/panels/index.ts` is now a barrel
  its `src/index.ts` re-exports wholesale, so a new panel no longer needs a
  second export line.
  <br />
  **App surface** — `/research` (`components/research/ResearchHub.tsx`) and
  `/coach` (`components/coach/CoachHub.tsx`) are tabbed hubs grouping every
  existing panel by the stage of work it belongs to, both reachable from the
  dock's settings menu. The individual `/cards/*` and round routes still mount
  the same panels one at a time; the hubs are the view for working across
  them. Since each panel reads its own store, the hubs are almost pure
  navigation — the exceptions are the two prop-driven panels above, for which
  the research hub derives the coverage report, coverage quests and routed
  assignments from the persisted evidence library and availability profiles,
  and the coach hub passes the flow currently selected in the round
  workspace's zustand store. Where no data source exists yet (quest
  contributions carry no timestamp in the contribution store, and nothing
  records `FlowEdit`s), the hub passes an empty list and the panel renders its
  own empty state instead of fabricating data.
  <br />
  `reason-editor`'s existing `OutlineNavPanel` already covers the outline nav
  this PR also proposed — and additionally syncs the collapsed set into the
  live `collapsedHeadingsPlugin` and offers per-heading Move ↑/↓ — so its
  `OutlinePanel` was dropped rather than added alongside. Vitest-covered by
  render tests in `packages/debate-ui/test/panel-shell.test.tsx`,
  `packages/debate-card-search/test/panels.test.tsx` (`TopicSprintPanel`) and
  `packages/debate-round/test/panels.test.tsx` (`SharedFlowSyncPanel`) —
  these render through `react-dom/server` rather than a DOM testing library,
  since every package's Vitest environment is `node`. No repo-wide `lint`
  script exists (checked root/app/package `package.json` scripts) so none was
  run. Verified: `bun install`, `bun run typecheck` (all 11 in-scope packages
  pass), `bun run test`, and `bun run build:web` (`debate-ai-web` succeeds,
  `/research` and `/coach` routes present) all pass.
- **Daily Best Card Challenge — persisted announcements.**
  [PR #192](https://github.com/debate/debate-ai.com/pull/192).
  Closes follow-up (b) under the "🕵️ Daily Best Card Challenge" bullet in
  Research Crowdsourcing Organizer Features — "a scheduled job or view that
  persists/announces the day's winner." Follow-ups (a) and (c) were already
  closed by the earlier "Daily Best Card Challenge — banner/widget UI" slice
  below, which composes `state/contributions.ts`'s
  `buildDailyBestCardsFromStore`/`getTodaysBestCardFromStore` — themselves
  reading the `submittedAt` timestamp `ContributionsFeedPanel` already stamps
  on every submission — into the `/cards/best-card` banner. A new
  `packages/debate-card-search/src/state/dailyBestCardAnnouncements.ts` layers
  announcements on top of those existing store helpers rather than re-reading
  and re-narrowing the contribution store itself:
  `buildPersistedDailyBestCards`/`getPersistedBestCardForDay` delegate to them
  (so every result stays an `AttributedDailyBestCard`, keeping the winner's
  `contributorId`), and `announceDailyBestCard` freezes a day's computed
  winner under a separate `dailyBestCardAnnouncements` localStorage key, keyed
  by UTC day. It is idempotent, so a stronger card submitted after a day is
  announced does not retroactively change that day's recorded winner.
  `listAnnouncedDailyBestCards`/`getAnnouncedDailyBestCard` read that
  announcement history back. `DailyBestCardPanel` (still mounted at
  `/cards/best-card`, reachable from the global dock's Settings menu as
  "Daily Best Card") now renders today's live leader — with its contributor,
  helpfulness score, likes, and saves — behind an "Announce today's winner"
  action, showing the frozen announced winner for the day once announced,
  plus the history of previously announced days. No follow-ups remain open on
  this idea. Documented in `docs/features/daily-best-card.md`. Vitest-covered
  in `packages/debate-card-search/test/dailyBestCardAnnouncements.test.ts`
  (empty-store cases, filtering out non-card and undated contributions,
  the live-leader lookup, announce/idempotency including the
  later-stronger-card-doesn't-change-the-announcement case, and listing/
  lookup of announced history). No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run. Verified:
  `bun install` (2050 packages), `bun run test`, `bun run typecheck` (all 11
  in-scope packages pass), and `bun run build:web` (`debate-ai-web` succeeds,
  `/cards/best-card` route present, no new route) all pass.
- **Gamified Quests — daily mission-check trigger UI.**
  Closes follow-up (a) under the "🎮 Gamified Quests" bullet in the
  Research Crowdsourcing Organizer Features list — "a real trigger, i.e. a
  UI action or scheduled job, to call
  `computeAndSavePersistedDailyMissionResult` on an actual cadence." No
  scheduled-job/cron infrastructure exists anywhere in this repo (every
  feature here is client-side, localStorage-backed), so this closes the
  follow-up with a UI action rather than a background job.
  `debate-card-search`'s `QuestStreaksPanel` (at `/cards/streaks`) gains a
  "Run today's mission check" form — a free-text contributor id (mirroring
  `DailyQuestsPanel`/`ContributionsFeedPanel`'s existing no-auth
  convention, since no contributor identity/auth system exists) plus a
  button that calls the already-existing
  `computeAndSavePersistedDailyMissionResult(contributorId,
  listQuestTemplates(), Date.now())` — composing `state/dailyQuests.ts`'s
  saved quest-template roster with `state/dailyMissionResults.ts`'s
  existing compute-and-save helper, which itself already reads a
  contributor's real, persisted contributions — and re-renders the roster
  via the panel's existing `buildPersistedQuestStreakRoster` read path. An
  empty contributor id shows a form-level validation error instead of
  calling the store. No new lib/state logic was introduced or changed;
  this wires an existing, already-Vitest-covered helper into the UI for
  the first time. No follow-ups remain open on this bullet. Docs added in
  `docs/features/quest-streaks.md`. Verified: `bun install` (2050
  packages), `bun run test` (119 files / 1590 tests, all pass — the
  existing `test/dailyMissionResults.test.ts` coverage of
  `computeAndSavePersistedDailyMissionResult` was untouched by this
  change), `bun run typecheck` (11 of 12 in-scope packages have a
  typecheck script; all pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/cards/streaks` route present, no new
  route) all pass. No repo-wide `lint` script exists (checked root/app/
  package `package.json` scripts) so none was run.
- **Team Brainstorm Assist — seed boards from coverage gaps.**
  Closes the "boards aren't seeded from the coverage-gap prompts" gap noted
  under the "🧠 Team Brainstorm Assist" bullet in the Research Crowdsourcing
  Organizer Features list in `docs/features/brainstorm-board.md`'s Known
  gaps section. `packages/debate-card-search/src/state/brainstormIdeas.ts`
  adds `buildBrainstormBoardsPanelViewForTopic(topic)`, composing the
  already-persisted `state/trackedArguments.ts`'s
  `buildPersistedTopicCoverageReport` with the existing, previously-unused
  pure `lib/team-brainstorm-assist.ts` `buildBrainstormBoardsForCoverageGaps`
  to produce one board per under-covered tracked argument/category pair —
  each showing its seeding prompt even with zero submitted ideas — merged
  with every other board that already has at least one submitted idea but
  isn't itself a coverage-gap seed, so nothing previously visible disappears
  once a topic is chosen. `BrainstormBoardPanel.tsx` gains a topic switcher
  (mirroring `TopicCoverageDashboardPanel`'s free-text input + saved-topic
  buttons, reading the same tracked topics via `listTrackedTopics`) that
  swaps the board list between the topic-less `buildBrainstormBoardsPanelView`
  and the new topic-scoped view, plus a "No ideas submitted yet." hint on an
  empty board and a topic-aware empty-state message. No new coverage-gap or
  ranking logic was introduced — this is a composition and rendering layer
  only. Vitest-covered in
  `packages/debate-card-search/test/brainstormIdeas.test.ts` (a seeded board
  with no ideas yet, a seeded board populated with an already-submitted
  idea, merging in a non-seed board with a submitted idea, and an untracked
  topic falling back to exactly the topic-less board list). Docs updated in
  `docs/features/brainstorm-board.md`. Verified: `bun install` (2050
  packages), `bun run test` (120 files / 1602 tests, all pass), `bun run
  typecheck` (11 of 12 in-scope packages have a typecheck script; all pass),
  and `bun run build:web` (`debate-ai-web` succeeds, `/cards/brainstorm`
  route present, no new route) all pass. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
- **Legacy Verbatim / Cardmirror Compatibility — editor keyboard-shortcut
  wiring.** Closes follow-up (a) under idea #14 ("Legacy Verbatim /
  Cardmirror Compatibility") in the Product Feature Ideas list: "wiring
  these commands into actual keyboard-shortcut handlers in
  `reason-editor`'s toolbar/editor view". `debate-card-parser`'s
  `moveOutlineNode` is now generic (`<T>` instead of hardcoded to
  `OutlineNode`) so a caller with its own outline shape — not just this
  module's `Card`/`OutlineItem` — can reuse the same bounds-checked swap
  directly; its `resolveHtmlBoundary` and the swap itself also gained two
  non-null assertions the array accesses already guaranteed safe, needed
  once this file is typechecked under `reason-editor`'s stricter
  `noUncheckedIndexedAccess` setting (see below). `reason-editor` gains
  two new engine modules: `engine/verbatim-shortcuts.ts`
  (`applyCondenseToHtml`, wrapping `condenseCardHtml` with a no-op
  fallback when nothing's underlined; `buildInsertShortCiteTransaction`,
  reusing `formatShortCiteTag` to insert a "Smith 24"-style short cite tag
  at the selection, marked `cite_mark`) and `engine/outline/heading-move.ts`
  (`buildMoveHeadingSectionTransaction`, reusing `moveOutlineNode` to
  validate/resolve a heading swap against the live document's
  `OutlineHeading[]` then swapping the two headings' document ranges via a
  ProseMirror transaction; `findHeadingAtPos`, resolving which heading's
  section the cursor is currently in). A new `VerbatimShortcuts` TipTap
  extension (`react/verbatim-shortcuts-extension.ts`) binds four
  shortcuts on the live editor: `Mod-Shift-K` (insert short cite),
  `Mod-Shift-D` (condense to read text), `Alt-ArrowUp`/`Alt-ArrowDown`
  (move the current heading's section), and `Mod-Shift-E` for emphasis —
  bound to the schema's own `toggleMark('emphasis_mark')` rather than
  `debate-card-parser`'s HTML-string `toggleEmphasisHtml`, since the
  schema already models emphasis as a real mark (the same one the
  existing "Emph" toolbar button toggles); using the raw-HTML helper
  against a live ProseMirror document would be the wrong layer.
  `condenseCardHtml`/`formatShortCiteTag`/`moveOutlineNode` are imported
  from their specific `debate-card-parser` source files rather than the
  package barrel, so `reason-editor`'s typecheck isn't forced to also
  clear the many pre-existing `noUncheckedIndexedAccess` errors in
  unrelated parser modules (`citation-extractor.ts`, `card-utils.ts`,
  etc.) the barrel re-exports — out of scope for this slice.
  `react/Toolbar.tsx` gains "+Cite"/"Condense" buttons; `react/OutlineNavPanel.tsx`
  gains a Move ↑/↓ button pair per heading (the mouse-driven counterpart to
  the Alt-Arrow shortcuts). `condenseCardHtml`/`toggleEmphasisHtml`'s
  follow-up (c) ("send selected evidence to a speech document") remains
  open — needs a speech-document send target that doesn't exist yet — as
  does the "video-lecture" idea's transcription follow-up, unrelated. Docs
  added at `docs/features/legacy-verbatim-shortcuts.md`. Vitest-covered in
  `packages/debate-card-parser/test/verbatim-shortcuts.test.ts` (new
  "generic" case: `moveOutlineNode` against a caller-shaped
  `{id, level}` array unrelated to `Card`/`OutlineItem`),
  `packages/reason-editor/test/verbatim-shortcuts.test.ts`
  (`applyCondenseToHtml`: condenses/joins/falls-back cases;
  `buildInsertShortCiteTransaction`: dated/undated cite insertion,
  replacing an existing selection, blank-author no-op), and
  `packages/reason-editor/test/heading-move.test.ts`
  (`buildMoveHeadingSectionTransaction`: swap down/up, content travels
  with its heading, out-of-bounds/unknown-id no-ops;
  `findHeadingAtPos`: mid-section, on-heading, and empty-outline cases).
  Verified: `bun install` (2050 packages), `bun run test` (122 files /
  1656 tests, all pass), `bun run typecheck` (all 11 in-scope packages
  pass — this slice is what first exercised `debate-card-parser`'s source
  under `reason-editor`'s stricter typecheck settings, hence the two
  non-null-assertion fixes above), and `bun run build:web`
  (`debate-ai-web` succeeds, `/reason-editor` route present, no new
  route) all pass. No repo-wide `lint` script exists (checked root/app/
  package `package.json` scripts) so none was run.
- **Revision Incentives — evidence-staleness signal.** Closes follow-up (c)
  under the "🔁 Revision Incentives" bullet in the Research Crowdsourcing
  Organizer Features list below, also the sole "Known gap" in
  `docs/features/revision-incentives.md` ("No evidence-staleness signal
  beyond rewarding a refresh after the fact"). `lib/revision-incentives.ts`
  gains `computeEvidenceStaleness(evidenceYear, currentYear)` (pure) — an
  `EvidenceStalenessSignal` flagging a citation stale once it's
  `STALE_EVIDENCE_THRESHOLD_YEARS` (3) years old or older, or has no
  parseable year at all (`evidenceYear === 0`) — a forward-looking signal
  independent of any revision, unlike the existing `evaluateRevision`'s
  `evidenceRefreshed`, which only rewards a refresh after it happens.
  `lib/shared-evidence-library.ts` gains `getEvidenceStaleness`, composing
  that directly against `deriveCardSnapshotFromEntry`'s parsed
  `evidenceYear` for a real `EvidenceLibraryEntry`, and
  `getStaleEvidenceEntries`, filtering a list down to stale `card` entries
  (a reusable analytic `block` never cites outside evidence, so it's
  excluded). `panels/EvidenceLibraryPanel.tsx` now renders a "Stale
  evidence" badge on any `card` search result flagged stale as of the
  current year, so a contributor sees which cards need a refresh before
  editing, not only after. No new scoring logic was introduced beyond the
  staleness threshold itself. Docs updated at
  `docs/features/revision-incentives.md` (Known gaps now empty) and
  `docs/features/evidence-library.md`. Vitest-covered in
  `packages/debate-card-search/test/revision-incentives.test.ts`
  (`computeEvidenceStaleness`: at/just-below the age threshold, an unknown
  year, a current-year citation, and a future-dated citation clamped to
  zero age) and
  `packages/debate-card-search/test/shared-evidence-library.test.ts`
  (`getEvidenceStaleness`: old/recent/undated/blank citations;
  `getStaleEvidenceEntries`: excludes blocks and fresh cards, returns empty
  when nothing is stale). Verified: `bun install` (2050 packages), `bun run
  test` (120 files / 1638 tests, all pass), `bun run typecheck` (all 11
  in-scope packages pass), and `bun run build:web` (`debate-ai-web`
  succeeds, `/cards/library` route present, no new route) all pass. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run. PR: https://github.com/debate/debate-ai.com/pull/210.
- **Shared Evidence Library — edit/delete affordance wired to Revision Incentives.**
  Closes the "No edit/delete affordance in the panel" gap noted in
  `docs/features/evidence-library.md`'s Known gaps, and follow-up (a) under
  the "🔁 Revision Incentives" bullet in the Research Crowdsourcing Organizer
  Features list ("wiring an actual card-edit/save flow to call
  `saveRevisionRecord` with a before/after snapshot"). `lib/shared-evidence-library.ts`
  gains `deriveCardSnapshotFromEntry`, which derives a Revision Incentives
  `CardSnapshot` from a real `EvidenceLibraryEntry` — reusing the existing
  `llm-card-scoring.ts` `scoreClarity`/`scoreUsability` heuristics directly
  for `qualitySignals`, and parsing a 4-digit year out of the entry's `cite`
  for `evidenceYear`/`citationCompleteness` (no citation scores 0, a citation
  with a parseable year scores 1, any other non-blank citation scores 0.5) —
  and `buildEvidenceEntryRevision`, which composes that derivation over a
  before/after entry pair into a `CardRevision`. No new scoring logic was
  introduced; `evaluateRevision`/`buildRevisionIncentiveLeaderboard` are
  reused unchanged. `state/evidenceLibraryEntries.ts` gains
  `saveEvidenceLibraryEntryRevision`, which composes
  `buildEvidenceEntryRevision` against this store's own before (looked up by
  id) and after (the caller's edit) entries and records the result via the
  already-persisted `saveRevisionRecord` — but only when the save overwrites
  an existing entry id, so a brand-new submission never records a spurious
  revision. `panels/EvidenceLibraryPanel.tsx` now renders **Edit** and
  **Delete** actions on every search result: Edit loads the entry back into
  the submission form (now labeled "Editing entry …") with a required "Your
  contributor ID" field, and saving calls `saveEvidenceLibraryEntryRevision`
  instead of a plain overwrite; Delete calls the already-existing
  `deleteEvidenceLibraryEntry`. A real edit through this flow now shows up on
  the Revision Incentives leaderboard at `/cards/revisions`, which previously
  had no way to ever gain a row. No follow-ups remain open on the "no edit/
  delete affordance" gap; follow-up (c) under "Revision Incentives" (a real
  evidence-staleness signal beyond rewarding a refresh after the fact)
  remains open, not started. Docs updated at
  `docs/features/evidence-library.md` and
  `docs/features/revision-incentives.md`. Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts`
  (`deriveCardSnapshotFromEntry`: year-parsing/citation-completeness across a
  dated citation, an undated non-blank citation, and a blank citation, plus
  `wordCount` and `qualitySignals` derivation; `buildEvidenceEntryRevision`:
  correct `cardId`/`contributorId` wiring and an end-to-end
  `evaluateRevision` score for both a real rewarded edit and a no-op edit)
  and `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
  (`saveEvidenceLibraryEntryRevision`: a brand-new entry records no
  revision, an overwrite records one crediting the given contributor, and
  successive edits each record their own revision). Verified: `bun install`
  (2050 packages), `bun run test` (120 files / 1627 tests, all pass), `bun
  run typecheck` (all 11 in-scope packages pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/cards/library` and `/cards/revisions` routes
  present, no new route) all pass. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
- **Research Progress Tracking — feed topic-progress history into Progress Unlocks tier computation.**
  Closes follow-up (c) under the "📈 Research Progress Tracking" bullet in the
  Research Crowdsourcing Organizer Features list ("feeding a contributor's
  topic-progress history back into `progress-unlocks.ts`'s tier
  computation," also called out as the sole "Known gap" in both
  `docs/features/progress-unlocks.md` and
  `docs/features/research-progress-tracking.md`). `lib/progress-unlocks.ts`'s
  `UnlockTierRequirement` gained a `minCompletedTaskCount` threshold, and
  `computeContributorTier` now reaches a tier via the existing
  contribution-count-and-score AND-path **or** by clearing
  `minCompletedTaskCount` alone — a contributor's real, persisted
  completed-research-task count (already folded into a `ContributorStats`
  row by `state/researchProgress.ts`'s existing
  `buildPersistedLeaderboardWithCompletedTasks`) is now a genuine,
  alternate tier-qualifying signal, not just a leaderboard column, so
  completing enough routed research tasks (`research-task-routing.ts`) can
  unlock a tier even without matching scored-contribution volume/quality.
  Backward compatible: every existing fixture's `completedTaskCount`
  defaults to 0, so the new OR-clause is a no-op unless real
  task-completion data is supplied. `ContributorUnlockStatus` now surfaces
  `completedTaskCount` and `NextTierProgress` a `completedTasksNeeded`
  field; `buildUnlockStatusText` mentions the task-completion path.
  `lib/unlock-streak-status.ts`'s
  `buildContributorUnlockStatusWithStreakFromStore`/`buildUnlockStatusRoster`
  now source their `ContributorStats` from
  `buildPersistedLeaderboardWithCompletedTasks` instead of
  `state/contributions.ts` alone, so a contributor who has completed
  research tasks but no scored contribution yet now also appears in the
  Progress Unlocks roster. `panels/ProgressUnlocksPanel.tsx` renders a new
  "Tasks completed" column. Docs updated at
  `docs/features/progress-unlocks.md` and
  `docs/features/research-progress-tracking.md`. Vitest-covered in
  `packages/debate-card-search/test/progress-unlocks.test.ts` (tier reached
  via completed tasks alone, the highest tier across both paths, next-tier
  `completedTasksNeeded`, and backward compatibility for the pre-existing
  AND-path fixtures) and
  `packages/debate-card-search/test/unlock-streak-status.test.ts` (real
  completed-task history feeding a store-backed status, and a task-only
  contributor appearing in the roster). Verified: `bun install` (2050
  packages), `bun run typecheck` (all in-scope packages pass), `bun run
  test` (120 files / 1616 tests, all pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/cards/progress` route present) all pass. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run.
- **Daily Best Card Challenge — banner/widget UI.**
  Closes follow-up (c) — "a challenge banner/widget UI" — under the "🕵️ Daily
  Best Card Challenge" bullet in the Research Crowdsourcing Organizer
  Features list. `state/contributions.ts` gains `buildDailyBestCardsFromStore`/
  `getTodaysBestCardFromStore`, which filter every persisted contribution
  down to `kind: "card"` entries carrying a `submittedAt` timestamp and
  compose them directly with the existing `lib/daily-best-card.ts`'s
  `buildDailyBestCards`/`getBestCardForDay` — no new scoring or day-grouping
  logic was introduced. This also confirms follow-up (a) ("wiring a
  `submittedAt` timestamp into wherever card contributions are eventually
  persisted") was already closed as a side effect of the earlier "Daily
  Quests and Targets" slice, which stamps `submittedAt` on every
  `ContributionsFeedPanel` submission. `panels/DailyBestCardPanel.tsx`
  (mounted at `/cards/best-card`, added to the Settings nav menu) renders
  today's UTC-day winner as a highlighted banner plus every earlier day's
  winner as a history list, so a coach or contributor can see the day's
  top card and past winners without needing a separate ballot UI — a card's
  existing likes/saves in the Contributions Feed already model the
  community "vote". Follow-up (b), a scheduled job to persist/announce a
  day's winner automatically, remains open — not started; this repo has no
  cron/scheduled-task mechanism yet. Docs added at
  `docs/features/daily-best-card.md`. Vitest-covered in
  `packages/debate-card-search/test/contributions.test.ts`
  (`buildDailyBestCardsFromStore`/`getTodaysBestCardFromStore`: picks one
  winner per represented day from persisted card contributions, excludes
  non-card contributions and cards without a `submittedAt` timestamp, and
  returns the correct/`null` result for a given day). Verified: `bun install`
  (2050 packages), `bun run test` (120 files / 1609 tests, all pass),
  `bun run typecheck` (all 11 in-scope packages pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/cards/best-card` route present) all pass. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run.
- **Research Task Routing — task-routing trigger UI.**
  Closes follow-up (d) under the "🧭 Research Task Routing" bullet in the
  Research Crowdsourcing Organizer Features list — "a task-routing trigger
  UI to actually populate a topic's queue" — and the "No task-routing
  trigger UI yet" known gap noted in `docs/features/task-inbox.md`.
  `packages/debate-card-search/src/state/routedTaskQueues.ts` gains
  `routePersistedTopicTasks`, which composes `state/trackedArguments.ts`'s
  `buildPersistedTopicCoverageReport` (a topic's tracked-argument checklist
  against the shared evidence library) directly with the existing
  `buildAndPersistRoutingResult`, so a caller can route and persist a
  topic's queue from nothing but a topic id — no new routing logic was
  introduced. `panels/TaskInboxPanel.tsx` (mounted at `/cards/inbox`) now
  renders a "Route a topic's tasks" form above the inbox — a topic input
  (with one-click suggestions from every topic that already has a tracked
  checklist, via `listTrackedTopics`) plus a "Route tasks" button that calls
  `routePersistedTopicTasks` and refreshes the inbox view — so a coach or
  contributor can populate a topic's task queue from the inbox itself
  instead of needing a separate trigger. No follow-ups remain open on this
  bullet. Docs updated in `docs/features/task-inbox.md`. Vitest-covered in
  `packages/debate-card-search/test/routedTaskQueues.test.ts`
  (`routePersistedTopicTasks`: routes and persists a topic's live coverage
  gaps end-to-end through the persisted tracked-argument checklist and
  evidence library, and scopes correctly — tracked arguments filed under a
  different topic don't leak into the routed report). Verified: `bun
  install` (2050 packages), `bun run test` (120 files / 1604 tests, all
  pass), `bun run typecheck` (all 11 in-scope packages pass), and `bun run
  build:web` (`debate-ai-web` succeeds, `/cards/inbox` route present, no new
  route) all pass. No repo-wide `lint` script exists (checked root/app/
  package `package.json` scripts) so none was run.
- **Shared Evidence Library — card/block submission form.**
  Closes the "No submission UI yet" gap noted under the "📚 Shared Evidence
  Library" bullet in the Research Crowdsourcing Organizer Features list, and,
  by giving the shared evidence repository a real UI source of
  `argBlock`/`wordCount`-carrying entries, closes follow-up (a) under the
  "📊 Topic Coverage Dashboard" bullet in that same list ("an `argBlock`/
  word-count field wired into a real card-submission flow beyond the
  existing `/cards/library` evidence-library form"). `lib/shared-evidence-library.ts`
  gains `computeWordCount`, a plain whitespace tokenizer that stamps a
  submitted entry's `wordCount` from its body text rather than asking the
  submitter to count it themselves — the exact field
  `lib/topic-coverage.ts`'s `missing`/`thin`/`covered` classification scores
  against. `panels/EvidenceLibraryPanel.tsx` (mounted at `/cards/library`)
  now renders a submission form above the existing search box — kind
  (card/block), topic, case area, argument block, citation, comma-separated
  tags, and a body text area with a live word-count readout — that saves a
  new `EvidenceLibraryEntry` via the already-persisted
  `saveEvidenceLibraryEntry` and refreshes the search results, so a card
  submitted here now flows straight into both the evidence library's own
  search index and the Topic Coverage Dashboard's live report for the same
  topic, with no new composition logic needed on either side. No follow-ups
  remain open on either bullet's submission-flow gap; the "no edit/delete
  affordance" and "no topic/case-area/tag filter controls in the panel"
  gaps noted separately in `docs/features/evidence-library.md` remain open,
  not started. Docs updated in `docs/features/evidence-library.md` and
  `docs/features/topic-coverage-dashboard.md`. Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts`
  (`computeWordCount`: space-separated words, collapsed newline/tab
  whitespace, leading/trailing trim, and an empty/whitespace-only string).
  Verified: `bun install` (2050 packages), `bun run test` (120 files / 1602
  tests, all pass), `bun run typecheck` (all 11 in-scope packages pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/cards/library` route
  present, no new route) all pass. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
- **Expandable Heading Structure — collapsed-heading decoration plugin.**
  Closes follow-up (b) under idea #9 ("Expandable Heading Structure") in
  the Product Feature Ideas list — "a ProseMirror decoration plugin that
  hides collapsed ranges in the actual editor view using
  `getCollapsedRanges`." A new
  `packages/reason-editor/src/engine/outline/collapsed-headings-plugin.ts`
  adds `collapsedHeadingsPlugin`, a ProseMirror plugin whose state (a
  `collapsedIds` list) is set via a `collapsedHeadingsKey`-tagged
  transaction meta — mirroring `comments-plugin.ts`'s meta-driven state
  convention — and whose `decorations` prop (factored out as the
  independently testable `computeCollapsedHeadingsDecorations`) composes
  the existing `buildHeadingOutline`/`getCollapsedRanges` to `display: none`
  every top-level document node inside a collapsed heading's range. Headings
  are flat, doc-level paragraphs (see `engine/schema/nodes.ts`), so a
  `CollapsedRange`'s bounds always line up with top-level node boundaries.
  `reason-core-extension.ts`'s `ReasonCore.addProseMirrorPlugins()` now
  includes the plugin unconditionally (a no-op when nothing is collapsed).
  `OutlineNavPanel.tsx` gains an effect that pushes its persisted
  `collapsedIds` into the plugin via `setCollapsedHeadingIdsMeta` on mount,
  on `documentId` change, and on every toggle, so collapsing a heading in
  the nav panel now also hides its content in the live editor view, not
  just the nav list. No follow-ups remain open on idea #9. Vitest-covered
  in `packages/reason-editor/test/collapsed-headings-plugin.test.ts`
  (plugin-state transitions via tagged/untagged meta, and decoration
  coverage for a mid-document collapse, an outermost collapse, and a
  collapsed heading with nothing to hide).
  PR: [#201](https://github.com/debate/debate-ai.com/pull/201).
- **Team Brainstorm Assist — real AI-generation call.**
  Closes follow-up (a) under the "🧠 Team Brainstorm Assist" bullet in the
  Research Crowdsourcing Organizer Features list — "an actual AI-generation
  call that drafts candidate ideas from `buildBrainstormPrompt`'s output."
  A new `packages/debate-card-search/src/lib/team-brainstorm-ai.ts` adds
  `TEAM_BRAINSTORM_AI_SYSTEM_PROMPT`, `buildTeamBrainstormAiUserPrompt`, and
  the tolerant `parseTeamBrainstormAiResponse`, mirroring
  `lib/llm-card-scoring-ai.ts`'s strict-JSON-with-tolerant-fallback split
  (the model is asked for a `{"ideas": [...]}` array of several distinct
  candidate ideas for a board's argument block/category/seeding prompt).
  `lib/team-brainstorm-client.ts` adds `requestTeamBrainstormAiIdeas`, a
  small self-contained `fetch` client (mirroring
  `lib/llm-card-scoring-client.ts`'s split) that POSTs to the existing
  `/api/reason-ai` Anthropic proxy. `lib/team-brainstorm-assist.ts`'s
  `BrainstormIdea` gains an additive, optional `isAiGenerated` field
  (existing records without one stay valid) so an AI-drafted idea saves and
  renders through the exact same `saveBrainstormIdea`/ranking/upvote path
  as a human-submitted one. `BrainstormBoardPanel.tsx`'s submission form now
  has a "Generate AI ideas" action (next to "Submit idea") that calls
  `requestTeamBrainstormAiIdeas` for the form's current argument
  block/category, saves each returned idea as a normal, AI-attributed
  (`contributorId: "AI"`, `isAiGenerated: true`) board idea, and renders an
  "AI" badge on it — or a form-level error message on failure. Follow-up
  (a) is now closed; the "boards aren't seeded from the coverage-gap
  prompts" and "no reviewer merge action for flagged duplicates" gaps noted
  separately remain open, as documented in
  `docs/features/brainstorm-board.md`. Docs updated in that same file.
  Vitest-covered in
  `packages/debate-card-search/test/team-brainstorm-ai.test.ts` (prompt
  content and response parsing, including a fenced reply, a prose-wrapped
  reply, entries with blank/whitespace-only ideas dropped, and an
  empty/unusable reply) and
  `packages/debate-card-search/test/team-brainstorm-client.test.ts` (the
  `fetch` client, mocked via `vi.stubGlobal`, covering the success path, an
  endpoint override, a server error message, a non-JSON error body, and an
  unparseable reply). Verified: `bun install` (2050 packages), `bun run
  test` (119 files / 1590 tests, all pass), `bun run typecheck` (11 of 12
  in-scope packages have a typecheck script; all pass), and `bun run
  build:web` (`debate-ai-web` succeeds, `/cards/brainstorm` route present,
  no new route) all pass. No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run.
- **AI Drill Generator — real AI-generated drill script.**
  Closes follow-up (b) under the "📚 AI Drill Generator" bullet in the
  Research Crowdsourcing Organizer Features list — "an actual AI-generated
  (rather than templated) script." A new
  `packages/debate-round/src/round/drill-script-ai.ts` adds
  `DRILL_SCRIPT_AI_SYSTEM_PROMPT`, `buildDrillScriptAiUserPrompt`, and the
  tolerant `parseDrillScriptAiResponse`, mirroring `round/coach-feedback-ai.ts`'s
  free-form-text split (a practice script is prose, not structured JSON) —
  the user-turn prompt composes a single `flow/drill-generator.ts` `Drill`'s
  kind and template prompt line for a chosen side, asking the model to turn
  that template line into an actual, ready-to-read practice script rather
  than restate it. `round/drill-script-client.ts` adds `requestDrillScript`,
  a small self-contained `fetch` client (mirroring
  `round/coach-feedback-client.ts`'s split) that POSTs to the existing
  `/api/reason-ai` Anthropic proxy. `state/drillSets.ts`'s `DrillSetRecord`
  gains an additive, optional `aiScripts` field keyed by a drill's index in
  `drills` (existing records without one stay valid) plus a new
  `saveDrillAiScript(roundId, drillIndex, aiScript)` helper that sets one
  entry without touching `drills` or any other drill's script — matching
  this store's existing roundId-only keying (a drill set is unique per
  `roundId`, unlike `coachingSessions.ts`'s roundId+sideKey keying).
  `DrillSetsPanel.tsx`'s drills now each have a "Get AI script" ("Regenerate
  AI script" once one exists) action that calls `requestDrillScript` with
  the drill and its round's side, saves the result, and renders it (or a
  per-drill error message on failure) under the template prompt. No
  follow-ups remain open on this bullet. Docs updated in
  `docs/features/drill-sets.md`. Vitest-covered in
  `packages/debate-round/test/drill-script-ai.test.ts` (prompt content,
  per-kind label rendering, and response parsing, including a fenced reply
  and a whitespace-only/empty reply),
  `packages/debate-round/test/drill-script-client.test.ts` (the `fetch`
  client, mocked via `vi.stubGlobal`, covering the success path, an
  endpoint override, a server error message, a non-JSON error body, and an
  empty/unusable AI reply), and `packages/debate-round/test/drillSets.test.ts`
  (the new `saveDrillAiScript` helper, including overwriting an existing
  script, leaving other drills' and other rounds' records untouched, and a
  no-op on an unstored roundId). Verified: `bun install` (2050 packages),
  `bun run test` (117 files / 1572 tests, all pass), `bun run typecheck`
  (11 of 12 in-scope packages have a typecheck script; all pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/drills` route present,
  no new route) all pass. No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run.
- **AI Coach Mode — real AI coaching-feedback call.**
  Closes follow-up (a) under the "🎙️ AI Coach Mode" bullet in the Research
  Crowdsourcing Organizer Features list — "an actual AI coaching call for
  open-ended feedback beyond this deterministic template layer." A new
  `packages/debate-round/src/round/coach-feedback-ai.ts` adds
  `COACH_FEEDBACK_AI_SYSTEM_PROMPT`, `buildCoachFeedbackAiUserPrompt`, and
  the tolerant `parseCoachFeedbackAiResponse`, mirroring
  `debate-speech-writer`'s `coach/team-coach-ai.ts` free-form-text split
  (open-ended coaching feedback is prose, not structured JSON like
  `round/judge-decision-ai.ts`'s verdict) — the user-turn prompt composes a
  session's side and its already-generated template prompts via the
  existing `flow/coach-mode.ts`'s `buildCoachingSummaryText`, so no new
  coaching-prompt derivation logic was introduced.
  `round/coach-feedback-client.ts` adds `requestCoachFeedback`, a small
  self-contained `fetch` client (mirroring `coach/team-coach-client.ts`'s
  split) that POSTs to the existing `/api/reason-ai` Anthropic proxy.
  `state/coachingSessions.ts`'s `CoachingSessionRecord` gains an additive,
  optional `aiFeedback` field (existing records without one stay valid)
  plus a new `saveCoachingSessionAiFeedback(roundId, sideKey, aiFeedback)`
  helper that sets it without touching a session's `prompts`.
  `CoachingSessionsPanel.tsx`'s session cards now have a "Get AI feedback"
  ("Regenerate AI feedback" once one exists) action that calls
  `requestCoachFeedback` with the session's own prompts, saves the result,
  and renders it (or a per-session error message on failure) under the
  template prompts. No follow-ups remain open on this bullet. Docs updated
  in `docs/features/coaching-sessions.md`. Vitest-covered in
  `packages/debate-round/test/coach-feedback-ai.test.ts` (prompt content and
  response parsing, including a fenced reply and a whitespace-only/empty
  reply), `packages/debate-round/test/coach-feedback-client.test.ts` (the
  `fetch` client, mocked via `vi.stubGlobal`, covering the success path, an
  endpoint override, a server error message, a non-JSON error body, and an
  empty/unusable AI reply), and
  `packages/debate-round/test/coachingSessions.test.ts` (the new
  `saveCoachingSessionAiFeedback` helper, including overwriting existing
  feedback, leaving other sessions untouched, and a no-op on an unstored
  roundId/sideKey pair). Verified: `bun install` (2050 packages),
  `bun run test` (115 files / 1549 tests, all pass), `bun run typecheck`
  (11 of 12 in-scope packages have a typecheck script; all pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/coaching` route present,
  no new route) all pass. No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run.
- **Contribution Leaderboard — completed-tasks signal.**
  Closes follow-up (b) under the "Contribution Leaderboard" bullet in the
  Research Crowdsourcing Organizer Features list — "a 'completed tasks'
  signal once a research-task system exists" (that system now exists: the
  Research Task Routing idea's persisted `routedTaskQueues.ts`/
  `completeAndRecordResearchTask`). `debate-card-search`'s
  `lib/contribution-leaderboard.ts` gains a `completedTaskCount` field on
  `ContributorStats` and an optional `completedTaskCounts` map parameter on
  `buildContributorStats`/`buildLeaderboard`, defaulting to 0 so every
  existing caller is unaffected; a contributor present only in that map
  (completed tasks, no scored contribution yet) still gets a leaderboard
  row via a new `buildTaskOnlyContributorStats` — mirroring
  `lib/research-progress.ts`'s `buildResearchProgressBoard` "union of both
  signals" convention. `state/researchProgress.ts` (which already reads the
  persisted completed-task history) adds
  `buildPersistedLeaderboardWithCompletedTasks`, grouping that history by
  `contributorId` and composing it with `state/contributions.ts`'s
  persisted contribution list through `buildLeaderboard` — it lives there
  rather than alongside `state/contributions.ts`'s existing
  `buildPersistedLeaderboard` to avoid a circular import between the two
  state modules (`state/contributions.ts` doesn't depend on
  `state/researchProgress.ts`). `ContributionLeaderboardPanel.tsx` now reads
  through `buildPersistedLeaderboardWithCompletedTasks` instead and renders
  a new "Completed tasks" column. `buildPersistedLeaderboard` itself is
  unchanged and still used elsewhere. No follow-ups remain open on this
  bullet. Vitest-covered in `test/contribution-leaderboard.test.ts` (the new
  `completedTaskCount` field, the `completedTaskCounts` map, and a
  task-only contributor row) and `test/researchProgress.test.ts` (the new
  `buildPersistedLeaderboardWithCompletedTasks` store composition, including
  a task-only contributor). Verified: `bun install`, `bun run test` (113
  files / 1528 tests, all pass), `bun run typecheck` (11 of 12 in-scope
  packages have a typecheck script; all pass — also fixed three pre-existing
  `ContributorStats` object literals in `lib/unlock-streak-status.ts` and
  three test files that were missing the new required field), and
  `bun run build:web` (`debate-ai-web` succeeds, `/cards/leaderboard` route
  present, no new route) all pass. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
- **Flow-in-Speech Flow Annotations — video-player annotation UI.**
  Closes follow-up (a) under idea #15 ("Flow-in-Speech Flow Annotations")
  in the Product Feature Ideas list — "a video-player UI (`debate-videos`)
  that lets a viewer drop an annotation at the current playback position,
  persisted through `flowAnnotations.ts`, and jump back to one." A new
  `packages/debate-round/src/panels/FlowAnnotationsPanel.tsx` renders a
  drop-annotation form (flow id, speech id, box path, optional note, and a
  timestamp that defaults to the `debate-videos` persistent player's live
  playback position via `useVideoPlayerStore`, or a manual `m:ss`/`h:mm:ss`
  entry) plus every persisted `FlowAnnotation` newest-first, each with a
  "Jump to" action that calls `sendYouTubeCommand("seekTo", ...)` — a new
  command added to `debate-videos`'s existing
  `playVideo`/`pauseVideo`/`setPlaybackRate` postMessage commands, wrapping
  the YouTube IFrame API's `seekTo(seconds, allowSeekAhead)` — and a
  "Clear" action, mounted at `/annotations` and linked from the global
  dock's Settings menu. `flow/flow-annotations.ts` gains an additive,
  optional `FlowAnnotation.videoId` (existing annotations without one stay
  valid) so "Jump to" can be scoped to the annotation's own recording
  rather than firing blindly at whatever happens to be loaded, plus three
  small pure helpers used by the panel:
  `getAnnotationsForVideo`/`formatAnnotationTimestamp`/
  `parseAnnotationTimestamp`/`parseBoxPathInput`.
  `state/flowAnnotations.ts` gains `listFlowAnnotationsForVideo` and
  `buildFlowAnnotationsPanelView` (a stable newest-first sort), mirroring
  the existing `buildFlowSummariesPanelView` convention. `debate-round` now
  depends on `debate-videos` (previously one-directional the other way —
  no cycle, `debate-videos` still doesn't depend on `debate-round`). "Jump
  to" only works once the annotation's own recording is already the one
  loaded in the player — no video-lookup/auto-open exists — and follow-up
  (b), a `FlowSpreadsheet` affordance surfacing a box's annotations via
  `listFlowAnnotationsForBox`, remains open, not started. Docs added at
  `docs/features/flow-annotations.md`;
  `packages/debate-round/README.md` updated. Vitest-covered in
  `packages/debate-round/test/flow-annotations.test.ts` (the new
  `videoId`/timestamp/box-path helpers) and
  `packages/debate-round/test/flowAnnotations.test.ts` (the new
  `listFlowAnnotationsForVideo`/`buildFlowAnnotationsPanelView` persistence
  helpers). Verified: `bun install`, `bun run test` (113 files / 1519
  tests, all pass), `bun run typecheck` (11 of 12 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`
  succeeds, `/annotations` route present) all pass. No repo-wide `lint`
  script exists (checked root/app/package `package.json` scripts) so none
  was run.
- **Video-Lecture-Training Coach AI — real AI Q&A call.**
  [PR #195](https://github.com/debate/debate-ai.com/pull/195).
  Closes follow-up (b) under idea #8 ("Video-Lecture-Training Coach AI") in
  the Product Feature Ideas list — "an actual AI Q&A call that consumes
  `buildGroundedCoachPrompt`'s output." A new
  `packages/debate-speech-writer/src/coach/team-coach-ai.ts` adds
  `TEAM_COACH_AI_SYSTEM_PROMPT`, which frames the model as the team's
  private coach and instructs it to reply with the answer text only, plus
  the pure, Vitest-testable `parseTeamCoachAiResponse`, which strips a
  wrapping code fence (mirroring `debate-round`'s
  `round/ai-versus-speech-ai.ts`'s tolerant-parsing convention exactly —
  this is free-form answer text, not JSON, so no schema validation is
  needed). The user-turn message sent to the model is exactly the
  already-existing `buildGroundedCoachPrompt`'s output (question +
  ranked grounding-material excerpts + its own "answer strictly from
  these materials" instruction) — no new prompt-composition logic was
  introduced. `coach/team-coach-client.ts` adds `requestTeamCoachAnswer`,
  a small self-contained `fetch` client (mirroring
  `round/ai-versus-speech-client.ts`'s split) that POSTs to the existing
  `/api/reason-ai` Anthropic proxy. `CoachMaterialsPanel.tsx`'s existing
  "Ask the coach" section now has an "Ask the coach" action alongside the
  existing "Preview grounded prompt" preview — it resolves the question's
  top relevant materials via the already-existing
  `findRelevantMaterialsFromStore`, calls `requestTeamCoachAnswer`, and
  renders the model's grounded answer or a plain error message on
  failure. No material-scoring, grouping, or persistence logic changed,
  and no new route was added. Vitest-covered in
  `packages/debate-speech-writer/test/team-coach-ai.test.ts` (system-prompt
  content and response parsing, including a fenced reply and a
  whitespace-only/empty reply) and
  `packages/debate-speech-writer/test/team-coach-client.test.ts` (the
  `fetch` client, with `fetch` mocked via `vi.stubGlobal`, covering the
  success path, an endpoint override, a server error message, a non-JSON
  error body, and an empty/unusable AI reply). Docs updated in
  `docs/features/coach-materials.md` and
  `packages/debate-speech-writer/README.md`. Follow-up (a), transcription/
  parsing that turns an uploaded recording or document into a material's
  text, remains open — not started. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install` (2050 packages), `bun run test` (113 files /
  1504 tests, all pass), `bun run typecheck` (11 of 12 in-scope packages
  have a typecheck script; all pass), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/coach-materials` route present, no new
  route) all pass.
- **AI Response-Outcome Charts — AI counsel-panel call.**
  Closes follow-up (a) under idea #4 ("AI Response-Outcome Charts") in the
  Product Feature Ideas list — "an actual AI-panel call (multiple 'counsel'
  model roles) that evaluates likely response paths and clash points
  beyond this deterministic heuristic." A new
  `packages/debate-round/src/flow/response-outcome-ai.ts` adds the pure,
  Vitest-testable `buildCounselPanelAiUserPrompt`/`parseCounselPanelAiResponse`,
  which compose a round's most-vulnerable already-scored arguments (row
  index, origin speech, unanswered status, heuristic exposure score) into a
  prompt asking the model to role-play three specialized debate "counsel"
  — Policy Counsel, Kritik Counsel, Weighing Counsel — assign whichever
  role best fits each argument, and estimate that argument's likely
  response path and clash point, plus one overall round-level clash
  summary; mirrors `round/judge-decision-ai.ts`'s prompt/parse split
  exactly, including its tolerant-parsing (fenced/prose-wrapped JSON)
  convention. `flow/response-outcome-client.ts` adds
  `requestCounselPanelAssessment`, a small self-contained `fetch` client
  (mirroring `judge-decision-client.ts`'s split) that POSTs to the
  existing `/api/reason-ai` Anthropic proxy. A new
  `state/counselPanelAssessments.ts` persists a round's
  `CounselPanelAiResult` to localStorage keyed by `roundId`, mirroring
  `debate-card-search`'s `state/aiCardAssessments.ts` convention exactly.
  `VulnerabilityChartsPanel.tsx`'s existing round cards now have a "Get AI
  counsel panel" action that requests an assessment against the round's
  top exposed arguments (from `buildVulnerabilityChartDataFromReport`) and
  renders the overall clash summary plus each assessed argument's counsel
  role, likely response path, and clash estimate; clearing a round now
  also clears its persisted counsel-panel assessment. No vulnerability-
  scoring, chart-data, or "what if" hypothetical logic changed, and no new
  route was added. Vitest-covered in
  `packages/debate-round/test/response-outcome-ai.test.ts` (prompt
  composition, well-formed/fenced/prose-wrapped replies, an unrecognized
  `counselRole`, empty `argumentAssessments`, and missing/blank required
  fields), `packages/debate-round/test/response-outcome-client.test.ts`
  (the `fetch` client, with `fetch` mocked via `vi.stubGlobal`, covering
  the success path, an endpoint override, a server error message, a
  non-JSON error body, and an unparseable AI reply), and
  `packages/debate-round/test/counselPanelAssessments.test.ts` (get/save/
  delete, corrupt/missing storage, and per-`roundId` isolation). Docs
  updated in `docs/features/response-outcome-charts.md` — including
  correcting its stale "Known gaps" section, which still listed the
  already-shipped "what if" hypothetical mode (follow-up (c)) as not
  started. No follow-ups remain open on idea #4. No repo-wide `lint`
  script exists (checked root/app/package `package.json` scripts) so none
  was run. Verified: `bun install` (2050 packages), `bun run test` (111
  files / 1491 tests, all pass), `bun run typecheck` (11 of 12 in-scope
  packages have a typecheck script; all pass), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/outcomes` route present, no new route) all
  pass.
- **Practice Round Simulator — AI opponent speech + AI judge-decision calls.**
  [PR #193](https://github.com/debate/debate-ai.com/pull/193).
  Closes follow-up (a) under the "🧪 Practice Round Simulator" bullet in
  Research Crowdsourcing Organizer Features — "an actual AI
  speech-generation call for the AI opponent's speeches and an AI
  judge-decision call under the chosen paradigm." `PracticeRoundSimulatorPanel`
  now has a "Generate AI opponent speech" action per round card, reusing the
  existing `buildAiResponseRequest`/`requestAiVersusSpeech`/
  `requestAiVersusSpeechWithPersona` helpers (idea #3's "Online Debate Versus
  AI" and the "AI Practice Opponent" idea) against the round's own
  `aiVersusRounds.ts` submitted-speech state — available once the round has
  been started at `/versus-ai` under the same `roundId` — sourcing the AI
  opponent's persona directly from the practice round's own saved
  `setup.opponentPersona` rather than a separate `opponentPersonaSelections`
  store lookup, since the practice-round setup already carries that choice
  explicitly. A new `packages/debate-round/src/round/practice-round-judge-decision-wiring.ts`
  adds `buildPracticeRoundJudgeDecisionInput`, a variant of idea #5's
  `judge-decision-store-wiring.ts` that takes the practice round's own saved
  `setup.judgeParadigm` directly as an argument (instead of reading a second
  `judgeParadigmSelections` store), while still resolving the round's flow
  summary from the existing `state/flowSummaries.ts` by the same `roundId`.
  The panel's new "Get AI judge decision" action calls the existing
  `requestJudgeDecision` with that resolved input and saves the verdict onto
  the round's own `PracticeRoundRecord` via a new optional `judgeDecision`
  field, rendering the winner, key voting issues, and rationale. No new
  turn-order, speech-order, judge-paradigm, or setup-composition logic was
  introduced. Vitest-covered in
  `packages/debate-round/test/practice-round-judge-decision-wiring.test.ts`
  (missing/empty flow summary, successful composition from the round's own
  paradigm, roundId scoping, and a custom paradigm). No follow-ups remain
  open on this idea. No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run. Verified:
  `bun install` (2050 packages), `bun run test` (108 files / 1465 tests, all
  pass), `bun run typecheck` (11 of 12 in-scope packages have a typecheck
  script; all pass), and `bun run build:web` (`debate-ai-web`, succeeds,
  `/practice-round` route present, no new route) all pass.
- **AI Practice Opponent — persona-conditioned AI speech-generation call.**
  [PR #191](https://github.com/debate/debate-ai.com/pull/191).
  Closes follow-up (a) under the "🤖 AI Practice Opponent" bullet in Research
  Crowdsourcing Organizer Features — "an actual AI speech-generation call
  that consumes `buildOpponentPersonaPrompt`'s output alongside idea #3's
  `AiSpeechRequest`." A new
  `packages/debate-round/src/round/opponent-persona-speech-ai.ts` adds the
  pure, Vitest-testable `buildPersonaAiVersusSystemPrompt(persona)`, which
  composes the existing "Online Debate Versus AI" `AI_VERSUS_SPEECH_SYSTEM_PROMPT`
  with `debate-speech-writer`'s `buildOpponentPersonaPrompt`, noting that the
  persona's style overrides the generic tone where they conflict; it reuses
  `ai-versus-speech-ai.ts`'s existing `buildAiVersusSpeechUserPrompt` and
  `parseAiVersusSpeechResponse` unchanged, since only the system prompt
  changes once a persona is selected. `round/opponent-persona-speech-client.ts`
  adds `requestAiVersusSpeechWithPersona`, a small self-contained `fetch`
  client (mirroring `ai-versus-speech-client.ts`'s split) that POSTs to the
  existing `/api/reason-ai` Anthropic proxy. A new
  `round/opponent-persona-speech-wiring.ts` adds `getOpponentPersonaForRound`,
  which resolves a round's persona directly from the already-persisted
  `opponentPersonaSelections.ts` store, treating a round's `roundId` as that
  store's `sessionId` key — both are free-text identifiers for the same
  practice session, so no new persistence field was introduced to link them.
  `AiVersusRoundPanel.tsx`'s existing "Generate AI speech" action now looks
  up the active round's saved persona and calls the persona-aware client
  when one is saved (showing which persona is in play via a badge), falling
  back to the existing plain `requestAiVersusSpeech` call otherwise. No
  turn-order, validation, or persona-registry logic changed, and no new
  route was added. Vitest-covered in
  `packages/debate-round/test/opponent-persona-speech-ai.test.ts` (prompt
  composition, including persona name/description/instructions/preferred-
  arguments and the override note),
  `packages/debate-round/test/opponent-persona-speech-client.test.ts` (the
  `fetch` client, with `fetch` mocked via `vi.stubGlobal`, covering the
  success path, an endpoint override, a server error message, a non-JSON
  error body, and an empty/unparseable AI reply), and
  `packages/debate-round/test/opponent-persona-speech-wiring.test.ts`
  (missing/present/scoped-by-roundId/most-recent-wins lookup cases). No
  follow-ups remain open on this idea. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install` (2050 packages), `bun run test` (107 files / 1460
  tests, all pass), `bun run typecheck` (11 of 12 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`,
  succeeds, `/versus-ai` route present, no new route) all pass.
- **AI Judge Decision Modes — real AI judge-decision call.**
  [PR #190](https://github.com/debate/debate-ai.com/pull/190).
  Closes follow-up (a) under idea #5 ("AI Judge Decision Modes") — "an AI
  judge-decision call that uses `buildJudgeParadigmPrompt` output instead of
  (or alongside) the existing static `judgeDecisionPrompt`." A new
  `packages/debate-round/src/round/judge-decision-ai.ts` adds
  `JUDGE_DECISION_AI_SYSTEM_PROMPT` and pure, Vitest-testable
  `buildJudgeDecisionAiUserPrompt`/`parseJudgeDecisionAiResponse` helpers —
  the prompt composes the selected paradigm's existing
  `buildJudgeParadigmPrompt` section with a round's flow summary text
  (`flow/flow-transcript-summary.ts`'s `buildFlowSummaryTextFromRows`), and
  the parser tolerantly extracts a `{winner, keyVotingIssues, rationale}`
  JSON verdict from a fenced or prose-wrapped reply, returning `null` (never
  throwing) on anything unparseable or missing a required field.
  `round/judge-decision-client.ts` adds `requestJudgeDecision`, a small
  self-contained `fetch` client (mirroring `lib/llm-card-scoring-client.ts`'s
  split) that POSTs to the existing `/api/reason-ai` Anthropic proxy. A new
  `round/judge-decision-store-wiring.ts` resolves a round's
  `JudgeDecisionAiInput` directly from two already-persisted, same-keyed
  stores — this package's own `state/flowSummaries.ts` and
  `debate-speech-writer`'s `state/judgeParadigmSelections.ts` — mirroring
  `pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores` convention, and
  reports which source(s) are missing rather than throwing. A new
  `state/judgeDecisions.ts` persists a round's generated
  `JudgeDecisionAiResult` to localStorage, and a new `JudgeDecisionPanel.tsx`
  renders a "Get AI judge decision" form (round ID + side names) plus every
  persisted decision (winner, key voting issues, rationale) at
  `/judge-decision`, linked from the settings dock (`CategoryDock.tsx`, "AI
  Judge Decision"). No follow-ups remain open on this idea. Vitest-covered
  in `packages/debate-round/test/judge-decision-ai.test.ts` (prompt building
  + tolerant parsing, including fenced/prose-wrapped replies and malformed
  shapes), `packages/debate-round/test/judge-decision-client.test.ts` (the
  `fetch` client, with `fetch` mocked via `vi.stubGlobal`, covering the
  success path, an endpoint override, a server error message, a non-JSON
  error body, and an unparseable reply),
  `packages/debate-round/test/judge-decision-store-wiring.test.ts`
  (composing/missing-source cases across both stores), and
  `packages/debate-round/test/judgeDecisions.test.ts` (persistence CRUD +
  corrupt-storage recovery). No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run. Verified: `bun
  install` (2050 packages), `bun run test` (104 files / 1446 tests, all
  pass), `bun run typecheck` (11 of 12 in-scope packages have a typecheck
  script; all pass), and `bun run build:web` (`debate-ai-web`, succeeds,
  `/judge-decision` route present) all pass.
- **Online Debate Versus AI — real AI speech-generation call.**
  [PR #189](https://github.com/debate/debate-ai.com/pull/189).
  Closes follow-up (a) under idea #3 ("Online Debate Versus AI") — "an
  actual AI speech-generation call that consumes `buildAiResponseRequest`'s
  output (prior speeches + slot + cross-ex flag) to produce the AI's next
  speech text." A new
  `packages/debate-round/src/round/ai-versus-speech-ai.ts` adds
  `AI_VERSUS_SPEECH_SYSTEM_PROMPT` and pure, Vitest-testable
  `buildAiVersusSpeechUserPrompt`/`parseAiVersusSpeechResponse` helpers —
  the prompt lists the slot being delivered, its time limit, whether it's
  a cross-examination turn, and every prior speech tagged "you"/"opponent";
  the parser strips a wrapping markdown code fence or a single layer of
  wrapping double quotes and returns `null` (never throws) on an empty
  reply. `round/ai-versus-speech-client.ts` adds `requestAiVersusSpeech`,
  a small self-contained `fetch` client (mirroring
  `lib/llm-card-scoring-client.ts`'s split) that POSTs to the existing
  `/api/reason-ai` Anthropic proxy. `AiVersusRoundPanel.tsx` gained a
  "Generate AI speech" button on the AI's turn, which builds the request
  from the already-existing `buildAiResponseRequest` and saves the
  returned text through the already-persisted `state/aiVersusRounds.ts`,
  replacing the prior "AI turns block further submission" placeholder
  message. No turn-order or persistence logic changed. Vitest-covered in
  `packages/debate-round/test/ai-versus-speech-ai.test.ts` (prompt
  building + tolerant parsing) and
  `packages/debate-round/test/ai-versus-speech-client.test.ts` (the
  `fetch` client, with `fetch` mocked via `vi.stubGlobal`, covering the
  success path, an endpoint override, a server error message, a non-JSON
  error body, and an empty/unparseable AI reply). Documented in
  `docs/features/ai-versus-rounds.md`. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install` (2050 packages), `bun run test` (100 files /
  1415 tests, all pass), `bun run typecheck` (11 of 12 in-scope packages
  have a typecheck script; all pass), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/versus-ai` route present) all pass.
- **Daily Quests and Targets — quest-board widget UI + real contribution wiring.**
  [PR #188](https://github.com/debate/debate-ai.com/pull/188).
  Closes follow-ups (a) and (b) under the "🎯 Daily Quests and Targets"
  bullet — a quest-board widget UI, and wiring real contribution-submission
  events into a persisted daily feed the board can score against. A new
  `packages/debate-card-search/src/state/dailyQuests.ts` persists a
  `QuestTemplate[]` roster (CRUD) and adds
  `seedQuestTemplatesFromTopicCoverage`, which turns a topic's under-covered
  tracked arguments (via the already-persisted `trackedArguments.ts` coverage
  report) directly into saved quest templates, reusing the existing
  `daily-quests.ts` `buildUnderCoveredArgumentQuests` rather than introducing
  a separate seeding rule. `buildPersistedDailyQuestBoard` composes that
  roster against the real, persisted `state/contributions.ts` feed —
  filtered to contributions carrying a `submittedAt`, mirroring
  `dailyMissionResults.ts`'s `hasSubmittedAt` convention — closing follow-up
  (a). Along the way this surfaced a shared, previously undiscovered gap:
  `ContributionsFeedPanel.tsx`'s submission form never stamped a saved
  contribution's `submittedAt`/`argBlock`, so every feature keyed off those
  fields (`daily-quests.ts`, `dailyMissionResults.ts`, `lib/group-challenges.ts`)
  was permanently starved of real data regardless of how "done" its own
  slice was. That panel now stamps `submittedAt: Date.now()` on every
  submission and adds an optional `argBlock` field to the form;
  `AttributedContribution` (in `contribution-leaderboard.ts`) now declares
  both as optional fields instead of leaving them as ad-hoc, untyped casts.
  A third piece, `panels/DailyQuestsPanel.tsx`, renders the live board, a
  custom-quest form, and a "seed from topic coverage" action at
  `/cards/quests`, linked from the settings dock (`CategoryDock.tsx`, "Daily
  Quests"). Follow-up (c), a streak/reward layer once the Gamified Quests
  idea's streak logic is composed in, remains open — not started; existing
  contributions saved before this change also aren't retroactively
  backfilled with `submittedAt`/`argBlock`. Vitest-covered in
  `packages/debate-card-search/test/dailyQuests.test.ts` (template CRUD,
  corrupt-storage recovery, topic-coverage seeding including upsert and the
  "nothing under-covered" case, and board composition against real
  persisted contributions — including same-day scoring, cross-day exclusion,
  target mismatch, and the missing-`submittedAt` exclusion). Documented in
  `docs/features/daily-quests.md`. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install` (2050 packages), `bun run test` (98 files / 1396
  tests, all pass), `bun run typecheck` (11 of 12 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`,
  succeeds, `/cards/quests` route present) all pass.
- **Gamified Quests — streak/badge widget UI.**
  Closes the remaining follow-up under the "🎮 Gamified Quests" bullet — "a
  streak/badge widget UI that renders `buildContributorQuestStreak`/
  `getEarnedStreakBadges`." `state/dailyMissionResults.ts` adds
  `buildPersistedQuestStreakRoster`, which lists every contributor with at
  least one persisted daily mission result and resolves each one's streak
  status through the already-existing `buildPersistedContributorQuestStreak`,
  mirroring `lib/unlock-streak-status.ts`'s `buildUnlockStatusRoster` "single
  call that renders the whole roster" convention — no new streak/badge logic
  was introduced. A new
  `packages/debate-card-search/src/panels/QuestStreaksPanel.tsx` renders that
  roster as a table (current streak, longest streak, last completed day, and
  every milestone badge earned), mounted at `/cards/streaks` and linked from
  the settings dock (`CategoryDock.tsx`, "Quest Streaks"). Vitest-covered in
  `packages/debate-card-search/test/dailyMissionResults.test.ts` (empty
  roster, multi-contributor roster sorted alphabetically with correct
  per-contributor streak/badges, and de-duplicating a contributor's multiple
  stored days into one roster entry). No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install` (2050 packages), `bun run test` (97 files / 1380
  tests, all pass), `bun run typecheck` (11 of 12 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`,
  succeeds, `/cards/streaks` route present) all pass.
- **Research Progress Tracking — persisted completion history + progress dashboard UI.**
  Closes follow-ups (a) and (b) under the "📈 Research Progress Tracking"
  bullet. `lib/research-progress.ts`'s pure `buildContributorProgress`/
  `buildTopicProgress`/`buildResearchProgressBoard` already existed but had
  no persistence: `completePersistedRoutedTask` (in `routedTaskQueues.ts`)
  only ever removed a finished assignment from its topic's active queue,
  with nothing remembering that it was ever completed. A new
  `packages/debate-card-search/src/state/researchProgress.ts` adds a
  `completedResearchTasks` localStorage store plus
  `completeAndRecordResearchTask`, which wraps `completePersistedRoutedTask`
  and additionally appends a `{topic, assignment, completedAt}` record —
  closing follow-up (a). `TaskInboxPanel.tsx`'s "Mark complete" action now
  calls this instead of `completePersistedRoutedTask` directly, so a real
  completion event is recorded. The same module's
  `buildPersistedResearchProgressBoard` composes every persisted
  contribution (`state/contributions.ts`), every completed-task record, and
  every still-active `state/routedTaskQueues.ts` assignment into
  `lib/research-progress.ts`'s board directly, and a new
  `panels/ResearchProgressPanel.tsx` renders it as a roster (contribution
  history, task-completion rate, per-topic breakdown) at
  `/cards/progress-tracking` — closing follow-up (b). Follow-up (c), feeding
  a contributor's topic-progress history back into `progress-unlocks.ts`'s
  tier computation, remains open — not started. Vitest-covered in
  `packages/debate-card-search/test/researchProgress.test.ts` (completion
  history persistence and corrupt-storage recovery, plus board composition
  for contributors with only contributions, only active tasks, only
  completed tasks, or a mix). Documented in
  `docs/features/research-progress-tracking.md`. No repo-wide `lint` script
  exists (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install` (2050 packages), `bun run test` (97 files / 1377
  tests, all pass), `bun run typecheck` (11 of 12 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`,
  succeeds, `/cards/progress-tracking` route present) all pass.
- **LLM Card Scoring — real AI-scoring call.**
  Closes follow-up (a) under the "🧠 LLM Card Scoring" bullet. A new
  `packages/debate-card-search/src/lib/llm-card-scoring-ai.ts` adds
  `CARD_SCORING_AI_SYSTEM_PROMPT` and pure, Vitest-testable
  `buildCardScoringAiUserPrompt`/`parseCardScoringAiResponse` helpers — the
  latter tolerantly parses a model reply (raw JSON, a ```json-fenced reply,
  or JSON wrapped in prose), clamping/rounding `overallScore` into [0, 100]
  and returning `null` (never throwing) when required fields are
  missing/empty/wrong-typed. `lib/llm-card-scoring-client.ts` adds
  `requestCardScoringAiAssessment`, a small self-contained `fetch` client
  (no new dependency on `reason-editor`) that POSTs to the existing
  `/api/reason-ai` Anthropic proxy — reused rather than duplicated, and its
  file doc-comment was updated to describe it as a general-purpose proxy
  now that a second package calls it. `state/aiCardAssessments.ts` persists
  each card's assessment in localStorage keyed by card id, mirroring
  `state/cardScores.ts`'s convention under a distinct `aiCardAssessments`
  key. `CardScoringPanel.tsx` gained a per-card "Get AI assessment" button
  with a loading state, inline verdict/per-dimension notes on success, and
  a per-card error message (not a panel crash) on failure or a malformed
  response. The heuristic scorer (`lib/llm-card-scoring.ts`) is unchanged.
  Follow-up (b) — wiring real argument-block keywords and a real
  submitted-card corpus — remains open, not started. Vitest-covered in
  `packages/debate-card-search/test/llm-card-scoring-ai.test.ts` (prompt
  building + tolerant parsing, including clamped out-of-range scores and
  several malformed-response cases) and
  `packages/debate-card-search/test/aiCardAssessments.test.ts`
  (save/get round-trip, missing key, corrupt JSON); the thin `fetch`
  passthrough in `lib/llm-card-scoring-client.ts` was left unit-untested
  per its own file comment, since the logic it depends on is covered
  directly. Documented in `docs/features/llm-card-scoring.md`. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run. Verified: `bun install` (2050 packages), `bun
  run --filter=debate-card-search test` (37 files / 576 tests, all pass),
  `bun run typecheck` (11 of 12 in-scope packages have a typecheck script;
  all pass), `bun run test` (96 files / 1367 tests, all pass), and `bun run
  build:web` (`debate-ai-web`, succeeds, `/cards/scoring` route present)
  all pass.
- **LLM Card Scoring — scoring/duplicate-flag panel UI.**
  `packages/debate-card-search/src/state/cardScores.ts` adds a localStorage
  store for submitted `ScoredCard`s (id, text, argument-block keywords,
  quality signals) plus `buildPersistedCardScoreRanking`, composing the
  existing `lib/llm-card-scoring.ts` `rankCardScores` heuristic scorer
  directly against every persisted card so a duplicate submitted at any time
  is still flagged. A new
  `packages/debate-card-search/src/panels/CardScoringPanel.tsx` renders a
  submission form and every persisted card's ranked overall score, per-
  dimension breakdown (relevance/clarity/uniqueness/evidence quality/
  usability), and a "Likely duplicate" flag, mounted at `/cards/scoring` —
  closing follow-up (c) under the "🧠 LLM Card Scoring" bullet. Follow-ups
  (a) an actual LLM-scoring call and (b) wiring real argument-block keywords/
  a real submitted-card corpus remain open — neither started. Vitest-covered
  in `packages/debate-card-search/test/cardScores.test.ts` (13 tests).
  Verified: `bun install` (2050 packages), `bun run test` (94 files / 1345
  tests, all pass), `bun run typecheck` (12 packages, all pass), and `bun
  run build:web` (`debate-ai-web`, succeeds, `/cards/scoring` route present)
  all pass.
- **Collaboration Prep Room — prep-room panel UI.**
  `packages/debate-card-search/src/state/prepRooms.ts` adds
  `buildPersistedPrepRoom`/`listPrepRoomTopics`, composing the already-
  persisted `evidenceLibraryEntries.ts`, `trackedArguments.ts` (via
  `buildPersistedTopicCoverageReport`), and `contributorAvailability.ts`
  stores into a fully store-driven `PrepRoom` (via the existing
  `buildPrepRoomFromStore`) from just a topic name. A new
  `packages/debate-card-search/src/panels/PrepRoomPanel.tsx` renders a topic
  switcher, that topic's evidence/draft-block keyword search (via the
  existing `searchPrepRoomEvidence`), and its routed research assignments,
  mounted at `/cards/prep-room` — closing follow-up (a) under the "🧑‍🤝‍🧑
  Collaboration Prep Room" bullet. Follow-up (b), a live presence/who's-
  active signal, remains open — not started. Vitest-covered in
  `packages/debate-card-search/test/prepRooms.test.ts`. Verified: `bun
  install` (2050 packages), `bun run typecheck` (12 packages, all pass),
  `bun run test` (93 files / 1332 tests, all pass), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/cards/prep-room` route present) all pass.
  Documented in `docs/features/collaboration-prep-room.md`.
- **Expandable Heading Structure — outline nav panel.**
  `packages/reason-editor/src/react/OutlineNavPanel.tsx` renders the live
  document's H1-H4 heading outline (via the existing `buildHeadingOutline`/
  `getVisibleHeadingIds` engine helpers), with a chevron to collapse/expand
  a heading's subtree and a click-to-jump label that moves the TipTap
  editor's selection to that heading. A new pure helper,
  `toggleCollapsedHeadingId` (in `engine/outline/heading-outline.ts`),
  flips a heading id's membership in the collapsed-id list; the panel
  persists the result through the existing `state/collapsedHeadings.ts`
  store, keyed by `documentId`, restoring it on remount — closing follow-up
  (a) under idea #9 ("Expandable Heading Structure"). `ReasonEditor.tsx`
  gains opt-in `showOutline`/`documentId` props (falling back to the
  existing `contentKey`) that render the panel alongside the document; the
  `/reason-editor` route now passes `showOutline`. Follow-up (b), a
  ProseMirror decoration plugin that hides collapsed ranges in the live
  editor view itself, remains open — not started. Vitest-covered in
  `packages/reason-editor/test/heading-outline.test.ts`
  (`toggleCollapsedHeadingId` cases). Verified: `bun install` (2050
  packages), `bun run typecheck` (12 packages, all pass), `bun run test`
  (92 files / 1327 tests, all pass), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/reason-editor` route present) all pass.
  Documented in `docs/features/reason-editor-outline-nav.md`.
- **Scout-to-Strategy Workflow — case-choice/strategy panel UI.**
  `packages/debate-round/src/state/strategyRecommendations.ts` persists a
  matchup's `StrategyRecommendation` to localStorage, and
  `buildStrategyRecommendationFromStores` (in
  `packages/debate-round/src/round/scout-to-strategy.ts`) resolves
  `opponentProfile`/`judgeProfile` from the existing
  `opponentTeamProfiles.ts`/`judgeProfiles.ts` stores by id, mirroring
  `pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores` convention.
  `packages/debate-round/src/panels/StrategyPanel.tsx` renders a
  matchup-id/opponent-id/judge-id/case-options form plus every persisted
  recommendation (recommended case, full case rankings, judge-adaptation
  notes, risk level and factors) at `/strategy`, closing follow-up (a).
  Follow-ups (b) (wiring `ourSide`/likely opponent side into the risk
  heuristic) and (c) (an actual AI-panel evaluation of case choice) remain
  open — not started. Vitest-covered in
  `packages/debate-round/test/strategyRecommendations.test.ts` (CRUD,
  corrupt/empty/non-array storage handling, upsert, deletion, and the
  panel-view sort) and new cases in
  `packages/debate-round/test/scout-to-strategy.test.ts` (store-id
  resolution, no-data fallback, explicit-profile precedence, and parity
  with the pure `buildStrategyRecommendation`). Verified: `bun install`
  (2050 packages), `bun run typecheck` (11 packages, all pass), `bun run
  test` (92 files / 1324 tests, all pass), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/strategy` route present) all pass.
  PR: [#180](https://github.com/debate/debate-ai.com/pull/180).
- **Topic Coverage Dashboard — checklist persistence + dashboard UI.**
  `packages/debate-card-search/src/state/trackedArguments.ts` adds a small
  CRUD store, `TrackedArgumentRecord`/`listTrackedArguments`/
  `listTrackedTopics`/`saveTrackedArgument`/`deleteTrackedArgument`, for a
  topic's tracked-argument checklist — closing follow-up (b), "a
  team-editable tracked-argument checklist per topic" — persisted to
  localStorage, mirroring the existing `evidenceLibraryEntries.ts`
  convention. The same file's `buildPersistedTopicCoverageReport` composes
  that checklist with the already-persisted `evidenceLibraryEntries.ts`
  store against the existing pure `buildTopicCoverageReport` (from the
  first `lib/topic-coverage.ts` slice) — every `EvidenceLibraryEntry` is
  already a `CoverageCardSummary` (it carries `argBlock`/`wordCount`), so no
  new card shape was needed. A second slice,
  `packages/debate-card-search/src/panels/TopicCoverageDashboardPanel.tsx`,
  renders a topic switcher, an "add to checklist" form, and the resulting
  coverage report (missing/thin/covered per tracked argument, an
  under-covered summary via `getUnderCoveredArguments`, and any untracked
  argument blocks with submitted cards) at `/cards/coverage`, closing
  follow-up (c), "a coverage dashboard UI." Follow-up (a), an
  `argBlock`/word-count field wired into a real card-submission flow beyond
  the existing `/cards/library` evidence-library form, remains open — not
  started. Vitest-covered in
  `packages/debate-card-search/test/trackedArguments.test.ts` (CRUD
  corrupt/empty/non-array storage handling, topic scoping, upsert,
  deletion, and `buildPersistedTopicCoverageReport`'s missing/thin/covered
  classification, cross-topic isolation, untracked surfacing, and a
  caller-supplied thresholds override). Documented in
  `docs/features/topic-coverage-dashboard.md`. Verified from a clean
  install: `bun install` (2050 packages), `bun run typecheck` (11 packages,
  all pass), `bun run test` (91 files / 1308 tests, all pass), and `bun run
  build:web` (`debate-ai-web` + `reason-editor`, both succeed) all pass.
  PR: [#179](https://github.com/debate/debate-ai.com/pull/179).
- **AI Response-Outcome Charts — "what if" hypothetical mode.**
  `packages/debate-round/src/flow/response-outcome.ts` adds
  `applyHypotheticalAdjustments`/`HypotheticalAction`/`HypotheticalAdjustment`
  for recomputing a persisted `ArgumentVulnerability[]` report's scores
  against a hypothetical per-row strategic choice — "extend" (another
  same-side extension), "answer" (the opposing side answers it, resolving
  unanswered status), or "concede" (the row's side drops all support,
  resetting both response counts and marking it unanswered again) —
  reusing the existing scoring rule via a newly extracted
  `computeVulnerabilityScore` helper rather than duplicating it, and
  composing directly against an already-derived report (mirroring the
  existing `*FromReport` convention used by
  `summarizeOutcomeBySideFromReport`/`buildVulnerabilityChartDataFromReport`)
  so it needs no raw `Flow`. `VulnerabilityChartsPanel.tsx` wires this in as
  a per-argument "what if" picker (Extend/Answer/Concede buttons) that
  recomputes that round's side-exposure summary and exposure chart live;
  the hypothetical selection is kept in local component state only — it's
  a scratch exploration, not a persisted change to the round's saved
  report. Vitest-covered in
  `packages/debate-round/test/response-outcome.test.ts`
  (`applyHypotheticalAdjustments`'s no-op-when-unnamed, extend/answer/concede
  score effects, row isolation, score-capping parity with the original
  scoring rule, and composability with
  `buildVulnerabilityChartDataFromReport`/`summarizeOutcomeBySideFromReport`).
  See idea #4 ("AI Response-Outcome Charts") in Product Feature Ideas below
  — this closes follow-up (c), "a 'what if' mode that recomputes the score
  against a hypothetical strategic choice rather than only the flow's
  current state." Follow-up (a), an actual AI-panel call (multiple
  "counsel" model roles) that evaluates likely response paths and clash
  points beyond this deterministic heuristic, remains open — not started.
  Verified from a clean install: `bun install` (2050 packages), `bun run
  typecheck` (11 packages, all pass), `bun run test` (90 files / 1293
  tests, all pass), and `bun run build` (`debate-ai-web` + `reason-editor`,
  both succeed) all pass.
  PR: [#178](https://github.com/debate/debate-ai.com/pull/178).
- **Video-Lecture-Training Coach AI — materials-upload/coach panel UI.**
  `packages/debate-speech-writer/src/panels/CoachMaterialsPanel.tsx` renders
  the already-persisted `CoachMaterial` store (`state/coachMaterials.ts`) as
  a real panel: an upload form (kind, title, topic, tags, text) that saves
  through the existing `saveCoachMaterial`/`deleteCoachMaterial`, every
  material grouped by kind via the new `buildCoachMaterialLibraryFromStore`
  (each with a "Delete" action), and an "Ask the coach" preview that runs
  the new `findRelevantMaterialsFromStore` plus the already-existing
  `buildGroundedCoachPrompt` to show the matched materials and composed
  prompt text (no AI call is made — see idea #8's follow-up (b), still
  open). `buildCoachMaterialLibraryFromStore`/`findRelevantMaterialsFromStore`
  compose the existing pure `buildCoachMaterialLibrary`/`findRelevantMaterials`
  directly against the persisted store, mirroring
  `buildTopContributorAwardsFromStore`'s "compose the pure function directly
  against the persisted store" convention — no new scoring/grouping logic.
  It's mounted at `/coach-materials`
  (`apps/debate-ai.com/app/coach-materials/page.tsx`, with a back-link to
  `/debate`) and reachable from the global nav dock's Settings menu ("Coach
  Materials", via a new `BookOpen`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Vitest-covered in
  `packages/debate-speech-writer/test/coachMaterials.test.ts`
  (`buildCoachMaterialLibraryFromStore`'s empty-store and kind-grouping
  behavior, `findRelevantMaterialsFromStore`'s empty-store, relevance
  ranking, and options-passthrough behavior). Documented in
  `docs/features/coach-materials.md`. See idea #8
  ("Video-Lecture-Training Coach AI") in Product Feature Ideas below — this
  closes follow-up (c), "a materials-upload/coach chat panel UI." Follow-ups
  (a) transcription/parsing that turns an uploaded recording or document
  into a material's text, and (b) an actual AI Q&A call that consumes
  `buildGroundedCoachPrompt`'s output, remain open — neither is started.
  PR: [#177](https://github.com/debate/debate-ai.com/pull/177).
- **Group Challenges — challenge-board/creation UI.**
  `packages/debate-card-search/src/panels/GroupChallengesPanel.tsx` adds a
  full-page React panel that lets a coach create a squad-scoped friendly
  challenge — title, a goal (either "reach N matching contributions,"
  optionally filtered by contribution kind/argument block, or "reach N
  recorded wins"), a comma-separated squad roster, and a start/end window —
  and lists every persisted `GroupChallenge` with its goal, window, and
  roster rendered as badges, each with a "Remove" action, mirroring
  `CoachingProgramsPanel`'s create-form-plus-roster convention. It's mounted
  at `/cards/group-challenges`
  (`apps/debate-ai.com/app/cards/group-challenges/page.tsx`, with a
  back-link to `/cards`, following the same panel-page convention as
  `/cards/collaboration`/`/cards/brainstorm`) and reachable from the global
  nav dock's Settings menu ("Group Challenges", via a new `Target`-icon
  `DropdownMenuItem` in `CategoryDock.tsx`) — this is the twenty-seventh
  "wire a persisted slice's UI into the actual web app" follow-up closed in
  this repo. The panel adds one small helper to `state/groupChallenges.ts` —
  `buildGroupChallengesPanelView` (every persisted challenge, title-sorted,
  mirroring `coachingPrograms.ts`'s `buildCoachingProgramsPanelView`
  convention) — reusing the already-persisted `saveGroupChallenge`/
  `deleteGroupChallenge` directly rather than introducing new
  challenge-lifecycle logic. Vitest-covered in
  `packages/debate-card-search/test/groupChallenges.test.ts`
  (`buildGroupChallengesPanelView`'s empty-store, title-sort, and
  non-mutating-of-the-underlying-store behavior). See the "Group Challenge
  Persistence" entry above and idea #13 ("Coaching Programs and Group
  Challenges") in Product Feature Ideas below — this closes follow-up (a),
  "a challenge-board/creation UI in `debate-card-search` that reads/writes
  through this store," named under that persistence slice. This is a
  config-management panel only — it doesn't render
  `computeGroupChallengeProgress`'s live standings, since a challenge's
  progress needs caller-supplied contributions/win events that still aren't
  persisted in a form this panel could read live (follow-up (b) named under
  the same persistence slice). Verified from a clean install: `bun install`
  (2050 packages), `bun run typecheck` (11 packages, all pass), `bun run
  test` (90 files / 1281 tests, all pass), and `bun run build`
  (`debate-ai-web` + `reason-editor`, both succeed) all pass.
- **Contributions Feed — like/save/endorse UI.**
  `packages/debate-card-search/src/panels/ContributionsFeedPanel.tsx` adds a
  full-page React panel with a submission form (contributor ID + kind picker)
  for creating a new `AttributedContribution`, plus every persisted
  contribution rendered as a ranked feed with Like/Save/Endorse buttons wired
  directly to the already-persisted `recordPersistedLike`/
  `recordPersistedSave`/`recordPersistedEndorsement` actions in
  `state/contributions.ts`. A submitted contribution starts with a neutral
  `qualitySignals: [0.5]` placeholder (no automated quality scorer is wired
  into the form yet) and "Endorse" records a full-credibility
  (`reviewerWeight: 1`) endorsement (no reviewer-identity/credibility system
  exists yet) — both follow-ups already tracked below. The panel adds one new
  composing function, `buildPersistedContributionFeed`
  (`packages/debate-card-search/src/state/contributions.ts`), which ranks
  every persisted contribution by helpfulness score via the existing
  `community-rating.ts` `rankContributions`, reusing that scoring directly
  rather than introducing new logic here. It's mounted at
  `/cards/contributions`
  (`apps/debate-ai.com/app/cards/contributions/page.tsx`, with a back-link to
  `/cards`, following the existing panel-page convention) and reachable from
  the global nav dock's Settings menu ("Contributions Feed", via a new
  `ThumbsUp`-icon `DropdownMenuItem` in `CategoryDock.tsx`). Each feed entry
  also surfaces its `isPopularityOnlyOutlier` flag as a badge, closing the
  leaderboard-panel half of idea #11's follow-up (c) ("surfacing
  `isPopularityOnlyOutlier` contributions ... for moderator review") for this
  feed view — the existing `/cards/leaderboard` per-contributor rollup still
  doesn't surface it. This closes follow-up (a) named under both the
  "Contribution Leaderboard" bullet ("a real submitted-contribution flow (and
  a like/save/endorse UI)") and idea #11 "Community-Rated Summaries and
  Highlights" ("a real like/save/endorse UI") in the Product Feature
  Ideas/Research Crowdsourcing Organizer Features sections below.
  Vitest-covered in `packages/debate-card-search/test/contributions.test.ts`
  (`buildPersistedContributionFeed`'s empty-store, ranking-by-helpfulness,
  live-update-after-a-like, and popularity-only-outlier-flagging behavior).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  typecheck` (11 packages, all pass), `bun run test` (90 files / 1274 tests,
  all pass), and `bun run build` (`debate-ai-web` + `reason-editor`, both
  succeed) all pass.
- **Common Argument Library — folder/collection browser UI.**
  `packages/debate-card-search/src/panels/ArgumentLibraryPanel.tsx` adds a
  full-page React panel that renders every persisted `EvidenceLibraryEntry`
  organized into topic folders (each split into case-area subgroups) plus
  cross-cutting tag collections, with a click-to-toggle tag filter that
  narrows the view to cards carrying any of the selected tags — mirroring
  `EvidenceLibraryPanel`'s mount-then-render convention (an SSR-safe loading
  state, then an empty state, then the populated view). It's mounted at
  `/cards/argument-library`
  (`apps/debate-ai.com/app/cards/argument-library/page.tsx`, with a back-link
  to `/cards`, following the same panel-page convention as `/cards/library`/
  `/cards/brainstorm`) and reachable from the global nav dock's Settings menu
  ("Argument Library", via a new `FolderTree`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`) — this is the twenty-sixth "wire a persisted slice's UI
  into the actual web app" follow-up closed in this repo. The panel adds one
  small helper to `state/evidenceLibraryEntries.ts` —
  `buildPersistedArgumentLibrary` (organizes every persisted evidence entry
  via `lib/argument-library.ts`'s existing `buildArgumentLibrary`, since
  `EvidenceLibraryEntry` already extends `LibraryCard` with the `topic`/
  `caseArea`/`tags` fields the library needs) — reusing the already-built
  organizing logic directly rather than introducing new grouping logic here.
  Vitest-covered in `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
  (`buildPersistedArgumentLibrary`'s empty-store, topic/case-area grouping,
  tag-collection grouping, and non-mutating-of-the-underlying-store
  behavior). See the "📚 Common Argument Library" bullet in Research
  Crowdsourcing Organizer Features below — this closes follow-up (b), "a
  folder/collection browser UI." Follow-ups (a) (wiring a `topic`/
  `caseArea`/`tags` field into wherever submitted cards are eventually
  persisted beyond this evidence-library store) and (c) (a tag-autocomplete/
  tag-management affordance) remain open — neither is started. See
  [PR #173](https://github.com/debate/debate-ai.com/pull/173).
- **Coaching Programs and Group Challenges — coaching-program config UI.**
  `packages/debate-round/src/panels/CoachingProgramsPanel.tsx` adds a
  full-page React panel that lets a coach create a named coaching space
  (name + comma-separated squad-roster member IDs) and lists every
  persisted `CoachingProgramConfig`, each with its roster rendered as
  badges and a "Remove" action, mirroring `PreRoundBriefingsPanel`'s
  list-plus-clear convention. It's mounted at `/coaching-programs`
  (`apps/debate-ai.com/app/coaching-programs/page.tsx`, with a back-link to
  `/debate`, following the same panel-page convention as `/coaching`/
  `/prep-notes`) and reachable from the global nav dock's Settings menu
  ("Coaching Programs", via a new `School`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`) — this is the twenty-fifth "wire a persisted slice's
  UI into the actual web app" follow-up closed in this repo. The panel
  adds one small helper to `state/coachingPrograms.ts` —
  `buildCoachingProgramsPanelView` (every persisted program config,
  name-sorted, mirroring `drillSets.ts`'s `buildDrillSetsPanelView`
  sorting convention) — reusing the already-persisted
  `saveCoachingProgram`/`deleteCoachingProgram` directly rather than
  introducing new config-lifecycle logic. Vitest-covered in
  `packages/debate-round/test/coachingPrograms.test.ts`
  (`buildCoachingProgramsPanelView`'s empty-store, name-sort, and
  non-mutating-of-the-underlying-store behavior). See idea #13
  ("Coaching Programs and Group Challenges") in Product Feature Ideas
  below — this closes the config-management half of follow-up (b), "a
  coaching-space dashboard UI." It does not yet render
  `buildCoachingProgramBoard`'s composed topic-sprint/group-challenge/
  member-drill board, since those inputs (persisted challenges, win
  events, topic-sprint contributions, and a roundId-to-contributor
  mapping for member drills) aren't available in a form this panel could
  read live — group-challenges' own follow-up (c) ("persisting
  challenges...") is still open. See the new follow-up noted under idea
  #13 below.
- **Team Collaboration Mode — collaboration-panel UI.**
  `packages/debate-card-search/src/panels/SprintNotesPanel.tsx` adds a
  full-page React panel that lets a teammate submit a new prep note against a
  shared topic (topic, author ID, note text, optional assignee) and renders
  every persisted `SprintNote` grouped by topic, each with a "cycle status"
  action (open → covered → needs-follow-up → open) and an "assign to" /
  "unassign" control — mirroring the existing `PrepNotesPanel` convention
  directly, since `SprintNoteStatus` shares the exact same three-value cycle
  as `PrepNoteStatus`. It's mounted at `/cards/collaboration`
  (`apps/debate-ai.com/app/cards/collaboration/page.tsx`, with a back-link to
  `/cards`, following the same panel convention as `/cards/reviews`/
  `/cards/brainstorm`) and reachable from the global nav dock's Settings menu
  ("Team Collaboration Mode", via a new `Users2`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (a), "a collaboration-mode panel UI,"
  named under the "🤝 Team Collaboration Mode" bullet in Research
  Crowdsourcing Organizer Features below — this is the twenty-fourth "wire a
  persisted slice's UI into the actual web app" follow-up closed in this
  repo. The panel adds four small helpers to `state/sprintNotes.ts` —
  `buildSprintNotesPanelView` (groups every persisted note by topic, in
  first-seen order across the stored notes, each group oldest first,
  mirroring `prepNotes.ts`'s `buildPrepNotesPanelView` grouping-by-status
  convention), `nextSprintNoteStatus` (the panel's status-cycle order,
  mirroring `prepNotes.ts`'s `nextPrepNoteStatus`), and
  `updatePersistedSprintNoteStatus`/`assignPersistedSprintNote` (apply the
  already-existing pure `updateSprintNoteStatus`/`assignSprintNote`
  transitions from `lib/team-collaboration-mode.ts` against a stored note and
  save the result, mirroring `prepNotes.ts`'s apply-and-save convention) —
  introducing no new note-lifecycle logic. Vitest-covered in
  `packages/debate-card-search/test/sprintNotes.test.ts` (status-cycle and
  assign/unassign apply-and-save behavior including the missing-id no-op
  case, and `buildSprintNotesPanelView`'s topic grouping, ordering, and live
  reflection of a status update). Documented in
  `docs/features/team-collaboration-mode.md` (mirroring
  `docs/features/prep-notes.md`'s format) and in
  `packages/debate-card-search/README.md`'s package-layout note and usage
  example. This panel only renders the `SprintNote` thread itself, not the
  full `buildTopicSprint` composition (quest board + task routing + progress
  board alongside notes) — none of `TopicCoverageReport`,
  `ContributorAvailability`, `TrackedTopicAssignment`, or
  `QuestContribution` are persisted in a form this panel could read live yet,
  so follow-up (b), "persisting a topic sprint's other inputs," remains open,
  as does follow-up (c), a live presence/who's-active signal — neither
  started. Verified from a clean install: `bun install`, `bun run typecheck`
  (11 packages with a typecheck script all pass; `debate-ai-web` has no
  separate typecheck script — types are checked as part of its build), `bun
  run test` (90 files / 1262 tests, all pass), and `bun run build:web`
  (production build, including the new `/cards/collaboration` route) all
  pass. No lint script is configured in this repo. PR: (opened by this run —
  see branch `claude/practical-allen-m9ogfi`). The local dev server was not
  smoke-tested in this sandbox (no reliable local browser workflow available
  here).
- **Legacy Verbatim / Cardmirror Compatibility — text-emphasize command.**
  `packages/debate-card-parser/src/utils/verbatim-shortcuts.ts` adds
  `toggleEmphasisHtml`, a pure, tag-aware function that toggles a
  `<mark>`/`</mark>` emphasis run over `[start, end)` of a card's *visible*
  (tag-stripped) text — closing follow-up (c), "a text-emphasize (toggle
  `<mark>`) command over an editor selection range," named under idea #14
  ("Legacy Verbatim / Cardmirror Compatibility") in Product Feature Ideas
  below. Addressing by visible-text offset (rather than raw HTML index)
  means a selection lands correctly around existing markup like `<u>` runs,
  mirroring `condenseCardHtml`'s tag-aware approach in the same file. A
  collapsed selection is a no-op; a selection that exactly matches an
  existing `<mark>` run's bounds un-emphasizes it; otherwise the selection
  is wrapped in a new `<mark>` pair, absorbing any `<mark>`/`</mark>` tags
  already touching the selection (inside it or immediately adjacent) so
  overlapping emphasis merges into one run instead of nesting.
  Vitest-covered in `packages/debate-card-parser/test/verbatim-shortcuts.test.ts`
  (wrap, un-emphasize, idempotent wrap-then-unwrap, merging a partially
  pre-marked selection, tag-aware offsets around a surrounding `<u>` run,
  collapsed-selection no-op, reversed-selection normalization, and
  out-of-range offset clamping). Exported from the package's public entry
  point alongside `condenseCardHtml`/`formatShortCiteTag`/`moveOutlineNode`.
  Follow-ups (a), wiring these commands into actual keyboard-shortcut
  handlers in `reason-editor`'s toolbar/editor view, and (b), a "send
  selected evidence to a speech document" command (which needs a
  speech-document target that doesn't exist yet), remain open — not
  started; this is a pure command function only, with no editor UI wiring.
  Verified from a clean install: `bun install`, `bun run typecheck` (11
  packages with a typecheck script all pass), `bun run test` (90 files /
  1253 tests, all pass), and `bun run build:web` (production build) all
  pass. No lint script is configured in this repo.
- **AI Response-Outcome Charts — chart/panel UI.**
  `packages/debate-round/src/panels/VulnerabilityChartsPanel.tsx` adds a
  full-page React panel that renders every persisted vulnerability report —
  a per-side exposure summary (argument count, unanswered count, average
  vulnerability score) and a "most exposed arguments" bar chart — reusing
  the already-existing `response-outcome.ts`
  `getArgumentVulnerabilityReport`/`summarizeOutcomeBySide`/
  `buildVulnerabilityChartData` computation directly. It's mounted at
  `/outcomes` (`apps/debate-ai.com/app/outcomes/page.tsx`, with a back-link
  to `/debate`, following the same panel convention as `/summaries`/
  `/outline`) and reachable from the global nav dock's Settings menu ("AI
  Response-Outcome Charts", via a new `BarChart3`-icon `DropdownMenuItem`
  in `CategoryDock.tsx`). Closes follow-up (b), "a chart/panel UI in
  `debate-round` that renders
  `buildVulnerabilityChartData`/`summarizeOutcomeBySide`," named under idea
  #4 ("AI Response-Outcome Charts") in Product Feature Ideas below — this
  is the twenty-third "wire a persisted slice's UI into the actual web
  app" follow-up closed in this repo. The panel is backed by a new
  persistence slice, `packages/debate-round/src/state/vulnerabilityReports.ts`
  (`listVulnerabilityReports`/`getVulnerabilityReport`/
  `saveVulnerabilityReport`/`deleteVulnerabilityReport`), which persists a
  round's derived `ArgumentVulnerability[]` report plus its flow `sideKeys`
  to localStorage, keyed by `roundId`, mirroring the existing
  `flowSummaries.ts` persistence convention. `response-outcome.ts` gains
  two row-based helpers — `summarizeOutcomeBySideFromReport` and
  `buildVulnerabilityChartDataFromReport` — split out of
  `summarizeOutcomeBySide`/`buildVulnerabilityChartData` the same way
  `flow-transcript-summary.ts`'s `buildFlowSummaryTextFromRows` was, so the
  panel can render an already-persisted report without the original raw
  `Flow`; no new vulnerability-scoring logic is introduced. Vitest-covered
  in `packages/debate-round/test/vulnerabilityReports.test.ts` (empty/corrupt
  storage, list/get/save/delete, upsert-on-save, and the sorted panel view)
  and new cases in `packages/debate-round/test/response-outcome.test.ts`
  (the row-based helpers match their `Flow`-based counterparts given the
  same derived report). Documented in
  `docs/features/response-outcome-charts.md` (mirroring
  `docs/features/flow-summaries.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout notes and usage
  examples. Follow-up (a), an actual AI-panel call (multiple "counsel"
  model roles) that evaluates likely response paths and clash points
  beyond this deterministic heuristic, and follow-up (c), a "what if" mode
  that recomputes the score against a hypothetical strategic choice, remain
  open — not started; this panel only renders reports already derived from
  a manually flowed grid, and nothing in this repo yet calls
  `getArgumentVulnerabilityReport`/`saveVulnerabilityReport` to generate one
  from a live round. Verified from a clean install: `bun install`, `bun run
  typecheck` (11 packages with a typecheck script all pass), `bun run test`
  (90 files / 1243 tests, all pass), and `bun run build:web` (production
  build, including the new `/outcomes` route) all pass. No lint script is
  configured in this repo. PR: [#169](https://github.com/debate/debate-ai.com/pull/169).
  The local dev server was not smoke-tested in this sandbox (no reliable
  local browser workflow available here).
- **CX NDCA Standings — standings dashboard UI.**
  `packages/debate-round/src/panels/StandingsPanel.tsx` adds a full-page
  React panel that lets a user record a team's tournament result
  (team ID, tournament name, date, division, bid level, outround finish,
  prelim win/loss record) and renders every persisted result's cumulative,
  ranked season standings — rank, total qualification points, tournaments
  counted vs. attended, cumulative prelim record, and best finish — reusing
  the already-existing `rankings/ndca-standings.ts`
  `computeTournamentPoints`/`buildStandings`/`rankStandings` computation
  directly. It's mounted at `/standings`
  (`apps/debate-ai.com/app/standings/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/opponents`/`/judges`)
  and reachable from the global nav dock's Settings menu ("CX NDCA
  Standings", via a new `TrendingUp`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (c), "a standings dashboard UI
  (likely under `/rank`)," named under idea #1 ("CX NDCA Standings") in
  Product Feature Ideas below — this is the twenty-second "wire a
  persisted slice's UI into the actual web app" follow-up closed in this
  repo. The panel is backed by a new persistence slice,
  `packages/debate-data-sync/src/state/tournamentResults.ts`
  (`listTournamentResults`/`listTournamentResultsForTeam`/
  `saveTournamentResult`/`deleteTournamentResult`), which persists
  `TournamentResult` records (each wrapped with a synthetic `id`, since a
  team can attend many tournaments, mirroring `debate-card-search`'s
  `revisionHistory.ts` wrapped-record convention) to localStorage, plus
  `buildStandingsFromStore`, which groups every persisted result by
  `teamId` and runs it directly through `buildStandings`/`rankStandings` —
  introducing no new points-scoring or ranking logic. Vitest-covered in
  `packages/debate-data-sync/test/tournamentResults.test.ts` (empty/corrupt
  storage, list/save/delete, per-team filtering, and
  `buildStandingsFromStore` grouping + ranking + honoring
  `BuildStandingsOptions` like `countBestN`). Documented in
  `docs/features/standings.md` (mirroring `docs/features/ai-versus-rounds.md`'s
  format) and in `packages/debate-data-sync/README.md`/
  `packages/debate-round/README.md`'s package-layout notes and usage
  examples. Follow-up (a), a real Tabroom/NDCA scraper that produces
  `TournamentResult` records automatically (today's `sync-tournaments.ts`
  only fetches tournament names), and follow-up (b), a real,
  circuit-sourced `QualificationPointsTable` instead of the illustrative
  default, remain open — not started; every result is entered by hand
  through this panel's form, and standings use
  `DEFAULT_QUALIFICATION_POINTS_TABLE`. Verified from a clean install:
  `bun install`, `bun run typecheck` (11 packages with a typecheck script
  all pass — this PR adds `state/tournamentResults.ts` typechecking to
  `debate-data-sync`'s existing script and `StandingsPanel.tsx` to
  `debate-round`'s; `debate-ai-web` has no separate typecheck script —
  types are checked as part of its build), `bun run test` (89 files / 1227
  tests, all pass), and `bun run build:web` (production build, including
  the new `/standings` route) all pass. No lint script is configured in
  this repo. PR: TBD. The local dev server was not smoke-tested in this
  sandbox (no reliable local browser workflow available here).
- **Practice Round Simulator — round-simulator UI.**
  `packages/debate-round/src/panels/PracticeRoundSimulatorPanel.tsx` adds a
  full-page React panel that lets a user configure a practice round (round
  ID, `debate-timer` format, side, an AI judge paradigm — built-in or
  custom via `buildCustomJudgeParadigm` — and an optional AI opponent
  persona), composing them via the already-existing
  `buildPracticeRoundSetup` and saving through `state/practiceRounds.ts`
  (`savePracticeRound`, `deletePracticeRound`), and renders every persisted
  round below with its setup sections, submitted-speech progress (read
  through the existing "Online Debate Versus AI" `aiVersusRounds.ts` store
  via `getPracticeRoundSubmittedSpeeches`, with a link to `/versus-ai` to
  actually submit them), and post-round feedback once one has been
  generated. It's mounted at `/practice-round`
  (`apps/debate-ai.com/app/practice-round/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/versus-ai`/
  `/coaching`) and reachable from the global nav dock's Settings menu
  ("Practice Round Simulator", via a new `PlayCircle`-icon
  `DropdownMenuItem` in `CategoryDock.tsx`). Closes follow-up (b), "a
  round-simulator UI that reads/writes through the persistence store,"
  named under the "🧪 Practice Round Simulator" bullet in Research
  Crowdsourcing Organizer Features below — this is the twenty-first "wire a
  persisted slice's UI into the actual web app" follow-up closed in this
  repo. The panel adds one small helper to `state/practiceRounds.ts` —
  `buildPracticeRoundsPanelView`, which sorts every persisted round by
  `roundId` for a stable display order (mirroring `aiVersusRounds.ts`'s
  `buildAiVersusRoundsPanelView`) — introducing no new setup-composition,
  judge-paradigm, or opponent-persona logic; every other field/action the
  panel uses (`buildPracticeRoundSetup`, `listJudgeParadigms`,
  `buildCustomJudgeParadigm`, `listOpponentPersonas`, `savePracticeRound`,
  `deletePracticeRound`, `getPracticeRoundSubmittedSpeeches`) already
  existed. Vitest-covered in
  `packages/debate-round/test/practiceRounds.test.ts` (empty view when
  nothing is stored, sorted by `roundId`, and that the sort doesn't mutate
  the underlying stored order). Documented in
  `docs/features/practice-round-simulator.md` (mirroring
  `docs/features/ai-versus-rounds.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note and usage
  example. Follow-up (a), an actual AI speech-generation call for the AI
  opponent's speeches and an AI judge-decision call under the chosen
  paradigm, remains open — not started; until it exists, post-round
  feedback is never generated automatically, so the panel always shows "no
  post-round feedback yet." Verified from a clean install: `bun install`,
  `bun run typecheck` (11 packages with a typecheck script all pass;
  `debate-ai-web` has no separate typecheck script — types are checked as
  part of its build), `bun run test` (88 files / 1216 tests, all pass), and
  `bun run build:web` (production build, including the new
  `/practice-round` route) all pass. No lint script is configured in this
  repo. PR: [#166](https://github.com/debate/debate-ai.com/pull/166). The
  local dev server was not smoke-tested in this sandbox (no reliable local
  browser workflow available here).
- **Team Brainstorm Assist — brainstorm-panel UI.**
  `packages/debate-card-search/src/panels/BrainstormBoardPanel.tsx` adds a
  full-page React panel that lets a squad submit a new brainstorm idea
  (argument block, contributor ID, category, idea text) and renders every
  persisted idea grouped into its board (argument block + category), each
  board ranked by popularity with a "possible duplicate" badge and an
  upvote action — reusing `team-brainstorm-assist.ts`'s existing
  `groupIdeasByBoard`/`buildBrainstormBoard`/`rankBrainstormIdeas` directly.
  It's mounted at `/cards/brainstorm`
  (`apps/debate-ai.com/app/cards/brainstorm/page.tsx`, with a back-link to
  `/cards`, following the same panel convention as `/cards/reviews`/
  `/cards/inbox`) and reachable from the global nav dock's Settings menu
  ("Team Brainstorm Assist", via a new `Lightbulb`-icon `DropdownMenuItem`
  in `CategoryDock.tsx`). Closes follow-up (b) named under the "🧠 Team
  Brainstorm Assist" bullet in Research Crowdsourcing Organizer Features
  below — this is the twentieth "wire a persisted slice's UI into the
  actual web app" follow-up closed in this repo. The panel adds two small
  helpers to `state/brainstormIdeas.ts` — `buildBrainstormBoardsPanelView`,
  which groups every persisted `BrainstormIdea` into its board and ranks
  each via `buildBrainstormBoard`, sorted by argument block then category
  for a stable display order (mirroring `routedTaskQueues.ts`'s
  `buildTaskInboxView`), and `upvotePersistedBrainstormIdea`, which reads a
  stored idea, increments its `upvotes` by one, and saves it back
  (mirroring `prepNotes.ts`'s `updatePersistedPrepNoteStatus` apply-and-save
  convention) — introducing no new ranking, duplicate-flagging, or mutation
  logic; every other field/action the panel uses (`groupIdeasByBoard`,
  `buildBrainstormBoard`, `saveBrainstormIdea`) already existed. Follow-up
  (a), seeding boards from the Topic Coverage Dashboard's under-covered
  arguments via `buildBrainstormPromptsForCoverageGaps`, and an actual
  AI-generation call that drafts candidate ideas, remain open — not
  started; the panel only lets a human type an idea in, and a board only
  appears once someone has submitted to it. Vitest-covered in
  `packages/debate-card-search/test/brainstormIdeas.test.ts` (empty board
  list when nothing is stored, ideas grouped into boards sorted by argument
  block then category, and `upvotePersistedBrainstormIdea` incrementing a
  stored idea's upvote count — including the no-op case for a missing id).
  Documented in `docs/features/brainstorm-board.md` (mirroring
  `docs/features/prep-notes.md`'s format) and in
  `packages/debate-card-search/README.md`'s package-layout note and usage
  example. Verified from a clean install: `bun install`, `bun run
  typecheck` (11 packages with a typecheck script all pass; `debate-ai-web`
  has no separate typecheck script — types are checked as part of its
  build), `bun run test` (88 files / 1213 tests, all pass), and `bun run
  build:web` (production build, including the new `/cards/brainstorm`
  route) all pass. No lint script is configured in this repo. PR:
  [#165](https://github.com/debate/debate-ai.com/pull/165). The local dev
  server was not smoke-tested in this sandbox (no reliable local browser
  workflow available here).
- **Online Debate Versus AI — round-setup + submission UI.**
  `packages/debate-round/src/panels/AiVersusRoundPanel.tsx` adds a full-page
  React panel that lets a user start a round (round ID, `debate-timer`
  format, and side — formats with no `secondary` side, like Congress, only
  offer the primary side), renders the round's full turn order derived via
  `buildAiVersusSpeechOrder` (each slot tagged "You"/"AI" and marked
  Delivered/Next/Pending), and — when it's the user's turn — a text area to
  type and submit the next expected speech, validated with
  `validateSpeechSubmission` before saving through the already-persisted
  `state/aiVersusRounds.ts` (`saveAiVersusRound`, `deleteAiVersusRound`). AI
  turns are shown as pending rather than fillable, since no AI
  speech-generation call exists yet. It's mounted at `/versus-ai`
  (`apps/debate-ai.com/app/versus-ai/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/word-count`/
  `/outline`) and reachable from the global nav dock's Settings menu
  ("Online Debate Versus AI", via a new `Bot`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (b) named under idea #3 ("Online
  Debate Versus AI") in Product Feature Ideas below — this is the
  nineteenth "wire a persisted slice's UI into the actual web app"
  follow-up closed in this repo. The panel adds two small helpers to
  `state/aiVersusRounds.ts` — `buildAiVersusRoundsPanelView`, which sorts
  every persisted round by `roundId` for a stable display order (mirroring
  `wordCountRounds.ts`'s `buildWordCountRoundsPanelView`), and
  `getAiVersusRoundStatus`, which rebuilds a round's turn order and
  next-slot status on read from its stored `styleKey`/`userSide` rather
  than storing the order itself (mirroring `wordCountRounds.ts`'s
  `getWordCountRoundStatuses`) — introducing no new turn-order or
  validation logic; every other field/action the panel uses
  (`buildAiVersusSpeechOrder`, `getNextSpeechSlot`, `isUsersTurn`,
  `validateSpeechSubmission`, `saveAiVersusRound`, `deleteAiVersusRound`)
  already existed. Vitest-covered in
  `packages/debate-round/test/aiVersusRounds.test.ts` (empty view when
  nothing is stored, sorted by `roundId`, the underlying stored order left
  untouched, `getAiVersusRoundStatus` returning `undefined` for an
  unpersisted round, its output matching an independently-derived
  `buildAiVersusSpeechOrder`/`getNextSpeechSlot`/`isUsersTurn` computation,
  and the status reflecting a newly submitted speech). Documented in
  `docs/features/ai-versus-rounds.md` (mirroring
  `docs/features/word-count-rounds.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note and usage
  example. Follow-up (a), an actual AI speech-generation call that consumes
  `buildAiResponseRequest`'s output to produce the AI's next speech text,
  remains open — not started; until it exists, a round can only progress as
  far as the user's own turns. Speech submission is also text-only —
  `PriorSpeechRecord` has no audio field and no transcription pipeline
  exists in this repo, so "or record a speech" from the original follow-up
  wording isn't implemented, documented as a known gap in the new doc file
  (the same trade-off the Word-Count panel's own unfinished follow-up (b)
  made). Verified from a clean install: `bun install`, `bun run typecheck`
  (11 packages with a typecheck script all pass; `debate-ai-web` has no
  separate typecheck script — types are checked as part of its build),
  `bun run test` (88 files / 1209 tests, all pass), and `bun run build:web`
  (production build, including the new `/versus-ai` route) all pass. No
  lint script is configured in this repo. PR:
  [#164](https://github.com/debate/debate-ai.com/pull/164). The local dev
  server was not smoke-tested in this sandbox (no reliable local browser
  workflow available here).
- **Outline Filters and Argument Tree View — outline panel UI.**
  `packages/debate-round/src/panels/ArgumentTreePanel.tsx` adds a full-page
  React panel that renders every persisted round's argument tree as a
  filterable outline, with Kind (all/headings-only/arguments-only), Side,
  Speech, and "Unanswered only" controls — each populated from the distinct
  side keys and speech names actually present in that round's tree — that
  re-filter the tree live via the existing `filterArgumentTree`/
  `flattenArgumentTree` and persist the chosen filter per round through the
  already-existing `argumentTreeFilters.ts` store. It's mounted at
  `/outline` (`apps/debate-ai.com/app/outline/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/summaries`/
  `/word-count`) and reachable from the global nav dock's Settings menu
  ("Argument Tree Outline", via a new `ListTree`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (a) named under idea #10 ("Outline
  Filters and Argument Tree View") in Product Feature Ideas below — this is
  the eighteenth "wire a persisted slice's UI into the actual web app"
  follow-up closed in this repo. Since the tree itself is derived from a
  live `Flow` rather than hand-entered, and nothing else in this repo
  persists a round's derived tree yet, this slice also adds
  `state/argumentTrees.ts` — a new `ArgumentTreeRecord` localStorage store
  (`listArgumentTrees`/`getArgumentTree`/`saveArgumentTree`/
  `deleteArgumentTree`/`buildArgumentTreesPanelView`), mirroring the
  existing `flowSummaries.ts`/`drillSets.ts` persistence convention, plus
  `buildAndSaveArgumentTree(flow, roundId)` for deriving and persisting a
  round's tree from an already-flowed `Flow` in one step. No new
  tree-derivation or filtering logic is introduced — `buildArgumentTree`/
  `filterArgumentTree`/`flattenArgumentTree` and the filter-selection store
  already existed. Vitest-covered in
  `packages/debate-round/test/argumentTrees.test.ts` (CRUD + upsert +
  delete semantics, `buildAndSaveArgumentTree` deriving from a small hand-
  built flow, and `buildArgumentTreesPanelView`'s stable `roundId` sort
  without mutating storage order). Documented in
  `docs/features/argument-tree-outline.md` (mirroring
  `docs/features/word-count-rounds.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note and usage
  example. Follow-up (b), finer argument-type tagging (link/impact/turn/
  answer/extension) and contributor/evidence-status fields, none of which
  exist in the `Box`/`Flow` schema today, remains open — not started; nor
  is there yet a real trigger in the live round-flowing page
  (`DebateFlowPage`/`FlowMainContent`) that calls `buildAndSaveArgumentTree`
  — the same "real trigger not wired" gap already noted for several other
  panels. Verified from a clean install: `bun install`, `bun run typecheck`
  (11 packages with a typecheck script all pass; `debate-ai-web` has no
  separate typecheck script — types are checked as part of its build),
  `bun run test` (88 files / 1203 tests, all pass), and `bun run build:web`
  (production build, including the new `/outline` route) all pass. No lint
  script is configured in this repo. PR:
  [#162](https://github.com/debate/debate-ai.com/pull/162). The local dev
  server was not smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **Word-Count-Only Speech Format — submission UI.**
  `packages/debate-round/src/panels/WordCountRoundsPanel.tsx` adds a
  full-page React panel that lets a user pick a round ID and `debate-timer`
  word-count style, then type each speech's text against a live word-count
  badge (current count, limit, and remaining/over) recomputed via
  `getWordCountStatus` on every keystroke, and save the round through
  `state/wordCountRounds.ts`'s `saveWordCountRound`. It's mounted at
  `/word-count` (`apps/debate-ai.com/app/word-count/page.tsx`, with a
  back-link to `/debate`, following the same panel convention as
  `/coaching`/`/drills`) and reachable from the global nav dock's Settings
  menu ("Word-Count Speeches", via a new `Type`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (a) named under idea #2
  ("Word-Count-Only Speech Format") in Product Feature Ideas below — this is
  the seventeenth "wire a persisted slice's UI into the actual web app"
  follow-up closed in this repo. The panel adds one small helper rather than
  new word-count logic: `state/wordCountRounds.ts`'s
  `buildWordCountRoundsPanelView`, which sorts every persisted round by
  `roundId` for a stable display order (mirroring
  `coachingSessions.ts`'s `buildCoachingSessionsPanelView`); every other
  field/action the panel uses (`getWordCountStatus`, `wordCountStyles`,
  `saveWordCountRound`, `deleteWordCountRound`, `getWordCountRoundStatuses`)
  already existed. Vitest-covered in
  `packages/debate-round/test/wordCountRounds.test.ts` (empty view when
  nothing is stored, sorted by `roundId`, and that the underlying stored
  order is left untouched). Documented in
  `docs/features/word-count-rounds.md` (mirroring
  `docs/features/coaching-sessions.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note and usage example.
  Follow-up (b), extending `useTimerState`/`SpeechTimer` to support a
  non-timed, word-limited speech mode in the live round timer itself,
  remains open — not started. Verified from a clean install: `bun install`,
  `bun run typecheck` (11 packages with a typecheck script all pass;
  `debate-ai-web` has no separate typecheck script — types are checked as
  part of its build), `bun run test` (87 files / 1192 tests, all pass), and
  `bun run build:web` (production build, including the new `/word-count`
  route) all pass. No lint script is configured in this repo. PR: (opened by
  this run — see branch `claude/peaceful-cerf-3qp6x7`). The local dev server
  was not smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **Peer Review System — review-queue/comment-thread UI.**
  `packages/debate-card-search/src/panels/ReviewQueuePanel.tsx` adds a
  full-page React panel that lets a user start a card's peer review, move it
  through `lib/peer-review.ts`'s status state machine (submit for review,
  request changes, approve, reject, publish) with buttons scoped to whatever
  transitions are legal from its current status, and leave/resolve comments
  on its thread (reviewer id, severity, body), with an unresolved-blocking-
  comments warning shown until they're resolved. It's mounted at
  `/cards/reviews` (`apps/debate-ai.com/app/cards/reviews/page.tsx`, with a
  back-link to `/cards`, following the same panel convention as
  `/cards/revisions`/`/cards/inbox`) and reachable from the global nav dock's
  Settings menu ("Review Queue", via a new `MessageSquareText`-icon
  `DropdownMenuItem` in `CategoryDock.tsx`). Closes follow-up (a) named
  under the "🗣️ Peer Review System" bullet in the Research Crowdsourcing
  Organizer Features list below — this is the sixteenth "wire a persisted
  slice's UI into the actual web app" follow-up closed in this repo, after
  the Contribution Leaderboard, Task Inbox, Progress Unlocks, Evidence
  Library, Prep Notes, Revision Incentives, Judge Profiles, Opponent Team
  Profiles, Practice Drills, Pre-Round Briefings, AI Coach Mode, Judge
  Paradigm Picker, Speech Transcript Summaries, and Opponent Persona Picker
  panels. The panel adds one small helper rather than new review-lifecycle
  logic: `state/peerReviews.ts`'s `buildReviewQueuePanelView`, which sorts
  every persisted review by `cardId` for a stable display order (mirroring
  `judgeParadigmSelections.ts`'s `buildJudgeParadigmSelectionsPanelView`);
  every other field/action the panel uses (`createCardReview`,
  `submitForReview`, `requestChanges`, `approveReview`, `rejectReview`,
  `publishReview`, `addReviewComment`, `resolveReviewComment`,
  `buildReviewSummary`, `savePeerReview`, `deletePeerReview`) already
  existed. Vitest-covered in
  `packages/debate-card-search/test/peerReviews.test.ts` (empty view when
  nothing is stored, sorted by `cardId`, and that the underlying stored
  order is left untouched). Documented in `docs/features/review-queue.md`
  (mirroring `docs/features/task-inbox.md`'s format) and in
  `packages/debate-card-search/README.md`'s package-layout note and usage
  example. Follow-ups (b) reviewer identity/permission checks and (c)
  wiring a review's lifecycle to whatever eventually persists submitted
  cards remain open — neither started. Verified from a clean install:
  `bun install`, `bun run typecheck`, `bun run test`, and `bun run
  build:web` (production build, including the new `/cards/reviews` route).
  No lint script is configured in this repo. PR: (opened by this run — see
  branch `claude/practical-allen-xcm27w`). The local dev server was not
  smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **AI Practice Opponent — persona-picker UI.**
  `packages/debate-speech-writer/src/panels/OpponentPersonaPickerPanel.tsx`
  adds a full-page React panel that lets a user save a practice session's AI
  opponent persona — one of the four built-in personas
  (`policy-heavy`/`kritik`/`lay`/`fast-flow`) from
  `opponent/opponent-personas.ts` — by entering a session ID and picking a
  persona from a radio group, then lists every session with a saved
  selection, each with a "Clear" action. It's mounted at `/practice-opponent`
  (`apps/debate-ai.com/app/practice-opponent/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/paradigms`/`/coaching`)
  and reachable from the global nav dock's Settings menu ("Opponent Persona
  Picker", via a new `Swords`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (b) named under the "AI Practice
  Opponent" idea in the Research Crowdsourcing Organizer Features list
  below — this is the fourteenth "wire a persisted slice's UI into the
  actual web app" follow-up closed in this repo, after the Contribution
  Leaderboard, Task Inbox, Progress Unlocks, Evidence Library, Prep Notes,
  Revision Incentives, Judge Profiles, Opponent Team Profiles, Practice
  Drills, Pre-Round Briefings, AI Coach Mode, Judge Paradigm Picker, and
  Speech Transcript Summaries panels. The panel adds one small helper
  rather than new persona-selection logic:
  `state/opponentPersonaSelections.ts`'s `buildOpponentPersonaSelectionsPanelView`,
  which sorts every persisted selection by `sessionId` for a stable display
  order (mirroring `judgeParadigmSelections.ts`'s
  `buildJudgeParadigmSelectionsPanelView`); every other field/action the
  panel uses (`listOpponentPersonas`, `saveOpponentPersonaSelection`,
  `deleteOpponentPersonaSelection`) already existed. Vitest-covered in
  `packages/debate-speech-writer/test/opponentPersonaSelections.test.ts`
  (empty view when nothing is stored, sorted by `sessionId`, and that the
  underlying stored order is left untouched). Documented in
  `packages/debate-speech-writer/README.md`'s package-layout note and usage
  example. Verified from a clean install: `bun install`, `bun run
  typecheck` (11 packages with a typecheck script all pass; `debate-ai-web`
  has no separate typecheck script — types are checked as part of its
  build), `bun run test` (87 files / 1186 tests, all pass), and `bun run
  build:web` (production build, including the new `/practice-opponent`
  route) all pass. No lint script is configured in this repo. PR:
  [#156](https://github.com/debate/debate-ai.com/pull/156). The local dev
  server was not smoke-tested in this sandbox (no reliable local browser
  workflow available here).
- **Speech Transcript Summaries and Answers — summary/cross-ex panel UI.**
  `packages/debate-round/src/panels/FlowSummariesPanel.tsx` adds a full-page
  React panel that renders every persisted `FlowSummaryRecord` (from
  `state/flowSummaries.ts`), one card per round, sorted by `roundId` — each
  card shows that round's per-argument summary text and, when any argument
  is currently unanswered, a suggested cross-examination-questions list and
  a suggested extension-ideas list for those unanswered rows, plus a
  "Clear" action. It's mounted at `/summaries`
  (`apps/debate-ai.com/app/summaries/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/coaching`/`/paradigms`)
  and reachable from the global nav dock's Settings menu ("Speech
  Transcript Summaries", via a new `FileText`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (b) named under idea #6 ("Speech
  Transcript Summaries and Answers") in Product Feature Ideas below — this
  is the thirteenth "wire a persisted slice's UI into the actual web app"
  follow-up closed in this repo, after the Contribution Leaderboard, Task
  Inbox, Progress Unlocks, Evidence Library, Prep Notes, Revision
  Incentives, Judge Profiles, Opponent Team Profiles, Practice Drills,
  Pre-Round Briefings, AI Coach Mode, and Judge Paradigm Picker panels. The
  panel adds two small helpers rather than new summary-derivation logic:
  `flow/flow-transcript-summary.ts`'s `buildFlowSummaryTextFromRows` (the
  row-mapping half of the existing `buildFlowSummaryText`, extracted so the
  panel can render already-persisted `FlowRowSummary[]` without the
  original raw `Flow`, with `buildFlowSummaryText` now calling it), and
  `state/flowSummaries.ts`'s `buildFlowSummariesPanelView`, which sorts
  every persisted summary by `roundId` for a stable display order; every
  other field/action the panel uses (`suggestCrossExamQuestions`,
  `suggestExtensionIdeas`, `deleteFlowSummary`) already existed. Vitest-covered
  in `packages/debate-round/test/flowSummaries.test.ts` (empty view when
  nothing is stored, sorted by `roundId`, and that clearing a round's
  summary is reflected) and `packages/debate-round/test/flow-transcript-summary.test.ts`
  (empty-row text, and that the extracted helper's output matches
  `buildFlowSummaryText`'s for the same rows). Documented in
  `docs/features/flow-summaries.md` (mirroring
  `docs/features/coaching-sessions.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note and usage
  example. Follow-up (a), audio/video transcription plus an AI call to
  extract claims/warrants/impacts/evidence from raw speech text instead of
  relying on a manually flowed grid, remains open — not started. Verified
  from a clean install: `bun install`, `bun run typecheck` (11 packages
  with a typecheck script all pass; `debate-ai-web` has no separate
  typecheck script — types are checked as part of its build), `bun run
  test` (87 files / 1183 tests, all pass), and `bun run build:web`
  (production build, including the new `/summaries` route) all pass. No
  lint script is configured in this repo. PR:
  [#154](https://github.com/debate/debate-ai.com/pull/154). The local dev
  server was not smoke-tested in this sandbox (no reliable local browser
  workflow available here).
- **AI Judge Decision Modes — paradigm-picker UI.**
  `packages/debate-speech-writer/src/panels/JudgeParadigmPickerPanel.tsx`
  adds a full-page React panel with a form to save a round's AI judge
  paradigm — one of the six built-in paradigms from `judge/judge-paradigms.ts`
  (Flow, Lay, Policymaker, Kritikal, Educator, Truth Over Tech), each shown
  with its name and description as a radio choice, or a "Custom judge
  paradigm" option that reveals a judge-name + preferences-notes form built
  through the existing `buildCustomJudgeParadigm` — plus a list of every
  round with a saved `JudgeParadigmSelection`, sorted by `roundId`, each with
  a "Clear" action. It's mounted at `/paradigms`
  (`apps/debate-ai.com/app/paradigms/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/judges`/`/coaching`)
  and reachable from the global nav dock's Settings menu ("Judge Paradigm
  Picker", via a new `Scale`-icon `DropdownMenuItem` in `CategoryDock.tsx`).
  Closes follow-up (b), "a paradigm-picker UI for selecting a built-in
  paradigm or entering a custom judge's notes that reads/writes through the
  persistence store," named under idea #5 ("AI Judge Decision Modes") in
  Product Feature Ideas below — this is the twelfth "wire a persisted
  slice's UI into the actual web app" follow-up closed in this repo, after
  the Contribution Leaderboard, Task Inbox, Progress Unlocks, Evidence
  Library, Prep Notes, Revision Incentives, Judge Profiles, Opponent Team
  Profiles, Practice Drills, Pre-Round Briefings, and AI Coach Mode panels.
  The panel adds one small helper to `state/judgeParadigmSelections.ts` —
  `buildJudgeParadigmSelectionsPanelView`, which sorts every persisted
  selection by `roundId` for a stable display order — introducing no new
  paradigm-selection or resolution logic; every field the panel saves
  already existed on `judge-paradigms.ts`'s `listJudgeParadigms`/
  `buildCustomJudgeParadigm` output, and every save/clear action calls the
  already-persisted `saveJudgeParadigmSelection`/`deleteJudgeParadigmSelection`
  directly. Vitest-covered in
  `packages/debate-speech-writer/test/judgeParadigmSelections.test.ts` (empty
  view when nothing is stored, sorted by `roundId`, and that the sort
  doesn't mutate the underlying stored order). Documented in
  `docs/features/judge-paradigm-selections.md` (mirroring
  `docs/features/judge-profiles.md`'s format) and in
  `packages/debate-speech-writer/README.md`'s package-layout note and usage
  example. Follow-up (a), an actual AI judge-decision call that uses
  `buildJudgeParadigmPrompt`'s output instead of (or alongside) the existing
  static `judgeDecisionPrompt`, remains open — not started. Verified from a
  clean install: `bun install`, `bun run typecheck` (11 packages with a
  typecheck script all pass; `debate-ai-web` has no separate typecheck
  script — types are checked as part of its build), `bun run test` (87
  files / 1178 tests, all pass), and `bun run build:web` (production build,
  including the new `/paradigms` route) all pass. No lint script is
  configured in this repo. PR:
  [#152](https://github.com/debate/debate-ai.com/pull/152). The local dev
  server was not smoke-tested in this sandbox (no reliable local browser
  workflow available here).
- **AI Coach Mode — coaching-panel UI.**
  `packages/debate-round/src/panels/CoachingSessionsPanel.tsx` adds a
  full-page React panel that renders every persisted `CoachingSessionRecord`
  (from `coachingSessions.ts`) grouped by round + side — each prompt showing
  a kind badge (Extension/Refutation/Collapse/Weighing) and its text — with
  a "Clear" action per session. It's mounted at `/coaching`
  (`apps/debate-ai.com/app/coaching/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/drills`/`/briefings`)
  and reachable from the global nav dock's Settings menu ("AI Coach Mode",
  via a new `GraduationCap`-icon `DropdownMenuItem` in `CategoryDock.tsx`).
  Closes follow-up (b), "a coaching-panel UI that reads/writes through the
  persistence store," named under the "🎙️ AI Coach Mode" bullet in Research
  Crowdsourcing Organizer Features below — this is the eleventh "wire a
  persisted slice's UI into the actual web app" follow-up closed in this
  repo, after the Contribution Leaderboard, Task Inbox, Progress Unlocks,
  Evidence Library, Prep Notes, Revision Incentives, Judge Profiles,
  Opponent Team Profiles, Practice Drills, and Pre-Round Briefings panels.
  The panel adds one small helper to `state/coachingSessions.ts` —
  `buildCoachingSessionsPanelView`, which sorts every persisted coaching
  session by `roundId` then `sideKey` for a stable display order —
  introducing no new coaching-prompt generation logic; every rendered field
  already existed on `coach-mode.ts`'s `buildCoachingSession` output.
  Vitest-covered in `packages/debate-round/test/coachingSessions.test.ts`
  (empty view when nothing is stored, sorted by `roundId` then `sideKey`,
  and that the view reflects a session removed via the existing
  `deleteCoachingSession`). Documented in
  `docs/features/coaching-sessions.md` (mirroring
  `docs/features/drill-sets.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note. Follow-up (a), an
  actual AI coaching call for open-ended feedback beyond this deterministic
  template layer, remains open — not started. Verified from a clean
  install: `bun install`, `bun run typecheck` (11 packages with a typecheck
  script all pass; `debate-ai-web` has no separate typecheck script — types
  are checked as part of its build), `bun run test` (87 files / 1175 tests,
  all pass), and `bun run build:web` (production build, including the new
  `/coaching` route) all pass. No lint script is configured in this repo.
  PR: [#151](https://github.com/debate/debate-ai.com/pull/151). The local
  dev server was not smoke-tested in this sandbox (no reliable
  local browser workflow available here).
- **Pre-Round Intelligence Panel — briefing-panel UI.**
  `packages/debate-round/src/panels/PreRoundBriefingsPanel.tsx` adds a
  full-page React panel that renders every persisted `PreRoundBriefingRecord`
  (from `preRoundBriefings.ts`) as its own card — an event-line header
  (tournament, division, round label), a badge with the prior head-to-head
  record against that round's opponent, and every briefing section (Event,
  Opponent scouting, Prior meetings, Judge tendencies, Team prep notes) —
  with a "Clear" action per round. It's mounted at `/briefings`
  (`apps/debate-ai.com/app/briefings/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/drills`/`/prep-notes`)
  and reachable from the global nav dock's Settings menu ("Pre-Round
  Briefings", via a new `ClipboardList`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (b), "a briefing panel UI that
  renders it on a round-information page," named under idea #12 ("Pre-Round
  Intelligence Panel") in Product Feature Ideas below — this is the tenth
  "wire a persisted slice's UI into the actual web app" follow-up closed in
  this repo, after the Contribution Leaderboard, Task Inbox, Progress
  Unlocks, Evidence Library, Prep Notes, Revision Incentives, Judge
  Profiles, Opponent Team Profiles, and Practice Drills panels. The panel
  adds one small helper to `state/preRoundBriefings.ts` —
  `buildPreRoundBriefingsPanelView`, which sorts every persisted briefing by
  `roundId` for a stable display order — introducing no new
  briefing-composition logic; every rendered field already existed on
  `pre-round-briefing.ts`'s `buildPreRoundBriefing` output. Vitest-covered
  in `packages/debate-round/test/preRoundBriefings.test.ts` (empty view when
  nothing is stored, sorted by `roundId`, and that the sort doesn't mutate
  the underlying stored order). Documented in
  `docs/features/pre-round-briefings.md` (mirroring
  `docs/features/drill-sets.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note. Follow-up (a), a
  real data source for tournament results, pairings, event details, and
  room assignments, remains open — not started. Verified from a clean
  install: `bun install`, `bun run typecheck` (12 packages typecheck;
  `debate-ai-web` has no separate typecheck script — types are checked as
  part of its build), `bun run test` (87 files / 1172 tests, all pass), and
  `bun run build:web` (production build, including the new `/briefings`
  route) all pass. No lint script is configured in this repo. The local dev
  server was not smoke-tested in this sandbox (no reliable local browser
  workflow available here).
- **AI Drill Generator — drill-panel UI.**
  `packages/debate-round/src/panels/DrillSetsPanel.tsx` adds a full-page
  React panel that renders every persisted `DrillSetRecord` (from
  `drillSets.ts`) grouped by round — each drill showing a kind badge
  (Overview/Frontline/Cross-Ex/Collapse) and its prompt — with a "Clear"
  action per round. It's mounted at `/drills`
  (`apps/debate-ai.com/app/drills/page.tsx`, with a back-link to `/debate`,
  following the same panel convention as `/prep-notes`/`/opponents`) and
  reachable from the global nav dock's Settings menu ("Practice Drills",
  via a new `Dumbbell`-icon `DropdownMenuItem` in `CategoryDock.tsx`).
  Closes follow-up (a), "a drill-panel UI that reads/writes through the
  persistence store," named under the "📚 AI Drill Generator" bullet in
  Research Crowdsourcing Organizer Features below — this is the ninth
  "wire a persisted slice's UI into the actual web app" follow-up closed
  in this repo, after the Contribution Leaderboard, Task Inbox, Progress
  Unlocks, Evidence Library, Prep Notes, Revision Incentives, Judge
  Profiles, and Opponent Team Profiles panels. The panel adds one small
  helper to `state/drillSets.ts` — `buildDrillSetsPanelView`, which sorts
  every persisted drill set by `roundId` then `sideKey` for a stable
  display order — introducing no new drill-generation logic; every
  rendered field already existed on `drill-generator.ts`'s `buildDrillSet`
  output. Vitest-covered in `packages/debate-round/test/drillSets.test.ts`
  (empty view when nothing is stored, sorted by `roundId`, and that saving
  a new drill set for an already-stored `roundId` upserts by `roundId`
  alone, matching `saveDrillSet`'s existing upsert semantics). Documented
  in `docs/features/drill-sets.md` (mirroring
  `docs/features/prep-notes.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note. Follow-up (b),
  an actual AI-generated (rather than templated) drill script, remains
  open — not started. Verified from a clean install: `bun install`,
  `bun run typecheck` (12 packages typecheck; `debate-ai-web` has no
  separate typecheck script — types are checked as part of its build),
  `bun run test` (87 files / 1169 tests, all pass), and `bun run build:web`
  (production build, including the new `/drills` route) all pass. No lint
  script is configured in this repo. The local dev server was not
  smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **Opponent Team Profiles — opponent-scouting roster UI panel.**
  `packages/debate-round/src/panels/OpponentTeamProfilesPanel.tsx` adds a
  full-page React panel that renders every persisted `OpponentTeamProfile`
  as a scouting roster table — rounds recorded, overall win-loss record,
  Aff/Neg side record (flagged "stronger on aff/neg" once it clears
  `opponent-team-profile.ts`'s threshold), and the team's top 3 most
  common argument tags and cases — ordered by rounds recorded descending.
  It's mounted at `/opponents` (`apps/debate-ai.com/app/opponents/page.tsx`,
  with a back-link to `/debate`, following the same panel convention as
  `/judges`/`/prep-notes`) and reachable from the global nav dock's
  Settings menu ("Opponent Team Profiles", via a new `Users`-icon
  `DropdownMenuItem` in `CategoryDock.tsx`). Closes follow-up (b), "a
  scouting-card/panel UI," named under the "🕵️ Opponent Team Profiles"
  bullet in Research Crowdsourcing Organizer Features below — this is the
  eighth "wire a persisted slice's UI into the actual web app" follow-up
  closed in this repo, after the Contribution Leaderboard, Task Inbox,
  Progress Unlocks, Evidence Library, Prep Notes, Revision Incentives, and
  Judge Profiles panels, and the first one to live in `debate-round` while
  rendering a `debate-data-sync` store (the profile/panel already crossed
  that package boundary via `pre-round-briefing.ts`, so the panel imports
  `debate-data-sync/src/state/opponentTeamProfiles` directly rather than
  duplicating storage). The panel adds one small helper to
  `debate-data-sync`'s `state/opponentTeamProfiles.ts` —
  `buildOpponentTeamProfilesRoster`, which lists every persisted profile
  ordered by rounds recorded descending (ties broken alphabetically by
  `teamId`) — introducing no new aggregation logic; every rendered field
  already existed on `rankings/opponent-team-profile.ts`'s
  `buildOpponentTeamProfile` output. Vitest-covered in
  `packages/debate-data-sync/test/opponentTeamProfiles.test.ts` (empty
  roster when nothing is stored, ordering by rounds recorded descending,
  and alphabetical tie-breaking when rounds recorded are equal).
  Documented in `docs/features/opponent-team-profiles.md` (mirroring
  `docs/features/judge-profiles.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note. Follow-up (a),
  a real round-history data source producing `OpponentRoundRecord`s (e.g.
  from Tabroom pairings/ballots) instead of relying on caller-supplied
  data, remains open — not started.

- **Judge Profiles — judge-profile roster UI panel.**
  `packages/debate-speech-writer/src/panels/JudgeProfilesPanel.tsx` adds a
  full-page React panel that renders every persisted `JudgeProfile` as a
  roster table — rounds judged, Aff/Neg side record (flagged "notable bias"
  once it clears `judge-profile.ts`'s threshold), overall average speaker
  points, delivery-speed tolerance, theory receptiveness, and most-tagged
  paradigm — ordered by rounds judged descending. It's mounted at `/judges`
  (`apps/debate-ai.com/app/judges/page.tsx`, with a back-link to `/debate`,
  following the same panel convention as `/prep-notes`) and reachable from
  the global nav dock's Settings menu ("Judge Profiles", via a new
  `Gavel`-icon `DropdownMenuItem` in `CategoryDock.tsx`). Closes follow-up
  (b), "a judge-profile card/panel UI," named under the "⚖️ Judge Profiles"
  bullet in Research Crowdsourcing Organizer Features below — this is the
  seventh "wire a persisted slice's UI into the actual web app" follow-up
  closed in this repo, after the Contribution Leaderboard, Task Inbox,
  Progress Unlocks, Evidence Library, Prep Notes, and Revision Incentives
  panels, and the first one in the `debate-speech-writer` package rather
  than `debate-card-search`/`debate-round`. The panel adds one small helper
  to `state/judgeProfiles.ts` — `buildJudgeProfilesRoster`, which lists
  every persisted profile ordered by rounds judged descending (ties broken
  alphabetically by `judgeId`) — introducing no new aggregation logic; every
  rendered field already existed on `judge/judge-profile.ts`'s
  `buildJudgeProfile` output. `debate-speech-writer`'s `package.json` gained
  a `debate-ui` dependency and `react`/`react-dom` peer dependencies (it had
  none before this, having previously been a pure prompt/analysis/state
  package with no React component), and `apps/debate-ai.com/package.json`
  gained a `debate-speech-writer` workspace dependency to mount the panel.
  Vitest-covered in `packages/debate-speech-writer/test/judgeProfiles.test.ts`
  (empty roster when nothing is stored, ordering by rounds judged
  descending, and alphabetical tie-breaking when rounds judged are equal).
  Documented in `docs/features/judge-profiles.md` (mirroring
  `docs/features/prep-notes.md`'s format) and in
  `packages/debate-speech-writer/README.md`'s package-layout note and import
  example. Follow-up (a), a real ballot-data source producing
  `JudgeRoundRecord`s, remains open — no ballot/`Round` schema in this repo
  captures speaker points, pace, or theory outcomes today, so a profile only
  appears in this panel once a caller has supplied records and called
  `saveJudgeProfile` directly. Verified from a clean install: `bun install`,
  `bun run typecheck` (12 packages typecheck; `debate-ai-web` has no
  separate typecheck script — types are checked as part of its build),
  `bun run test` (87 files / 1163 tests, all pass), and `bun run build:web`
  (production build, including the new `/judges` route) all pass. No lint
  script is configured in this repo. The local dev server was not
  smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **Revision Incentives — incentives-leaderboard UI panel.**
  `packages/debate-card-search/src/panels/RevisionIncentivesPanel.tsx` adds a
  full-page React panel that renders every contributor with at least one
  persisted card revision as a ranked table — revision count, rewarded-
  revision count, total reward points, and weak-cards-improved count — sorted
  by total reward points descending. It's mounted at `/cards/revisions`
  (`apps/debate-ai.com/app/cards/revisions/page.tsx`, mirroring the existing
  `/cards/leaderboard`/`/cards/inbox`/`/cards/progress`/`/cards/library`
  pages' back-link convention) and reachable from the global nav dock's
  Settings menu ("Revision Incentives", via a new `History`-icon
  `DropdownMenuItem` in `CategoryDock.tsx`). Closes follow-up (b), "a
  reward-notification/incentives-leaderboard UI," named under the "🔁
  Revision Incentives" bullet in Research Crowdsourcing Organizer Features
  below — this is the sixth "wire a persisted slice's UI into the actual web
  app" follow-up closed in this repo, after the Contribution Leaderboard,
  Task Inbox, Progress Unlocks, Evidence Library, and Prep Notes panels. The
  panel adds one small helper to `state/revisionHistory.ts` —
  `buildPersistedRevisionIncentiveLeaderboard`, which composes
  `revision-incentives.ts`'s existing pure `buildRevisionIncentiveLeaderboard`
  directly against the persisted revision-history store, mirroring
  `contributions.ts`'s `buildPersistedLeaderboard` convention — introducing
  no new scoring logic. Vitest-covered in
  `packages/debate-card-search/test/revisionHistory.test.ts` (empty
  leaderboard when nothing is stored, a built leaderboard matching the pure
  function's output over the same records, and the leaderboard reflecting a
  newly saved revision without the caller re-fetching the full list).
  Documented in `docs/features/revision-incentives.md` (mirroring
  `docs/features/contribution-leaderboard.md`'s format) and in
  `packages/debate-card-search/README.md`'s `panels/` layout note and import
  example. Follow-up (a), a real card-edit/save flow that calls
  `saveRevisionRecord`, remains open — no card-editing flow exists in this
  repo yet. Verified from a clean install: `bun install`, `bun run
  typecheck` (11 packages with a typecheck script all pass; `debate-ai-web`
  has no separate typecheck script — types are checked as part of its
  build), `bun run test` (87 files / 1160 tests, all pass), and `bun run
  build:web` (production build, including the new `/cards/revisions` route)
  all pass. No lint script is configured in this repo. The local dev server
  was not smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **Strategy Sync Notes — prep-notes panel UI.**
  `packages/debate-round/src/panels/PrepNotesPanel.tsx` adds a full-page
  React panel that renders every persisted `PrepNote` (across all flows)
  grouped by status — needs-follow-up first, then open, then covered — each
  note showing its text, author, current assignee, a "Mark &lt;next
  status&gt;" button that cycles its status (open → covered →
  needs-follow-up → open), and an "assign to" control. It's mounted at
  `/prep-notes` (`apps/debate-ai.com/app/prep-notes/page.tsx`, with a
  back-link to `/debate`, following the same panel convention as the
  `/cards/*` pages) and reachable from the global nav dock's Settings menu
  ("Prep Notes", via a new `NotebookPen`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (a), "a prep-notes panel UI," named
  under the "🔄 Strategy Sync Notes" bullet in Research Crowdsourcing
  Organizer Features below — this is the fifth "wire a persisted slice's UI
  into the actual web app" follow-up closed in this repo, after the
  Contribution Leaderboard, Task Inbox, Progress Unlocks, and Evidence
  Library panels, and the first one in the `debate-round` package rather
  than `debate-card-search`. The panel adds two small helpers to
  `state/prepNotes.ts` — `buildPrepNotesPanelView` (groups the persisted
  notes by status, reusing `strategy-sync-notes.ts`'s existing
  `sortNotesByCreatedAt`) and `nextPrepNoteStatus` (the panel's status-cycle
  order) — and wires the panel's actions straight through to the
  already-persisted `updatePersistedPrepNoteStatus`/`assignPersistedPrepNote`,
  introducing no new mutation logic. Both new helpers are Vitest-covered in
  `packages/debate-round/test/prepNotes.test.ts` (empty groups when nothing
  is stored, status grouping/ordering across multiple notes, and the view
  reflecting a status update made through the existing persisted mutator).
  Documented in `docs/features/prep-notes.md` (mirroring
  `docs/features/progress-unlocks.md`'s format) and in
  `packages/debate-round/README.md`'s `panels/` layout note and import
  example. Follow-up (b), an assignee-notification system, remains open —
  no notification system exists in this repo. A "jump to argument" link
  back into the live flow view and a note-creation UI were both explicit
  non-goals of this slice (the former needs a mounted `Flow`, which this
  cross-flow panel doesn't have; the latter is a separate, flow-view-scoped
  affordance). Verified from a clean install: `bun install`, `bun run
  typecheck` (12 packages typecheck; `debate-ai-web` has no separate
  typecheck script — types are checked as part of its build), `bun run
  test` (87 files / 1157 tests, all pass), and `bun run build:web`
  (production build, including the new `/prep-notes` route) all pass. No
  lint script is configured in this repo. The local dev server was not
  smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **Shared Evidence Library — evidence library search UI panel.**
  `packages/debate-card-search/src/panels/EvidenceLibraryPanel.tsx` adds a
  full-page React panel with a free-text search box and a card/block kind
  filter over every persisted `EvidenceLibraryEntry`, showing each match's
  argument, topic/case area, body, citation, tags, and (while a text query is
  active) relevance score. It's mounted at `/cards/library`
  (`apps/debate-ai.com/app/cards/library/page.tsx`, mirroring the existing
  `/cards/leaderboard`/`/cards/inbox`/`/cards/progress` pages' back-link
  convention) and reachable from the global nav dock's Settings menu
  ("Evidence Library", via a new `Library`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (a), "a search panel UI," named
  under the "📋 Shared Evidence Library" bullet in Research Crowdsourcing
  Organizer Features below — this is the fourth "wire a persisted slice's UI
  into the actual web app" follow-up closed in this repo, after the
  Contribution Leaderboard, Task Inbox, and Progress Unlocks panels,
  following that same established pattern (persisted store → thin panel
  component → routed page → nav entry). Unlike those three panels, this one
  introduces no new composition function — `state/evidenceLibraryEntries.ts`
  already exposed `searchPersistedEvidenceLibrary`/`listEvidenceLibraryEntries`
  in a shape the panel could call directly (with an explicit, possibly-empty
  `text` field alongside an optional `kind` filter), so the panel wires
  existing, already-tested search/ranking logic straight through rather than
  adding a new one. That exact combined `{ text: "", kind }` call shape (the
  panel's default state before a search is typed) is now explicitly
  Vitest-covered in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`, on top
  of the existing text/kind/combined coverage in that file and in
  `test/shared-evidence-library.test.ts`. The panel component itself is not
  unit-tested, matching the Leaderboard/Inbox/Progress panels' precedent —
  this repo has no `@testing-library/react`/jsdom-based component-render
  convention in any package's `test/` suite. Documented in
  `docs/features/evidence-library.md` (mirroring
  `docs/features/task-inbox.md`'s format) and in
  `packages/debate-card-search/README.md`'s `panels/` layout note and import
  example. Follow-ups: (b) no topic/case-area/tag filter controls in the
  panel itself (only free text and kind are exposed, though
  `searchEvidenceLibrary` already supports all three), (c) a real search
  index (e.g. Typesense) once entries are persisted at scale — the "(b)
  wiring `prep-room.ts` to read through this store" follow-up was already
  closed separately (see "Collaboration Prep Room Store Wiring" below).
  Neither of the two remaining follow-ups is started; a new follow-up, a
  submission UI for adding cards/blocks to the repository (the store's own
  original follow-up (a), unaffected by this panel), also remains open.
  Verified from a clean install: `bun install`, `bun run typecheck` (11
  packages typecheck; `debate-ai-web` has no separate typecheck script —
  types are checked as part of its build), `bun run test` (87 files / 1153
  tests, all pass), and `bun run build:web` (production build, including the
  new `/cards/library` route) all pass. No lint script is configured in this
  repo. The local dev server was not smoke-tested in this sandbox (no
  reliable local browser workflow available here).
- **Progress Unlocks — unlock/progress roster UI panel.**
  `packages/debate-card-search/src/panels/ProgressUnlocksPanel.tsx` adds a
  full-page React panel that renders every contributor with at least one
  persisted contribution as a roster: unlock tier, the research-task skill
  level that tier grants, every badge earned (tier + daily-quest streak
  badges), current streak, and how far they are from the next tier. It's
  mounted at `/cards/progress`
  (`apps/debate-ai.com/app/cards/progress/page.tsx`, mirroring the existing
  `/cards/leaderboard`/`/cards/inbox` pages' back-link convention) and
  reachable from the global nav dock's Settings menu ("Progress", via a new
  `Award`-icon `DropdownMenuItem` in `CategoryDock.tsx`, alongside the
  existing Leaderboard/Task Inbox entries). Closes follow-up (b), "a
  progress/unlock UI", named under the "🔓 Progress Unlocks" bullet in
  Research Crowdsourcing Organizer Features below — this is the third
  "wire a persisted slice's UI into the actual web app" follow-up closed in
  this repo, after the Contribution Leaderboard and Task Inbox panels,
  following that same established pattern (persisted store → thin panel
  component → routed page → nav entry). The panel adds one new composition
  function, `buildUnlockStatusRoster`
  (`packages/debate-card-search/src/lib/unlock-streak-status.ts`), which
  lists every contributor id with a persisted contribution (via
  `state/contributions.ts`'s `listContributions`/`groupContributionsByContributor`)
  and resolves each one's status through the already-existing
  `buildContributorUnlockStatusWithStreakFromStore` — mirroring
  `contributions.ts`'s `buildPersistedLeaderboard` "compose the pure function
  directly against the persisted store" convention; no new tier, badge, or
  streak logic was introduced, and `progress-unlocks.ts`/`gamified-quests.ts`
  themselves are unchanged. The roster is sorted alphabetically by
  `contributorId` rather than by score, since (unlike the Contribution
  Leaderboard) this view isn't meant to be a ranking. Vitest-covered in
  `packages/debate-card-search/test/unlock-streak-status.test.ts` (empty
  roster when nothing is persisted, multiple contributors each resolved with
  their own tier/streak and sorted alphabetically, and that one contributor's
  persisted data doesn't leak into another's roster entry). The panel
  component itself is not unit-tested, matching the Leaderboard/Task Inbox
  panels' precedent — this repo has no `@testing-library/react`/jsdom-based
  component-render convention in any package's `test/` suite; its data
  composition is fully covered via the `lib` test above. Documented in
  `docs/features/progress-unlocks.md` (mirroring
  `docs/features/contribution-leaderboard.md`'s format) and in
  `packages/debate-card-search/README.md`'s `panels/` layout note and import
  example. Follow-ups: (a) contributor identity/auth scoping ("my progress"
  vs. everyone's), the same known gap as the Leaderboard/Inbox panels — not
  started. Verified from a clean install: `bun install`, `bun run typecheck`
  (11 packages typecheck; `debate-ai-web` has no separate typecheck script —
  types are checked as part of its build), `bun run test` (87 files / 1152
  tests, all pass), and `bun run build:web` (production build, including the
  new `/cards/progress` route) all pass. No lint script is configured in
  this repo. The local dev server (`bun run dev:web`) could not be
  smoke-tested in this sandbox for the same pre-existing `self-signed
  certificate in certificate chain` reason noted on the Contribution
  Leaderboard/Task Inbox panel entries below — not a regression introduced
  here. PR: [#143](https://github.com/debate/debate-ai.com/pull/143).
- **Research Task Routing — task-assignment/inbox UI.**
  `packages/debate-card-search/src/panels/TaskInboxPanel.tsx` adds a
  full-page React panel that lists every persisted routed task queue, grouped
  by topic: each assignment shows the under-covered argument, its urgency
  level (`missing`/`thin`), the assignee, and their current skill level, with
  a "Mark complete" button; any tasks nobody was eligible/available for are
  listed separately per topic. It's mounted at `/cards/inbox`
  (`apps/debate-ai.com/app/cards/inbox/page.tsx`, mirroring the existing
  `/cards/leaderboard` page's back-link convention) and reachable from the
  global nav dock's Settings menu ("Task Inbox", via a new `Inbox`-icon
  `DropdownMenuItem` in `CategoryDock.tsx`, alongside the existing
  Leaderboard entry). Closes the "(c) a task-assignment/inbox UI" follow-up
  named under the "Research Task Routing" bullet in Research Crowdsourcing
  Organizer Features below — this is the second "wire a persisted slice's UI
  into the actual web app" follow-up closed in this repo, after the
  Contribution Leaderboard panel, following that same established pattern
  (persisted store → thin panel component → routed page → nav entry). The
  panel adds one new composition function, `buildTaskInboxView`
  (`packages/debate-card-search/src/state/routedTaskQueues.ts`), which
  flattens every persisted `RoutedTaskQueueRecord` (from `routedTaskQueues.ts`)
  into a flat, per-assignment view tagged with its `topicId` and the
  assignee's current persisted `skillLevel` (looked up from
  `contributorAvailability.ts`) — mirroring the leaderboard panel's
  `buildPersistedLeaderboard` "compose the pure function directly against the
  persisted store" convention; no new routing or completion logic was
  introduced. Marking a task complete calls the already-existing, already-
  persisted `completePersistedRoutedTask` directly (removes the assignment
  from the stored queue and decrements the assignee's stored
  `activeTaskCount`), then the panel re-reads `buildTaskInboxView()` to
  refresh. Vitest-covered in
  `packages/debate-card-search/test/routedTaskQueues.test.ts` (empty when
  nothing is routed, flattens multiple persisted queues with each
  assignment's topic and current skill level attached, and omits
  `contributorSkillLevel` when the assignee's profile is no longer
  persisted). The panel component itself is not unit-tested, matching the
  Contribution Leaderboard panel's precedent — this repo has no
  `@testing-library/react`/jsdom-based component-render convention in any
  package's `test/` suite; its data composition is fully covered via the
  `state` test above. Documented in `docs/features/task-inbox.md` (mirroring
  `docs/features/contribution-leaderboard.md`'s format) and in
  `packages/debate-card-search/README.md`'s `panels/` layout note. Follow-ups:
  (a) a task-routing trigger UI (a topic's queue is currently only populated
  by calling `buildAndPersistRoutingResult` some other way, e.g. from a
  future coverage-dashboard action), (b) scoping the inbox to "my tasks"
  once contributor identity/auth exists, (c) a reviewer/verification step
  before a task is marked complete. None of these are started. Verified from
  a clean install: `bun install`, `bun run typecheck` (11 packages
  typecheck; `debate-ai-web` has no separate typecheck script — types are
  checked as part of its build), `bun run test` (87 files / 1149 tests, all
  pass), and `bun run build:web` (production build, including the new
  `/cards/inbox` route) all pass. The local dev server (`bun run dev:web`)
  could not be smoke-tested in this sandbox for the same pre-existing
  `self-signed certificate in certificate chain` reason noted on the
  Contribution Leaderboard panel entry below — not a regression introduced
  here.
- **Contribution Leaderboard — leaderboard UI panel wired to the app.**
  `packages/debate-card-search/src/panels/ContributionLeaderboardPanel.tsx`
  adds a full-page React panel that renders every persisted contributor
  ranked by total helpfulness score, alongside their unlock tier, earned
  badges, and current daily-quest streak — the first UI panel in this
  package (previously `src/` only had `components/`, `hooks/`, `layout/`,
  `lib/`, and `state/`, with every Research Crowdsourcing Organizer Features
  slice below stopping at pure logic plus a persistence store). It's mounted
  at `/cards/leaderboard` (`apps/debate-ai.com/app/cards/leaderboard/page.tsx`,
  mirroring the existing `/rank` page's back-link convention) and reachable
  from the global nav dock's Settings menu ("Leaderboard", via a new
  `Trophy`-icon `DropdownMenuItem` in `CategoryDock.tsx`). Closes the
  "Contribution Leaderboard" bullet's own follow-up (c), "a leaderboard UI
  that reads through the persistence store," and idea #11's ("Community-Rated
  Summaries and Highlights") follow-up (c), "a leaderboard/ranked-feed UI,"
  both under Research Crowdsourcing Organizer Features below. The panel adds
  one new composition function, `buildPersistedLeaderboard`
  (`packages/debate-card-search/src/state/contributions.ts`), which composes
  the existing pure `contribution-leaderboard.ts` `buildLeaderboard` directly
  against the persisted `contributions.ts` store — mirroring this repo's
  established "compose the pure function directly against the persisted
  store" convention — and reuses the existing
  `unlock-streak-status.ts` `buildContributorUnlockStatusWithStreakFromStore`
  for each row's tier/badges/streak; no new scoring, tier, or streak logic
  was introduced. Vitest-covered in
  `packages/debate-card-search/test/contributions.test.ts` (empty store
  yields an empty leaderboard, contributors are ranked by total helpfulness
  score, and a like recorded after a contribution is saved is reflected in a
  later leaderboard build). The panel component itself is not unit-tested —
  this repo has no `@testing-library/react`/jsdom-based component-render
  convention in any package's `test/` suite; its data composition is fully
  covered via the `state`/`lib` tests above. Documented in
  `docs/features/contribution-leaderboard.md` (new `docs/` folder — none
  existed in this repo before) and in `packages/debate-card-search/README.md`
  (updated to describe the current `panels/`/`lib/`/`state/` layout, which
  had drifted out of date across ~40 prior persistence-slice PRs). This is
  the first "wire a persisted slice's UI into the actual web app" follow-up
  closed in this repo — every other UI follow-up named throughout Product
  Feature Ideas and Research Crowdsourcing Organizer Features below (prep-room
  panels, drill panels, coaching panels, task-routing inboxes, etc.) remains
  open and is a natural next task for a future run, following this same
  pattern (persisted store → thin panel component → routed page → nav entry).
  Follow-ups: (a) a real submitted-contribution flow (card/summary/analytic
  submission UI) that calls `saveContribution`, so the leaderboard has data
  to show; today it renders an explicit empty state until something does,
  (b) a like/save/endorse UI on that submission flow wired to
  `recordPersistedLike`/`recordPersistedSave`/`recordPersistedEndorsement`.
  Neither of these is started. Verified from a clean install: `bun install`,
  `bun run typecheck` (11 packages typecheck; `debate-ai-web` has no separate
  typecheck script — types are checked as part of its build), `bun run test`
  (87 files / 1146 tests, all pass), and `bun run build:web` (production
  build, including the new `/cards/leaderboard` route) all pass. The local
  dev server (`bun run dev:web`) could not be smoke-tested in this sandbox —
  it fails during startup on an unrelated `Error: self-signed certificate in
  certificate chain` from a Cloudflare `Request.cf` fetch, a pre-existing
  sandbox/network limitation, not a change introduced here.
- **Contribution Community Signals — persisted like/save/endorse events.**
  `packages/debate-card-search/src/state/contributions.ts` adds
  `recordPersistedLike`/`recordPersistedSave`/`recordPersistedEndorsement`,
  which apply a like/save/endorsement event directly to a stored
  `AttributedContribution` (incrementing `likes`/`saves` by one, or
  appending a `ReviewerEndorsement` carrying a caller-supplied
  `reviewerWeight`) and save the result, rather than requiring a caller to
  read, mutate, and re-save the contribution itself — mirroring
  `contributorAvailability.ts`'s `recordPersistedTaskAssigned`/
  `recordPersistedTaskCompleted` "compose the mutation directly against the
  persisted store" convention. Closes the "wiring real like/save/endorse
  actions and persisting those counts per contribution" follow-up shared by
  the "Contribution Leaderboard" bullet and idea #11 ("Community-Rated
  Summaries and Highlights") under Research Crowdsourcing Organizer
  Features / Product Feature Ideas below. `community-rating.ts`'s pure
  `computeHelpfulnessBreakdown`/`rankContributions` and
  `contribution-leaderboard.ts`'s `buildLeaderboard`/`buildContributorStats`
  are unchanged — a persisted contribution's updated `likes`/`saves`/
  `reviewerEndorsements` feed into their existing scoring the same way any
  other `AttributedContribution` field does. Vitest-covered in
  `packages/debate-card-search/test/contributions.test.ts` (a like/save
  increments and persists, repeated likes accumulate, an endorsement is
  appended and persisted alongside any existing endorsements, and each
  helper returns `undefined` and leaves storage untouched for an id that
  isn't stored). This is a composition slice only — no dedup of repeat
  likes/saves from the same user (no per-user identity is tracked on a
  contribution today), no reviewer identity/permission checks (no auth/roles
  exist yet), and no leaderboard/community-rating UI in this repo yet calls
  these on a real user action. Follow-up: a leaderboard/contribution-card UI
  that reads through `contributions.ts`/`contribution-leaderboard.ts` and
  calls these on a real like/save/endorse action; not started. Verified
  from a clean install: `bun install`, `bun run typecheck` (11 packages,
  all pass), `bun run test` (87 files / 1143 tests, all pass), and
  `bun run build` all pass. PR:
  [#140](https://github.com/debate/debate-ai.com/pull/140).
- **Research Task Routing — persisted activeTaskCount assignment/completion events.**
  `packages/debate-card-search/src/state/contributorAvailability.ts` adds
  `recordPersistedTaskAssigned`/`recordPersistedTaskCompleted`, which apply a
  `+1`/`-1` delta (floored at `0`) to a stored `ContributorAvailability`
  profile's `activeTaskCount` and save the result, rather than requiring a
  caller to read, mutate, and re-save the profile itself. `packages/debate-card-search/src/state/routedTaskQueues.ts`
  adds `buildAndPersistRoutingResult`, which routes a topic's coverage-gap
  tasks against the currently persisted `contributorAvailability.ts` profiles
  (`buildRoutingResult`), calls `recordPersistedTaskAssigned` for every
  resulting assignment, and saves the routed queue via the existing
  `saveRoutedTaskQueue` — and `completePersistedRoutedTask`, which removes a
  topic's persisted assignment by `argBlock`, calls
  `recordPersistedTaskCompleted` for its contributor, and saves the updated
  queue. Closes the "(a) wiring real task-assignment/completion events to
  keep a persisted profile's `activeTaskCount` accurate" follow-up named
  under the "🧭 Research Task Routing" bullet in Research Crowdsourcing
  Organizer Features below, mirroring `dailyMissionResults.ts`'s
  `computeAndSavePersistedDailyMissionResult` "compose the pure function
  directly against the persisted store" convention on the write side.
  `research-task-routing.ts`'s pure `buildRoutingResult`/`routeTasks` are
  unchanged. Vitest-covered in `packages/debate-card-search/test/contributorAvailability.test.ts`
  (activeTaskCount increments/decrements, floors at zero, no-op when no
  profile is stored) and `packages/debate-card-search/test/routedTaskQueues.test.ts`
  (routes against the persisted contributor list, saves the queue, increments
  only the assignee's count, completing a task removes it from the stored
  queue and decrements its contributor's count, and no-ops for an unknown
  topic or `argBlock`). This is a composition slice only — no
  task-assignment/inbox UI in this repo yet calls these on a real assignment/
  completion event. Follow-up: a task-assignment/inbox UI that reads/writes
  through these stores; not started. Verified from a clean install:
  `bun install`, `bun run typecheck` (11 packages, all pass), `bun run test`
  (87 files / 1135 tests, all pass), and `bun run build` all pass. No lint
  script is configured in this repo. PR:
  [#139](https://github.com/debate/debate-ai.com/pull/139).
- **Gamified Quests — persisted end-of-day mission computation.**
  `packages/debate-card-search/src/state/dailyMissionResults.ts` adds
  `computeAndSavePersistedDailyMissionResult`, which computes a contributor's
  daily-mission result directly from their real, persisted contributions
  (`state/contributions.ts`'s `listContributionsByContributor`) — filtering
  to contributions that carry the `submittedAt` timestamp `daily-quests.ts`'s
  `QuestContribution` needs (excluding, rather than throwing on, persisted
  `AttributedContribution`s that don't) — builds that day's quest board via
  the existing `buildDailyQuestBoard`, computes the result via the existing
  `computeDailyMissionResult`, and saves it via this file's own
  `saveDailyMissionResult`, mirroring this same file's
  `buildPersistedContributorQuestStreak` "compose the pure function directly
  against the persisted store" convention, this time on the write side.
  Closes the "(a) wiring a real end-of-day computation (UI action or
  scheduled job) that calls `computeDailyMissionResult` against that day's
  persisted contributions and saves it via `saveDailyMissionResult`"
  follow-up named under the "🎮 Gamified Quests" bullet in Research
  Crowdsourcing Organizer Features below. `gamified-quests.ts`/
  `daily-quests.ts`/`contributions.ts` themselves are unchanged. Vitest-covered
  in `packages/debate-card-search/test/dailyMissionResults.test.ts` (mission
  complete/incomplete from real persisted contributions, contributions
  without `submittedAt` excluded rather than throwing, a contribution
  submitted on a different UTC day not counted, another contributor's
  contributions not counted, upsert-on-recompute, and a contributor with no
  persisted contributions at all). This is a composition slice only —
  nothing in this repo yet calls this on a real end-of-day cadence (UI
  action or scheduled job), and no streak/badge widget UI reads through this
  store. Follow-up: a streak/badge widget UI that renders
  `buildStreakSummaryText`/`buildPersistedContributorQuestStreak`; not
  started. Verified from a clean install: `bun install`, `bun run typecheck`
  (11 packages, all pass), `bun run test` (87 files / 1124 tests, all pass),
  and `bun run build` all pass. No lint script is configured in this repo.
  PR: [#138](https://github.com/debate/debate-ai.com/pull/138).
- **Prep Note Status/Assignment Persistence — wire `updateNoteStatus`/`assignNote`
  back into the persisted store.**
  `packages/debate-round/src/state/prepNotes.ts` adds
  `updatePersistedPrepNoteStatus`/`assignPersistedPrepNote`, thin wrappers
  that look up a persisted `PrepNote` by id, apply
  `strategy-sync-notes.ts`'s existing pure `updateNoteStatus`/`assignNote`
  state transition, save the result via the existing `savePrepNote`, and
  return the updated note (or `undefined`, leaving storage untouched, if no
  note with that id is stored) — mirroring this repo's established
  "compose the pure state transition directly against the persisted store"
  convention (e.g. `buildPersistedContributorQuestStreak`,
  `buildPrepRoomFromStore`). Closes the "(b) wiring `updateNoteStatus`/
  `assignNote`'s returned copies back into `savePrepNote` so status/
  assignment changes persist" follow-up named under the "Prep Note
  Persistence" entry below (itself the "Strategy Sync Notes" idea's
  persistence slice under Research Crowdsourcing Organizer Features).
  Vitest-covered in `packages/debate-round/test/prepNotes.test.ts`
  (status change persists and is returned, assigning and unassigning
  — `assignedToId: null` — both persist and are returned, and both
  helpers return `undefined` and leave storage untouched for an id that
  isn't stored). This is a composition slice only —
  `updateNoteStatus`/`assignNote`/`savePrepNote` themselves are unchanged,
  and no prep-notes panel UI in this repo yet calls these new helpers.
  Verified from a clean install: `bun install`, `bun run typecheck` (12
  packages, all pass), `bun run test` (87 files / 1117 tests, all pass), and
  `bun run build` all pass. PR:
  [#137](https://github.com/debate/debate-ai.com/pull/137).
- **Progress Unlocks — derive unlock status from persisted contributions/mission-results.**
  `packages/debate-card-search/src/lib/unlock-streak-status.ts` adds
  `buildContributorUnlockStatusWithStreakFromStore`, a thin wrapper around the
  existing pure `buildContributorUnlockStatusWithStreak` that reads a
  contributor's persisted contributions (`state/contributions.ts`'s
  `listContributionsByContributor`) and mission-result history
  (`state/dailyMissionResults.ts`'s `listDailyMissionResultsForContributor`)
  instead of requiring a caller-supplied `ContributorStats`/
  `DailyMissionResult[]` list, mirroring the existing
  `buildPersistedContributorQuestStreak`/`buildPrepRoomFromStore`
  "compose the pure function directly against the persisted store"
  convention. A contributor with zero persisted contributions gets an
  all-zero, `novice` status (via a small `buildEmptyContributorStats`
  helper) instead of the `buildContributorStats` empty-contributions error,
  since a brand-new contributor having no unlock status yet is expected, not
  a bug. Closes the "🔓 Progress Unlocks" bullet's own follow-up (a),
  "persisting a contributor's tier/badges", named under Research
  Crowdsourcing Organizer Features below — no separate tier/badge
  persistence is needed since it's now derived live from the existing
  stores. `buildContributorUnlockStatusWithStreak`/`buildContributorStats`/
  `computeContributorTier` themselves are unchanged. Vitest-covered in
  `packages/debate-card-search/test/unlock-streak-status.test.ts` (tier
  derived from persisted contributions, streak folded in from persisted
  mission results, all-zero novice fallback for a contributor with no
  persisted contributions, and that one contributor's persisted data doesn't
  leak into another's status), using the same in-memory `localStorage` mock
  convention as this package's other persistence tests. This is a
  composition slice only — no UI panel in this repo yet reads this status.
  Verified from a clean install: `bun install`, `bun run typecheck` (12
  packages, all pass), `bun run test` (87 files / 1112 tests, all pass), and
  `bun run build` all pass. PR:
  [#136](https://github.com/debate/debate-ai.com/pull/136).
- **Collaboration Prep Room Store Wiring — read entries from the persisted
  evidence library.** `packages/debate-card-search/src/lib/prep-room.ts`
  adds `buildPrepRoomFromStore`, a thin wrapper around the existing pure
  `buildPrepRoom` that reads a topic's `entries` from the persisted
  `evidenceLibraryEntries.ts` store (`listEvidenceLibraryEntries`) whenever
  the caller doesn't already supply an entry list directly — explicitly
  supplied entries still take precedence over the store. Closes the "(a)
  wiring `buildPrepRoom`/`searchPrepRoomEvidence` to read through the
  now-persisted `evidenceLibraryEntries.ts` store instead of caller-supplied
  entries" follow-up named under both the "Collaboration Prep Room" bullet
  in Research Crowdsourcing Organizer Features below and the "Shared
  Evidence Library" bullet's own note that this wiring was still open.
  `buildPrepRoom`/`searchPrepRoomEvidence` themselves are unchanged — this is
  purely an additive, store-aware entry point so a future prep-room panel UI
  only needs to pass a topic, not a pre-fetched entry list. Vitest-covered in
  `packages/debate-card-search/test/prep-room.test.ts` (store-resolved
  entries scoped to the topic, empty room when the store has nothing for
  that topic, explicit-entries precedence, and parity with `buildPrepRoom`
  when entries are supplied), using the same in-memory `localStorage` mock
  convention as this package's other persistence tests. No prep-room panel
  UI and no live presence signal exist yet. Verified from a clean install:
  `bun install`, `bun run typecheck` (12 packages, all pass), `bun run test`
  (87 files / 1108 tests, all pass), and `bun run build` all pass. PR:
  [#135](https://github.com/debate/debate-ai.com/pull/135).
- **Pre-Round Briefing Store Wiring — resolve opponent/judge profiles from
  persisted stores.** `packages/debate-round/src/round/pre-round-briefing.ts`
  adds `buildPreRoundBriefingFromStores`, a thin wrapper around the existing
  pure `buildPreRoundBriefing` that resolves `opponentProfile`/`judgeProfile`
  via `debate-data-sync`'s `opponentTeamProfiles.ts` (`getOpponentTeamProfile`)
  and `debate-speech-writer`'s `judgeProfiles.ts` (`getJudgeProfile`) by
  `opponentTeamId`/`judgeId` whenever the caller doesn't already supply the
  profile object directly — an explicitly supplied profile still takes
  precedence over a store lookup. Closes the "(c) wiring
  `buildPreRoundBriefing` to look up a persisted profile through this store"
  follow-up named under both the "Opponent Team Profiles" and "Judge Profiles"
  bullets in Research Crowdsourcing Organizer Features below, and idea #12's
  ("Pre-Round Intelligence Panel") related follow-up in Product Feature Ideas.
  `buildPreRoundBriefing` itself is unchanged — this is purely an additive,
  store-aware entry point so a future briefing-panel UI only needs to pass
  ids, not pre-fetched profile objects. Vitest-covered in
  `packages/debate-round/test/pre-round-briefing.test.ts` (store-resolved
  profiles, no-data-on-file fallback per id, explicit-profile precedence, and
  parity with `buildPreRoundBriefing` when nothing is supplied), using the
  same in-memory `localStorage` mock convention as this package's other
  persistence tests. No briefing-panel UI and no real tournament/pairing/room
  data source exist yet. Verified from a clean install: `bun install`,
  `bun run typecheck` (12 packages, all pass), `bun run test` (87 files /
  1104 tests, all pass), and `bun run build` all pass. PR:
  [#134](https://github.com/debate/debate-ai.com/pull/134).
- **Gamified Quests — persisted daily mission-result history.**
  `packages/debate-card-search/src/state/dailyMissionResults.ts` adds a
  localStorage-backed CRUD store (`listDailyMissionResults`/
  `listDailyMissionResultsForContributor`/`getDailyMissionResult`/
  `saveDailyMissionResult`/`deleteDailyMissionResult`) for
  `gamified-quests.ts`'s `DailyMissionResult`, keyed by `contributorId` +
  `dayKey` with upsert-on-save semantics (recomputing an already-recorded
  day overwrites rather than duplicating it), mirroring the existing
  `coachingSessions.ts`/`contributorAvailability.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Also adds `buildPersistedContributorQuestStreak`,
  which composes the persisted history directly into the existing
  `buildContributorQuestStreak` rather than requiring the caller to hold an
  in-memory history list, mirroring the existing
  `evidenceLibraryEntries.ts`-style "reuse the pure function directly
  against the persisted store" convention. Closes the "(a) wiring real,
  persisted daily contributions into `computeDailyMissionResult` per
  contributor per day" follow-up named under the "🎮 Gamified Quests" bullet
  in Research Crowdsourcing Organizer Features below — the real, attributed
  contributions that `computeDailyMissionResult` is derived from (via
  `daily-quests.ts`'s `buildDailyQuestBoard`) are already persisted by the
  existing `contributions.ts` store, so this closes the missing half: a
  place to persist each day's computed mission result once, so a
  contributor's streak survives across sessions instead of requiring a
  caller-held in-memory list. Vitest-covered (with an in-memory
  `localStorage` mock, since this package's Vitest environment is `node`
  with no DOM) in
  `packages/debate-card-search/test/dailyMissionResults.test.ts`, including
  an interop test that builds a real streak from persisted history. This is
  a persistence slice only — `gamified-quests.ts`'s pure streak/badge
  computation is unchanged; nothing in this repo yet wires a real
  UI/scheduled-job call to compute and save a contributor's mission result
  at the end of each day, and no streak/badge widget UI in this repo yet
  reads through this store. Follow-ups: (a) wiring a real end-of-day
  computation (UI action or scheduled job) that calls
  `computeDailyMissionResult` against that day's persisted contributions and
  saves it here, (b) a streak/badge widget UI that renders
  `buildStreakSummaryText`/`buildPersistedContributorQuestStreak`. Neither
  of these is started. Verified from a clean install: `bun install`, `bun
  run typecheck` (11 packages, all pass), `bun run test` (87 files / 1100
  tests, all pass), and `bun run build` all pass.
- **Research Task Routing — persisted routed task queue.**
  `packages/debate-card-search/src/state/routedTaskQueues.ts` adds a
  localStorage-backed CRUD store (`listRoutedTaskQueues`/`getRoutedTaskQueue`/
  `saveRoutedTaskQueue`/`deleteRoutedTaskQueue`) for `research-task-routing.ts`'s
  `RoutingResult`, wrapped in a `RoutedTaskQueueRecord` (`topicId` + `result`)
  since a `RoutingResult` has no natural key of its own, keyed by a
  caller-supplied `topicId` with upsert-on-save semantics, mirroring the
  existing `drillSets.ts`/`flowSummaries.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Closes the "persisted task queue" half of the "(a)
  persisted contributor profiles (active task count — skill level is now
  derived) and a persisted task queue" follow-up named under the "Research
  Task Routing" bullet in Research Crowdsourcing Organizer Features below —
  the contributor-profile half was already closed by
  `contributorAvailability.ts`. Vitest-covered (with an in-memory
  `localStorage` mock, since this package's Vitest environment is `node`
  with no DOM) in `packages/debate-card-search/test/routedTaskQueues.test.ts`.
  This is a persistence slice only — it stores whatever `RoutingResult` a
  caller passes in verbatim (`routeTasks`/`buildRoutingResult`/
  `buildTaskQueue` themselves are unchanged); no task-assignment/inbox UI in
  this repo yet reads or writes through this store, and nothing yet wires
  real task-assignment/completion events into a persisted contributor's
  `activeTaskCount`. Follow-ups: (a) wiring real task-assignment/completion
  events to keep a persisted `ContributorAvailability`'s `activeTaskCount`
  accurate, (b) a task-assignment/inbox UI that renders a topic's persisted
  routed queue and reads/writes through this store. Neither of these is
  started. Verified from a clean install: `bun run typecheck` (all packages
  pass), `bun run test` (86 files / 1085 tests, all pass), and `bun run
  build` all pass. PR:
  [#132](https://github.com/debate/debate-ai.com/pull/132).
- **Revision Incentives — persisted revision history.**
  `packages/debate-card-search/src/state/revisionHistory.ts` adds a
  localStorage-backed store for `revision-incentives.ts`'s `CardRevision`
  before/after edit events. Unlike this package's other persistence stores,
  a card can be revised many times, so records aren't keyed by `cardId`/
  `contributorId` alone — each recorded revision is wrapped in a
  `CardRevisionRecord` with its own synthetic `id` and `revisedAt`
  timestamp, and saving appends a new history entry rather than overwriting
  a prior one for the same card, mirroring the existing `debate-round`
  `drillSets.ts` wrapped-record convention (SSR/no-storage-safe, corrupt or
  missing JSON degrades to an empty list rather than throwing).
  `listRevisionHistory`/`listRevisionHistoryForCard`/
  `listRevisionHistoryForContributor` return records oldest-first, and
  because `CardRevisionRecord` is a superset of `CardRevision`, a list of
  records can be passed directly into `revision-incentives.ts`'s
  `buildRevisionIncentiveLeaderboard`/`buildContributorRevisionStats`
  without stripping the extra fields. Closes the "(a) wiring actual
  card-edit events into a persisted revision history" follow-up named under
  the "Revision Incentives" bullet in Research Crowdsourcing Organizer
  Features below. Vitest-covered (with an in-memory `localStorage` mock,
  since this package's Vitest environment is `node` with no DOM) in
  `packages/debate-card-search/test/revisionHistory.test.ts`, including an
  interop test that feeds a persisted history straight into
  `buildRevisionIncentiveLeaderboard`. This is a persistence slice only —
  nothing in this repo yet wires a real card-edit event into
  `saveRevisionRecord`, and the reward points a revision earns still aren't
  surfaced anywhere. Follow-ups: (a) wiring an actual card-edit/save flow to
  call `saveRevisionRecord` with a before/after snapshot, (b) a
  reward-notification/incentives-leaderboard UI that reads through this
  store via `buildRevisionIncentiveLeaderboard`. Neither of these is
  started. Verified from a clean install: `bun run typecheck` (12 packages,
  all pass), `bun run test` (85 files / 1076 tests, all pass), and
  `bun run build` all pass. PR:
  [#131](https://github.com/debate/debate-ai.com/pull/131).
- **Expandable Heading Structure — collapsed-heading persistence.**
  `packages/reason-editor/src/state/collapsedHeadings.ts` adds a
  localStorage-backed CRUD store (`listCollapsedHeadingSelections`/
  `getCollapsedHeadingSelection`/`saveCollapsedHeadingSelection`/
  `deleteCollapsedHeadingSelection`) for a document's collapsed heading ids
  (`CollapsedHeadingSelection`: `documentId` + `collapsedIds: string[]`),
  keyed by `documentId` with upsert-on-save semantics, mirroring the
  existing `debate-round` `argumentTreeFilters.ts`/`debate-speech-writer`
  `judgeParadigmSelections.ts` persistence convention (SSR/no-storage-safe,
  corrupt or missing JSON degrades to an empty list rather than throwing).
  This is the first localStorage-backed persistence store in the
  `reason-editor` package; it's exported from the package's `engine` entry
  point (`reason-editor/engine`) alongside the existing `heading-outline.ts`
  outline exports it complements. Closes the "(c) persisting collapsed-state
  per document" follow-up named under idea #9 ("Expandable Heading
  Structure") in Product Feature Ideas below. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in `packages/reason-editor/test/collapsedHeadings.test.ts`.
  This is a persistence slice only — it stores whatever `collapsedIds` a
  caller passes in verbatim; `heading-outline.ts`'s pure outline/collapse-range
  computation is unchanged, and no nav panel or editor view in this repo yet
  reads or writes through this store. Follow-ups: (a) a React nav/outline
  panel in `reason-editor` that renders the outline and toggles collapsed
  ids, reading/writing through this store, (b) a ProseMirror decoration
  plugin that hides collapsed ranges in the actual editor view using
  `getCollapsedRanges`. Neither of these is started. Verified from a clean
  install: `bun run typecheck` (12 packages, all pass), `bun run test` (84
  files / 1061 tests, all pass), and `bun run build` all pass. PR:
  [#130](https://github.com/debate/debate-ai.com/pull/130).
- **Research Task Routing — persisted contributor-availability profiles.**
  `packages/debate-card-search/src/state/contributorAvailability.ts` adds a
  localStorage-backed CRUD store (`listContributorAvailability`/
  `getContributorAvailability`/`saveContributorAvailability`/
  `deleteContributorAvailability`) for `research-task-routing.ts`'s
  `ContributorAvailability` records, keyed by `contributorId` with
  upsert-on-save semantics, mirroring the existing `judgeProfiles.ts`/
  `brainstormIdeas.ts` persistence convention (SSR/no-storage-safe, corrupt
  or missing JSON degrades to an empty list rather than throwing). Closes
  half of the "(a) persisted contributor profiles (active task count — skill
  level is now derived) and a persisted task queue" follow-up named under
  the "Research Task Routing" bullet under Research Crowdsourcing Organizer
  Features below. Vitest-covered (with an in-memory `localStorage` mock,
  since this package's Vitest environment is `node` with no DOM) in
  `packages/debate-card-search/test/contributorAvailability.test.ts`. This
  is a persistence slice only — it stores whatever `ContributorAvailability`
  a caller passes in verbatim; nothing in this repo yet updates
  `activeTaskCount` from real task-assignment events, and the routed task
  queue (`RoutingResult`) itself still isn't persisted. Follow-ups: (a)
  wiring real task-assignment/completion events to keep a persisted
  profile's `activeTaskCount` accurate, (b) persisting a routed
  `RoutingResult`/task queue, (c) a task-assignment/inbox UI that reads/
  writes through this store. None of these are started.
- **Word-Count-Only Speech Format — persisted word-count round results.**
  `packages/debate-round/src/state/wordCountRounds.ts` adds a
  localStorage-backed CRUD store (`listWordCountRounds`/`getWordCountRound`/
  `saveWordCountRound`/`deleteWordCountRound`) for a round's chosen
  `debate-timer` word-count style key and its submitted speech text, keyed by
  `roundId` with upsert-on-save semantics, mirroring the existing
  `aiVersusRounds.ts`/`practiceRounds.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Closes the "(c) persisting word-count-mode round
  results alongside timed rounds" follow-up named under idea #2
  ("Word-Count-Only Speech Format") below. Also adds
  `getWordCountRoundStatuses`, which computes each submitted speech's
  `WordCountStatus` on read (via the existing `getWordCountStatus`) by
  matching each submission's `name` against the round's style, rather than
  storing a status snapshot that could go stale if a format's word limits
  ever change; a submission whose name no longer matches any speech in the
  style is skipped rather than throwing. Vitest-covered (with an in-memory
  `localStorage` mock, since this package's Vitest environment is `node`
  with no DOM) in `packages/debate-round/test/wordCountRounds.test.ts`. This
  is a persistence slice only — no submission UI in this repo yet reads or
  writes through this store, and `useTimerState`/`SpeechTimer` still has no
  non-timed, word-limited speech mode. Follow-ups: (a) a submission UI in
  `debate-round`/`reason-editor` that calls `getWordCountStatus` while a
  debater types and reads/writes through this store, (b) extending
  `useTimerState`/`SpeechTimer` to support a non-timed, word-limited speech
  mode. Neither of these is started.
- **Practice Round Simulator — persisted practice-round store.**
  `packages/debate-round/src/state/practiceRounds.ts` adds a
  localStorage-backed CRUD store (`listPracticeRounds`/`getPracticeRound`/
  `savePracticeRound`/`deletePracticeRound`) for `practice-round-simulator.ts`'s
  derived `PracticeRoundSetup` and (once generated) `PracticeRoundFeedback`,
  keyed by `roundId` with upsert-on-save semantics, mirroring the existing
  `aiVersusRounds.ts`/`drillSets.ts` persistence convention (SSR/no-storage-safe,
  corrupt or missing JSON degrades to an empty list rather than throwing).
  Closes the "(c) persisting a simulated practice round (setup, submitted
  speeches, and feedback) once round-state persistence exists" follow-up
  named under the "Practice Round Simulator" bullet in Research
  Crowdsourcing Organizer Features below — round-state persistence now
  exists via idea #3's `aiVersusRounds.ts` store, so rather than duplicating
  a round's submitted speeches in a second place, this store also adds
  `getPracticeRoundSubmittedSpeeches`, which looks them up through the
  existing `aiVersusRounds.ts` store directly. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in `packages/debate-round/test/practiceRounds.test.ts`.
  This is a persistence slice only — it stores whatever `PracticeRoundSetup`/
  `PracticeRoundFeedback` a caller passes in verbatim
  (`buildPracticeRoundSetup`/`buildPracticeRoundFeedback` themselves are
  unchanged); no round-simulator UI in this repo yet reads or writes through
  this store. Follow-ups: (a) an actual AI speech-generation call for the AI
  opponent's speeches and an AI judge-decision call under the chosen
  paradigm, (b) a round-simulator UI in `debate-round` that renders
  `buildPracticeRoundSetupText`/`buildPracticeRoundFeedbackText` and
  reads/writes through this store. Neither of these are started. PR:
  [#127](https://github.com/debate/debate-ai.com/pull/127) (`bun run
  typecheck`/`bun run test`/`bun run build` all pass).
- **Shared Evidence Library — persisted evidence repository.**
  `packages/debate-card-search/src/state/evidenceLibraryEntries.ts` adds a
  localStorage-backed CRUD store (`listEvidenceLibraryEntries`/
  `getEvidenceLibraryEntry`/`saveEvidenceLibraryEntry`/
  `deleteEvidenceLibraryEntry`) for `shared-evidence-library.ts`'s
  `EvidenceLibraryEntry`, keyed by `id` with upsert-on-save semantics, plus
  `searchPersistedEvidenceLibrary`, which reuses `searchEvidenceLibrary`
  directly against the persisted list rather than reimplementing search,
  mirroring the existing `contributions.ts`/`groupChallenges.ts` persistence
  convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
  empty list rather than throwing). Closes the "(a) wiring real submitted
  cards and team-drafted blocks into a persisted repository instead of
  caller-supplied entries" follow-up named under the "Shared Evidence
  Library" bullet in Research Crowdsourcing Organizer Features below, and
  unblocks the "Collaboration Prep Room" idea's own follow-up (a), which
  named a persisted evidence store as its prerequisite. Vitest-covered (with
  an in-memory `localStorage` mock, since this package's Vitest environment
  is `node` with no DOM) in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`. This is
  a persistence slice only — it stores whatever `EvidenceLibraryEntry` a
  caller passes in verbatim (`searchEvidenceLibrary`/`buildEvidenceLibraryIndex`
  themselves are unchanged); no search-panel UI in this repo yet reads or
  writes through this store, and `prep-room.ts`'s `buildPrepRoom` still
  takes a caller-supplied entry list rather than reading through this store.
  Follow-ups: (a) a search panel UI in `debate-card-search` that renders
  `searchPersistedEvidenceLibrary`/`buildEvidenceSearchSummaryText` results
  and `buildEvidenceLibraryIndex`'s folders/collections, (b) wiring
  `prep-room.ts`'s `buildPrepRoom`/`searchPrepRoomEvidence` to read through
  this store instead of a caller-supplied entry list, (c) a real search
  index (e.g. Typesense, mirroring the existing `search-query.ts` CARDS
  search) once entries are persisted, for relevance/typo-tolerance beyond
  the current keyword-overlap heuristic. None of these are started. PR:
  [#126](https://github.com/debate/debate-ai.com/pull/126) (`bun run
  typecheck`/`bun run test`/`bun run build` all pass).
- **AI Coach Mode — coaching-session persistence.**
  `packages/debate-round/src/state/coachingSessions.ts` adds a
  localStorage-backed CRUD store (`listCoachingSessions`/`getCoachingSession`/
  `getCoachingSessionsForRound`/`saveCoachingSession`/`deleteCoachingSession`)
  for `coach-mode.ts`'s derived `CoachingPrompt[]` coaching session, keyed by
  `roundId` + `sideKey` (a round can have a separately-generated session per
  side represented in its flow) with upsert-on-save semantics, mirroring the
  existing `flowSummaries.ts`/`drillSets.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Closes the "(c) persisting a generated coaching
  session per round" follow-up named under "AI Coach Mode" in the Research
  Crowdsourcing Organizer Features list below. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in `packages/debate-round/test/coachingSessions.test.ts`.
  This is a persistence slice only — it stores whatever `CoachingPrompt[]` a
  caller passes in verbatim (`buildCoachingSession` itself is unchanged); no
  coaching-panel UI in this repo yet reads or writes through this store. PR:
  TBD (`bun run test`/`bun run typecheck`/`bun run build:web` all pass).
  Follow-ups: (a) an actual AI coaching call for open-ended feedback beyond
  the existing template layer, (b) a coaching-panel UI in `debate-round` that
  reads/writes through this store. Neither of these is started.
- **Speech Transcript Summaries and Answers — flow-summary persistence.**
  `packages/debate-round/src/state/flowSummaries.ts` adds a
  localStorage-backed CRUD store (`listFlowSummaries`/`getFlowSummary`/
  `saveFlowSummary`/`deleteFlowSummary`) for `flow-transcript-summary.ts`'s
  derived `FlowRowSummary[]` (as produced by `getFlowRowSummaries`), keyed by
  `roundId` with upsert-on-save semantics, mirroring the existing
  `preRoundBriefings.ts`/`drillSets.ts` persistence convention (SSR/no-storage-safe,
  corrupt or missing JSON degrades to an empty list rather than throwing).
  Closes the "(c) persisting generated summaries per round" follow-up named
  under idea #6 ("Speech Transcript Summaries and Answers") in Product
  Feature Ideas below. Vitest-covered (with an in-memory `localStorage` mock,
  since this package's Vitest environment is `node` with no DOM) in
  `packages/debate-round/test/flowSummaries.test.ts`. This is a persistence
  slice only — it stores whatever `FlowRowSummary[]` a caller passes in
  verbatim (`getFlowRowSummaries`/`buildFlowSummaryText` themselves are
  unchanged); no summary/cross-ex panel UI in this repo yet reads or writes
  through this store. Follow-ups: (a) audio/video transcription plus an AI
  call to extract claims/warrants/impacts/evidence from raw speech text
  rather than relying on a manually flowed grid, (b) a summary/cross-ex panel
  UI in `debate-round` that renders `buildFlowSummaryText`/
  `suggestCrossExamQuestions`/`suggestExtensionIdeas` for the selected speech
  and reads/writes through this store. Neither of these is started. PR:
  [#123](https://github.com/debate/debate-ai.com/pull/123) (`bun run
  test`/`bun run typecheck`/`bun run build:web` all pass).
- **Online Debate Versus AI — submitted-round persistence.**
  `packages/debate-round/src/state/aiVersusRounds.ts` adds a
  localStorage-backed CRUD store (`listAiVersusRounds`/`getAiVersusRound`/
  `saveAiVersusRound`/`deleteAiVersusRound`) for an `AiVersusRoundRecord`
  (`roundId`, `styleKey`, `userSide`, `submittedSpeeches:
  PriorSpeechRecord[]`) built on `ai-versus-speech-order.ts`'s existing
  `AiVersusSide`/`PriorSpeechRecord` types, keyed by `roundId` with
  upsert-on-save semantics, mirroring the existing
  `preRoundBriefings.ts`/`coachingPrograms.ts` persistence convention
  (SSR-safe, corrupt/missing JSON degrades to an empty list rather than
  throwing). `submittedSpeeches.length` doubles as the `submittedCount`
  that `getNextSpeechSlot`/`isUsersTurn`/`validateSpeechSubmission`/
  `buildAiResponseRequest` already expect, so no separate counter field is
  stored. Closes the "(c) persisting an online-versus-AI round's submitted
  speeches" follow-up named under idea #3 ("Online Debate Versus AI") in
  Product Feature Ideas below. Vitest-covered (with an in-memory
  `localStorage` mock, since this package's Vitest environment is `node`
  with no DOM) in `packages/debate-round/test/aiVersusRounds.test.ts`. This
  is a persistence slice only — `ai-versus-speech-order.ts`'s pure
  turn-order logic is unchanged. PR:
  [#122](https://github.com/debate/debate-ai.com/pull/122) (`bun run
  typecheck`/`bun run test`/`bun run build:web` all pass). Follow-ups: (a)
  an actual AI speech-generation call that consumes
  `buildAiResponseRequest`'s output, (b) a round-setup + submission UI in
  `debate-round` that reads/writes
  through this store and calls `validateSpeechSubmission`. Neither of these
  are started.
- **Outline Filters and Argument Tree View — filter-selection persistence.**
  `packages/debate-round/src/state/argumentTreeFilters.ts` adds a
  localStorage-backed CRUD store (`listArgumentTreeFilterSelections`/
  `getArgumentTreeFilterSelection`/`saveArgumentTreeFilterSelection`/
  `deleteArgumentTreeFilterSelection`) for `argument-tree.ts`'s
  `ArgumentTreeFilter`, keyed by `roundId` with upsert-on-save semantics,
  mirroring the existing `judgeParadigmSelections.ts`/
  `opponentPersonaSelections.ts` persistence convention (SSR-safe,
  corrupt/missing JSON degrades to an empty list rather than throwing).
  Closes the "(c) persisting the user's chosen filter state per round"
  follow-up named under idea #10 below. Vitest-covered in
  `packages/debate-round/test/argumentTreeFilters.test.ts`. This is a
  persistence slice only — `argument-tree.ts`'s pure tree-building/filtering
  logic is unchanged and still takes a caller-supplied `ArgumentTreeFilter`.
  Follow-ups: (a) a React tree/outline panel in `debate-round` that renders
  the filtered tree and reads/writes through this store, (b) finer
  argument-type tagging and contributor/evidence-status fields. Neither of
  these are started.
- **Fix `packageManager` field so local installs use Bun instead of npm.**
  `package.json`'s `"packageManager"` field said `"npm@10.0.0"`, but this repo's
  actual lockfile is `bun.lock` (committed since the original monorepo setup),
  `.github/workflows/test.yml` installs and verifies with `bun install` /
  `bun run typecheck` / `bun run coverage`, and `README.md`'s documented
  workflow is `bun install` / `bun run …`. That mismatch meant every prior
  autonomous run's `npm install` failed with `Cannot read properties of null
  (reading 'edgesOut')` (a pre-existing `@npmcli/arborist` bug on this
  workspace layout), which blocked real `typecheck`/`test`/`build`
  verification and forced isolated-sandbox workarounds — see PRs
  [#119](https://github.com/debate/debate-ai.com/pull/119) and earlier entries
  below for repeated instances of this same blocker. Changed the field to
  `"bun@1.3.11"` to match the tool this repo actually uses. Verified from a
  clean checkout: `bun install` (2050 packages, ~9s), `bun run typecheck` (11
  packages, all pass), `bun run test` (75 files / 969 tests, all pass), and
  `bun run build` (`debate-ai-web` + `reason-editor`, both succeed) all pass
  cleanly with no code changes needed. No test changes were needed since this
  is a tooling-config fix, not a behavior change.
- **Brainstorm Idea Persistence.** `packages/debate-card-search/src/state/brainstormIdeas.ts`
  adds a localStorage-backed CRUD store (`listBrainstormIdeas`/`getBrainstormIdea`/
  `saveBrainstormIdea`/`deleteBrainstormIdea`) for `team-brainstorm-assist.ts`'s
  `BrainstormIdea`, keyed by `id` with upsert-on-save semantics, mirroring the
  existing `groupChallenges.ts`/`peerReviews.ts`/`contributions.ts` persistence
  convention (SSR-safe, corrupt/missing JSON degrades to an empty list rather
  than throwing). Closes the "(c) persisting submitted ideas and votes"
  follow-up named under the "Team Brainstorm Assist" bullet below.
  Vitest-covered in `packages/debate-card-search/test/brainstormIdeas.test.ts`.
  This is a persistence slice only — `team-brainstorm-assist.ts`'s pure
  ranking/board logic is unchanged and still takes a caller-supplied
  `BrainstormIdea[]`. Follow-ups: (a) an actual AI-generation call that drafts
  candidate ideas, (b) a brainstorm-panel UI for live squad submission/upvoting.
  Neither of these are started. PR: [#119](https://github.com/debate/debate-ai.com/pull/119)
  (merged; full `bun run typecheck`/`bun run test`/`bun run build` verification
  completed after merge — see the `packageManager` fix entry above for why the
  original PR could only verify in an isolated sandbox).
- **Collaboration Prep Room — evidence + draft blocks + task-routing composition slice.**
  `packages/debate-card-search/src/lib/prep-room.ts` adds
  `buildPrepRoom`/`searchPrepRoomEvidence`/`buildPrepRoomSummaryText`,
  composing the existing "Shared Evidence Library"
  (`shared-evidence-library.ts`'s `buildEvidenceLibraryIndex`/
  `searchEvidenceLibrary`) and "Research Task Routing"
  (`research-task-routing.ts`'s `buildRoutingResult`) slices into one
  topic-scoped `PrepRoom`: the topic's evidence organized into folders/tag
  collections, its `kind: "block"` entries surfaced as draft blocks (the
  existing evidence-library model already distinguishes a team-drafted
  reusable analytic block from a cut evidence card, so no separate block
  model was needed), and its coverage-gap tasks routed to available
  contributors — mirroring the existing `team-collaboration-mode.ts`
  composition precedent (Daily Quests + Research Task Routing + Research
  Progress Tracking composed into one `TopicSprint`). Reuses
  `shared-evidence-library.ts` and `research-task-routing.ts` directly
  rather than introducing a separate evidence or assignment model.
  Vitest-covered in `packages/debate-card-search/test/prep-room.test.ts`.
  This is the first slice only — it works entirely off a caller-supplied
  entry list, coverage report, and contributor-availability list; it
  doesn't render a prep-room panel UI. A second slice,
  `buildPrepRoomFromStore` (see the "Collaboration Prep Room Store Wiring"
  entry in Tracker Status above), now reads a topic's entries from the
  `evidenceLibraryEntries.ts` store instead of requiring a caller-supplied
  entry list, closing follow-up (a) below. Follow-ups: (a) a prep-room panel
  UI that renders `buildPrepRoomFromStore`'s evidence index/draft
  blocks/routing and lets a teammate call `searchPrepRoomEvidence`, (b) a
  live presence/who's-active signal, mirroring the "Team Collaboration Mode"
  idea's own still-open follow-up. Neither of these are started.
  PR: [#118](https://github.com/debate/debate-ai.com/pull/118) (first slice),
  [#135](https://github.com/debate/debate-ai.com/pull/135) (store-wiring
  slice).
- **Unlock Status Streak Badges — Progress Unlocks/Gamified Quests composition slice.**
  `packages/debate-card-search/src/lib/unlock-streak-status.ts` adds
  `buildContributorUnlockStatusWithStreak`/`buildUnlockStatusWithStreakText`,
  composing the existing "Progress Unlocks" tier/badge logic
  (`progress-unlocks.ts`'s `buildContributorUnlockStatus`) with the existing
  "Gamified Quests" streak logic (`gamified-quests.ts`'s
  `buildContributorQuestStreak`) into one `ContributorUnlockStatusWithStreak`
  that merges tier-earned badges with streak-earned badges (tier badges
  first) and carries the full `StreakStatus` alongside the unlocked skill
  level and next-tier progress. The "🎮 Gamified Quests" bullet's own
  follow-up (c) named this exact gap — see Research Crowdsourcing Organizer
  Features below — mirroring the existing
  `tiered-task-routing.ts` composition precedent (Progress Unlocks composed
  into Research Task Routing). Reuses `progress-unlocks.ts` and
  `gamified-quests.ts` directly rather than introducing a separate tier or
  streak signal. Vitest-covered in
  `packages/debate-card-search/test/unlock-streak-status.test.ts`. This is
  the first slice only — it works entirely off caller-supplied
  `ContributorStats`/`DailyMissionResult`s (neither a contributor's tier nor
  their streak is persisted anywhere in this repo yet); no progress/unlock UI
  in this repo reads it. Follow-ups: (a) persisting a contributor's tier and
  daily mission-completion history so this can be computed from real data
  instead of caller-supplied input, (b) a progress/unlock panel UI that
  renders `buildUnlockStatusWithStreakText`/`ContributorUnlockStatusWithStreak`.
  PR: [#117](https://github.com/debate/debate-ai.com/pull/117).
- **Generated Drill Set Persistence — localStorage drill-set-per-round store.**
  `packages/debate-round/src/state/drillSets.ts` adds
  `listDrillSets`/`getDrillSet`/`saveDrillSet`/`deleteDrillSet`, a
  localStorage-backed CRUD store for `drill-generator.ts`'s generated
  `Drill[]` set (plus the `sideKey` it was generated for), keyed by
  `roundId` with upsert-on-save semantics, mirroring the existing
  `preRoundBriefings.ts`/`judgeParadigmSelections.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). See the "AI Drill Generator" bullet under Research
  Crowdsourcing Organizer Features below — this is the "(c) persisting
  generated drills per round" follow-up named in that slice. This is a
  persistence slice only — it stores whatever `Drill[]` a caller passes in
  verbatim (`buildDrillSet` itself is unchanged); no drill-panel UI in this
  repo yet reads or writes through this store. Vitest-covered in
  `packages/debate-round/test/drillSets.test.ts`. Follow-ups: (a) a
  drill-panel UI that calls `buildDrillSet` and reads/writes through this
  store, (b) an actual AI-generated (rather than templated) drill script.
  PR: [#116](https://github.com/debate/debate-ai.com/pull/116).
- **Pre-Round Briefing Persistence — localStorage briefing store.**
  `packages/debate-round/src/state/preRoundBriefings.ts` adds
  `listPreRoundBriefings`/`getPreRoundBriefing`/`savePreRoundBriefing`/
  `deletePreRoundBriefing`, a localStorage-backed CRUD store for
  `pre-round-briefing.ts`'s `PreRoundBriefing`, keyed by a caller-supplied
  `roundId` with upsert-on-save semantics, mirroring the existing
  `judgeParadigmSelections.ts`/`coachingPrograms.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). See idea #12 ("Pre-Round Intelligence Panel") in
  Product Feature Ideas below — this is the "(c) persisting a generated
  briefing per round" follow-up named in that slice. This is a persistence
  slice only — it stores whatever `PreRoundBriefing` a caller passes in
  verbatim (`buildPreRoundBriefing`/`buildPreRoundBriefingText` themselves
  are unchanged); no round-information-page UI in this repo yet reads or
  writes through this store. Vitest-covered in
  `packages/debate-round/test/preRoundBriefings.test.ts`. Follow-ups: (a) a
  briefing-panel UI that renders a persisted briefing on a round-information
  page, (b) real data sources for tournament results, pairings, event
  details, and room assignments (none exist in this repo today) feeding
  `buildPreRoundBriefing` before it's persisted, (c) wiring
  `savePreRoundBriefing` into whatever eventually calls
  `buildPreRoundBriefing` for a real round.
  PR: [#115](https://github.com/debate/debate-ai.com/pull/115).
- **Opponent Persona Selection Persistence — localStorage persona-per-session store.**
  `packages/debate-speech-writer/src/state/opponentPersonaSelections.ts` adds
  `listOpponentPersonaSelections`/`getOpponentPersonaSelection`/
  `saveOpponentPersonaSelection`/`deleteOpponentPersonaSelection`, a
  localStorage-backed CRUD store for a practice session's selected
  `OpponentPersona` (`opponent/opponent-personas.ts`), keyed by `sessionId`
  with upsert-on-save semantics, mirroring the existing
  `judgeParadigmSelections.ts`/`coachMaterials.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Stores the full `OpponentPersona` object rather
  than just a builtin id, so a future custom persona would persist too. See
  the "AI Practice Opponent" idea in Research Crowdsourcing Organizer
  Features below — this is the "(c) persisting the selected persona per
  practice session" follow-up named in that slice. Vitest-covered in
  `packages/debate-speech-writer/test/opponentPersonaSelections.test.ts`.
  This is a persistence slice only — no persona-picker UI in this repo yet
  reads or writes through this store, and it isn't wired into an actual
  AI speech-generation call. Follow-ups: (a) an actual AI speech-generation
  call that consumes `buildOpponentPersonaPrompt`'s output alongside idea
  #3's `AiSpeechRequest`, (b) a persona-picker UI that reads/writes through
  this store before starting an AI-versus practice round.
  PR: [#114](https://github.com/debate/debate-ai.com/pull/114).
- **Group Challenge Persistence — localStorage challenge-config store.**
  `packages/debate-card-search/src/state/groupChallenges.ts` adds
  `listGroupChallenges`/`getGroupChallenge`/`saveGroupChallenge`/
  `deleteGroupChallenge`, a localStorage-backed CRUD store for
  `group-challenges.ts`'s `GroupChallenge` (id, title, goal, member roster,
  challenge window), keyed by `id` with upsert-on-save semantics, mirroring
  the existing `sprintNotes.ts`/`coachingPrograms.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Reuses `GroupChallenge` from `group-challenges.ts`
  directly rather than redefining it. Vitest-covered (with an in-memory
  `localStorage` mock, since this package's Vitest environment is `node`
  with no DOM) in
  `packages/debate-card-search/test/groupChallenges.test.ts`. See the
  "Group Challenges" bullet under Research Crowdsourcing Organizer Features
  below (PR #97) — this is the "(c) persisting challenges" follow-up named
  in that slice. This is a config-persistence slice only — it stores a
  challenge's static config verbatim; a challenge's computed progress
  (`computeGroupChallengeProgress`, `GroupChallengeProgress`) stays
  session-derived from caller-supplied contributions/win events rather than
  being persisted, and no challenge-board/creation UI in this repo yet reads
  or writes through this store. Follow-ups: (a) a challenge-board/creation
  UI in `debate-card-search` that reads/writes through this store, (b)
  wiring real contribution-submission/practice-round-result events into
  `computeGroupChallengeProgress` instead of caller-supplied data, (c)
  notifying the squad when a persisted challenge completes.
  PR: [#113](https://github.com/debate/debate-ai.com/pull/113).
- **Judge Paradigm Selection Persistence — localStorage paradigm-per-round store.**
  `packages/debate-speech-writer/src/state/judgeParadigmSelections.ts` adds
  `listJudgeParadigmSelections`/`getJudgeParadigmSelection`/
  `saveJudgeParadigmSelection`/`deleteJudgeParadigmSelection`, a
  localStorage-backed CRUD store for a round's selected `JudgeParadigm`
  (`judge-paradigms.ts`), keyed by `roundId` with upsert-on-save semantics,
  mirroring the existing `opponentTeamProfiles.ts`/`coachMaterials.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). Stores the full
  `JudgeParadigm` object rather than just a builtin id, so a "custom"
  paradigm built with `buildCustomJudgeParadigm` persists too. See idea #5
  ("AI Judge Decision Modes") in Product Feature Ideas below — this is the
  "(c) persisting the selected paradigm per round" follow-up named in that
  slice. This is a persistence slice only — no paradigm-picker UI in this
  repo yet reads or writes through this store, and no AI judge-decision call
  looks up a round's persisted selection to build its prompt. Follow-ups:
  (a) a paradigm-picker UI that reads/writes through this store, (b) wiring
  a round's persisted selection into an actual AI judge-decision call via
  `buildJudgeParadigmPrompt`.
  PR: [#112](https://github.com/debate/debate-ai.com/pull/112).
- **Contribution Leaderboard Persistence — localStorage contribution store.**
  `packages/debate-card-search/src/state/contributions.ts` adds
  `listContributions`/`listContributionsByContributor`/`getContribution`/
  `saveContribution`/`deleteContribution`, a localStorage-backed CRUD store
  for `contribution-leaderboard.ts`'s `AttributedContribution` (a
  `community-rating.ts` `CommunityContribution` attributed to a
  `contributorId`), keyed by `id` with upsert-on-save semantics, mirroring
  the existing `sprintNotes.ts`/`peerReviews.ts`/`opponentTeamProfiles.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing).
  `listContributionsByContributor` reuses `contribution-leaderboard.ts`'s
  existing `groupContributionsByContributor` helper directly rather than
  reimplementing contributor-scoped filtering. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in
  `packages/debate-card-search/test/contributions.test.ts`. See the
  "Contribution Leaderboard" bullet under Research Crowdsourcing Organizer
  Features below — this is the "(a) wiring a `contributorId` into wherever
  contributions are eventually persisted" follow-up named in that slice.
  This is a persistence slice only — it stores whatever
  `AttributedContribution` a caller passes in verbatim (still built from
  caller-supplied like/save/quality/reviewer-endorsement signals, not wired
  to any real contribution-submission flow); no leaderboard UI in this repo
  yet reads or writes through this store, and `buildLeaderboard`/
  `buildContributorStats` still take a caller-supplied contribution list
  rather than reading through this store directly. Follow-ups: (a) wiring
  real like/save/endorse actions and a real submitted-contribution flow into
  `saveContribution`, (b) a leaderboard/ranked-feed UI that reads through
  this store and renders `buildLeaderboard`, (c) composing this store's
  reads directly into `buildLeaderboard`/`buildContributorStats` call sites
  once one exists, instead of requiring a caller-supplied list.
  PR: [#111](https://github.com/debate/debate-ai.com/pull/111).
- **Peer Review Persistence — localStorage review store.**
  `packages/debate-card-search/src/state/peerReviews.ts` adds
  `listPeerReviews`/`getPeerReview`/`savePeerReview`/`deletePeerReview`, a
  localStorage-backed CRUD store for `peer-review.ts`'s `CardReview`
  (status plus its full `ReviewComment` thread), keyed by `cardId` with
  upsert-on-save semantics, mirroring the existing
  `sprintNotes.ts`/`opponentTeamProfiles.ts`/`coachMaterials.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). Reuses `CardReview` from
  `peer-review.ts` directly rather than redefining it. Vitest-covered (with
  an in-memory `localStorage` mock, since this package's Vitest environment
  is `node` with no DOM) in
  `packages/debate-card-search/test/peerReviews.test.ts`. See the "Peer
  Review System" bullet under Research Crowdsourcing Organizer Features
  below — this is the "(a) persisting `CardReview`/`ReviewComment`
  alongside submitted cards" follow-up named in that slice. This is a
  persistence slice only — it stores whatever `CardReview` a caller passes
  in verbatim (still built from caller-supplied state-machine transitions,
  not wired to any real card-submission flow); no review-queue/comment-
  thread UI in this repo yet reads or writes through this store.
  Follow-ups: (a) a review-queue/comment-thread UI that reads/writes
  through this store, (b) reviewer identity/permission checks once
  auth/roles exist, (c) wiring a review's lifecycle to whatever eventually
  persists submitted cards, so `publishReview` can gate a card actually
  going live.
  PR: TBD.
- **Judge Profile Persistence — localStorage profile store.**
  `packages/debate-speech-writer/src/state/judgeProfiles.ts` adds
  `listJudgeProfiles`/`getJudgeProfile`/`saveJudgeProfile`/
  `deleteJudgeProfile`, a localStorage-backed CRUD store for
  `judge-profile.ts`'s `JudgeProfile`, keyed by `judgeId` with
  upsert-on-save semantics, mirroring the existing
  `coachMaterials.ts`/`opponentTeamProfiles.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). See the "Judge Profiles" bullet under Research
  Crowdsourcing Organizer Features below — this is the "(c)
  persisting/looking up profiles by judge across tournaments" follow-up
  named in that slice, mirroring the same follow-up already closed for
  Opponent Team Profiles (PR #108). This is a persistence slice only — it
  stores whatever `JudgeProfile` a caller passes in verbatim (still built
  from caller-supplied `JudgeRoundRecord`s, not a real ballot data source);
  no judge-profile card/panel UI in this repo yet reads or writes through
  this store. Vitest-covered (with an in-memory `localStorage` mock, since
  this package's Vitest environment is `node` with no DOM) in
  `packages/debate-speech-writer/test/judgeProfiles.test.ts`. Follow-ups:
  (a) a real ballot data source producing `JudgeRoundRecord`s so profiles
  reflect real ballots instead of caller-supplied data, (b) a
  judge-profile card/panel UI that renders `buildJudgeTendencySummary` for
  a profile read through this store, (c) wiring `buildPreRoundBriefing`
  (in `debate-round`) to look up a persisted profile here instead of
  requiring the caller to supply one.
  PR: [#109](https://github.com/debate/debate-ai.com/pull/109).
- **Opponent Team Profile Persistence — localStorage profile store.**
  `packages/debate-data-sync/src/state/opponentTeamProfiles.ts` adds
  `listOpponentTeamProfiles`/`getOpponentTeamProfile`/
  `saveOpponentTeamProfile`/`deleteOpponentTeamProfile`, a
  localStorage-backed CRUD store for `opponent-team-profile.ts`'s
  `OpponentTeamProfile`, keyed by `teamId` with upsert-on-save semantics,
  mirroring the existing `coachMaterials.ts`/`sprintNotes.ts` persistence
  convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
  empty list rather than throwing). This is the first localStorage-backed
  persistence store in the `debate-data-sync` package. Vitest-covered
  (with an in-memory `localStorage` mock, since this package's Vitest
  environment is `node` with no DOM) in
  `packages/debate-data-sync/test/opponentTeamProfiles.test.ts`. See the
  "Opponent Team Profiles" bullet under Research Crowdsourcing Organizer
  Features below — this is the "(c) persisting/looking up profiles by team
  across tournaments" follow-up named in that slice. This is a persistence
  slice only — it stores whatever `OpponentTeamProfile` a caller passes in
  verbatim (still built from caller-supplied `OpponentRoundRecord`s, not a
  real Tabroom/tab-service data source); no scouting-card or
  pre-round-briefing UI in this repo yet reads or writes through this
  store. Follow-ups: (a) a real round-history data source producing
  `OpponentRoundRecord`s so profiles reflect real pairings/ballots instead
  of caller-supplied data, (b) a scouting-card/panel UI that renders
  `buildOpponentScoutingSummary` for a profile read through this store,
  (c) wiring `buildPreRoundBriefing` (in `debate-round`) to look up a
  persisted profile here instead of requiring the caller to supply one.
  PR: [#108](https://github.com/debate/debate-ai.com/pull/108).
- **Coach Material Persistence — localStorage config store.**
  `packages/debate-speech-writer/src/state/coachMaterials.ts` adds
  `listCoachMaterials`/`getCoachMaterial`/`saveCoachMaterial`/
  `deleteCoachMaterial`, a localStorage-backed CRUD store for
  `team-coach-materials.ts`'s `CoachMaterial` (id, kind, title, topic, tags,
  text), keyed by `id` with upsert-on-save semantics, mirroring the existing
  `coachingPrograms.ts`/`prepNotes.ts`/`flowAnnotations.ts`/`sprintNotes.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). Reuses `CoachMaterial`
  from `team-coach-materials.ts` directly rather than redefining it.
  Vitest-covered (with an in-memory `localStorage` mock, since this
  package's Vitest environment is `node` with no DOM) in
  `packages/debate-speech-writer/test/coachMaterials.test.ts`. See the
  "Video-Lecture-Training Coach AI" idea (#8) in Product Feature Ideas
  below — this is the "(d) persisting a team's `CoachMaterial`s" follow-up
  named in that slice (PR #98). This is the first slice only — it persists
  whatever `CoachMaterial` a caller passes in verbatim; no UI in this repo
  yet uploads a material and threads it through `saveCoachMaterial`/
  `deleteCoachMaterial`, and it still doesn't transcribe recordings, parse
  uploaded documents, or call any AI model. Follow-ups: (a)
  transcription/parsing that turns an uploaded recording or document into a
  `CoachMaterial`'s `text`, (b) an actual AI Q&A call that consumes
  `buildGroundedCoachPrompt`'s output, (c) a materials-upload/coach chat
  panel UI that reads/writes through this store.
  PR: TBD.
- **Shared Evidence Library — fast keyword/tag/cite/topic search slice.**
  `packages/debate-card-search/src/lib/shared-evidence-library.ts` adds an
  `EvidenceLibraryEntry` model (extends the existing "Common Argument
  Library" slice's `LibraryCard` with a searchable full-text `text` body, a
  `cite`, and a `kind: "card" | "block"` distinguishing a cut/tagged
  evidence card from a team-drafted reusable analytic block) plus
  `searchEvidenceLibrary` (narrows by topic/case-area/kind/tags — reusing
  `argument-library.ts`'s `filterCardsByTags` directly — then, when a text
  query is given, ranks the remaining entries by keyword-overlap relevance
  against their combined text/argBlock/cite via the existing "LLM Card
  Scoring" slice's `scoreRelevance`, dropping zero-relevance entries rather
  than returning noise), `findEntriesByCite` (citation lookup),
  `buildEvidenceLibraryIndex` (a thin alias of `buildArgumentLibrary`, since
  an `EvidenceLibraryEntry` is already a `LibraryCard`), and
  `buildEvidenceSearchSummaryText`. Reuses `argument-library.ts` and
  `llm-card-scoring.ts` directly rather than introducing a separate
  grouping or relevance-scoring path. Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts`. See
  the "Shared Evidence Library" bullet under Research Crowdsourcing
  Organizer Features below. This is the first slice only — it works
  entirely off a caller-supplied entry list; it doesn't read real submitted
  cards or blocks, persist the repository, or render a search UI, and its
  keyword search is a deterministic overlap heuristic rather than a real
  full-text/fuzzy search index. Follow-ups: (a) wiring real submitted cards
  and team-drafted blocks into a persisted repository instead of
  caller-supplied entries, (b) a search panel UI in `debate-card-search`
  that renders `searchEvidenceLibrary`/`buildEvidenceSearchSummaryText`
  results and `buildEvidenceLibraryIndex`'s folders/collections, (c) a real
  search index (e.g. Typesense, mirroring the existing `search-query.ts`
  CARDS search) once entries are persisted, for relevance/typo-tolerance
  beyond the current keyword-overlap heuristic.
  PR: [#106](https://github.com/debate/debate-ai.com/pull/106).
- **Sprint Note Persistence — localStorage note store.**
  `packages/debate-card-search/src/state/sprintNotes.ts` adds
  `listSprintNotes`/`listSprintNotesForTopic`/`getSprintNote`/
  `saveSprintNote`/`deleteSprintNote`, a localStorage-backed CRUD store for
  `team-collaboration-mode.ts`'s `SprintNote` (id, topic, author, text,
  status, optional assignee), keyed by `id` with upsert-on-save semantics,
  mirroring the existing `debate-round` `prepNotes.ts`/`coachingPrograms.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). This is the first
  localStorage-backed persistence store in the `debate-card-search`
  package. `listSprintNotesForTopic` reuses `team-collaboration-mode.ts`'s
  existing `getNotesForTopic` query helper directly rather than
  reimplementing topic-scoped filtering/sorting. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in
  `packages/debate-card-search/test/sprintNotes.test.ts`. See the "Team
  Collaboration Mode" bullet under Research Crowdsourcing Organizer Features
  below — this is the "(a) persisting `SprintNote`s and a topic sprint's
  inputs somewhere" follow-up named in that slice. This is the first slice
  only — it persists whatever `SprintNote` a caller passes in verbatim; no
  UI in this repo yet calls `createSprintNote`/`updateSprintNoteStatus`/
  `assignSprintNote` and threads the result through
  `saveSprintNote`/`deleteSprintNote`, and a topic sprint's other inputs
  (quest templates, contributor availability) still aren't persisted.
  Follow-ups: (a) a collaboration-mode panel UI in `debate-card-search` that
  reads/writes through this store, (b) persisting a topic sprint's other
  inputs once they have a natural persisted shape, (c) a presence/live-status
  signal for who's currently active in the sprint.
  PR: [#105](https://github.com/debate/debate-ai.com/pull/105).
- **Flow Annotation Persistence — localStorage annotation store.**
  `packages/debate-round/src/state/flowAnnotations.ts` adds
  `listFlowAnnotations`/`listFlowAnnotationsForFlow`/
  `listFlowAnnotationsForSpeech`/`listFlowAnnotationsForBox`/
  `getFlowAnnotation`/`saveFlowAnnotation`/`deleteFlowAnnotation`, a
  localStorage-backed CRUD store for `flow-annotations.ts`'s
  `FlowAnnotation` (id, flow/box address, speech, playback timestamp,
  optional note), keyed by `id` with upsert-on-save semantics, mirroring
  the existing `prepNotes.ts`/`coachingPrograms.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). `listFlowAnnotationsForSpeech`/
  `listFlowAnnotationsForBox` reuse `flow-annotations.ts`'s existing
  `getAnnotationsForSpeech`/`getAnnotationsForBox` query helpers directly
  rather than reimplementing filtering/sorting. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in `packages/debate-round/test/flowAnnotations.test.ts`.
  See idea #15 below ("Flow-in-Speech Flow Annotations") — this is the "(c)
  persisting annotations alongside a `Round`/`Flow`" follow-up named in
  that slice. This is the first slice only — it persists whatever
  `FlowAnnotation` a caller passes in verbatim; no UI in this repo yet
  calls `createFlowAnnotation` and threads the result through
  `saveFlowAnnotation`/`deleteFlowAnnotation`. Follow-ups: (a) a
  video-player UI (`debate-videos`) that lets a viewer drop an annotation
  at the current playback position, persisted through this store, and jump
  back to one, (b) a flow-grid affordance (`FlowSpreadsheet`) that surfaces
  annotations on their box via `listFlowAnnotationsForBox` and links back
  to the timestamp.
  PR: [#104](https://github.com/debate/debate-ai.com/pull/104).
- **Shared Flow Sync — concurrent-edit merge and conflict-detection slice.**
  `packages/debate-round/src/flow/shared-flow-sync.ts` adds a `FlowEdit`
  model (one contributor's proposed edit to a single flow `Box`'s content,
  addressed via `boxPath` the same way `flow-annotations.ts`/
  `strategy-sync-notes.ts` already address boxes) plus `mergeFlowEdits`
  (reconciles every box's edits into one canonical value — last write wins,
  tie-broken by `id` — except when a box's latest edit and some other,
  different-author edit with different content land within a configurable
  `conflictWindowMs` of each other, in which case that box is left out of
  `merged` and reported in `conflicts` instead, so a teammate's genuinely
  concurrent work is surfaced for a human to resolve rather than silently
  overwritten), `applyMergedEditsToFlow` (immutably applies merged edits to
  a `Flow`'s boxes, skipping an edit whose `boxPath` no longer resolves
  rather than throwing, mirroring `resolveAnnotationBox`'s handling), and
  `buildSharedFlowSyncSummaryText`. See idea #16 below ("Shared,
  Ai-Generated Debate Flow"). This is the first slice only — it's pure
  merge logic over caller-supplied edits; there's no live transport (e.g.
  WebSocket) wiring contributors' edits together in real time, it isn't
  wired into `FlowSpreadsheet`, and it doesn't preload evidence cards into
  flow notes (the idea's "optionally preloading evidence cards" half).
  Vitest-covered (100% statement/branch/function/line coverage) in
  `packages/debate-round/test/shared-flow-sync.test.ts`. Follow-ups: (a) a
  live transport (WebSocket or similar) that turns local `FlowEdit`s into a
  shared stream across a room/team, (b) a `FlowSpreadsheet` affordance that
  applies `mergeFlowEdits`/`applyMergedEditsToFlow` and surfaces
  `conflicts` for a teammate to pick a winner, (c) composing
  `argument-library.ts`'s tagged card corpus to suggest a pre-filled flow
  note from matching evidence, keeping the human in control of whether to
  accept it.
  PR: [#103](https://github.com/debate/debate-ai.com/pull/103).
- **Prep Note Persistence — localStorage note store.**
  `packages/debate-round/src/state/prepNotes.ts` adds
  `listPrepNotes`/`listPrepNotesForFlow`/`getPrepNote`/`savePrepNote`/
  `deletePrepNote`, a localStorage-backed CRUD store for
  `strategy-sync-notes.ts`'s `PrepNote` (id, flow/box address, author, text,
  status, optional assignee), keyed by `id` with upsert-on-save semantics,
  mirroring the existing `coachingPrograms.ts`/`myTeamProfile.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). `listPrepNotesForFlow`
  reuses `strategy-sync-notes.ts`'s existing `getNotesForFlow` query helper
  directly rather than reimplementing flow-scoped filtering/sorting.
  Vitest-covered (with an in-memory `localStorage` mock, since this
  package's Vitest environment is `node` with no DOM) in
  `packages/debate-round/test/prepNotes.test.ts`. See the "Strategy Sync
  Notes" bullet under Research Crowdsourcing Organizer Features below — this
  is the "(a) wiring `PrepNote` into wherever round/flow state is eventually
  persisted" follow-up named in that slice. This is the first slice
  only — it persists whatever `PrepNote` a caller passes in verbatim; no UI
  in this repo yet calls `createPrepNote`/`updateNoteStatus`/`assignNote`
  and threads the result through `savePrepNote`/`deletePrepNote`. Follow-up
  (b), wiring `updateNoteStatus`/`assignNote`'s returned copies back into
  `savePrepNote`, is now done — see the "Prep Note Status/Assignment
  Persistence" entry above. Follow-ups: (a) a prep-notes panel UI in
  `debate-round` that reads/writes through this store, (b) an assignee
  notification once a notification system exists.
  PR: [#102](https://github.com/debate/debate-ai.com/pull/102).
- **Coaching Program Persistence — localStorage config store.**
  `packages/debate-round/src/state/coachingPrograms.ts` adds
  `listCoachingPrograms`/`getCoachingProgram`/`saveCoachingProgram`/
  `deleteCoachingProgram`, a localStorage-backed CRUD store for
  `coaching-program.ts`'s `CoachingProgramConfig` (id, name, squad roster),
  keyed by `id` with upsert-on-save semantics, mirroring the existing
  `myTeamProfile.ts` persistence convention (SSR/no-storage-safe, corrupt or
  missing JSON degrades to an empty list rather than throwing). Reuses
  `CoachingProgramConfig` from `coaching-program.ts` directly rather than
  redefining it. Vitest-covered (with an in-memory `localStorage` mock, since
  this package's Vitest environment is `node` with no DOM) in
  `packages/debate-round/test/coachingPrograms.test.ts`. See the "Coaching
  Programs and Group Challenges" idea (#13) in Product Feature Ideas below —
  this is the "(a) persisting a coaching program's config" half of the
  follow-up named in the `coaching-program.ts` slice (PR #99). This is the
  first slice only — it persists a program's *config* only, not its board's
  session-derived inputs (topic-sprint contributions, member flows,
  challenges, win events), and there's no UI reading or writing this store
  yet. Follow-ups: (a) a coaching-space dashboard UI that lists/creates/edits
  programs through this store, (b) wiring `buildCoachingProgramBoard`'s other
  inputs into their own persistence once those have a natural persisted
  shape (most are session-derived rather than static config).
  PR: [#101](https://github.com/debate/debate-ai.com/pull/101).
- **Tiered Task Routing — stats-derived skill-level composition slice.**
  `packages/debate-card-search/src/lib/tiered-task-routing.ts` adds
  `deriveContributorAvailability`/`deriveContributorAvailabilityList` (builds
  a `research-task-routing.ts` `ContributorAvailability` by deriving its
  `skillLevel` from a contributor's `contribution-leaderboard.ts`
  `ContributorStats` via `progress-unlocks.ts`'s
  `buildContributorUnlockStatus`/`getUnlockedSkillLevel`, instead of
  requiring a caller-supplied skill level — throwing if the supplied stats
  and task-load entries don't share a `contributorId`, and skipping a
  contributor with stats but no matching load entry rather than guessing a
  `maxConcurrentTasks` default) and `buildRoutingResultFromContributorStats`
  (composes that straight into the existing `buildTaskQueue`/`routeTasks`).
  This closes the exact gap both the "Progress Unlocks" and "Research Task
  Routing" ideas' own follow-ups named — `progress-unlocks.ts` could derive
  an unlocked skill level but nothing fed it into
  `research-task-routing.ts`'s `ContributorAvailability`. Reuses
  `progress-unlocks.ts` and `research-task-routing.ts` directly rather than
  introducing a separate skill-derivation or routing path. Vitest-covered in
  `packages/debate-card-search/test/tiered-task-routing.test.ts`. See the
  "Research Task Routing" and "Progress Unlocks" bullets under Research
  Crowdsourcing Organizer Features below. This is the first slice only — a
  contributor's `activeTaskCount`/`maxConcurrentTasks` still isn't tracked
  anywhere in this repo, so it remains caller-supplied; this only removes
  the need for a caller-supplied `skillLevel`. Follow-ups: (a) persisting a
  contributor's active-task count so `activeTaskCount` no longer needs to be
  caller-supplied either, (b) wiring `buildRoutingResultFromContributorStats`
  into a task-assignment/inbox UI once one exists, (c) reusing the same
  derive-then-route pattern once `research-task-routing.ts`'s task queue
  gains other skill-gated categories beyond coverage-gap tasks.
  PR: [#100](https://github.com/debate/debate-ai.com/pull/100).
- **Coaching Program Space — topic-sprint/group-challenge/member-drill composition slice.**
  `packages/debate-round/src/round/coaching-program.ts` adds a
  `CoachingProgramConfig` (id, name, squad roster) and
  `buildCoachingProgramBoard`, which composes `debate-card-search`'s
  `team-collaboration-mode.ts` `buildTopicSprint` (shared research sprint),
  `debate-card-search`'s `group-challenges.ts` `buildGroupChallengeBoard`
  (friendly-challenge standings), and this package's own
  `flow/drill-generator.ts` `buildDrillSet` (one practice-drill set per
  roster member who has a flowed practice round, ignoring flows for
  contributors outside the roster) into one renderable coaching-space board,
  plus `buildCoachingProgramSummaryText` and `buildMemberDrillSummaryText`.
  `debate-round` now depends on `debate-card-search` to make this
  composition possible, mirroring the existing precedent of
  `pre-round-briefing.ts` adding new cross-package dependencies. Reuses
  `buildTopicSprint`/`buildGroupChallengeBoard`/`buildDrillSet` directly
  rather than reimplementing any of their quest/challenge/drill logic.
  Vitest-covered in `packages/debate-round/test/coaching-program.test.ts`.
  See the "Coaching Programs and Group Challenges" idea (#13) in Product
  Feature Ideas below — this is the "coaching-program/space model" follow-up
  named in the Group Challenges slice (PR #97). This is the first slice
  only — it works entirely off caller-supplied topic-sprint/challenge/flow
  inputs; it doesn't persist a program, its roster, or its board anywhere,
  doesn't compose `practice-round-simulator.ts`'s
  `buildPracticeRoundSetup`/`buildPracticeRoundFeedback` (a practice round is
  per-member/per-session rather than a fixed part of a program's board), and
  doesn't render a coaching-space UI. Follow-ups: (a) persisting a
  `CoachingProgramConfig` and its board's inputs, (b) a coaching-space
  dashboard UI that renders `buildCoachingProgramBoard`/
  `buildCoachingProgramSummaryText`, (c) letting a coach start (and later
  review feedback from) a member's practice round from within the space by
  wiring in `buildPracticeRoundSetup`/`buildPracticeRoundFeedback`.
  PR: [#99](https://github.com/debate/debate-ai.com/pull/99).
- **Video-Lecture-Training Coach AI — grounding-materials library and
  grounded-prompt slice.**
  `packages/debate-speech-writer/src/coach/team-coach-materials.ts` adds a
  kind-grouped `CoachMaterial` library (`buildCoachMaterialLibrary` — lecture
  transcripts, camp materials, instructional documents, and practice-round
  recordings, in a stable, most-consulted-first order), a deterministic
  keyword-overlap relevance scorer (`scoreMaterialRelevance`/
  `findRelevantMaterials`, matching against a material's title, tags, and
  body text, optionally scoped by topic and capped by limit/threshold), and
  `buildGroundedCoachPrompt` — a self-contained prompt built from the most
  relevant materials that instructs a future AI Q&A call to answer only from
  the supplied grounding materials, mirroring the existing
  `opponent-personas.ts`/`judge-paradigms.ts` structured-prompt convention —
  plus `buildCoachMaterialLibrarySummaryText`. Vitest-covered (100%
  statement/branch coverage) in
  `packages/debate-speech-writer/test/team-coach-materials.test.ts`. See the
  "Video-Lecture-Training Coach AI" idea (#8) in Product Feature Ideas below.
  This is the first slice only — it doesn't transcribe recordings, parse
  uploaded documents, call any AI model, or persist a team's materials.
  Follow-ups: (a) transcription/parsing that turns an uploaded recording or
  document into a `CoachMaterial`'s `text`, (b) an actual AI Q&A call that
  consumes `buildGroundedCoachPrompt`'s output, (c) a materials-upload/coach
  chat panel UI, (d) persisting a team's `CoachMaterial`s.
  PR: [#98](https://github.com/debate/debate-ai.com/pull/98).
- **Group Challenges — squad-scoped friendly-challenge progress-tracking slice.**
  `packages/debate-card-search/src/lib/group-challenges.ts` adds a
  `GroupChallenge` model supporting two goal kinds — `contribution_target`
  (e.g. "the squad finds 20 solvency cards this week", reusing
  `daily-quests.ts`'s `QuestTarget` matching, exported as
  `matchesQuestTarget` for this reuse) and `win_target` (e.g. "the squad wins
  5 rebuttal exercises", from caller-supplied win events) — plus
  `computeGroupChallengeProgress` (scopes progress to the challenge's
  `[startsAt, endsAt)` window and `memberIds` roster, and ranks per-member
  standings by blended helpfulness score for contribution challenges via the
  existing `contribution-leaderboard.ts` `buildLeaderboard` — not raw count,
  so a member with fewer but higher-quality contributions can still lead —
  or by raw win count for win challenges), `buildGroupChallengeBoard`
  (incomplete challenges first, mirroring `buildDailyQuestBoard`'s
  ordering), and `buildGroupChallengeSummaryText`. Reuses
  `daily-quests.ts`/`contribution-leaderboard.ts` directly rather than
  introducing a separate matching or scoring path. Vitest-covered in
  `packages/debate-card-search/test/group-challenges.test.ts`. See the
  "Coaching Programs and Group Challenges" idea (#13) in Product Feature
  Ideas below. This is the first slice only — it's the "friendly challenges"
  half of idea #13 only; it doesn't model coaching "spaces"/rosters,
  assigned drills, research-sprint wiring, or a practice-round composition
  (the rest of idea #13), persist a challenge or its progress, notify the
  squad when a challenge completes, or render a challenge UI. Follow-ups:
  (a) a coaching-program/space model that composes this with
  `drill-generator.ts`'s `buildDrillSet`, `team-collaboration-mode.ts`'s
  `buildTopicSprint`, and `practice-round-simulator.ts`'s
  `buildPracticeRoundSetup`/`buildPracticeRoundFeedback`, (b) a
  challenge-board/creation UI in `debate-card-search`, (c) persisting
  challenges and wiring real contribution-submission/practice-round-result
  events into `computeGroupChallengeProgress` instead of caller-supplied
  data.
  PR: [#97](https://github.com/debate/debate-ai.com/pull/97).
- **Team Collaboration Mode — topic-sprint composition slice.**
  `packages/debate-card-search/src/lib/team-collaboration-mode.ts` adds
  `buildTopicSprint`/`buildTopicSprintSummaryText`, composing the existing
  "Daily Quests and Targets" board (`daily-quests.ts`'s
  `buildDailyQuestBoard`), "Research Task Routing" result
  (`research-task-routing.ts`'s `buildRoutingResult`), and "Research
  Progress Tracking" board (`research-progress.ts`'s
  `buildResearchProgressBoard`) into one shared, topic-scoped session (a
  "Topic Sprint"), plus a topic-addressed `SprintNote` model
  (`createSprintNote`/`updateSprintNoteStatus`/`assignSprintNote`/
  `getNotesForTopic`/`getNotesAssignedTo`/`getOpenFollowUps`) mirroring
  `debate-round`'s `strategy-sync-notes.ts` `PrepNote` lifecycle
  (open/covered/needs-follow-up, assignable as a task) — this package has no
  dependency on `debate-round`, so the box-addressed convention is mirrored
  locally with a topic in place of a flow box rather than introducing a
  separate note-status scheme. Reuses `daily-quests.ts`,
  `research-task-routing.ts`, and `research-progress.ts` directly rather
  than introducing a separate quest/assignment/progress signal.
  Vitest-covered (100% statement/branch/function/line coverage) in
  `packages/debate-card-search/test/team-collaboration-mode.test.ts`. See
  the "Team Collaboration Mode" bullet under Research Crowdsourcing
  Organizer Features below. This is the first slice only — it works
  entirely off caller-supplied quests/contributions/coverage
  reports/contributor availability/assignments/notes; it doesn't persist a
  sprint or its notes, track live/presence status for who's currently
  online, or render a collaboration-mode UI. Follow-ups: (a) persisting
  `SprintNote`s and a topic sprint's inputs (quest templates, contributor
  availability) somewhere, (b) a collaboration-mode panel UI that renders
  `buildTopicSprint`/`buildTopicSprintSummaryText` and calls
  `createSprintNote`/`updateSprintNoteStatus`/`assignSprintNote`, (c) a
  presence/live-status signal for who's currently active in the sprint.
  PR: [#96](https://github.com/debate/debate-ai.com/pull/96).
- **Team Brainstorm Assist — squad brainstorm prompt/board slice.**
  `packages/debate-card-search/src/lib/team-brainstorm-assist.ts` adds
  `buildBrainstormPrompt` (a structured, non-AI-calling brainstorm prompt for
  one argument block across four categories — `argument`, `impact_framing`,
  `frontline`, `response`), `buildBrainstormPromptsForCoverageGaps` (seeds
  prompts straight from the existing Topic Coverage Dashboard's
  `getUnderCoveredArguments`, worst-covered argument first), a squad idea
  board model (`groupIdeasByBoard`, `rankBrainstormIdeas` — reusing the
  existing `community-rating.ts` `scorePopularitySignal` for ranking and the
  existing `llm-card-scoring.ts` `scoreUniqueness` heuristic to flag
  near-duplicate submissions, `buildBrainstormBoard`,
  `buildBrainstormBoardsForCoverageGaps`), and `buildBrainstormSummaryText`.
  Reuses `topic-coverage.ts`, `community-rating.ts`, and `llm-card-scoring.ts`
  directly rather than introducing a separate coverage, popularity, or
  duplicate-detection signal. Vitest-covered (100% statement/branch/
  function/line coverage) in
  `packages/debate-card-search/test/team-brainstorm-assist.test.ts`. See the
  "Team Brainstorm Assist" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it doesn't call any AI
  model to actually generate ideas, persist a board or its submitted ideas,
  or render a brainstorm panel UI. Follow-ups: (a) an actual AI-generation
  call that consumes `buildBrainstormPrompt`'s output to draft candidate
  ideas for the squad to react to instead of starting from a blank board,
  (b) a brainstorm-panel UI in `debate-card-search` that renders
  `buildBrainstormBoard`/`buildBrainstormSummaryText` and lets teammates
  submit/upvote ideas live, (c) persisting submitted ideas and their votes.
  PR: [#95](https://github.com/debate/debate-ai.com/pull/95).
- **Practice Round Simulator — setup/post-round-feedback composition slice.**
  `packages/debate-round/src/round/practice-round-simulator.ts` adds
  `buildPracticeRoundSetup`/`buildPracticeRoundSetupText` (combines idea #3's
  `buildAiVersusSpeechOrder` speech order, `debate-speech-writer`'s
  `judgeParadigms` registry, and its `opponentPersonas` registry into one
  renderable practice-round setup document — accepting either a built-in
  paradigm/persona id or a pre-built one, e.g. from
  `buildCustomJudgeParadigm`) and `buildPracticeRoundFeedback`/
  `buildPracticeRoundFeedbackText` (frames post-round feedback around the
  selected judge paradigm's voting priorities — or its description when it
  has none, as with a custom paradigm — followed by the existing AI Coach
  Mode `buildCoachingSession`/`buildCoachingSummaryText`). Reuses
  `ai-versus-speech-order.ts`, `judge-paradigms.ts`, `opponent-personas.ts`,
  and `coach-mode.ts` directly rather than reimplementing any of that
  speech-order/paradigm/persona/coaching logic. Vitest-covered in
  `packages/debate-round/test/practice-round-simulator.test.ts`. See the
  "Practice Round Simulator" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it doesn't call any AI
  model to actually generate the AI opponent's speeches or a judge decision,
  isn't wired into any round-simulator UI, and doesn't persist a practice
  round anywhere. This repo has no `lint` script configured (only
  `typecheck`/`test`/`build` via turbo), so there was no lint step to run.
  Follow-ups: (a) an actual AI speech-generation call for the AI opponent's
  speeches (consuming idea #3's `buildAiResponseRequest` alongside the
  chosen `opponentPersona`) and an AI judge-decision call under the chosen
  paradigm, (b) a round-simulator UI in `debate-round` that renders
  `buildPracticeRoundSetupText` for setup and `buildPracticeRoundFeedbackText`
  after the round, (c) persisting a simulated practice round (setup,
  submitted speeches, and feedback) once round-state persistence exists.
  PR: [#94](https://github.com/debate/debate-ai.com/pull/94).
- **AI Coach Mode — extension/refutation/collapse/weighing coaching-prompt slice.**
  `packages/debate-round/src/flow/coach-mode.ts` adds
  `buildExtensionPrompts` (unanswered rows whose last flowed entry is on the
  caller's own side — their last word stands, so extend it as
  dropped/conceded), `buildRefutationPrompts` (unanswered rows whose last
  flowed entry is on the opposing side — must be answered before it's
  extended against the caller), `buildCollapsePrompts` (a thin remap of the
  existing `drill-generator.ts` `buildCollapseDrills`), `buildWeighingGuidance`
  (a whole-round weighing prompt comparing the caller's side against every
  other side via `response-outcome.ts`'s `summarizeOutcomeBySide` — ahead on
  both unanswered count and average vulnerability is framed as "weigh on your
  uncontested offense", behind on either is framed as a warning to shore up
  the case first), `buildCoachingSession` (combines all four, refutation
  first since live threats need an answer before anything else), and
  `buildCoachingSummaryText`. Reuses `flow-transcript-summary.ts`,
  `response-outcome.ts`, `argument-tree.ts`'s `getSpeechSideKey`, and
  `drill-generator.ts`'s `buildCollapseDrills` directly rather than
  reimplementing any of that vulnerability/side-classification logic.
  Vitest-covered in `packages/debate-round/test/coach-mode.test.ts`. See the
  "AI Coach Mode" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it's a deterministic template layer
  over the flow's existing clash/vulnerability signals (the same heuristic
  `response-outcome.ts` and `drill-generator.ts` already use), not an actual
  AI-generated coaching call; it isn't wired into any coaching-panel UI, and
  generated sessions aren't persisted anywhere. This repo has no `lint`
  script configured (only `typecheck`/`test`/`build` via turbo), so there was
  no lint step to run. Follow-ups: (a) an actual AI coaching call (live or
  post-round) that consumes the same flow signals for open-ended feedback
  beyond this template layer, (b) a coaching-panel UI in `debate-round` that
  renders `buildCoachingSession`/`buildCoachingSummaryText`, (c) persisting a
  generated coaching session per round.
  PR: [#92](https://github.com/debate/debate-ai.com/pull/92).
- **Strategy Sync Notes — box-addressed prep-note/task-assignment/status slice.**
  `packages/debate-round/src/flow/strategy-sync-notes.ts` adds a `PrepNote`
  data model addressed to a specific flow `Box` the same way
  `flow-annotations.ts` already addresses boxes (`boxPath`/`boxFromPath`):
  `createPrepNote` (validates a non-empty `boxPath`, an `authorId`, and
  non-blank, length-clamped `text`, starting in the `open` status),
  `updateNoteStatus` (moves a note between `open`/`covered`/
  `needs-follow-up`), `assignNote` (assigns — or unassigns, passing `null`
  — a note to a teammate as a task), `getNotesForBox`/`getNotesForFlow`/
  `getNotesAssignedTo`/`getOpenFollowUps` (oldest-first query helpers, so
  the longest-open follow-up surfaces first), `resolvePrepNoteBox` (mirrors
  `resolveAnnotationBox` for a "jump to argument" link), and
  `buildPrepNoteSummaryText` (a status-count line plus one line per open
  follow-up, with its assignee if any). Mirrors `flow-annotations.ts`'s
  box-addressing convention exactly rather than introducing a separate
  argument-addressing scheme. Vitest-covered in
  `packages/debate-round/test/strategy-sync-notes.test.ts`. See the
  "Strategy Sync Notes" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it's pure data-model/query
  logic over caller-supplied notes; nothing in this repo persists a
  `PrepNote`, notifies an assignee when a task is assigned, or renders a
  prep-notes panel UI yet. Follow-ups: (a) wiring `PrepNote` into wherever
  round/flow state is eventually persisted, (b) a prep-notes panel UI in
  `debate-round` (likely alongside `FlowSpreadsheet`) that renders
  `getNotesForFlow`/`buildPrepNoteSummaryText` and calls
  `createPrepNote`/`updateNoteStatus`/`assignNote`, (c) an assignee
  notification once a notification system exists in this repo.
  PR: TBD.
- **Scout-to-Strategy Workflow — case-choice/judge-adaptation/risk-level recommendation slice.**
  `packages/debate-round/src/round/scout-to-strategy.ts` adds
  `computeCaseOverlapScore`/`rankCaseOptions` (ranks caller-supplied case
  options by tag overlap against the opponent's existing `OpponentTeamProfile`
  `topArgumentTags` — a heuristic proxy for "the opponent likely has blocks
  prepped against this" — safest/lowest-overlap first, tie-broken
  alphabetically), `buildJudgeAdaptationNotes` (turns an existing
  `JudgeProfile`'s speed tolerance, theory receptiveness, side bias, and
  most-tagged paradigm into concrete adaptation notes, with explicit
  fallback text when there's no judge data or no notable tendencies),
  `assessMatchupRisk` (combines opponent win rate/side preference and judge
  side bias into a `low`/`medium`/`high` risk level plus the specific
  factors behind it — one risk factor is `medium`, two or more is `high`),
  and `buildStrategyRecommendation`/`buildStrategyRecommendationText`
  (compose all of the above into one renderable recommendation). Mirrors the
  existing `pre-round-briefing.ts` pattern in the same package and reuses
  the existing `OpponentTeamProfile` (`debate-data-sync`)/`JudgeProfile`
  (`debate-speech-writer`) types directly rather than introducing new ones.
  Vitest-covered (100% statement/branch/function/line coverage) in
  `packages/debate-round/test/scout-to-strategy.test.ts`. See the
  "Scout-to-Strategy Workflow" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — the risk/case-overlap
  heuristics are illustrative, not a validated strategic model; it doesn't
  know which side the opponent will be on this round (no `ourSide`/opponent
  side input is wired into the risk heuristic yet), it doesn't call any AI
  model to evaluate case choice, and it isn't wired into any strategy-panel
  UI yet. This repo has no `lint` script configured (only
  `typecheck`/`test`/`build` via turbo), so there was no lint step to run.
  Follow-ups: (a) a case-choice/strategy panel UI in `debate-round` that
  renders `buildStrategyRecommendation`/`buildStrategyRecommendationText`,
  (b) wiring `ourSide`/likely opponent side into the risk heuristic once
  round-setup state exposes it, (c) an actual AI-panel evaluation of case
  choice instead of the tag-overlap heuristic.
  PR: [#90](https://github.com/debate/debate-ai.com/pull/90).
- **AI Practice Opponent — policy-heavy/kritik/lay/fast-flow persona registry slice.**
  `packages/debate-speech-writer/src/opponent/opponent-personas.ts` adds a
  `opponentPersonas` registry of four built-in styles (`policy-heavy`,
  `kritik`, `lay`, `fast-flow`), each with a name/description, pace, ordered
  `preferredArguments`, and imperative `instructions`, plus
  `getOpponentPersona`/`listOpponentPersonas` lookups and
  `buildOpponentPersonaPrompt` for composing a self-contained prompt section.
  Mirrors the existing `judge-paradigms.ts` registry shape exactly rather
  than introducing a separate persona-definition pattern. Vitest-covered
  (100% statement/branch/function/line coverage) in
  `packages/debate-speech-writer/test/opponent-personas.test.ts`. See the "AI
  Practice Opponent" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it doesn't call any AI model, isn't
  wired into idea #3's `buildAiResponseRequest`/`AiSpeechRequest` (which
  lives in `debate-round` and can't import from `debate-speech-writer`
  without inverting the existing dependency direction), and isn't rendered
  in any persona-picker UI. Follow-ups: (a) an actual AI speech-generation
  call that consumes `buildOpponentPersonaPrompt`'s output alongside idea
  #3's `AiSpeechRequest` to produce a persona-styled opponent speech, (b) a
  persona-picker UI for selecting an opponent style before starting an
  AI-versus practice round. (c), persisting the selected persona per
  practice session, is now done — see "Opponent Persona Selection
  Persistence" above.
  PR: TBD.
- **AI Drill Generator — overview/frontline/cross-ex/collapse drill slice.**
  `packages/debate-round/src/flow/drill-generator.ts` adds `buildOverviewDrill`
  (a whole-round overview prompt weighing every side's unanswered-argument
  count and average vulnerability), `buildFrontlineDrills` (a
  frontline-practice prompt per still-live opposing argument), `buildCrossExamDrills`
  (wraps the existing `flow-transcript-summary.ts` `suggestCrossExamQuestions`
  as tagged drills), `buildCollapseDrills` (recommends the opposing side's
  top-N most vulnerable arguments, via the existing `response-outcome.ts`
  `getArgumentVulnerabilityReport`, as collapse-scenario candidates),
  `buildDrillSet` (combines all four in order for a chosen side), and
  `buildDrillSummaryText`. Reuses the existing `flow-transcript-summary.ts`
  and `response-outcome.ts` slices directly rather than introducing a
  separate scoring or template path. Vitest-covered (100% statement/branch/
  function/line coverage) in
  `packages/debate-round/test/drill-generator.test.ts`. See the "AI Drill
  Generator" bullet under Research Crowdsourcing Organizer Features below.
  This is the first slice only — it's a deterministic template layer over
  the flow's existing clash/vulnerability signals, not an actual AI-generated
  drill script; it isn't wired into any drill-panel UI, and generated drills
  aren't persisted anywhere. Follow-ups: (a) an actual drill-panel UI in
  `debate-round` that renders `buildDrillSet`/`buildDrillSummaryText`, (b) an
  AI-generated (rather than templated) overview/frontline script once an LLM
  call is wired in, (c) persisting generated drills per round/practice
  session.
  PR: [#88](https://github.com/debate/debate-ai.com/pull/88).
- **Common Argument Library — topic-folder/case-area/tag-collection organizing slice.**
  `packages/debate-card-search/src/lib/argument-library.ts` adds
  `groupCardsByTopic`, `groupCardsByCaseArea`, `buildTopicFolder` (splits one
  topic's cards into case-area subgroups), `buildTopicFolders` (a folder for
  every topic represented), `buildTagCollections` (a cross-cutting
  collection for every distinct tag, with multi-tag cards appearing under
  each of their tags), `filterCardsByTags` (any/all tag matching),
  `buildArgumentLibrary`, and `buildLibrarySummaryText`. Extends the
  existing "Topic Coverage Dashboard" slice's `argBlock`-tagged
  `CoverageCardSummary` card model with `topic`/`caseArea`/`tags` rather than
  introducing a separate card shape. Vitest-covered in
  `packages/debate-card-search/test/argument-library.test.ts`. See the
  "Common Argument Library" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off a
  caller-supplied, already-tagged card list; it doesn't read real submitted
  cards, persist a library's structure, or render a folder/collection
  browser UI. Follow-ups: (a) wiring a `topic`/`caseArea`/`tags` field into
  wherever submitted cards are eventually persisted, (b) a folder/collection
  browser UI in `debate-card-search` that renders `buildArgumentLibrary`'s
  topic folders and tag collections, (c) a tag-autocomplete/tag-management
  affordance so contributors pick from existing tags instead of free typing.
  PR: TBD.

- **Gamified Quests — streak tracking and milestone-badge slice.**
  `packages/debate-card-search/src/lib/gamified-quests.ts` adds
  `computeDailyMissionResult` (derives whether a day's `daily-quests.ts`
  `QuestProgress` board was fully completed), `computeStreakStatus`
  (current streak walking backward from a caller-supplied "as of" UTC day
  key, plus the longest streak found anywhere in the supplied history),
  `getEarnedStreakBadges` (milestone badges — 3/7/14/30-day streaks by
  default — earned at a given streak length), `buildContributorQuestStreak`,
  and `buildStreakSummaryText`. Reuses `daily-quests.ts`'s `QuestProgress`
  board directly as the per-day completion signal rather than introducing a
  separate mission-tracking data model. Vitest-covered in
  `packages/debate-card-search/test/gamified-quests.test.ts`. See the
  "Gamified Quests" bullet under Research Crowdsourcing Organizer Features
  below — the "Daily Quests and Targets", "Progress Unlocks", and "Revision
  Incentives" slices all named this as a follow-up. This is the first slice
  only — it works entirely off caller-supplied daily mission-completion
  history; it doesn't wire in real contribution-submission events, persist a
  contributor's streak/badges anywhere, or render a streak/badge UI.
  Follow-ups: (a) wiring the existing `daily-quests.ts` board (fed by real
  persisted daily contributions) into `computeDailyMissionResult` per
  contributor per day instead of caller-supplied results, (b) a streak/badge
  widget UI that renders `buildContributorQuestStreak`/
  `buildStreakSummaryText` alongside the quest board, (c) surfacing earned
  streak badges on a contributor's `progress-unlocks.ts` unlock status
  alongside their tier badges.
  PR: TBD.

- **Daily Quests and Targets — per-day quest progress tracking slice.**
  `packages/debate-card-search/src/lib/daily-quests.ts` adds
  `computeQuestProgress` (tallies a day's contributions matching a quest's
  kind/argument-block target against its target count),
  `buildDailyQuestBoard` (progress for every quest on the UTC calendar day
  of a caller-supplied `now`, incomplete quests first), `buildQuestBoardSummaryText`,
  and `buildUnderCoveredArgumentQuests` (turns the existing "Topic Coverage
  Dashboard" slice's `getUnderCoveredArguments` output into a ready-made
  "find N more cards for X" quest per under-covered tracked argument).
  Reuses `topic-coverage.ts`'s coverage classification and
  `daily-best-card.ts`'s `getUtcDayKey` directly rather than introducing a
  separate under-coverage or day-scoping signal. Vitest-covered in
  `packages/debate-card-search/test/daily-quests.test.ts`. See the "Daily
  Quests and Targets" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off
  caller-supplied quest templates and contributions; it doesn't track
  streaks (a separate "Gamified Quests" idea), persist quest completion
  anywhere, or render a quest board UI. Follow-ups: (a) wiring real
  contribution-submission events into a persisted daily contribution feed
  instead of caller-supplied data, (b) a quest-board widget UI that renders
  `buildDailyQuestBoard`/`buildQuestBoardSummaryText`, (c) a streak/reward
  layer on top of quest completion once the "Gamified Quests" idea's own
  first slice exists.
  PR: [#84](https://github.com/debate/debate-ai.com/pull/84).

- **LLM Card Scoring — deterministic heuristic scoring slice.**
  `packages/debate-card-search/src/lib/llm-card-scoring.ts` adds
  `scoreRelevance` (keyword/phrase overlap against a card's argument
  block), `scoreClarity` (average-sentence-length balance), `scoreUniqueness`
  (Jaccard token similarity against the rest of the corpus), `scoreEvidenceQuality`
  (a direct alias of the existing idea #11 `community-rating.ts`
  `scoreQualitySignal`), `scoreUsability` (word-count target band),
  `computeCardScoreBreakdown` (blends all five into a weighted overall
  score and flags likely duplicates), `rankCardScores`, and
  `buildCardScoreSummaryText`. Reuses `scoreQualitySignal` directly rather
  than introducing a separate quality-scoring path. Vitest-covered in
  `packages/debate-card-search/test/llm-card-scoring.test.ts`. See the "LLM
  Card Scoring" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it's a deterministic heuristic
  stand-in for an eventual LLM call, not the LLM call itself; it doesn't
  call any model, persist scores, or render a scoring UI. Follow-ups: (a)
  an actual LLM-scoring call for the more subjective dimensions (clarity,
  usability) that a heuristic can only roughly proxy, (b) wiring real
  argument-block keywords and a real submitted-card corpus into the
  scorer instead of caller-supplied data, (c) a scoring/duplicate-flag
  panel UI in `debate-card-search` that renders `rankCardScores` and
  surfaces `isLikelyDuplicate` cards for moderator review.

- **Research Progress Tracking — per-contributor topic/task/contribution progress slice.**
  `packages/debate-card-search/src/lib/research-progress.ts` adds
  `buildContributorProgress` (combines a contributor's existing
  `contribution-leaderboard.ts` `ContributorStats` with per-topic task
  completion derived from a caller-supplied, topic-tagged
  `research-task-routing.ts` `RoutedAssignment` list), `buildTopicProgress`
  (assigned/completed counts and a completion rate for one topic),
  `groupAssignmentsByContributor`, `buildResearchProgressBoard` (a full,
  roster-sorted board across every contributor found in either the
  contribution or assignment lists), and `buildProgressSummaryText`. Reuses
  the existing `ContributorStats`/`RoutedAssignment` types directly rather
  than introducing a separate scoring or assignment path. Vitest-covered in
  `packages/debate-card-search/test/research-progress.test.ts`. See the
  "Research Progress Tracking" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off
  caller-supplied contributions and a caller-supplied, topic-tagged
  assignment list with a caller-supplied completion timestamp; it doesn't
  track task completion itself (no task system exists in this repo today),
  persist a contributor's progress, or render a progress-tracking UI.
  Follow-ups: (a) wiring real `completedAt` events into a persisted
  assignment/completion history, (b) a progress dashboard/roster UI that
  renders `buildResearchProgressBoard`/`buildProgressSummaryText`, (c)
  feeding a contributor's actual topic-progress history back into
  `progress-unlocks.ts`'s tier computation instead of raw leaderboard stats
  alone.

- **Progress Unlocks — contributor tier/skill/badge scoring slice.**
  `packages/debate-card-search/src/lib/progress-unlocks.ts` adds
  `computeContributorTier` (maps the existing `contribution-leaderboard.ts`
  `ContributorStats` — contribution count and total helpfulness score — to
  an unlock tier: `novice` → `apprentice` → `veteran` → `expert`, gated on
  clearing both a volume and a quality threshold per tier),
  `getUnlockedSkillLevel` (maps a tier to the `research-task-routing.ts`
  `SkillLevel` it grants for taking on routed research tasks — `novice`
  through `veteran` unlock `novice`/`intermediate`, `expert` unlocks
  `advanced`), `getUnlockedBadges` (every badge earned on the way to a
  tier, cumulative), and `buildContributorUnlockStatus`/
  `buildUnlockStatusText` (combine tier, unlocked skill level, badges, and
  progress toward the next tier into a renderable status). Reuses the
  existing `ContributorStats`/`SkillLevel` types directly rather than
  introducing a separate scoring or skill-tagging path. Vitest-covered in
  `packages/debate-card-search/test/progress-unlocks.test.ts`. See the
  "Progress Unlocks" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it works entirely off a
  caller-supplied `ContributorStats`; it doesn't persist a contributor's
  tier/badges, gate any actual UI or task list, or feed the derived
  `SkillLevel` into `research-task-routing.ts`'s `ContributorAvailability`
  itself. Follow-ups: (a) persisting a contributor's tier/badges, (b) a
  progress/unlock UI that renders `buildUnlockStatusText`/
  `buildContributorUnlockStatus`, (c) feeding `getUnlockedSkillLevel` into
  `research-task-routing.ts`'s `ContributorAvailability.skillLevel` instead
  of a caller-supplied value.
  PR: [#80](https://github.com/debate/debate-ai.com/pull/80).
- **Revision Incentives — card-revision reward scoring slice.**
  `packages/debate-card-search/src/lib/revision-incentives.ts` adds
  `evaluateRevision` (scores a before/after card snapshot pair — reusing the
  existing idea #11 `community-rating.ts` `scoreQualitySignal` to measure
  quality gain, doubling the quality-point reward when the card was weak
  beforehand, plus flat bonuses for a meaningful citation-completeness gain
  or citing newer evidence than the prior snapshot), `groupRevisionsByContributor`,
  `buildContributorRevisionStats` (per-contributor revision count, rewarded
  count, total reward points, and weak-cards-improved count), `buildRevisionIncentiveLeaderboard`
  (ranks contributors by total reward points, tie-broken by `contributorId`),
  and `buildRevisionRewardText` (renders a one-line reward notification, or a
  no-reward line when nothing meaningful improved). Reuses the existing idea
  #11 quality scoring directly rather than introducing a separate quality
  metric. Vitest-covered in
  `packages/debate-card-search/test/revision-incentives.test.ts`. See the
  "Revision Incentives" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off
  caller-supplied before/after card snapshots; it doesn't track card
  revision history itself (no such history exists in this repo today),
  persist reward points, or render an incentives UI. Follow-ups: (a) wiring
  actual card-edit events into a persisted `CardRevision` history, (b) a
  reward-notification/incentives-leaderboard UI in `debate-card-search`
  that renders `buildRevisionRewardText`/`buildRevisionIncentiveLeaderboard`,
  (c) an actual "outdated evidence" staleness signal (e.g. flagging cards
  whose `evidenceYear` has fallen behind a topic's current cycle) instead of
  only rewarding a refresh after the fact.
  PR: [#79](https://github.com/debate/debate-ai.com/pull/79).
- **Research Task Routing — coverage-gap-to-contributor routing slice.**
  `packages/debate-card-search/src/lib/research-task-routing.ts` adds
  `buildTaskQueue` (turns a topic-coverage report's under-covered arguments
  — via the existing `topic-coverage.ts` `getUnderCoveredArguments` — into a
  queue of research tasks, most urgent first, each tagged with a required
  skill level: `missing` arguments need at least `intermediate` skill to
  build coverage from scratch, `thin` arguments are open to any skill
  level), `routeTasks` (assigns the queue to caller-supplied contributors,
  gating each task by required skill and remaining capacity, and routing to
  whichever eligible contributor currently has the fewest active tasks —
  updated as assignments happen within the same call — tie-broken by
  `contributorId`, leaving a task in `unassignedTasks` rather than dropping
  it when nobody qualifies or has capacity), `buildRoutingResult` (a
  build-then-route convenience wrapper), and `buildRoutingSummaryText`
  (renders one line per assignment plus an unassigned-count line for a
  task-assignment view). Reuses the existing "Topic Coverage Dashboard"
  slice directly rather than introducing a separate gap-detection path.
  Vitest-covered in
  `packages/debate-card-search/test/research-task-routing.test.ts`. A third
  slice, `contributorAvailability.ts` (see Tracker Status above, "Research
  Task Routing — persisted contributor-availability profiles"), now
  persists a contributor's `ContributorAvailability` to localStorage. See
  the "Research Task Routing" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off a
  caller-supplied `TopicCoverageReport` and a caller-supplied contributor
  list; it doesn't track contributors' skill levels or active task counts
  itself (neither exists in this repo today), and it isn't wired into any
  task-assignment UI yet. Follow-ups: (a) a persisted contributor profile
  (skill level, active task count) and a persisted task queue, neither of
  which exist in this repo today, (b) a task-assignment/inbox UI in
  `debate-card-search` that renders `buildRoutingSummaryText`/assignments
  and lets a contributor accept or complete a routed task, (c) an
  actual-skill-level signal (e.g. derived from the `Contribution
  Leaderboard`/`community-rating.ts` history) instead of a caller-supplied
  `skillLevel`.
  PR: [#78](https://github.com/debate/debate-ai.com/pull/78).
- **Top Contributor Awards — per-category award selection slice.**
  `packages/debate-card-search/src/lib/contributor-awards.ts` adds
  `groupContributionsByKind` (groups caller-supplied, contributor-attributed
  contributions by their `ContributionKind`), `buildCategoryLeaderboard` (a
  thin wrapper over the existing `contribution-leaderboard.ts`
  `buildLeaderboard` for one kind's contributions), `buildTopContributorAwards`
  (selects one category winner per `ContributionKind` present in the input —
  the contributor with the highest total helpfulness score for that kind,
  tie-broken by `contributorId` — in a stable `card`/`summary`/`highlight`/
  `annotation` order, omitting kinds with no contributions), and
  `buildAwardsAnnouncementText` (renders one human-readable announcement
  line per award for a banner or notification). Reuses the existing idea
  #11 `community-rating.ts` helpfulness scoring via `contribution-leaderboard.ts`
  rather than introducing a separate scoring path. Vitest-covered in
  `packages/debate-card-search/test/contributor-awards.test.ts`. See the
  "Top Contributor Awards" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — the only award categories
  it can produce today are the ones `ContributionKind` already distinguishes
  ("card" → Best Evidence Finder, "summary" → Best Explainer, plus
  "highlight" and "annotation"); it doesn't have a distinct kind for
  "original argument" or "refutation" contributions (neither exists in this
  repo today), and it doesn't persist, schedule, or render an awards
  announcement. Follow-ups: (a) a finer-grained `ContributionKind` (or
  separate tag) for "original argument"/"refutation" contributions, (b) a
  scheduled job that periodically calls `buildTopContributorAwards` and
  persists/announces the winners, (c) an awards UI in `debate-card-search`
  that renders `buildAwardsAnnouncementText`.
  PR: [#77](https://github.com/debate/debate-ai.com/pull/77).
- **Top Contributor Awards — awards UI panel.**
  `packages/debate-card-search/src/panels/ContributorAwardsPanel.tsx` adds a
  full-page React panel rendering one card per `ContributionKind` category
  present among persisted contributions — the winning contributor, their
  contribution count, and their total helpfulness score for that category —
  reusing `buildTopContributorAwards` directly (no new scoring/grouping
  logic). It's mounted at `/cards/awards`
  (`apps/debate-ai.com/app/cards/awards/page.tsx`, with a back-link to
  `/cards`, following the existing panel-page convention) and reachable from
  the global nav dock's Settings menu ("Contributor Awards", via a new
  `Medal`-icon `DropdownMenuItem` in `CategoryDock.tsx`). Adds one new
  composing function, `buildTopContributorAwardsFromStore`
  (`packages/debate-card-search/src/state/contributions.ts`), which runs
  `buildTopContributorAwards` directly against every persisted contribution
  in `state/contributions.ts` rather than requiring a caller-supplied
  contribution list, mirroring that file's existing
  `buildPersistedLeaderboard`/`buildPersistedContributionFeed` "compose the
  pure function directly against the persisted store" convention. This
  closes follow-up (c) named under the "Top Contributor Awards" bullet in
  Research Crowdsourcing Organizer Features below. Follow-ups (a) a
  finer-grained kind/tag for "original argument"/"refutation" contributions
  and (b) a scheduled announce job remain open — neither is started.
  Vitest-covered in `packages/debate-card-search/test/contributions.test.ts`.
  Documented in `docs/features/contributor-awards.md`.
- **Topic Coverage Dashboard — per-argument coverage aggregation slice.**
  `packages/debate-card-search/src/lib/topic-coverage.ts` adds
  `groupCardsByArgument` (groups caller-supplied cards by their `argBlock`),
  `computeArgumentCoverage` (classifies one argument block as `missing`
  (zero cards), `thin` (below configurable card-count/word-count
  thresholds), or `covered`), `buildTopicCoverageReport` (builds coverage
  for every argument in a caller-supplied tracked list — even ones with
  zero submitted cards — plus a separate `untracked` list for any argument
  block cards were filed under that isn't on the tracked list, so an
  unplanned-but-covered argument or a typo'd block name isn't silently
  dropped), `getUnderCoveredArguments` (the tracked arguments still needing
  work, worst-covered first), and `buildTopicCoverageSummaryText` (a short
  dashboard-header summary line). Vitest-covered in
  `packages/debate-card-search/test/topic-coverage.test.ts`. See the "Topic
  Coverage Dashboard" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off a
  caller-supplied card list and a caller-supplied tracked-argument list; it
  doesn't read real submitted cards or a topic's argument checklist from
  anywhere (neither exists in this repo today), and it isn't wired into any
  dashboard UI yet. Follow-ups: (a) an `argBlock`/word-count field wired
  into wherever submitted cards are eventually persisted, (b) a
  team-editable tracked-argument checklist per topic (no topic/checklist
  schema exists in this repo today), (c) a coverage dashboard UI in
  `debate-card-search` that renders `buildTopicCoverageReport`/
  `getUnderCoveredArguments`. None of these are started.
  PR: [#76](https://github.com/debate/debate-ai.com/pull/76).
- **Daily Best Card Challenge — daily-winner selection slice.**
  `packages/debate-card-search/src/lib/daily-best-card.ts` adds
  `groupCardsByDay` (groups caller-supplied, timestamped card contributions
  by their UTC calendar day of submission), `pickBestCardOfDay` (scores a
  single day's cards via the existing `community-rating.ts`
  `computeHelpfulnessBreakdown` and returns the single highest-helpfulness
  card, tie-broken by id), `buildDailyBestCards` (batch-builds one winner
  per represented day, sorted ascending), `getBestCardForDay` (a
  caller-supplied-`now` convenience wrapper for "today's" winner, or `null`
  if nothing was submitted that day), and `buildDailyBestCardHighlight`
  (renders a short highlight line for a challenge banner/widget). A card's
  community "vote" reuses the existing likes/saves signal already scored by
  `computeHelpfulnessBreakdown` rather than introducing a separate voting
  mechanism. Vitest-covered in
  `packages/debate-card-search/test/daily-best-card.test.ts`. See the
  "Daily Best Card Challenge" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off
  already-collected, caller-supplied contributions; it doesn't track
  submission timestamps itself, persist a day's winner, or render a
  challenge banner/widget UI. Follow-ups: (a) wiring a `submittedAt`
  timestamp into wherever card contributions are eventually persisted, (b)
  a scheduled job or view that calls `getBestCardForDay`/`buildDailyBestCards`
  and persists/announces the day's winner, (c) a challenge banner/widget UI
  in `debate-card-search` that renders `buildDailyBestCardHighlight`. None
  of these are started.
  PR: [#74](https://github.com/debate/debate-ai.com/pull/74).
- **Peer Review System — card review lifecycle slice.**
  `packages/debate-card-search/src/lib/peer-review.ts` adds a `CardReview`
  state machine (`draft` → `in_review` → `changes_requested`/`approved`/
  `rejected` → `published`) plus a reviewer-comment thread on top of it:
  `createCardReview`, `submitForReview`, `requestChanges`, `approveReview`,
  `rejectReview`, and `publishReview` enforce only the documented legal
  transitions (throwing `InvalidReviewTransitionError` otherwise), while
  `addReviewComment` (auto-moves an in-review card to `changes_requested`
  when a `blocking`-severity comment is posted), `resolveReviewComment`,
  `getUnresolvedBlockingComments`, and `isReadyToPublish` model the
  comment thread — `approveReview` throws `UnresolvedBlockingCommentsError`
  if any blocking comment is still unresolved, so approval can't skip past
  requested changes. `buildReviewSummary` renders a short status/comment-count
  string for a review-queue or card-detail panel. Vitest-covered in
  `packages/debate-card-search/test/peer-review.test.ts`. See the "Peer
  Review System" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it's pure state-transition logic
  over a caller-supplied `CardReview`; nothing in this repo persists a
  review, notifies reviewers, or renders a review-queue/comment-thread UI
  yet. Follow-ups: (a) wiring `CardReview`/`ReviewComment` into wherever
  submitted cards are eventually persisted, (b) a review-queue and
  comment-thread UI in `debate-card-search` that calls
  `submitForReview`/`addReviewComment`/`approveReview`/etc., (c) reviewer
  identity/permission checks (e.g. only assigned reviewers can approve)
  once an auth/roles system exists.
  PR: [#73](https://github.com/debate/debate-ai.com/pull/73).
- **Contribution Leaderboard — per-contributor ranking slice.**
  `packages/debate-card-search/src/lib/contribution-leaderboard.ts` adds
  `groupContributionsByContributor` (groups a flat list of
  contributor-attributed contributions by `contributorId`, preserving
  order), `buildContributorStats` (aggregates one contributor's scored
  contributions into a contribution count, total/average helpfulness
  score, their single best contribution, and a count of their
  popularity-only-outlier contributions), and `buildLeaderboard` (groups,
  scores, and ranks every contributor by total helpfulness score
  descending — so a contributor with several well-received contributions
  outranks a single viral hit — tie-broken by `contributorId`). This
  builds directly on the existing idea #11 `community-rating.ts`
  helpfulness-scoring slice (`computeHelpfulnessBreakdown`) rather than
  duplicating its scoring logic. Vitest-covered in
  `packages/debate-card-search/test/contribution-leaderboard.test.ts`. See
  the "Contribution Leaderboard" bullet under Research Crowdsourcing
  Organizer Features below. This is the first slice only — it aggregates
  whatever contributor-attributed contributions the caller passes in; it
  doesn't track "most completed tasks" (no task system exists in this
  repo today), persist standings, or render a leaderboard UI. Follow-ups:
  (a) a `contributorId` field and query wired into wherever
  `CommunityContribution`s are eventually persisted, (b) a "completed
  tasks" signal once a research-task system (see the "Research Task
  Routing"/"Daily Quests and Targets" ideas below) exists to feed it, (c)
  a leaderboard UI in `debate-card-search` that renders `buildLeaderboard`.
  PR: [#72](https://github.com/debate/debate-ai.com/pull/72).
- **Pre-Round Intelligence Panel — briefing composition slice.**
  `packages/debate-round/src/round/pre-round-briefing.ts` adds
  `buildPreRoundBriefing` (combines an already-built `OpponentTeamProfile`
  scouting summary, a `JudgeProfile` tendency summary, a head-to-head
  prior-meetings record derived from caller-supplied `OpponentRoundRecord`s,
  and free-text team prep notes into one structured briefing with a
  labeled section per signal — each missing piece renders an explicit "no
  data on file" line rather than being silently omitted),
  `summarizePriorMeetings` (tallies wins/losses from a head-to-head record
  list), and `buildPreRoundBriefingText` (renders the structured briefing
  as a single markdown-ish document). This reuses the existing
  `buildOpponentScoutingSummary` (`debate-data-sync`) and
  `buildJudgeTendencySummary` (`debate-speech-writer`) slices directly, so
  `debate-round` now depends on both packages. Vitest-covered in
  `packages/debate-round/test/pre-round-briefing.test.ts`. See idea #12
  below. This is the first slice only — it doesn't fetch live tournament
  results, prior pairings, event details, or room assignments from any
  real data source (none exist in this repo today; the caller supplies
  whichever profiles/records/notes they already have), and it isn't wired
  into any round-information page UI yet. Follow-ups: (a) real data
  sources for tournament results, pairings, event details, and room
  assignments to populate `RoundEventInfo` and the head-to-head record
  list automatically instead of relying entirely on caller-supplied data,
  (b) a briefing panel UI in `debate-round` that renders
  `buildPreRoundBriefing`/`buildPreRoundBriefingText` on a round-information
  page, (c) persisting a generated briefing (or its inputs) per round.
  PR: TBD.
- **Opponent Team Profiles — scouting-profile aggregation slice.**
  `packages/debate-data-sync/src/rankings/opponent-team-profile.ts` adds
  `buildOpponentTeamProfile` (aggregates an opposing team's caller-supplied
  round history — `OpponentRoundRecord`s — into an overall win/loss record,
  a per-side win/loss split with a `hasNotableSidePreference` flag once
  there's enough of a sample on both sides, and frequency-ranked
  `topArgumentTags`/`topCases` reflecting the arguments and case names they
  run most often), `groupRecordsByTeam` / `buildOpponentTeamProfiles`
  (batch-build profiles for every team in a flat record list),
  `getHeadToHeadRecords` (filters a record list down to rounds recorded
  specifically against a given opponent, for head-to-head lookups), and
  `buildOpponentScoutingSummary` (renders a profile as short bullet lines
  for a pre-round scouting card, explicitly reporting "unknown" rather than
  fabricating a value when tags/cases were never tracked). Vitest-covered
  in `packages/debate-data-sync/test/opponent-team-profile.test.ts`. See
  the "Opponent Team Profiles" item under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it's pure aggregation
  logic over caller-supplied round records; no scraper in this repo
  reconstructs real head-to-head/round history from Tabroom or tab-service
  ballots, and it isn't wired into any scouting-card or pre-round-briefing
  UI yet. Follow-ups: (a) a real round-history data source (e.g.
  reconstructed from Tabroom pairings/ballots) that produces
  `OpponentRoundRecord`s instead of relying entirely on caller-supplied
  data, (b) a scouting-card/panel UI that renders
  `buildOpponentScoutingSummary`, (c) persisting/looking up profiles by
  team across tournaments rather than recomputing from a full history each
  time.
  PR: TBD.
- **Judge Profiles — tendency-profile aggregation slice.**
  `packages/debate-speech-writer/src/judge/judge-profile.ts` adds
  `buildJudgeProfile` (aggregates a judge's caller-supplied ballot history —
  `JudgeRoundRecord`s — into side-vote win rates with a `hasNotableSideBias`
  flag once there's enough of a sample, average speaker points awarded per
  side, a rough `classifySpeedTolerance` pace-based delivery-speed estimate,
  a `classifyTheoryReceptiveness` theory-argument win-rate estimate, and the
  judge-paradigms.ts paradigm they were most often tagged with),
  `groupRecordsByJudge` / `buildJudgeProfiles` (batch-build profiles for
  every judge in a flat record list), and `buildJudgeTendencySummary`
  (renders a profile as short bullet lines for a pre-round briefing or
  profile card, explicitly reporting "unknown" rather than fabricating a
  value when a signal was never tracked). Vitest-covered in
  `packages/debate-speech-writer/test/judge-profile.test.ts`. See the
  "Judge Profiles" item under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it's pure aggregation logic over
  caller-supplied ballot records; no `Round`/ballot schema in this repo
  captures speaker points, delivery pace, or theory outcomes today, so it
  doesn't read or persist real ballot data, and it isn't wired into any
  judge-profile or pre-round-briefing UI yet. Follow-ups: (a) a real ballot
  data source (e.g. reconstructed from Tabroom ballots) that produces
  `JudgeRoundRecord`s instead of relying entirely on caller-supplied data,
  (b) a judge-profile card/panel UI that renders `buildJudgeTendencySummary`,
  (c) persisting/looking up profiles by judge across tournaments rather than
  recomputing from a full history each time.
  PR: [#69](https://github.com/debate/debate-ai.com/pull/69).
- **Online Debate Versus AI — turn-order and speech-validation slice.**
  `packages/debate-round/src/round/ai-versus-speech-order.ts` adds
  `buildAiVersusSpeechOrder` (flattens a `debate-timer` format's
  `timerSpeeches` into an ordered turn list tagged `speaker: "user" | "ai"`
  from the user's chosen `primary`/`secondary` side), `getNextSpeechSlot` /
  `isUsersTurn` (whose turn is next given how many speeches have already
  been submitted), `validateSpeechSubmission` (checks a submitted speech
  name against the next expected slot, rejecting it when the round is
  already complete, it's the AI's turn, or the name doesn't match), and
  `buildAiResponseRequest` (a structured, non-AI-calling request object —
  the next AI slot, prior speeches to condition on, and whether it's a
  cross-examination turn — for a future prompt-builder to consume).
  Vitest-covered in
  `packages/debate-round/test/ai-versus-speech-order.test.ts`. See idea #3
  below. This is the first slice only — it's pure turn-order/state logic
  over the existing `debateStyles` format registry; it doesn't call any AI
  model, accept text/audio speech submissions, or persist round state, and
  it isn't wired into any online-versus-AI round UI yet; see follow-ups
  noted under idea #3.
  PR: TBD.
- **CX NDCA Standings — qualification points and standings computation slice.**
  `packages/debate-data-sync/src/rankings/ndca-standings.ts` adds
  `computeTournamentPoints` (scores a single tournament result from its
  outround finish, prelim-win record, and a bid-level bonus, against a
  configurable `QualificationPointsTable`), `buildTeamStanding` /
  `buildStandings` (aggregate a team's — or every team's — tournament
  results into a cumulative standing: total qualification points from its
  best N tournaments if capped, overall prelim record and best finish
  across every tournament attended), `rankStandings` (sorts standings by
  total points, tie-broken by team id), and `getQualifiedTeams` (filters
  ranked standings by a minimum-points threshold and/or a qualifier cap).
  The exported `DEFAULT_QUALIFICATION_POINTS_TABLE` is explicitly an
  illustrative default, not the real NDCA point table (which varies by
  circuit/season and isn't public data this repo has) — callers who need
  accurate qualification points should supply their own table.
  Vitest-covered in
  `packages/debate-data-sync/test/ndca-standings.test.ts`. See idea #1
  below. This is the first slice only — it's pure aggregation/ranking logic
  over caller-supplied `TournamentResult` records; it doesn't scrape or
  parse real Tabroom/NDCA results into that shape (the existing
  `sync-tournaments.ts` only fetches tournament *names*, not per-team
  results), and it isn't wired into any standings dashboard UI yet; see
  follow-ups noted under idea #1.
  PR: TBD.
- **Community-Rated Summaries and Highlights — helpfulness scoring and ranking slice.**
  `packages/debate-card-search/src/lib/community-rating.ts` adds
  `scorePopularitySignal` (logarithmically dampens raw likes/saves so votes
  alone can't dominate), `scoreQualitySignal` (averages popularity-independent
  quality signals), `scoreReviewerSignal` (dampens summed reviewer-credibility
  weight the same way), `computeHelpfulnessBreakdown` (blends the three into
  a 0-100 `helpfulnessScore` under a default 30/40/30 popularity/quality/reviewer
  weighting, and flags a heavily-voted-but-substance-poor contribution as an
  `isPopularityOnlyOutlier`), and `rankContributions` (sorts a contribution
  list by that blended score, tie-broken by id). Vitest-covered in
  `packages/debate-card-search/test/community-rating.test.ts`. See idea #11
  below. This is the first slice only — it scores whatever like/save/quality/
  endorsement counts the caller passes in; it doesn't track those signals
  itself (no like/save/endorse actions, no persistence), compute per-reviewer
  credibility, or render a leaderboard/moderation UI; see follow-ups noted
  under idea #11.
  PR: TBD.
- **AI Response-Outcome Charts — flow-derived vulnerability scoring slice.**
  `packages/debate-round/src/flow/response-outcome.ts` adds
  `scoreArgumentVulnerability` (a deterministic 0-100 heuristic over an
  already-flowed argument thread — unanswered arguments score highest,
  repeated direct opposing responses raise it further, same-side
  extensions/defense lower it), `getArgumentVulnerabilityReport` (every
  argument row scored and sorted by vulnerability), `summarizeOutcomeBySide`
  (rolls the report up per side into argument/unanswered counts and an
  average vulnerability), and `buildVulnerabilityChartData` (top-N
  label/value points ready for a bar chart). Vitest-covered in
  `packages/debate-round/test/response-outcome.test.ts`. See idea #4 below.
  This is the first slice only — it's a deterministic heuristic over the
  flow's existing clash signals, not an actual AI panel evaluating response
  paths or estimating win probabilities, and it isn't wired into any
  chart/panel UI yet; see follow-ups noted under idea #4.
  PR: TBD.
- **Legacy Verbatim / Cardmirror Compatibility — condense/cite/reorder logic slice.**
  `packages/debate-card-parser/src/utils/verbatim-shortcuts.ts` adds
  `condenseCardHtml` (collapses a card's HTML down to its underlined "read"
  runs, preserving nested `<mark>` emphasis and joining non-adjacent runs
  with an ellipsis, mirroring Verbatim's condense command), `formatShortCiteTag`
  (builds a Verbatim-style short cite tag like `"Smith 24"` or `"Smith ND"`
  from a card's author/year), and `moveOutlineNode` (swaps an outline node
  with its previous/next sibling, backing a heading/card reorder shortcut).
  Vitest-covered in
  `packages/debate-card-parser/test/verbatim-shortcuts.test.ts`. See idea #14
  below. This is the first slice only — it covers 3 of the 5 shortcuts idea
  #14 describes (condensing cards, formatting citations, moving headings);
  "sending selected evidence to a speech document" and "emphasizing text"
  are not implemented since they need editor-selection/document-target state
  that doesn't exist yet. None of these functions are wired to an actual
  keyboard-shortcut handler or UI; see follow-ups noted under idea #14.
  PR: [#64](https://github.com/debate/debate-ai.com/pull/64).
- **Outline Filters and Argument Tree View — heading-grouped argument tree slice.**
  `packages/debate-round/src/flow/argument-tree.ts` adds `buildArgumentTree`
  (groups a flow's rows into a tree keyed by its `isHeading` rows, nesting
  each argument under the most recent heading above it),
  `filterArgumentTree` (filters by speech, by a `sideKey` derived from each
  argument's origin speech via `getSpeechSideKey`, by unanswered/dropped
  status, and by heading-vs-argument `kind` — including a pure `kind:
  "heading"` outline view), `flattenArgumentTree`, and `getFlowSideKeys`.
  Vitest-covered in `packages/debate-round/test/argument-tree.test.ts`. See
  idea #10 below. This is the first slice only — it doesn't distinguish
  finer argument types (link, impact, turn, answer, extension) or track
  contributor/evidence-status, since neither exists in the flow schema
  today, and it isn't wired into any tree/outline UI yet; see follow-ups
  noted under idea #10.
  PR: [#63](https://github.com/debate/debate-ai.com/pull/63).
- **Speech Transcript Summaries and Answers — flow-derived unanswered-argument slice.**
  `packages/debate-round/src/flow/flow-transcript-summary.ts` adds
  `summarizeFlowRow`, `getFlowRowSummaries`, `getUnansweredFlowRows`,
  `buildFlowSummaryText`, `suggestCrossExamQuestions`, and
  `suggestExtensionIdeas` so a viewer can turn an already-flowed `Flow` (the
  existing `Box`/column grid) into a concise per-argument summary, flag
  which arguments currently stand unanswered as of the flow's latest
  state, and get template cross-examination questions and extension ideas
  built from those drops. Vitest-covered in
  `packages/debate-round/test/flow-transcript-summary.test.ts`. See idea #6
  below. This is the first slice only — it doesn't transcribe audio or use
  an AI model to extract claims/warrants/impacts from raw speech text (it
  works off the flow grid a debater has already flowed), and it isn't wired
  into any summary/cross-ex UI yet; see follow-ups noted under idea #6.
  PR: TBD.
- **Flow-in-Speech Flow Annotations — timestamped annotation data model slice.**
  `packages/debate-round/src/flow/flow-annotations.ts` adds a `FlowAnnotation`
  type plus `createFlowAnnotation`, `sortAnnotationsByTimestamp`,
  `getAnnotationsForSpeech`, `getAnnotationsForBox`,
  `findAnnotationAtPlaybackPosition`, and `resolveAnnotationBox` so a viewer
  scrubbing a streamed/recorded speech can drop a timestamped note on a
  specific flow `Box` (addressed via the existing `boxFromPath` path
  convention) and later jump straight back to it. Vitest-covered in
  `packages/debate-round/test/flow-annotations.test.ts`. See idea #15 below.
  This is the first slice only — it is not wired into the video player
  (`debate-videos`) or the `FlowSpreadsheet`/flow grid UI, and annotations
  aren't persisted anywhere yet; see follow-ups noted under idea #15.
  PR: [#61](https://github.com/debate/debate-ai.com/pull/61).
- **AI Judge Decision Modes — judge-paradigm registry slice.**
  `packages/debate-speech-writer/src/judge/judge-paradigms.ts` adds a registry
  of configurable judge personas (flow, lay, policymaker, critic, educator,
  truth-tester) plus `buildJudgeParadigmPrompt` (composes a paradigm-specific
  prompt section) and `buildCustomJudgeParadigm` (builds a "custom" paradigm
  from a real judge's own publicly stated preferences). Vitest-covered in
  `packages/debate-speech-writer/test/judge-paradigms.test.ts`. See idea #5
  below. This is the first slice only — it is not wired into the existing
  `judgeDecisionPrompt` AI call or into any paradigm-picker UI; see
  follow-ups noted under idea #5.
  PR: [#60](https://github.com/debate/debate-ai.com/pull/60).
- **Expandable Heading Structure — outline/collapse logic slice.**
  `packages/reason-editor/src/engine/outline/heading-outline.ts` adds
  `buildHeadingOutline`, `getVisibleHeadingIds`, `getCollapsedRanges`, and
  `isPositionCollapsed` so a nav panel or editor view can implement
  collapsible H1-H4 sections (pocket/hat/block/tag+analytic) over the
  existing flat heading schema, without any schema change. Vitest-covered
  in `packages/reason-editor/test/heading-outline.test.ts`. See idea #9
  below. This is the first slice only — it is not wired into any React
  nav panel/outline UI yet (no such component exists in `reason-editor`
  today); see follow-ups noted under idea #9.
  PR: [#58](https://github.com/debate/debate-ai.com/pull/58).
- **Word-Count-Only Speech Format — pure logic slice.** `packages/debate-timer/src/formats/word-count-format.ts`
  adds `countWords`, `getWordCountStatus`, `estimateWordLimit`, and a `wordCountStyles` registry
  (mirrors Public Forum's speech order with word limits instead of timers). Vitest-covered in
  `packages/debate-timer/test/word-count-format.test.ts`. See idea #2 below. This is the first
  slice only — it is not wired into `SpeechTimer`/`debate-round`'s timer state (built around
  elapsed milliseconds) or exposed in any submission UI; see follow-ups noted under idea #2.
  PR: [#57](https://github.com/debate/debate-ai.com/pull/57).

## Product Feature Ideas

Each idea below has a working first-cut implementation already shipped (see Tracker Status above and `docs/features/`). Rather than re-narrate that build history, each entry now outlines the next round of UI features to add for that idea — pick items up here rather than re-deriving them from the Tracker Status log.

1. **CX NDCA Standings** — _Removed Aug 30, 2026_ (`/standings` and `StandingsPanel` deleted; the underlying `debate-data-sync` scoring helpers — `computeTournamentPoints`/`buildStanding`/`rankStandings` — were left in place). Rebuild as a lighter-weight view merged into the Team Rankings tool rather than a standalone page:
   - A "Standings" tab inside Team Rankings, reusing the surviving scoring helpers.
   - A manual CSV/paste import for tournament results, since live Tabroom scraping is blocked (see "Confirmed blocker" below) and the old panel's only path in was hand-entry.
   - Bring back a qualification-points-table editor as a collapsible section rather than its own panel.

2. **Word-Count-Only Speech Format** (`/word-count`, in-round meter in `SpeechHeaderBar`) — every previously-tracked follow-up is now done: the live in-round `SpeechWordCounter` popover already has a 🎤 dictation button (mirroring the standalone form's); a per-style word-limit preset manager exists — `/settings`'s **Word limit presets** section (`WordLimitPresetsPanel`/`useWordLimitPresets`/`state/wordLimitPresets.ts`), account-synced via `/api/settings`'s `wordLimitPresets` field, checked ahead of the built-in `wordCountStyles` registry by `resolveSpeechWordLimit` in both this panel and the live meter; a trend view exists — `/word-count`'s **Word-count trend** section (`buildWordCountTrendData` in `state/wordCountRounds.ts`, rendered by `WordCountRoundsPanel`), a chronological bar-per-submission list across every persisted round, filterable by speech name; and that history is now account-synced too — a new `saved_word_count_rounds` D1 table plus `/api/word-count-rounds` routes, merged in by `hooks/useWordCountRounds.ts`, so the trend view (and the persisted-round list it's built from) follows a signed-in user across devices instead of staying per-browser. See `docs/features/word-count-rounds.md`'s "Custom word-limit presets", "Word-count trend view", and "Account-synced round history" sections. No further follow-up is currently tracked for this idea; a future run should pick a fresh next-step (e.g. a bulk "delete all my synced history" action, or resolving a same-`roundId` conflict between two devices instead of only filling gaps) if one becomes worth doing.

3. **Online Debate Versus AI** (`/versus-ai`) —
   - Audio speech submission, reusing the existing microphone-dictation hook instead of text-only entry.
   - Let any earlier speech in the round be regenerated, not only the most recent one.
   - A transcript export/download action for a completed round.

4. **AI Response-Outcome Charts** (`/outcomes`) —
   - A side-by-side view comparing two or more "what if" hypotheticals at once instead of one at a time.
   - A timeline of past AI counsel-panel assessments for a round, not just the latest.
   - Chart export/share (image or link) action.

5. **AI Judge Decision Modes** (`/judge-decision`, `/paradigms`) — a decision history log per round now exists: every requested AI decision is appended (its own generated id) instead of overwriting the round's prior verdict, `JudgeDecisionPanel` renders each round's decisions newest-first, and the history is account-synced (a new `saved_judge_decisions` D1 table plus `/api/judge-decisions` routes, merged in by `hooks/useJudgeDecisions.ts`) so it follows a signed-in user across devices. A "Clear all history for this round" bulk action now sits next to each round's heading (`deleteJudgeDecisionsForRound`/`deleteRoundHistory`), clearing that round's full history locally and, when signed in, best-effort from the account too — the other half of the "bulk clear/cap" bullet (a per-round decision count cap) remains open. See `docs/features/judge-paradigm-selections.md`'s "Decision history" section. Next:
   - A multi-judge "panel" mode that runs several paradigms against the same round and shows a combined decision.
   - A side-by-side paradigm comparison view for picking which judge to prep for.
   - A per-round decision count cap, now that a heavily-re-judged round can accumulate many entries even with the new bulk-clear action available.

6. **Speech Transcript Summaries and Answers** (`/summaries`) —
   - Bulk transcript upload (multiple speeches at once) instead of one at a time.
   - Rank suggested cross-exam questions/extension ideas by strength rather than a flat list.
   - A one-click "send to Prep Notes / Speech Document" action for a summary.

7. **On Page Card Reuse Search** (`EvidenceLibraryPanel`'s "Check this page" box, plus the `debate-web-ext` browser extension) —
   - Surface each check's result inline in a small history list on `/cards/library` instead of a one-shot lookup.
   - A team dashboard of pages flagged as already-cut, so a coach can see reuse patterns at a glance.
   - An extension options page for whitelisting sites / configuring which repository to check against.

8. **Video-Lecture-Training Coach AI** (`/coach-materials`) —
   - Server-side transcription for uploaded audio/video recordings (currently only `.docx`/`.txt`/`.md` extract text).
   - Material tagging and a search/filter bar once a library grows past a handful of uploads.
   - Version history for a material that gets re-uploaded/edited.

9. **Expandable Heading Structure** (`/reason-editor`, CardMirror's native
   `NavigationPanel` + `HeadingBreadcrumbBar` — not the dead `reason-editor`
   package `OutlineNavPanel` this bullet used to point at; see the Completed
   entry below and `docs/features/reason-editor-outline-nav.md`). All four
   prior bullets are done: the nav panel's `navPaneVisible` setting already
   defaults to visible; `nav-panel.ts`'s drag/drop already supports
   drag-to-reorder; an earlier run added the sticky current-heading
   breadcrumb; and this run added its dedicated visibility toggle
   (`showHeadingBreadcrumb`, Settings → Appearance, independent of
   `navPaneVisible`). Next: a multi-pane/multi-window breadcrumb (today
   single-doc only).

10. **Outline Filters and Argument Tree View** (`/outline`) —
    - Multi-select rows to bulk-apply an argument-type/contributor/evidence-status tag at once.
    - Save and reuse named filter presets instead of re-picking filters each visit.
    - Export the filtered tree to a Speech Document or outline file.

11. **Community-Rated Summaries and Highlights** (`/cards/leaderboard`, `/cards/contributions`) —
    - A moderator view that surfaces `isPopularityOnlyOutlier`-flagged contributions for review (computed today, not yet shown anywhere).
    - An endorsement history list per contributor.
    - A tooltip/legend explaining how the popularity/quality/reviewer-weight blend produces a score.

12. **Pre-Round Intelligence Panel** (`/briefings`) — real tournament pairings/room-assignment data stays blocked (Tabroom login wall, see below), so:
    - A manual pairing/room-assignment entry form as the practical stand-in.
    - A print/export view of a briefing for offline use before a round.
    - A "last updated" freshness indicator so a stale briefing is obvious.

13. **Coaching Programs and Group Challenges** (`/coaching-programs`, `/cards/group-challenges`) —
    - A calendar/schedule view across a program's drills, sprints, and challenges.
    - A coach-facing roster analytics dashboard (completion rates, streaks, standings in one place).
    - A digest notification summarizing challenge results instead of requiring a panel visit.

14. **Legacy Verbatim / Cardmirror Compatibility** (CardMirror's native shortcut set) — all four prior bullets are done: `insertShortCite` (`Mod-Shift-k`) closes the one missing command; an in-editor shortcuts reference already exists (`openShortcutsReference`, reachable via the menu/palette/toolbar button — not bound to `?` by default, but rebindable like any other command); Settings → Keyboard shortcuts (`keybindings-editor.ts`) already lets a user rebind every command; and the reference itself now has Print and Export… actions (`reference-ui.ts`, `reference-export.ts`). See `docs/features/legacy-verbatim-shortcuts.md`. Next: a "download the shortcuts as a printable PDF" option instead of relying on the browser/OS print-to-PDF flow from the Print action; or an in-app onboarding nudge (e.g. from `ui-tour.ts`) pointing a Verbatim-trained user at the reference the first time they open a CardMirror document.

15. **Flow-in-Speech Flow Annotations** (`/annotations`, `FlowSpreadsheet` badges) —
    - Search/filter annotations by speech, speaker, or tag.
    - Bulk-export a round's annotations into a Speech Document.
    - A density scrubber on the video timeline showing where annotations cluster.

16. **Shared, AI-Generated Debate Flow** (Coach Hub's `SharedFlowSyncPanel`/`FlowEditLogPanel`) —
    - Live "who's editing now" presence indicators alongside the existing merge preview.
    - A side-by-side diff view for conflicting edits instead of a flat conflict list.
    - Upgrade the short-poll sync transport to a WebSocket/Durable Object push channel for near-real-time updates.

## Research Crowdsourcing Organizer Features

> The note above about UI follow-ups applies to this section too. As with Product Feature Ideas, each bullet below is an outline of UI features to add next, not a build log.

* 🧩 **Community Research Hub** (`/community-hub`) — a personalized "for you" section; fold its directory into the News Stream feed instead of a separate destination; a quick-jump search bar across every listed space.
* 🏅 **Contribution Leaderboard** (`/cards/leaderboard`) — weekly/monthly/all-time range filters; per-category (kind) leaderboards alongside the overall one; a per-contributor profile drill-down page.
* 🎮 **Gamified Quests** (`/cards/streaks`) — a streak-freeze/grace-day mechanic for a missed day; a shareable streak-badge image; an opt-in reminder notification before a streak lapses.
* 🔓 **Progress Unlocks** (`/cards/progress`) — a visual next-tier progress bar instead of text-only status; a small unlock celebration toast when a tier/badge is earned; a badge showcase on a contributor's profile.
* 🧠 **LLM Card Scoring** (`/cards/scoring`) — batch-score an uploaded set of cards at once; a per-contributor score-trend chart over time; an inline score badge shown directly in Evidence Library search results.
* 📈 **Research Progress Tracking** (`/cards/progress-tracking`) — a topic-comparison view across the whole team; personal goal-setting UI; a printable/exportable progress report.
* 📚 **Common Argument Library** (`/cards/argument-library`) — bulk folder actions (merge/archive); saved custom collections per user; a tag hierarchy/synonym grouping view on top of the existing case-variant merge tool.
* 🕵️ **Daily Best Card Challenge** (`/cards/best-card`) — a winner-history calendar view; a comment thread on each day's winner; a "best of the week" rollup.
* 🗣️ **Peer Review System** (`/cards/reviews`) — gate reviewer identity behind the real signed-in session (the same pattern already wired into most other panels this month) instead of a free-typed reviewer ID; a review-aging indicator for stale pending reviews; a reviewer-workload balancing view.
* 🏆 **Top Contributor Awards** (`/cards/awards`) — an awards history / hall-of-fame page; auto-post each announcement to the News Stream feed; a "nominate a peer" action.
* 🧭 **Research Task Routing** (`/cards/inbox`) — a coach-facing override/reassign control; a task-priority indicator; a capacity-aware view of routing load across the team.
* 🔁 **Revision Incentives** (`/cards/revisions`) — a stale-evidence digest surfaced from the existing staleness signal; a before/after revision diff viewer; a reward-points redemption or tie-in to the leaderboard.
* 📊 **Topic Coverage Dashboard** (`/cards/coverage`) — a coverage-over-time trend chart; a preview of the quests a coverage gap would seed before creating them; a cross-topic comparison heatmap.
* 🎯 **Daily Quests and Targets** (`/cards/quests`) — quest difficulty tiers; team-vs-team quest competitions; a completion celebration posted to the News Stream feed.
* 🤝 **Team Collaboration Mode** (`/cards/collaboration`) — a shared whiteboard/canvas for sprint brainstorming; an end-of-sprint retrospective summary; calendar scheduling for sprint sessions.
* 🕵️ **Opponent Team Profiles** (`/opponents`) — real round-history data stays blocked (Tabroom login wall, see below), so: a bulk CSV import for scouted rounds; a side-by-side us-vs-opponent comparison view; a printable/exportable scouting report.
* ⚖️ **Judge Profiles** (`/judges`) — same Tabroom blocker, so: a bulk CSV import for ballot history; a multi-judge comparison view for panel rounds; a confidence indicator on the auto-tagged paradigm.
* 🤖 **AI Practice Opponent** (`/practice-opponent`) — share a custom-authored persona across a team instead of per-user only; a difficulty slider layered on top of persona choice; post-round feedback tips specific to the persona faced.
* 🎙️ **AI Coach Mode** (`/coaching`) — a coaching-session history timeline per round; a side-by-side comparison across two rounds; an exportable coaching-notes document.
* 🧑‍🤝‍🧑 **Collaboration Prep Room** (`/cards/prep-room`) — a shared task checklist view; a shared file/attachment area; a room activity timeline.
* 🧠 **Team Brainstorm Assist** (`/cards/brainstorm`) — polish the idea-ranking UI (upvote affordance/animation); a one-click "send top idea to Argument Library" action; an optional brainstorm-session timer.
* 📋 **Shared Evidence Library** (`/cards/library`) — saved searches with alerts on new matches; bulk tag editing across a filtered result set; a one-click citation-format export.
* 🔄 **Strategy Sync Notes** (`/prep-notes`, `/notifications`) — threaded replies on a note instead of flat status; a priority flag; a digest notification instead of one per assignment.
* 📊 **Matchup Prep Dashboard** — same panel and outline as "Pre-Round Intelligence Panel" above (idea #12); no separate UI work tracked here.
* 🧪 **Practice Round Simulator** (`/practice-round`) — a round replay/playback view; a scoring rubric shown alongside the AI judge decision; comparison across a debater's past attempts.
* 📚 **AI Drill Generator** (`/drills`) — drill scheduling/reminders; a difficulty rating with filtering; completion tracking tied into Progress Unlocks.
* 🧭 **Scout-to-Strategy Workflow** (`/strategy`) — a history log of past strategy recommendations per matchup; a side-by-side case-option comparison table; a one-click export into the Pre-Round Briefing.

## Confirmed blocker: Tabroom results/pairings/ballot data

Idea #1 ("CX NDCA Standings") follow-up (a), idea #12 ("Pre-Round
Intelligence Panel") follow-up (a), and the "Opponent Team Profiles"/"Judge
Profiles" bullets' follow-up (a) all share the same open dependency: a real
data source that produces `TournamentResult`/`OpponentRoundRecord`/
`JudgeRoundRecord`s from Tabroom instead of hand-entered data. This run
verified that dependency is genuinely blocked, not merely unstarted:
`sync-tournaments.ts`'s existing `getTournamentNames()` fetches Tabroom's
public tournament *index* page successfully (no login required), but a
tournament's `results`/`postings` pages — the pages that would actually
carry per-team results, pairings, or ballots — return a 302 redirect to
`/user/login/login.mhtml` with the query-string message "Because of the
prevalence of ineffecient AI spiders putting high levels of load on
Tabroom, you must now log in to access that area." (reproduced live against
`https://www.tabroom.com/index/tourn/results/index.mhtml?tourn_id=33616`, a
completed tournament, on 2026-08-24). Tabroom is explicitly gating
automated access to exactly this data behind an authenticated login it has
no account/credentials for in this repo. A future run should not
re-attempt this scrape without a real, authorized Tabroom account and
explicit sign-off — scraping past an anti-bot login wall is out of scope
for this repo's autonomous routine. These four follow-ups remain correctly
marked "not started" / open, now with this blocker documented rather than
merely unattempted.