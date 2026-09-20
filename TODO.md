## Tracker Status

_Note: this section (In progress / Completed) previously tracked a long
history of small slices picked up by the standing autonomous-routine prompt
("integrate all the tools into the UI... create user settings and link user
db SQL with the ability to save flows/docs/debates in SQL and link to
users... add tools into where needed in the UI... develop better tool UI").
That history was lost when `4aa1c03` ("Prod (#863)") reset this file to the
generic contributor-ideas stub below, most likely by a merge that resolved
this file to a stale branch state rather than the tip. It is not being
reconstructed from memory — only what's confirmed against the current
codebase is recorded from here on._

### In progress

_No task currently in progress._

### Completed

- **🔀 Two tabs or devices editing named Outline filter presets at the same
  time no longer silently drop each other's change.** Another repeat of the
  standing autonomous-routine prompt above — as with every prior repeat
  (reconfirmed fresh this run: 84+ `user.id` references across `saved_*` D1
  tables in `apps/debate-ai.com/lib/database/schema.ts`,
  `TOOL_RECORD_COLLECTIONS` syncs every localStorage-backed tool without its
  own dedicated table to the account, and every tool is reachable from
  `/tools`, CardMirror's `MenuBar`/command palette, and the feature catalog),
  that prompt's own asks are already fully built. There were no open PRs on
  the remote and this branch's own designated PR (from the prior run) was
  already merged into `master`, so this branch was restarted from `master`'s
  tip. (A different in-flight branch, `claude/gifted-babbage-6yecr0`, had an
  unrelated unpushed-PR commit for a `speech-share` participant-email bug —
  left untouched since it isn't this branch's work.) A subagent confirmed
  `outlineFilterPresets` (`packages/debate-round/src/state/outlineFilterPresets.ts`)
  had the exact same unfixed "client computes the whole next array and PUTs
  it" lost-update race that `favoriteTools`/`recentTools`/
  `savedArgumentCollections`/`wordLimitPresets` all had before their
  op-based fixes — `packages/debate-practice-drills/src/hooks/useOutlineFilterPresets.ts`'s
  `persist()` called `saveUserSettings({ outlineFilterPresets: next })` with
  a full client-computed array, and `apps/debate-ai.com/app/api/settings/route.ts`'s
  handling of `outlineFilterPresets` was a blind whole-column overwrite with
  no read-then-apply-op step, unlike the fixed fields in the same file. It's
  real user-editable state — add (per-round "Save preset" button) and remove
  (global "Saved filter presets" badge list) both write the same array, the
  preset list is explicitly global/not per-round, and the hook already has a
  cross-tab `storage`-event listener for *read* freshness, meaning the
  *write* race was a real, already-partially-addressed-but-not-fully-closed
  gap.

  Mirrored the `wordLimitPresets` fix, minus the `update` op (the UI only
  ever adds or removes a preset, no rename/edit-in-place exists):
  `packages/debate-round/src/state/outlineFilterPresets.ts` gains
  `OutlineFilterPresetOp` (`addOutlineFilterPreset` / `removeOutlineFilterPreset`),
  `normalizeOutlineFilterPresetOpPatch` (shape-only validation — exactly one
  op per request, reusing `isValidArgumentTreeFilter` for the nested filter
  object), `validateNewOutlineFilterPreset` (business-rule checks: name
  validity, duplicate name, capacity), `buildOutlineFilterPresetFailureMessage`,
  and `applyOutlineFilterPresetOp` (applies the op against a `current` list,
  returning `{ next, failure }`; a refused add returns the unchanged `next`
  reference, and removing an absent name is a silent no-op like
  `applyWordLimitPresetOp`'s). `apps/debate-ai.com/app/api/settings/route.ts`
  wires the op in exactly like the `wordLimitPresets` op branch: reads the
  row's current `outlineFilterPresets`, applies the op, and either writes
  the result or returns `400` with `buildOutlineFilterPresetFailureMessage`'s
  message on failure. The plain whole-list `outlineFilterPresets` PUT stays
  accepted (same "still accepted for a caller that genuinely needs one"
  carve-out as the other fixed fields) but nothing in the app sends one
  anymore. `useOutlineFilterPresets.ts`'s `persist` split into
  `persistLocal` (local state/localStorage, applied immediately and
  optimistically, unchanged) and `syncOp` (best-effort account sync sending
  just the op), matching `useWordLimitPresets.ts`'s own split.
  `packages/debate-round/src/round/user-settings-client.ts` gains
  `saveOutlineFilterPresetOp`, mirroring `saveWordLimitPresetOp`.

  Vitest-covered: `packages/debate-round/test/outlineFilterPresets.test.ts`
  gains cases for `validateNewOutlineFilterPreset` (valid/invalid
  name/filter, duplicate name, at-capacity), `buildOutlineFilterPresetFailureMessage`
  (one message per failure), `normalizeOutlineFilterPresetOpPatch`
  (valid/malformed add and remove ops, a `roundId`-carrying add, more than
  one op per request, a non-object body), and `applyOutlineFilterPresetOp`
  (append, trim, duplicate refusal, remove, idempotent remove-of-absent,
  empty op, and a two-concurrent-adds-resolve-onto-the-same-list scenario —
  the exact race this closes). `packages/debate-help-docs/content/docs/features/user-settings.mdx`'s
  Known gaps gains a paragraph documenting the fix, mirroring the
  `wordLimitPresets` paragraph immediately above it.

  Ran the full verification gate: `bun install`, `bunx turbo run typecheck`
  (17/17 packages green, `debate-round`/`debate-practice-rounds`/
  `debate-ai-web` included), `bun run test` (481 files, 9127 tests passing —
  up from 9105 by exactly the 22 new cases above, repo-wide), and
  `bun run build:web` (production build succeeded — the pre-existing "no
  output files found for task debate-editor#build" warning is unrelated
  `turbo.json` `outputs` config, not a build failure; the build's
  regenerated `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts`
  and `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable.

- **📝 Five stale `packages/debate-help-docs` "Known gaps" entries corrected
  — each described a gap the code no longer had, left over from a fix
  landed elsewhere that never updated the doc that named the gap.** Another
  repeat of the standing autonomous-routine prompt above — as with every
  prior repeat (reconfirmed fresh this run: 84+ `user.id` references across
  `saved_*` D1 tables in `apps/debate-ai.com/lib/database/schema.ts`,
  `TOOL_RECORD_COLLECTIONS` syncs every localStorage-backed tool without its
  own dedicated table to the account, and every tool is reachable from
  `/tools`, CardMirror's `MenuBar`/command palette, and the feature catalog),
  that prompt's own asks are already fully built. There were no open PRs and
  no branches other than `master`/`prod` on the remote, and this branch's
  own prior commits were already merged into `master` (PR #888), so it was
  restarted from `master`'s tip. Rather than a fresh code fix, this run
  picked up the "four stale Known gaps entries" + the
  `round-invites-and-notifications.mdx` stale entry this file's own
  "Follow-ups" section had been carrying forward across several prior runs
  as "worth a future small doc-accuracy pass" without ever being picked up —
  each re-verified fresh against the current code before editing:
  - `internals/argument-tree-outline.mdx`: still said applying a saved
    Outline filter preset "doesn't select or scroll to a particular round."
    Confirmed fixed — `debate-practice-drills/src/state/outlineFilterPresetJump.ts#resolvePresetJumpRoundId`
    is wired into `ArgumentTreePanel.tsx` and does exactly that when the
    preset's origin round still exists.
  - `features/coaching-programs.mdx`: still said the roster analytics table
    "doesn't yet fold in drill-completion rate or practice-round counts."
    Confirmed fixed — `internals/coaching-programs.mdx`'s own "Per-member
    drill/practice-round status" section documents the two new columns
    already built for this.
  - `internals/news-stream.mdx`: still described `feature-catalog.ts` as
    "this package's own," one of three hand-synced copies of
    `APP_FEATURES`. Confirmed fixed — `lib/news-stream.ts` now imports
    `APP_FEATURES` from the single shared `debate-feature-catalog` package,
    per `internals/features-page.mdx`'s "One shared catalog" section; the
    residual "nothing checks the three copies against each other" gap no
    longer applies since there's only one copy.
  - `features/reason-editor-outline-nav.mdx`: still said the heading
    breadcrumb bar was single-doc-only, "multi-pane... doesn't have one
    yet." Confirmed fixed for multi-pane (still genuinely missing for
    multi-window, which the doc now says) —
    `debate-editor/src/editor/multi-pane-shell.ts` mounts a per-pane
    `HeadingBreadcrumbBar` scoped to that pane's own `.pmd-pane-body`
    scroller. The adjacent module comment in `heading-breadcrumb-bar.ts`
    itself was equally stale ("multi-pane/multi-window... are not wired
    up") and got the same correction.
  - `features/round-invites-and-notifications.mdx`: still said "only round
    creation sends invites, not later edits." Confirmed fixed —
    `useRoundEditorForm.ts#handleSubmit`'s edit-mode branch already calls
    `computeAddedInviteEmails` + `dispatchRoundInvites` for newly-added
    debaters/judges/spectators, and `round-invite-client.ts#computeAddedInviteEmails`'s
    own docstring names this exact gap as what it closes.

  Also removed the two now-redundant "Follow-ups" entries that had been
  carrying these forward (one of the two duplicate copies of the "four
  stale entries" list, plus the `round-invites-and-notifications.mdx`
  entry); the file's pre-existing duplicate `team-rankings.mdx` follow-up
  entry and its still-genuinely-open items (`flow-annotations.mdx`,
  `practice-vs-ai.mdx`, `quest-streaks.mdx`) were left as they were, not
  part of this pass.

  No code behavior changed (doc text only, plus the one stale code comment
  above) so no new Vitest coverage was needed. Ran the full verification
  gate: `bun install`, `bunx turbo run typecheck` (17/17 packages green,
  including `debate-editor` and `debate-help-docs`), `bun run test` (481
  files, 9105 tests passing, repo-wide), and `bun run build:web` (production
  build succeeded — the pre-existing "no output files found for task
  debate-editor#build" warning is unrelated `turbo.json` `outputs` config,
  not a build failure; the build's regenerated
  `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts` and
  `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable.

- **🔢 Two tabs or devices editing custom word-limit presets at the same time
  no longer silently drop each other's change.** Another repeat of the
  standing autonomous-routine prompt above — as with every prior repeat
  (reconfirmed fresh this run: 84+ `user.id` references across `saved_*` D1
  tables in `apps/debate-ai.com/lib/database/schema.ts`,
  `TOOL_RECORD_COLLECTIONS` syncs every localStorage-backed tool without its
  own dedicated table to the account, and every tool is reachable from
  `/tools`, CardMirror's `MenuBar`/command palette, and the feature catalog),
  that prompt's own asks are already fully built. The prior run's own PR
  (#887) was already merged into `master` with no open PRs or other branches
  on the remote, so this branch was restarted from `master`'s tip. A subagent
  scanned the ~60 `packages/debate-help-docs` "Known gaps" entries not
  already investigated in this file's history (auth/free-form-identity gaps,
  per-user-vs-shared-resource sync, transcription-needs-a-paid-service gaps,
  and infra/deployment items all correctly triaged as out of scope — needing
  a real auth system, a backend redesign, a product decision, or ops access
  respectively, not a mechanical fix) and landed on
  `features/user-settings.mdx`'s own Known gaps: "Every other field
  (`debateStyle`, `colorTheme`, `wordLimitPresets`, etc.) is a plain
  whole-value replace with no such protection" — the exact same lost-update
  race `favoriteTools` and `savedArgumentCollections` had already been fixed
  for elsewhere in this same paragraph.

  Confirmed still real: `packages/debate-round/src/hooks/useWordLimitPresets.ts`'s
  `addPreset`/`updatePreset`/`removePreset` all computed the next *full*
  array from the hook's own in-memory `presets` state and called
  `saveUserSettings({ wordLimitPresets: next })` — a whole-list PUT — and
  `apps/debate-ai.com/app/api/settings/route.ts`'s handling of
  `wordLimitPresets` was a blind whole-column overwrite, unlike the
  read-then-apply-op blocks already in place for `favoriteTools` and
  `savedArgumentCollections` in the same file.

  Mirrored the same fix a third time:
  `packages/debate-round/src/state/wordLimitPresets.ts` gains
  `WordLimitPresetOp` (`addWordLimitPreset` / `updateWordLimitPreset` /
  `removeWordLimitPreset`), `normalizeWordLimitPresetOpPatch` (shape-only
  validation — exactly one op per request), and `applyWordLimitPresetOp`
  (applies the op against a `current` list, reusing new
  `validateNewWordLimitPreset`/`validateWordLimitPresetUpdate` business-rule
  guards extracted from the existing add/update logic; like
  `applySavedArgumentCollectionOp`, an op can be refused — duplicate name, at
  capacity, unknown preset — so it returns `{ next, failure }`).
  `apps/debate-ai.com/app/api/settings/route.ts` wires the op in exactly like
  the `savedArgumentCollections` op branch: reads the row's current
  `wordLimitPresets`, applies the op, and either writes the result or
  returns `400` with `buildWordLimitPresetFailureMessage`'s message on
  failure. The plain whole-list `wordLimitPresets` PUT stays accepted (same
  "still accepted for a caller that genuinely needs one" carve-out as the
  other two fields) but nothing in the app sends one anymore.
  `useWordLimitPresets.ts`'s `persist` split into `persistLocal` (local
  state/localStorage, applied immediately and optimistically, unchanged) and
  `syncOp` (best-effort account sync sending just the op), matching
  `useFavoriteTools.ts`'s own split. `packages/debate-round/src/round/user-settings-client.ts`
  gains `saveWordLimitPresetOp`, mirroring `saveFavoriteToolOp`.

  Vitest-covered: `packages/debate-round/test/wordLimitPresets.test.ts` gains
  cases for `validateNewWordLimitPreset`/`validateWordLimitPresetUpdate`
  (valid/invalid name, invalid word limit, duplicate name, at-capacity,
  unknown preset), `buildWordLimitPresetFailureMessage` (one message per
  failure), `normalizeWordLimitPresetOpPatch` (each op's valid shape,
  malformed values, more-than-one-op-per-request rejection, non-object
  body), and `applyWordLimitPresetOp` (add/update/remove success and failure
  paths, idempotent remove-of-absent, and a case chaining two concurrent add
  ops onto the same starting list to demonstrate neither is dropped). No new
  test was added for `saveWordLimitPresetOp`/`persistLocal`/`syncOp`
  themselves — `user-settings-client.ts`'s functions aren't tested anywhere
  in this repo today (no `fetch` mocking there for `saveFavoriteToolOp`
  either), and this hook's own existing test
  (`useWordLimitPresets.test.ts`) only covers the pure
  `isWordLimitPresetsLiveUpdateStorageEvent` predicate, not `persist`/
  `addPreset` etc. — matching both files' pre-existing conventions.

  Ran the full verification gate: `bun install`, the two focused test files
  (51 tests) plus `debate-round`'s own `bunx vitest run` (61 files, 1241
  tests) and `bunx tsc --noEmit` (clean), `bun run test` (481 files, 9105
  tests passing, repo-wide), `bunx turbo run typecheck` (17/17 packages
  green, `debate-ai-web` and `debate-help-docs` included), and
  `bun run build:web` (production build succeeded — the pre-existing "no
  output files found for task debate-editor#build" warning is unrelated
  `turbo.json` `outputs` config, not a build failure; the build's
  regenerated `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts`
  and `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable. Docs
  updated: `features/user-settings.mdx`'s Known gaps (the `wordLimitPresets`
  mention removed from the "every other field" list, a new paragraph added
  describing the op-based fix).

- **🔀 Two tabs or devices editing saved Argument Library collections at the
  same time no longer silently drop each other's change.** Another repeat of
  the standing autonomous-routine prompt above — as with every prior repeat
  (reconfirmed fresh this run: 84 `user.id` references across `saved_*` D1
  tables in `apps/debate-ai.com/lib/database/schema.ts`,
  `TOOL_RECORD_COLLECTIONS` syncs every localStorage-backed tool without its
  own dedicated table to the account, and every tool is reachable from
  `/tools`, CardMirror's `MenuBar`/command palette, and the feature catalog),
  that prompt's own asks are already fully built. There were no open PRs and
  no branches other than `master` on the remote, and this branch's own prior
  commits were already on `master` (a merged PR), so it was restarted from
  `master`'s tip. A subagent scanned `packages/debate-help-docs`'s ~81
  "Known gaps" sections (cross-checked against every doc path already
  investigated in this file's history) for a fresh, concretely-scoped
  candidate, landing on
  `features/argument-library-collections.mdx`'s: "No optimistic-concurrency
  handling: the whole `savedArgumentCollections` list is a single
  account-settings field, so a rename/update/add/remove from two signed-in
  devices at once has the last write win."

  Confirmed still real:
  `packages/debate-search-evidence/src/hooks/useSavedArgumentCollections.ts`'s
  `addCollection`/`removeCollection`/`renameCollection`/`updateCollection`
  all computed the next *full* array from the hook's own in-memory state and
  PUT it whole via `saveSavedArgumentCollections`, so two tabs each acting
  from a stale snapshot raced a classic lost update — the exact gap
  `debate-round`'s `state/favoriteTools.ts#applyFavoriteToolOp` had already
  closed for `favoriteTools` (and `recentTools` the same way) by resolving a
  single op server-side against the row's *current* value instead of
  trusting the caller's copy.

  Mirrored that fix for `SavedArgumentCollection`:
  `packages/debate-search-evidence/src/lib/argument-library-collections.ts`
  gains `SavedArgumentCollectionOp` (`addSavedArgumentCollection` /
  `removeSavedArgumentCollection` / `renameSavedArgumentCollection` /
  `updateSavedArgumentCollectionTags`), `normalizeSavedArgumentCollectionOpPatch`
  (shape-only validation — exactly one op per request), and
  `applySavedArgumentCollectionOp` (applies the op against a `current` list,
  reusing the existing `validateNewSavedArgumentCollection`/
  `validateSavedArgumentCollectionRename`/`validateSavedArgumentCollectionTagsUpdate`
  business-rule guards; unlike `applyFavoriteToolOp`, a collection op can be
  refused — duplicate name, at capacity, unknown collection — so it returns
  `{ next, failure }` rather than always succeeding). `remove` stays a
  silent no-op on an absent name, matching `removeFavoriteTool`'s and
  `removeCollection`'s own `void` convention. All three are exported from
  `packages/debate-search-evidence/src/index.ts`.

  `apps/debate-ai.com/app/api/settings/route.ts` wires the op in exactly
  like the `favoriteTools`/`recentTools` op branches: reads the row's current
  `savedArgumentCollections`, applies the op, and either writes the result
  or returns `400` with `buildSavedArgumentCollectionFailureMessage`'s
  message when `applySavedArgumentCollectionOp` reports a failure. The
  plain whole-list `savedArgumentCollections` PUT stays accepted (mirroring
  `favoriteTools`'s "still accepted for a caller that genuinely needs one"
  carve-out) but nothing in the app sends one anymore.
  `useSavedArgumentCollections.ts`'s `persist` now takes the op alongside
  the locally-computed next list — local state/localStorage apply
  immediately and optimistically (unchanged), while the account sync
  (`argument-library-collections-client.ts`'s new
  `sendSavedArgumentCollectionOp`) sends just the op, best-effort, matching
  the hook's existing "local apply is never blocked by a sync failure"
  convention.

  Vitest-covered:
  `packages/debate-search-evidence/test/argument-library-collections.test.ts`
  gains cases for `normalizeSavedArgumentCollectionOpPatch` (each op's valid
  shape, malformed values, more-than-one-op-per-request rejection, absent
  body handling) and `applySavedArgumentCollectionOp` (add/remove/rename/
  update success and failure paths, idempotent remove-of-absent, and a case
  chaining two concurrent add ops onto the same starting list to demonstrate
  neither is dropped). New
  `packages/debate-search-evidence/test/argument-library-collections-client.test.ts`
  covers `fetchSavedArgumentCollections`/`saveSavedArgumentCollections`
  (pre-existing, previously untested) and the new
  `sendSavedArgumentCollectionOp`, asserting it PUTs just the op body (not a
  whole-list replace) and surfaces the server's error message on a
  business-rule refusal. No `renderHook`-based test was added for the hook
  itself — no sibling hook in this repo (`useFavoriteTools`,
  `useOutlineFilterPresets`, `useRecentTools`) is tested that way either;
  each stops at its pure exported helpers and client module, which is what
  the new coverage above does.

  Ran the full verification gate: `bun install`, the three focused test
  files (74 tests) plus `debate-search-evidence`'s own `bunx vitest run` (45
  files, 1249 tests) and `bunx tsc --noEmit` (clean), `bun run test` (481
  files, 9078 tests passing, repo-wide), `bunx turbo run typecheck` (17/17
  packages green, `debate-ai-web` included), and `bun run build:web`
  (production build succeeded; the build's regenerated
  `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts` and
  `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable. Docs
  updated: `features/argument-library-collections.mdx`'s Known gaps entry
  (marked fixed, describing the op-based approach and its
  `favoriteTools`-fix precedent).

- **🎞️ An admin's fix to a published video's metadata now survives the next
  `db:seed:videos` re-seed instead of being silently overwritten by the
  committed JSON asset.** Another repeat of the standing autonomous-routine
  prompt above — as with every prior repeat (reconfirmed fresh this run: 84
  `user.id` references across `saved_*` D1 tables in
  `apps/debate-ai.com/lib/database/schema.ts`, `TOOL_RECORD_COLLECTIONS`
  syncs every localStorage-backed tool without its own dedicated table to
  the account, and every tool is reachable from `/tools`, CardMirror's
  `MenuBar`/command palette, and the feature catalog), that prompt's own
  asks are already fully built. There were no open PRs and no branches other
  than `master` on the remote, and this branch's own prior commits were
  already on `master` (a merged PR), so it was restarted from `master`'s
  tip. A subagent scanned `packages/debate-help-docs` "Known gaps" sections
  for a fresh, concretely-scoped candidate — checking ~25 entries against
  current source, most either stale (already fixed elsewhere, doc just
  never updated), an intentional documented tradeoff, or blocked on a
  product/architecture decision — before landing on
  `internals/video-library.mdx`'s own admitted gap: "An admin edit to a
  published video is written to the `videos` table only... re-running
  `db:seed:videos` upserts the asset's version back over the edit... Persisting
  edits means writing them back to the assets, or teaching the seed to skip
  rows an admin has edited."

  Confirmed still open: `buildVideoSeedStatements`
  (`packages/debate-data-sync/src/videos/video-seed-sql.ts`) generated an
  `ON CONFLICT("video_id") DO UPDATE SET "col" = excluded."col", ...` for
  every seeded column with no guard, so any re-seed (the CLI script, the
  admin seed endpoint, or the weekly YouTube resync's own re-seed step)
  clobbered whatever an admin had corrected through `/admin`'s Video
  library card. The sibling case — a *removed* video — was already solved:
  `deleteLibraryVideo` (`lib/videos/admin-library.ts`) records the removal
  in `youtube_video_exclusions` so a resync respects it; edits had no
  equivalent memory.

  Took the doc's own second option (skip rows an admin has edited) rather
  than writing edits back to the JSON assets, which would need a
  write-back path to a committed file the seed doesn't otherwise touch. A
  new `admin_edited` boolean column (migration
  `apps/debate-ai.com/drizzle/0047_video_admin_edited.sql`, default
  `false`, plus the matching `schema.ts` field) is set by
  `buildLibraryUpdate` on every admin edit and never cleared.
  `buildVideoSeedStatements`'s `DO UPDATE SET` now guards every seeded
  column with `CASE WHEN "admin_edited" = 1 THEN "col" ELSE
  excluded."col" END`, so an admin-edited row's stored values win over the
  asset's on any re-seed; `admin_edited` itself is left out of the SET
  list, so SQLite's upsert semantics leave it untouched, and `"updated_at"
  = unixepoch()` stays unconditional so the row keeps reading as fresh and
  isn't swept up by the trailing `DELETE ... WHERE "updated_at" <
  seededAt` prune.

  Vitest-covered: `packages/debate-data-sync/test/video-seed-sql.test.ts`
  gains a case asserting the generated SQL's `CASE WHEN "admin_edited" = 1`
  guard on a seeded column, that `admin_edited` is never itself an
  assignment target, and that `updated_at` stays unconditional.
  `apps/debate-ai.com/lib/videos/__tests__/seed-videos-to-db.test.ts` gains
  an end-to-end case against a real in-memory SQLite database: mark a row
  admin-edited with a raw `UPDATE`, re-seed with the JSON fixture's
  original (different) title, and assert the admin's title survives while
  the row is neither pruned nor stale. `admin-library.test.ts` gains a case
  asserting `buildLibraryUpdate` sets `adminEdited: true`, plus an
  assertion on the existing `updateLibraryVideo` persistence test. The new
  migration was added to all three test files' hand-maintained
  `VIDEOS_TABLE_MIGRATIONS` lists (`seed-videos-to-db.test.ts`,
  `admin-library.test.ts`, and `resync-view-counts.test.ts`, which also
  builds the `videos` table and would otherwise fail with "no such column"
  the moment the schema change landed).

  Ran the full verification gate: `bun install`, the three focused test
  files (`video-seed-sql.test.ts`, `seed-videos-to-db.test.ts`,
  `admin-library.test.ts`) plus `debate-data-sync`'s own `bunx vitest run`
  (34 files, 619 tests), `bun run test` (480 files, 9045 tests passing,
  repo-wide — this also caught `resync-view-counts.test.ts`'s migration
  list needing the same update, which the three files above alone would
  have missed), `bunx turbo run typecheck` (17/17 packages green,
  `debate-ai-web` included), and `bun run build:web` (production build
  succeeded; the build's regenerated
  `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts` and
  `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable. Docs
  updated: `internals/video-library.mdx`'s Known gaps entry (marked fixed)
  and its "Admin management" section (a third bullet on the new
  `admin_edited` bookkeeping); `features/video-library.mdx`'s Known gaps
  also had this same gap, plus an already-stale "a seed run is not atomic"
  line left over from an earlier fix — both removed.

- **🔀 A speech-document send synced from another device no longer shows up
  as the newest entry if it was actually sent earlier.** Another repeat of
  the standing autonomous-routine prompt above — as with every prior
  repeat (reconfirmed fresh this run: 84 `user.id` references across
  `saved_*` D1 tables in `apps/debate-ai.com/lib/database/schema.ts`,
  `TOOL_RECORD_COLLECTIONS` syncs every localStorage-backed tool without
  its own dedicated table to the account, and every tool is reachable from
  `/tools`, CardMirror's `MenuBar`/command palette, and the feature
  catalog), that prompt's own asks are already fully built. There were no
  open PRs and no branches other than `master`/`prod` on the remote, and
  this branch's own prior commits were already on `master` (a merged PR),
  so it was restarted from `master`'s tip. A subagent scanned
  `packages/debate-help-docs` "Known gaps" sections for a fresh,
  concretely-scoped candidate, verifying each against current source
  (ruling out one already-fixed stale doc entry and one that's really a
  data-migration decision, not a code defect) before landing on
  `features/speech-documents-cloud-save.mdx`'s own admitted gap: "An entry
  adopted during merge isn't re-sorted by `sentAt`."

  Confirmed still open: `useSpeechSendLogSync.ts`'s one-time account merge
  adopted a remote-only entry via `speechSendLogStore.add(entry)`, which
  (`appendSpeechSendLogEntry`) always appends to the end of local
  insertion order — correct for a live send (always the newest) but wrong
  for a merge, where a remote entry can have an older `sentAt` than
  everything already local (e.g. sent from another device before this
  browser ever synced). Since `SpeechSendLogPanel.tsx` displays
  newest-first by reversing array order, that older entry rendered at the
  top as if it were the most recent send.

  `packages/debate-editor/src/editor/speech-send-log.ts` gains a new pure
  `mergeSpeechSendLogEntries(log, newEntries, max)` — concatenates then
  sorts by `sentAt` ascending, applying the same max-size eviction as
  `appendSpeechSendLogEntry` (now by chronological position instead of
  array position). `SpeechSendLogStore` gains a matching `mergeRemote`
  method (one `init`/save/fire for the whole batch, replacing what would
  otherwise be one `add()` call, and one store write, per adopted entry).
  `useSpeechSendLogSync.ts`'s merge loop now collects every remote entry
  missing locally and hands them to `mergeRemote` in one call instead of
  looping `store.add` per entry.

  Vitest-covered: `packages/debate-editor/test/speech-send-log.test.ts`
  gains a new `describe("mergeSpeechSendLogEntries", ...)` block (5 cases
  — an older remote entry is positioned before newer local ones rather
  than appended after, multiple new entries interleave into full
  chronological order, eviction past `max` keeps the newest by `sentAt`
  rather than by array position, inputs aren't mutated, and an empty
  `newEntries` is a no-op). `SpeechSendLogStore`/`useSpeechSendLogSync`
  themselves aren't independently tested, matching this repo's existing
  convention (no test anywhere in this repo covers either).

  Ran the full verification gate: `bun install`, the updated test file (25
  passing, 5 new cases) plus `debate-editor`'s own `bunx vitest run` (37
  files, 799 tests) and `bunx tsc --noEmit` (clean), `bun run test` (479
  files, 9020 tests passing, repo-wide), `bunx turbo run typecheck` (17/17 packages
  green, `debate-ai-web` included), and `bun run build:web` (production
  build succeeded; the build's regenerated
  `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts` and
  `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable. Docs
  updated: `speech-documents-cloud-save.mdx`'s Known gaps entry (marked
  fixed).

- **⚙️ `/tools` now shows the account tool-data sync status, with a manual
  retry and a way back in for an opted-out guest.** Another repeat of the
  standing autonomous-routine prompt above — as with every prior repeat
  (reconfirmed fresh this run: 84 `user.id` references across `saved_*` D1
  tables in `apps/debate-ai.com/lib/database/schema.ts`, `TOOL_RECORD_COLLECTIONS`
  syncs every localStorage-backed tool without its own dedicated table to the
  account, and every tool is reachable from `/tools`, CardMirror's
  `MenuBar`/command palette, and the feature catalog), that prompt's own asks
  are already fully built. There were no open PRs and this branch carried no
  unfinished work of its own (its prior commits were already on `master`), so
  a subagent scanned `packages/debate-help-docs` "Known gaps" sections for a
  fresh, concretely-scoped candidate, verifying each against current source.
  It picked `internals/tool-data-sync.mdx`'s: "Nothing surfaces the sync any
  more, and two things can only be reached through it. A guest who picked
  'don't ask me again' has no way back short of clearing site data, and a
  collection whose merge failed has no Sync now to retry with."

  Confirmed still open: `apps/debate-ai.com/app/settings/page.tsx` is now
  only `CardMirrorSettingsPanel` — the status list `useToolRecordSync`'s own
  doc comment still says is "for the `/settings` status list" was removed
  when that page became the card editor's settings, and nothing replaced it.
  `useToolRecordSync`'s `results`/`resync` and
  `setSignInPromptOptedOut(false)` (the opt-out's undo path) were both fully
  built and had zero call sites in app code.

  `apps/debate-ai.com/lib/tools/tool-sync-status.ts` adds a pure
  `summarizeToolSyncFailures(results)`, turning the hook's raw per-collection
  results into the one thing worth surfacing without reading every row: which
  tools, if any, actually failed (not merely unsynced because nobody is
  signed in — `ToolRecordHydrationResult.error` is only set for a real
  failure), with each one's label and link via `findToolRecordCollection`.
  `components/tools/ToolSyncStatusPanel.tsx` (new, mounted on `/tools` above
  `MySavedItems`, per the doc's own "`/tools`, say" suggestion) renders it:
  an "Account sync" row with a **Sync now** button wired to `resync()`, the
  failure list underneath when there is one, and — when signed out and the
  guest has opted out of the sign-in prompt — a "Turn sign-in reminders back
  on" button calling `setSignInPromptOptedOut(false)`.

  Vitest-covered: `apps/debate-ai.com/lib/tools/__tests__/tool-sync-status.test.ts`
  (6 cases — a real failure surfaces with its label/link, a signed-out-shaped
  `synced: false` with no `error` is not mistaken for a failure, a synced
  result with a stray `error` is ignored, a result for a collection key the
  catalog no longer recognizes is dropped, multiple failures sort by label,
  and an empty result list). `ToolSyncStatusPanel` itself isn't independently
  tested — no component test in this app renders a `useSession`-backed
  component (0 found), matching this repo's existing convention for
  DOM/hook-wired components elsewhere in this file's history.

  Ran the full verification gate: `bun install`, the new test file (6
  passing) plus `bun run test` (479 files, 9012 tests passing, repo-wide, up
  6 from the new cases), `bunx tsc --noEmit` on the web app (clean),
  `bunx turbo run typecheck` (17/17 packages green, `debate-ai-web`
  included), and `bun run build:web` (production build succeeded, `/tools`
  present in the route list; the build's regenerated
  `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts` and
  `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable. Docs
  updated: `internals/tool-data-sync.mdx`'s Known gaps entry (marked fixed,
  and the oversized-record bullet's now-stale "the row that read it is not"
  line corrected) and Tests list. Shipped as
  [PR #884](https://github.com/debate/debate-ai.com/pull/884).

- **🎯 Related-videos' "same tournament" pass no longer pulls in a video that
  merely mentions the tournament in its description.** Another repeat of the
  standing autonomous-routine prompt above — as with every prior repeat
  (reconfirmed fresh this run: 19+ `saved_*` D1 tables link to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), `TOOL_RECORD_COLLECTIONS`
  entries sync every localStorage-backed tool without its own dedicated
  table to the account, and every tool is reachable from `/tools`,
  CardMirror's `MenuBar`/command palette, and the feature catalog), that
  prompt's own asks are already fully built. There was one open PR (#880,
  "Merge claude/gifted-babbage-ix0e8a into master") — confirmed fully
  superseded (its single commit is identical, file-for-file, to the
  already-merged #875) and closed as such rather than built on. No other
  unfinished branch work existed, so this run had a subagent scan
  `packages/debate-help-docs` "Known gaps" sections for a fresh,
  concretely-scoped candidate, verifying each against current source rather
  than trusting the doc text. It picked
  `internals/video-watch-page.mdx`'s: "the tournament pass is a `LIKE`
  search on the tournament name, so a tournament whose name appears in
  unrelated descriptions pulls those in too."

  Confirmed still open: `getRelatedVideos`
  (`apps/debate-ai.com/lib/videos/video-repository.ts`) built its "same
  tournament" pass as `{ source: "all", q: tournamentName, sort: "Recency" }`
  — routing the tournament name through the generic `q` free-text filter,
  which matches against title, channel *and description* (`searchText` in
  the JSON fallback, a `LIKE` over the same concatenation in SQL), even
  though every video row already carries its own dedicated `tournament`
  field/column that nothing filtered on directly.

  `VideoQueryParams` (`packages/debate-data-sync/src/videos/video-query.ts`)
  gains a `tournament?: string | null` field, applied in `filterVideoRows`
  as a case-insensitive substring match against `row.tournament` alone (not
  `searchText`). `buildConditions`
  (`apps/debate-ai.com/lib/videos/video-repository.ts`) mirrors it as a
  `LIKE` on the `videos.tournament` column for the SQL backend, matching the
  file's existing categoryKey/style predicate pattern. `getRelatedVideos`'s
  tournament pass now passes `{ tournament: tournamentName, ... }` instead
  of `{ q: tournamentName, ... }`.

  Vitest-covered:
  `packages/debate-data-sync/test/video-query.test.ts` gains two new
  `filterVideoRows` cases — a case-insensitive tournament match that
  excludes a different-tournament video whose description merely mentions
  the search term (the exact false positive the doc described, shown
  side-by-side against `q`'s broader match on the same input to make the
  fix's effect explicit), and a row with no tournament value is dropped when
  a tournament filter is set. The SQL `buildConditions` mirror and
  `getRelatedVideos`'s two-line wiring change aren't independently tested —
  matching this file's own header comment that the filter semantics are
  "expressed twice... and [the JSON fallback] is what the unit tests
  exercise," the same convention its existing categoryKey/style/source
  predicates already follow; no test file for `video-repository.ts` exists
  in this repo (getRelatedVideos/getVideoPage have never had one).

  Ran the full verification gate: `bun install`, the updated test file (39
  passing, up from 37) plus `debate-data-sync`'s own `bunx vitest run` (34
  files, 618 tests) and `bunx tsc --noEmit` (clean), `bun run test` (478
  files, 9001 tests passing, repo-wide), `bunx turbo run typecheck` (17/17
  packages green, `debate-ai-web` included), and `bun run build:web`
  (production build succeeded; the build's regenerated
  `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts` and
  `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable. Docs
  updated: `internals/video-watch-page.mdx`'s Known gaps entry (split in
  two; the `LIKE`-across-descriptions half marked fixed, the "query passes,
  not a relevance model" framing left open as a genuine, larger follow-up).
  Shipped as
  [PR #881](https://github.com/debate/debate-ai.com/pull/881).

- **🔁 Eleven tool-record collections were syncing to two different D1 tables
  at once — one of them dead.** Another repeat of the standing
  autonomous-routine prompt above — reconfirmed again this run: 31 `saved_*`
  tables in `apps/debate-ai.com/lib/database/schema.ts` link to `user.id`, and
  every tool is reachable from `/tools`, the command palette, and the feature
  catalog. There were no open PRs and no unfinished work on this branch's
  prior PR (`#878`, already merged; this branch restarted from `master`'s
  tip), so this run searched for a fresh, concrete gap in the tool-sync layer
  itself rather than repeating that reconfirmation as the whole slice.

  Found one: `packages/debate-data-sync/src/state/toolRecordCollections.ts`'s
  own header comment says joining `TOOL_RECORD_COLLECTIONS` exists so a tool
  doesn't need "a bespoke table, route, client and hook" — explicitly citing
  `saved_drill_sets` as the *old* pattern it replaces. But `drillSets` was
  still an entry in that same list, alongside ten other tools that also
  already had their own dedicated table, route and hook: `judgeDecisions`
  (`saved_judge_decisions`), `counselPanelAssessments`
  (`saved_counsel_panel_assessments`), `coachMaterials` /
  `coachMaterialVersions` (`saved_coach_materials` /
  `saved_coach_material_versions`), `customOpponentPersonaLibrary`
  (`saved_custom_opponent_personas`), `wordCountRounds`
  (`saved_word_count_rounds`), `roundPairings` (`saved_round_pairings`),
  `strategyRecommendations` (`saved_strategy_recommendations`),
  `sprintSessions` (`saved_sprint_sessions`), and `dailyBestCardComments`
  (`saved_daily_best_card_comments`). Each one's real panel reads and writes
  only its dedicated table through its own hook (confirmed none of the eleven
  hooks import anything from `debate-data-sync`); the generic catalog entry
  meant `tool-record-auto-sync.ts`'s 15-second watcher *also* pushed the exact
  same `localStorage` key (verified by matching `STORAGE_KEY` constants) to
  `saved_tool_records` — rows nothing ever reads back. Net effect: wasted D1
  writes and API calls every 15s per open tab across eleven tools, and a
  second, stale copy of each tool's data sitting in `saved_tool_records` that
  a future caller of that generic table (an admin view, an export) would read
  instead of the real one.

  This wasn't a design choice that just needed documenting — the same doc
  file already listed word-count rounds and drill sets as tools whose
  bespoke-table pattern *predates* the generic catalog and that the catalog
  was built to extend to tools that "had nothing," while separately listing
  both as generic-catalog entries in its own tool-by-tool breakdown. The
  catalog entries were removed (not the bespoke tables — those are correct
  and are what each tool's UI actually uses) since nothing pointed at the
  generic copies to begin with.

  Vitest-covered: `packages/debate-data-sync/test/toolRecordCollections.test.ts`
  gains a regression test asserting all eleven keys are no longer
  `isSyncedToolCollection`, and `test/tool-record-catalog.test.ts`'s
  `EXPECTED_ID_FIELDS` map (which already fails the suite on any stale
  entry) had its eleven matching rows removed to match.

  Ran the full verification gate: `bun install`, the two touched
  `debate-data-sync` test files plus that package's own `bunx vitest run` (34
  files, 616 tests) and `bunx tsc --noEmit` (clean), `debate-videos`'s own
  `bunx vitest run` (43 files, 488 tests, unaffected — its
  `tool-record-sync-catalog.test.ts` only asserts every *remaining* entry's
  route is a real sidebar link), `bun run test` (478 files, 8999 tests
  passing, repo-wide, up one from the new regression test),
  `bunx turbo run typecheck` (17/17 packages green, `debate-ai-web` included),
  and `bun run build:web` (production build succeeded; the build's
  regenerated `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts`
  and `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable. Docs
  updated: `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx`'s
  "Which tools sync" breakdown moved these eleven tools out of the
  generic-table paragraphs and into an explicit list of tools that sync
  through their own table instead, and its "Tools already backed by a
  `saved_*` table" line now names all eleven; and
  `features/daily-best-card.mdx`'s Known gaps entry, which had incorrectly
  attributed `dailyBestCardComments`'s sync to the shared Tool Data Sync
  mechanism, now correctly points at its own dedicated table.

- **🏷️ The video list table's Tournament column no longer shows a literal
  "$1" for tournaments like "TOC21"/"Nats18".** Another repeat of the
  standing autonomous-routine prompt above — as with every prior repeat,
  that prompt's own asks (tool integration, user settings, SQL-linked
  flows/docs/debates) are already fully built, confirmed again this run:
  `apps/debate-ai.com/lib/database/schema.ts` still links every `saved_*`
  table to `user.id`, and `TOOL_RECORD_COLLECTIONS`
  (`packages/debate-data-sync/src/state/toolRecordCollections.ts`) still
  syncs every localStorage-backed tool to the account. There were no open
  PRs to build on, but this branch itself already carried unfinished work:
  a bare, message-less commit (`.`) had added
  `cleanTournamentName` to
  `packages/debate-videos/src/components/video-grid/VideoListRows.tsx` —
  used to shorten a round's Tournament column cell (e.g. "Tournament of
  Champions 2023" → "TOC") — with no tests, no docs, and a real bug still
  live in it. Per this routine's own "resume existing work assigned to this
  branch" rule, this run finished it rather than starting a fresh slice.

  The bug: `.replace(/\b(?:TOC|Nats)\d{2}\b/gi, "$1")` used a
  *non-capturing* group (`(?:...)`) but replaced with `"$1"`. With no
  capture group 1 to back-reference, JavaScript's `String.replace` inserts
  the literal two-character string `"$1"` instead of substituting anything —
  so any tournament matching that pattern rendered as `$1` in the table
  instead of its abbreviation. This wasn't hypothetical: `"TOC21"`,
  `"Nats18"`, and `"Nats16"` are real `tournament` values in
  `debate-data-sync/data/videos/rounds-pf.json`. Fix: add the capturing
  group the replacement already assumed —
  `.replace(/\b(TOC|Nats)\d{2}\b/gi, "$1")` — one character. `"TOC21"` now
  cleans to `"TOC"`; `"Nats18"`/`"Nats16"` clean to `undefined` (empty),
  same as this function already did for a bare `"Nationals"`, since "Nats"
  alone is one of the generic org words it strips outright.

  Vitest-covered: new
  `packages/debate-videos/test/video-tournament-name.test.ts` (5 cases) —
  empty/null input, the `TOC21`/`Nats18`/`Nats16`/`TOC 2025` regression
  fixtures (confirmed to fail with the literal `"$1"` before the fix, pass
  after), full-name-to-abbreviation expansion, round/org-word stripping
  against real `rounds-*.json` values pulled from the repo's own data, and
  a no-noise pass-through case.

  Ran the full verification gate: `bun install`, the new test file (5
  passing) plus `packages/debate-videos`'s own `bunx vitest run` (43 files,
  488 tests, up from 42/483), `bun run test` (478 files, 8998 tests
  passing, repo-wide), `bunx turbo run typecheck` (17/17 packages green,
  `debate-ai-web` and `debate-help-docs` included), and `bun run build:web`
  (production build succeeded; the build's regenerated
  `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts` and
  `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable. Docs
  updated: `packages/debate-help-docs/content/docs/features/video-library.mdx`
  gains a new "List layout" section — this function, and its Tournament
  column, had no doc coverage at all until now. Shipped as
  [PR #878](https://github.com/debate/debate-ai.com/pull/878).

- **🎥 The video watch page's fullscreen button now fullscreens the video
  alone, not the whole left-column stage.** Another repeat of the standing
  autonomous-routine prompt above — as with every prior repeat (reconfirmed
  fresh this run: 19+ `saved_*` D1 tables link to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), all 65
  `TOOL_RECORD_COLLECTIONS` entries sync through `saved_tool_records`, and
  every tool is reachable from `/tools`, CardMirror's `MenuBar`/command
  palette, and the feature catalog), that prompt's own asks are already
  fully built. There were no open PRs, but two prior runs had left
  finished, unshipped work sitting on orphaned branches with no PR ever
  opened for them: `claude/gifted-babbage-ix0e8a` (a rankings/NDT fix that
  turned out to already be on `master` under a different commit, landed as
  [PR #875](https://github.com/debate/debate-ai.com/pull/875) — that branch
  is now fully superseded and needs nothing further) and
  `claude/gifted-babbage-22ld6c`, built on top of it, which added one more
  commit never folded into any PR: `handleToggleFullscreen`
  (`packages/debate-videos/src/panels/watch/VideoWatchPage.tsx`) called
  `requestFullscreen()` on `stageRef` — the outer div wrapping the toolbar,
  video, *and* the title/description column beside it — instead of
  `videoWrapperRef`, the tighter ref around just the iframe that the
  picture-in-picture handoff already uses. Confirmed the bug was still live
  on current `master` before reusing the fix (this exact prior-run
  regression is why "resume existing work instead of duplicating effort"
  matters here): a viewer clicking "Fullscreen" got the metadata column
  fullscreened alongside the video, not the video alone.

  Reapplied that orphaned commit's substantive diff onto current `master`
  (its own `TODO.md` hunk didn't apply cleanly against this file's current
  state, so that part was written fresh instead of reused) rather than
  re-deriving the fix from scratch: `handleToggleFullscreen` now calls
  `requestFullscreen()` on `videoWrapperRef`, and the now-unused `stageRef`
  is removed.

  Vitest-covered: `packages/debate-videos/test/video-watch-page.test.tsx`
  gains a case that stubs `HTMLElement.prototype.requestFullscreen` to
  record which element it was called on, clicks the Fullscreen button, and
  asserts the call landed on the video wrapper and never on the surrounding
  stage.

  Ran the full verification gate: `bun install`, the updated test file (7
  passing) plus `debate-videos`'s own `bunx vitest run` (42 files, 483
  tests) and `bunx tsc --noEmit` (clean), `bun run test` (477 files, 8993
  tests passing, repo-wide), `bunx turbo run typecheck` (17/17 packages
  green, `debate-ai-web` included), and `bun run build:web` (production
  build succeeded; the build's regenerated
  `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts` and
  `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable. Docs
  updated: `internals/video-watch-page.mdx`'s Known gaps entry (marked
  fixed).

- **🧭 The tool-catalog consistency test now walks `app/` itself, instead of
  only cross-checking the three hand-maintained catalogs against each
  other.** Another repeat of the standing autonomous-routine prompt above
  — as with every prior repeat (reconfirmed fresh this run: 19+ `saved_*`
  D1 tables link to `user.id` (`apps/debate-ai.com/lib/database/schema.ts`),
  all 65 `TOOL_RECORD_COLLECTIONS` entries sync through
  `saved_tool_records`, and every tool is reachable from `/tools`,
  CardMirror's `MenuBar`/command palette, and the feature catalog), that
  prompt's own asks are already fully built. There were no open PRs to
  build on, and this branch's own prior history (PRs #869–#875) had already
  landed on `master` by the time this run started, so this is a fresh slice
  on top of current `master`. A dedicated subagent scanned every
  `packages/debate-help-docs` doc's "Known gaps"/"Known limitations"
  section (79 files have one) for a still-open, concretely-scoped,
  single-PR item, cross-checking each candidate against current source
  rather than trusting the doc text, and turned up several stale entries
  (already fixed in code without the doc being updated: the outline-preset
  jump-to-round gap, a roster-analytics gap, a feature-catalog drift gap,
  and a breadcrumb multi-pane gap) before landing on
  `internals/features-page.mdx`'s: "The catalog is a hand-maintained
  registry, so a new route has to be added to it as well. Nothing fails if
  it isn't — the tests assert the catalog's internal consistency, not that
  it covers every file under `apps/debate-ai.com/app/`, because the app is
  outside the packages Vitest runs over."

  Confirmed still open: `apps/debate-ai.com/lib/__tests__/tool-catalog-consistency.test.ts`
  only cross-checked `ALL_TOOLS` (`/tools`), `APP_FEATURES` (`/features`),
  and `WORKSPACE_LINKS` (the Reason Editor's Workspace menu) against each
  other — a route added to `app/` and to none of the three reached no
  catalog at all with nothing to catch it.

  That test file gains a `findAppPageRoutes` walker (plain `node:fs`/
  `node:path`, mirroring the existing precedent in
  `lib/database/__tests__/migration-sql.test.ts`) that collects every
  route under `apps/debate-ai.com/app/` with its own `page.tsx` (skipping
  `api/`, which has none), filtered down to static routes — a
  dynamic-segment route like `/cards/leaderboard/[contributorId]` is a
  detail page under an already-covered static parent, not a distinct
  catalog entry, so it's excluded from the requirement rather than added to
  it. A new test asserts every one of those 62 static routes appears in at
  least one of the three catalogs, except a documented
  `ROUTES_WITHOUT_A_CATALOG_ENTRY` (the homepage, `/admin`, the two
  auth-flow steps, `/legal/privacy`, `/login` — already established
  elsewhere in this same file as "a step on the way to a feature rather
  than a feature" — and the editor's own two settings pages; `/features`
  and `/tools` are the catalog pages themselves, and `/tools` needed no
  entry in the exclude set since `WORKSPACE_LINKS`'s own trailing "All
  Tools" link already covers it). A companion test keeps that exclude set
  honest the same way the file's pre-existing exclude sets already are —
  each excluded route must really be absent from every catalog — and a
  canary test guards against the walker silently resolving to the wrong
  directory and returning nothing.

  Vitest-covered by construction: the new checks are tests, not
  implementation with tests bolted on. Confirmed they fail correctly before
  the fix — deliberately mis-adding `/tools` to the exclude set (already
  covered via `WORKSPACE_LINKS`) failed the "keeps ... honest" case with a
  clear message during development, then passed once removed.

  Ran the full verification gate: `bun install`, the updated test file (8
  passing, up from 5) plus `bun run test` (477 files, 8992 tests passing,
  repo-wide), `bunx turbo run typecheck` (17/17 packages green,
  `debate-ai-web` included), and `bun run build:web` (production build
  succeeded; the build's regenerated
  `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts` and
  `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable. Docs
  updated: `internals/features-page.mdx`'s Known gaps entry (marked fixed)
  and Tests list. Shipped as
  [PR #876](https://github.com/debate/debate-ai.com/pull/876).

- **🔗 A renamed REASON document's old URL now redirects to it instead of
  falling through to "first file."** Another repeat of the standing
  autonomous-routine prompt above — as with every prior repeat (reconfirmed
  fresh this run: 19 `saved_*` D1 tables link to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), all 65
  `TOOL_RECORD_COLLECTIONS` entries sync through `saved_tool_records`, and
  every tool is reachable from `/tools`, CardMirror's `MenuBar`/command
  palette, and the feature catalog), that prompt's own asks are already fully
  built. There were no open PRs to build on. A general Explore pass across
  three fresh `packages/debate-help-docs` "Known gaps" candidates (an
  in-grid flow-annotation indicator, a synced-deck-management UI, and this
  one) found the other two either not actually small — the "ebb flow" grid
  package has no dependency on the annotation data's package, and the two
  address boxes/cells by incompatible schemes — or premised on UI that no
  longer exists (the "deck scope picker" doc referenced was retired months
  ago, with zero live call sites for deck create/rename/delete). This run
  picked `internals/reason-docs-sidebar.mdx`'s remaining small, concrete one:
  "Renaming a file changes its URL, and nothing redirects the old one."

  `documents` gets a nullable `previous_slug` column
  (`apps/debate-ai.com/drizzle/0046_document_previous_slug.sql`, hand-written
  to match this repo's migration lineage rather than `drizzle-kit generate`'s
  output — its tracked snapshot history is stale relative to the files
  already on disk past `0035`, the same drift `lib/database/migration-sql.ts`'s
  own header already documents). `PUT /api/doc/documents/:id` now sets it to
  `slugifySegment(doc.title)` — the file's own slug just before this edit —
  whenever a title change actually moves the slug; a capitalization/
  punctuation-only edit that resolves to the same slug leaves it alone, and an
  old title with nothing sluggable in it (already falls back to the row id)
  has nothing worth remembering. `lib/reason-docs/doc-path.ts#findItemByRef`
  gets a new `previousPath` fallback: for each file, its current path with
  only the leaf segment swapped back to `previousSlug`, tried the same
  exact-then-suffix way the current path already is, after both of those come
  up empty and before the folder/first-file fallback. This remembers one
  rename back, not a full history, and only a file's own leaf rename — a
  folder rename (which would move every path under it) isn't tracked, matching
  the doc's own scoped wording ("Renaming *a file*").

  Vitest-covered: `apps/debate-ai.com/lib/reason-docs/__tests__/doc-path.test.ts`
  gets a new `describe` block (5 cases — old bare name and old full path both
  still resolve while the new name also does, only one rename back is
  remembered, an old name two files' *previous* paths would now share is
  refused rather than guessed, a never-renamed file is unaffected, and a
  folder's own rename is not considered). The route handler's `previousSlug`
  write itself isn't independently tested — no route handler anywhere in
  `apps/debate-ai.com/app/api` has a test file in this repo (0 found, matching
  prior runs' finding), so this doesn't add the first one; the pure slug-diff
  condition it applies (`oldSlug && oldSlug !== slugifySegment(nextTitle)`) is
  a direct, easily-audited call into the now-tested `slugifySegment`.

  Ran the full verification gate: `bun install`, the new/updated test file
  (26 passing, 5 new cases) plus this package's own
  `bunx vitest run lib/reason-docs` (5 files, 101 tests), `bun run test` (477
  files, 8986 tests passing, repo-wide), `bunx turbo run typecheck` (17/17
  packages green, `debate-ai-web` included), and `bun run build:web`
  (production build succeeded; the build's regenerated
  `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts` and
  `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable. Docs
  updated: `internals/reason-docs-sidebar.mdx`'s Known gaps entry (marked
  fixed) and its "The URL is the file's name" section's "Forgiving" bullet
  (describes the new one-rename-back redirect). Unlike every prior repeat of
  this routine, the branch this ran on had *not* already been merged to
  `master` by another agent run, so — per this routine's own PR workflow —
  this is the first slice of it to actually need one:
  [PR #874](https://github.com/debate/debate-ai.com/pull/874).

- **🎬 The video watch page's PiP toggle no longer loses a resumed video's
  position when toggled before playback reports in.** Another repeat of the
  standing autonomous-routine prompt above — as with every prior repeat
  (reconfirmed fresh this run: 19 `saved_*` D1 tables link to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), all 65
  `TOOL_RECORD_COLLECTIONS` entries sync through `saved_tool_records`, and
  every tool is reachable from `/tools`, CardMirror's `MenuBar`/command
  palette, and the feature catalog), that prompt's own asks are already
  fully built. There were no open PRs to build on (the branch this routine
  runs on had already been fully merged to `master` — via other agent
  runs' branches carrying the same commits — before this run started, so
  no PR was needed for prior work either). Re-scanned every remaining
  `packages/debate-help-docs` doc's "Known gaps" section for a still-open,
  small, concretely-scoped item and picked
  `internals/video-watch-page.mdx`'s: "a video closed in the first second
  before any broadcast arrives resumes from 0."

  Investigating that gap found the actual mechanism: `VideoWatchPage.tsx`'s
  `currentTimeRef` — the ref that both the popout-handoff cleanup and the
  picture-in-picture toggle read the "current position" from — was seeded
  to a hard `0` on mount rather than to the video's own resolved saved
  position, and only ever advanced once YouTube's first `infoDelivery`
  broadcast arrived. The popout-handoff path already guarded against this
  (`if (seconds > 0 ...)`, so a stray `0` there never overwrote a real saved
  position), but `handleTogglePip`'s `setResumeSeconds(currentTimeRef.current)`
  has no such guard, and moving the iframe into the PiP window resets its
  navigation state, forcing a reload from `resumeSeconds`. Toggling PiP
  before the first `infoDelivery` broadcast therefore reopened the popped-out
  embed at `0` instead of wherever the video had actually opened.

  Fix is one seed: the mount effect in
  `packages/debate-videos/src/panels/watch/VideoWatchPage.tsx` now reads the
  store's resolved `startTime` right after `setActiveVideo` and assigns it to
  `currentTimeRef.current` (previously hard-coded to `0`) in the same place
  it already used that value for `startSeconds` — one extra line, no new
  state, no change to the normal path once `infoDelivery` starts reporting.

  Vitest-covered:
  `packages/debate-videos/test/video-watch-page.test.tsx` gets a new case
  that opens a video at a saved timestamp, toggles PiP (via a stubbed
  `window.documentPictureInPicture`) before ever dispatching a simulated
  `infoDelivery` message, and asserts the iframe's rebuilt `src` still opens
  at the saved second — confirmed to fail (asserting `null` instead of the
  saved second) against the pre-fix code, then pass against the fix.

  Ran the full verification gate: `bun install`, the updated test file (6
  passing) plus `packages/debate-videos`'s test file directly, `bun run test`
  (repo-wide, 477 files / 8980 tests passing — same counts as before this
  change, since this only adds one new passing case), `bunx turbo run
  typecheck` (17/17 packages green, `debate-ai-web` included), and `bun run
  build:web` (production build succeeded; the build's regenerated
  `apps/debate-ai.com/lib/offline-sw/{app-file-list,version}.ts` and
  `public/service-worker.js` were reverted rather than committed, since
  nothing they describe changed). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable. Docs
  updated: `internals/video-watch-page.mdx`'s Known gaps entry (marked
  fixed, and the section reformatted from one paragraph into a bulleted
  list so a fixed item can be struck through without reflowing the other
  two).

- **🏆 NDT leaderboard tab explains itself instead of rendering nothing.**
  Another repeat of the standing autonomous-routine prompt above — as with
  every prior repeat (reconfirmed fresh this run: 19+ `saved_*` D1 tables
  link to `user.id` (`apps/debate-ai.com/lib/database/schema.ts`), all 65
  `TOOL_RECORD_COLLECTIONS` entries sync through `saved_tool_records`, and
  every tool is reachable from `/tools`, CardMirror's `MenuBar`/command
  palette, and the feature catalog), that prompt's own asks are already
  fully built. There were no open PRs to build on. This run had a subagent
  scan every `packages/debate-help-docs` doc's "Known gaps" section (79 of
  92 files have one) for a still-open, concretely-scoped, single-PR item —
  the two most self-contained were `internals/team-rankings.mdx`'s
  hardcoded `CURRENT_YEAR` (skipped: auto-deriving a debate season from the
  calendar date is a product decision about when TOC's bid list actually
  rolls over, not something this routine should guess at) and its "NDT
  appears as a division tab but has no ranking source; the hook
  short-circuits it to an empty table" — picked, since it's a pure UI/UX
  gap with no external data-source ambiguity.

  Reading `RankingsLeaderboardPanel.tsx` showed the empty-table framing was
  already half-fixed (a `division === "NDT"` branch skips the table
  entirely, showing only the champion/topic banner), but when a season had
  no champion history either — or the tab was still loading — the panel
  rendered nothing at all, indistinguishable from a stuck loading state.
  `packages/debate-videos/src/panels/leaderboard/leaderboardUtils.ts`'s
  `DIVISION_CONFIG` gets a new `hasLiveLeaderboard: boolean` field
  (`true` for VPF/VLD/VCX, `false` for NDT) and an exported
  `hasLiveLeaderboard(division)` lookup, replacing the ad hoc `"NDT"`
  string check in both `RankingsLeaderboardPanel.tsx` (which now also
  renders an explanatory "No live team leaderboard is published for
  College NDT…" notice once `championsLoading` resolves) and
  `useLeaderboardData.ts`'s hook.

  Vitest-covered: `packages/debate-videos/test/leaderboard-utils.test.ts`
  gets a new `describe("hasLiveLeaderboard")` block (VPF/VLD/VCX true, NDT
  false, an unrecognized division falls back to false). The panel's JSX
  branch itself isn't independently tested, matching this package's
  existing convention (no test in `debate-videos` renders
  `RankingsLeaderboardPanel`/`LeaderboardView`; only their pure logic
  modules are unit-tested).

  Ran the full verification gate: `bun install`, the updated test file (15
  passing) plus `packages/debate-videos`'s own `bunx vitest run` (42 files,
  481 tests), `bun run test` (477 files, 8983 tests passing, repo-wide),
  `bunx turbo run typecheck` (17/17 packages green, `debate-ai-web`
  included), and `bun run build:web` (production build, succeeded — the
  pre-existing `no output files found for task debate-editor#build`
  warning is unrelated `turbo.json` `outputs` config, not a build failure;
  the build's generated `offline-sw` file-list/version/service-worker
  artifacts were reverted, not committed, since they're regenerated on
  every build and unrelated to this change). No `lint`/`format:check`
  script exists anywhere in this repo, so that step was skipped as not
  applicable. Docs updated: `internals/team-rankings.mdx`'s Known gaps
  entry (NDT bullet reworded to describe the new notice; the
  `CURRENT_YEAR` bullet is unchanged and left as a genuine follow-up).

- **🏆 NDT leaderboard tab explains itself instead of rendering nothing.**
  Another repeat of the standing autonomous-routine prompt above — as with
  every prior repeat (reconfirmed fresh this run: 19+ `saved_*` D1 tables
  link to `user.id` (`apps/debate-ai.com/lib/database/schema.ts`), all 65
  `TOOL_RECORD_COLLECTIONS` entries sync through `saved_tool_records`, and
  every tool is reachable from `/tools`, CardMirror's `MenuBar`/command
  palette, and the feature catalog), that prompt's own asks are already
  fully built. There were no open PRs to build on. This run had a subagent
  scan every `packages/debate-help-docs` doc's "Known gaps" section (79 of
  92 files have one) for a still-open, concretely-scoped, single-PR item —
  the two most self-contained were `internals/team-rankings.mdx`'s
  hardcoded `CURRENT_YEAR` (skipped: auto-deriving a debate season from the
  calendar date is a product decision about when TOC's bid list actually
  rolls over, not something this routine should guess at) and its "NDT
  appears as a division tab but has no ranking source; the hook
  short-circuits it to an empty table" — picked, since it's a pure UI/UX
  gap with no external data-source ambiguity.

  Reading `RankingsLeaderboardPanel.tsx` showed the empty-table framing was
  already half-fixed (a `division === "NDT"` branch skips the table
  entirely, showing only the champion/topic banner), but when a season had
  no champion history either — or the tab was still loading — the panel
  rendered nothing at all, indistinguishable from a stuck loading state.
  `packages/debate-videos/src/panels/leaderboard/leaderboardUtils.ts`'s
  `DIVISION_CONFIG` gets a new `hasLiveLeaderboard: boolean` field
  (`true` for VPF/VLD/VCX, `false` for NDT) and an exported
  `hasLiveLeaderboard(division)` lookup, replacing the ad hoc `"NDT"`
  string check in both `RankingsLeaderboardPanel.tsx` (which now also
  renders an explanatory "No live team leaderboard is published for
  College NDT…" notice once `championsLoading` resolves) and
  `useLeaderboardData.ts`'s hook.

  Vitest-covered: `packages/debate-videos/test/leaderboard-utils.test.ts`
  gets a new `describe("hasLiveLeaderboard")` block (VPF/VLD/VCX true, NDT
  false, an unrecognized division falls back to false). The panel's JSX
  branch itself isn't independently tested, matching this package's
  existing convention (no test in `debate-videos` renders
  `RankingsLeaderboardPanel`/`LeaderboardView`; only their pure logic
  modules are unit-tested).

  Ran the full verification gate: `bun install`, the updated test file (15
  passing) plus `packages/debate-videos`'s own `bunx vitest run` (42 files,
  481 tests), `bun run test` (477 files, 8983 tests passing, repo-wide),
  `bunx turbo run typecheck` (17/17 packages green, `debate-ai-web`
  included), and `bun run build:web` (production build, succeeded — the
  pre-existing `no output files found for task debate-editor#build`
  warning is unrelated `turbo.json` `outputs` config, not a build failure;
  the build's generated `offline-sw` file-list/version/service-worker
  artifacts were reverted, not committed, since they're regenerated on
  every build and unrelated to this change). No `lint`/`format:check`
  script exists anywhere in this repo, so that step was skipped as not
  applicable. Docs updated: `internals/team-rankings.mdx`'s Known gaps
  entry (NDT bullet reworded to describe the new notice; the
  `CURRENT_YEAR` bullet is unchanged and left as a genuine follow-up).

- **📇 Quick Cards full-library "clear" now issues one bulk delete instead of
  one per card.** Another repeat of the standing autonomous-routine prompt
  above — as with every prior repeat (reconfirmed fresh this run: 19
  `saved_*` D1 tables link to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), all 65
  `TOOL_RECORD_COLLECTIONS` entries sync through `saved_tool_records`, and
  every tool is reachable from `/tools`, CardMirror's `MenuBar`/command
  palette, and the feature catalog), that prompt's own asks are already
  fully built. There were no open PRs to build on. This run first
  investigated this file's own flagged follow-up —
  `docs/internals/quest-streaks.mdx`'s "wire mission-result computation to
  the weekly cron" gap — and confirmed it's more blocked than previously
  framed: `computeAndSavePersistedDailyMissionResult`
  (`packages/debate-contributor-progress/src/state/dailyMissionResults.ts`)
  derives a day's result from `state/contributions.ts`, which is pure
  browser `localStorage` with no D1 table or server API at all, so the
  Worker's `scheduled` export (`apps/debate-ai.com/worker/index.ts`) has
  nothing server-side to iterate — this needs a new D1 table and sync layer
  (a real backend-architecture decision, including how to migrate existing
  localStorage data), not a single-PR wiring fix, so it stays a follow-up,
  reframed below. Re-scanned other `packages/debate-help-docs` "Known gaps"
  sections instead and picked `quick-cards-cloud-save.mdx`'s: a full-library
  "clear" issued one `DELETE /api/quick-cards/[cardId]` call per card
  instead of a single bulk request, unlike `/api/tool-records/[collection]`'s
  existing bulk-clear route for the sidebar's other localStorage-backed
  tools.

  `apps/debate-ai.com/app/api/quick-cards/route.ts` gets a new `DELETE`
  handler (mirroring `/api/tool-records/[collection]`'s) that deletes every
  `saved_quick_cards` row for the signed-in user in one query.
  `packages/debate-editor/src/editor/quick-cards-client.ts` gets a matching
  `clearSavedQuickCardsFromAccount()`. `quick-cards-store.ts`'s `clear()`
  now calls it once instead of looping `deleteSavedQuickCardFromAccount`
  per id.

  Vitest-covered: `packages/debate-editor/test/quick-cards-client.test.ts`
  gets a new `describe` block for `clearSavedQuickCardsFromAccount` (the
  right endpoint/method, and the server-error-message passthrough).
  `packages/debate-editor/test/quick-cards-store.test.ts`'s existing clear
  test now asserts a single bulk-clear call instead of one delete per card
  (its shared `stubFetch` helper learned to route a DELETE to the bare
  `/api/quick-cards` endpoint to a new `onClear` callback). The API route's
  `DELETE` handler itself isn't independently tested — no route handler in
  `apps/debate-ai.com/app/api` has a test file in this repo (0 found), so
  this doesn't add the first one.

  Ran the full verification gate: `bun install`, the two updated test files
  (34 passing) plus `packages/debate-editor`'s own `bunx vitest run` (37
  files, 794 tests), `bun run test` (477 files, 8980 tests passing,
  repo-wide), `bunx turbo run typecheck` (17/17 packages green,
  `debate-ai-web` included), and `bun run build:web` (production build,
  succeeded — the pre-existing `no output files found for task
  debate-editor#build` warning is unrelated `turbo.json` `outputs` config,
  not a build failure). No `lint`/`format:check` script exists anywhere in
  this repo, so that step was skipped as not applicable. Docs updated:
  `quick-cards-cloud-save.mdx`'s feature description and Known gaps (entry
  removed).

- **🖨️ Print/Export the shortcuts reference scoped to an active search,
  instead of always the full list.** Another repeat of the standing
  autonomous-routine prompt above — as with every prior repeat (reconfirmed
  fresh this run: 19 `saved_*` D1 tables link to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), all 65
  `TOOL_RECORD_COLLECTIONS` entries sync through `saved_tool_records`, and
  every tool is reachable from `/tools`, CardMirror's `MenuBar`/command
  palette, and the feature catalog), that prompt's own asks are already
  fully built. There were no open PRs to build on. The prior run's two
  fresh candidates (outline-preset jump, CardMirror download) are both
  already fixed, so this run re-scanned every `packages/debate-help-docs`
  doc's "Known gaps" section for a still-open, small, concretely-scoped
  item (two more turned out stale — already fixed in code, not flagged
  here) and picked `legacy-verbatim-shortcuts.mdx`'s: "Print/Export always
  render the full reference, ignoring an active search filter."

  `packages/debate-editor/src/editor/reference-export.ts` gets a new pure
  `filterShortcutsReferenceGroups(groups, query)` — same case-insensitive
  label-or-keybinding substring predicate the on-screen modal's
  `applyFilter` already used for DOM show/hide, now reusable off the DOM.
  `reference-ui.ts`'s Print/Export/Download-PDF button handlers in
  `render()` now call it with the live `this.searchQuery` at click time
  (via a `filteredGroups()` closure) instead of passing the unfiltered
  `groups` straight through to `print()`/`exportAsText()`/`exportAsPdf()`;
  their button `title`s dropped the now-inaccurate "full" wording.

  Vitest-covered: `packages/debate-editor/test/reference-export.test.ts`
  gets a new `describe` block (5 cases — empty/whitespace query is a
  no-op, matches by label, matches by keybinding text, a group with every
  row filtered out is dropped entirely, no match returns `[]`).
  `reference-ui.ts`'s click-handler wiring itself isn't independently
  tested, matching this file's existing convention (no test in this
  package renders `ReferenceModal` — `applyFilter`'s own DOM behavior next
  to it isn't unit-tested either).

  Ran the full verification gate: `bun install`, the new/updated test file
  (10 passing) plus `packages/debate-editor`'s own `bunx vitest run` (37
  files, 792 tests), `bunx tsc --noEmit` (clean), `bun run test` (477
  files, 8978 tests passing, repo-wide), `bunx turbo run typecheck` (17/17
  packages green, `debate-ai-web` included), and `bun run build:web`
  (production build, succeeded — the pre-existing `no output files found
  for task debate-editor#build` warning is unrelated `turbo.json`
  `outputs` config, not a build failure). No `lint`/`format:check` script
  exists anywhere in this repo, so that step was skipped as not
  applicable. Docs updated: `legacy-verbatim-shortcuts.mdx`'s Known gaps
  entry (fixed, folded into the feature description).

- **🔖 Jump to a saved Outline filter preset's origin round when applying
  it.** Another repeat of the standing autonomous-routine prompt above — as
  with every prior repeat (per the lost history noted above, and
  reconfirmed fresh this run), that prompt's own asks are already fully
  built: 19 `saved_*` D1 tables (`user_settings`/`documents`/`saved_flows`/
  `saved_rounds` among them) all link to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), all 65 entries of
  `TOOL_RECORD_COLLECTIONS` (`packages/debate-data-sync`) sync their
  localStorage-backed tool to the account through the generic
  `saved_tool_records` table, and every tool is already reachable from the
  `/tools` page, CardMirror's own `MenuBar`/command palette, and the feature
  catalog. There were no open PRs to build on, so this slice picked up the
  first item already named in this file's own Follow-ups below:
  `argument-tree-outline.mdx`'s Known gap that applying a saved outline
  filter preset only ever changed the filter of whichever round card was
  already on screen — it never selected or scrolled to a particular round.

  `packages/debate-round/src/state/outlineFilterPresets.ts`'s
  `OutlineFilterPreset` gets an optional `roundId` field recording which
  round's outline a preset was saved from (validated in `isValidPreset`,
  round-trips through the existing `serializeOutlineFilterPresets`/
  `parseOutlineFilterPresets` JSON column unchanged). `handleSavePreset` in
  `packages/debate-practice-drills/src/panels/ArgumentTreePanel.tsx` now
  passes that round's id through `useOutlineFilterPresets`' `addPreset`.
  The panel's global "Saved filter presets" list (previously just a
  removable badge per preset) now also makes each preset's name clickable:
  clicking it applies the preset to its origin round and
  `scrollIntoView`s that round's card, via a new pure
  `state/outlineFilterPresetJump.ts#resolvePresetJumpRoundId` (preset +
  round-card refs in a `useRef` map) that decides whether there's a round
  left to jump to — `null` for a preset saved before this field existed, or
  whose origin round's outline was since cleared, in which case the name
  stays inert and the preset remains usable from any round's own
  pre-existing "Filter presets" dropdown exactly as before.

  Vitest-covered: `packages/debate-round/test/outlineFilterPresets.test.ts`
  (new cases — a preset list with/without `roundId` validates, a
  non-string `roundId` is rejected, `roundId` round-trips through
  serialize/parse) and a new
  `packages/debate-practice-drills/test/outlineFilterPresetJump.test.ts`
  covering `resolvePresetJumpRoundId`'s four cases (round still exists,
  preset predates tracking, origin round deleted, empty round list). The
  DOM-touching half (`scrollIntoView`, the `useRef` map, the button's
  disabled/title state) isn't independently tested, mirroring this
  package's existing convention for its other localStorage/DOM-bound hooks
  (e.g. `useOutlineFilterPresets`/`useWordLimitPresets` each only unit-test
  their pure `storage`-event predicate, not `addPreset`/`removePreset`
  themselves) — no test in this package renders `ArgumentTreePanel` or any
  other panel component today.

  Ran the full verification gate: `bun install`, the new/updated test files
  (32 passing) plus `bun run test` (477 files, 8973 tests passing,
  repo-wide), `bunx turbo run typecheck` (17/17 packages green,
  `debate-ai-web` included), and `bun run build:web` (production build,
  succeeded — the pre-existing `no output files found for task
  debate-editor#build` warning is unrelated `turbo.json` `outputs` config,
  not a build failure). No `lint`/`format:check` script exists anywhere in
  this repo, so that step was skipped as not applicable. Docs updated:
  `argument-tree-outline.mdx`'s Filter presets section (describes the new
  jump behavior) and Known gaps (entry removed).

- **📎 Offer a download of unreadable CardMirror content instead of just
  discarding it.** Another repeat of the standing autonomous-routine prompt
  above — as with every prior repeat (per the lost history noted above, and
  reconfirmed fresh this run), that prompt's own asks are already fully
  built: `user_settings`/`documents`/`saved_flows`/`saved_rounds` and 25+
  other `saved_*` D1 tables all link to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), every one of the 13
  localStorage-backed tool stores syncs to the account through the generic
  `saved_tool_records` table (`TOOL_RECORD_COLLECTIONS` in
  `packages/debate-data-sync`), and every tool is already reachable from the
  `/tools` page, CardMirror's own `MenuBar`/command palette
  (`Mod-Shift-Space`), and the feature catalog. There were no open PRs to
  build on, so this slice picked a fresh, still-open,
  concretely-scoped item: `docs/features/cardmirror-embed-persistence.md`'s
  Known gaps named that the CardMirror singleton refuses to load a document
  whose stored HTML fails to parse, and — because nothing typed into that
  pane is ever saved once it's marked unreadable — whatever a user then
  types is silently discarded with no way to recover it, only a notice
  saying so.

  `packages/debate-editor/src/editor/status-notices.ts`'s `NoticeInput` gets
  an optional `download?: { filename, content }` field; `renderPanel()` adds
  a "Download" button (next to the existing Copy/Dismiss) that Blob+anchor
  downloads it, mirroring the anchor+Blob pattern already used throughout
  `debate-round`/`debate-practice-drills`/`debate-team-collaboration`'s
  panels (e.g. `ArgumentTreePanel.tsx`'s `handleDownload`). A repeat
  `postNotice` under the same coalescing key keeps a previously-attached
  download rather than dropping it if the repeat doesn't re-attach one.
  `packages/debate-editor/src/react/singleton.ts`'s `markUnreadable` (both
  call sites, in `claim()`) now passes the raw `html` that failed
  `parseHtml` through as that download's content, named
  `unreadable-<key>.html` — `<key>` run through a new `sanitizeForFilename`
  (collapses anything outside `[A-Za-z0-9._-]` to `-`) since `key` is
  `contentKey ?? title ?? "default"` (`CardMirrorEditor.tsx`), a free-form
  document title, not already filename-safe.

  Vitest-covered: `packages/debate-editor/test/status-notices.test.ts` (new
  — no Download button without a payload, button renders and downloads the
  right Blob/filename on click with `URL.createObjectURL`/`revokeObjectURL`
  stubbed, a coalesced repeat keeps the earlier download, dismissing still
  hides the chip) and `packages/debate-editor/test/singleton.test.ts` (new —
  `sanitizeForFilename`'s handling of path separators, punctuation runs,
  leading/trailing dashes, and the empty/all-unsafe fallback to
  `"document"`). `singleton.ts`'s `markUnreadable`/`claim()` themselves
  aren't independently tested here or anywhere else in this package — they
  need a full engine boot (`../editor/index.js`, ~10k lines) and a live
  `EditorView`, which no existing test in this package sets up; the new
  coverage stops at the two pure/testable boundaries (the notice model,
  the filename sanitizer) rather than adding that scaffolding for one field.

  Ran the full verification gate: `bun install`, the two new test files (9
  passing) plus `packages/debate-editor`'s own `bunx vitest run` (37 files,
  787 tests) and `bunx tsc --noEmit` (clean), `bun run test` (476 files,
  8966 tests passing, repo-wide), `bunx turbo run typecheck` (17/17 packages
  green, `debate-ai-web` included), and `bun run build:web` (production
  build, succeeded). No `lint`/`format:check` script exists anywhere in this
  repo, so that step was skipped as not applicable. Docs updated:
  `docs/features/cardmirror-embed-persistence.md`'s Known gaps entry (marked
  fixed) and Tests list.

## Follow-ups

- Two candidates considered and not picked this run, found while searching
  for the saved-Argument-Library-collections race (see this file's
  "Completed" entry above):
  - `internals/flow-annotations.mdx`'s Known gaps: the "ebb flow" grid editor
    has no in-grid annotation-badge indicator yet. Confirmed still real, but
    the doc's own note says it needs a Handsontable-native custom
    renderer/cell-metadata mechanism against a 1300+-line `HotGrid.tsx` —
    more than one focused PR, and awkward to Vitest-cover (rendering-heavy).
  - `features/practice-vs-ai.mdx`'s Known gaps: `getGamificationProfile`
    always returns `currentStreak: 0`, making the `Streak5` achievement
    unreachable. Confirmed in `apps/debate-ai.com/lib/practice-vs-ai/store.ts`;
    the schema's own comment says it needs a new dated-activity-log D1 table
    — the same shape of backend-architecture gap as the `quest-streaks`
    follow-up above, so deferred rather than picked up.

- `docs/internals/quest-streaks.mdx`'s Known gaps: a day's mission result is
  still computed by a manual button click rather than the existing weekly
  cron (`apps/debate-ai.com/wrangler.jsonc`'s `triggers.crons` /
  `worker/index.ts`'s `scheduled` export). Investigated this run and it's
  blocked on more than just wiring: `computeAndSavePersistedDailyMissionResult`
  derives a result from `state/contributions.ts`, which is pure browser
  `localStorage` with no D1 table or server API — the Worker's `scheduled`
  export has no server-side data to iterate at all. Closing this for real
  needs a new D1 table plus a sync layer for contributions (what to persist,
  how to migrate a device's existing localStorage history), which is a
  backend-architecture decision this routine defers rather than one small
  PR's worth of wiring. Left as a follow-up, not picked up this run.

- `docs/internals/team-rankings.mdx`'s Known gaps: `CURRENT_YEAR`
  (`apps/debate-ai.com/lib/leaderboard/resolve.ts`) is a hardcoded season
  string; a request for the next season's year silently falls through to
  the historical Elo-only path until someone bumps the constant. Not picked
  up this run because auto-deriving the season from the current date isn't
  safe — the TOC bid list's season rollover doesn't necessarily land on a
  calendar-year boundary, and getting that wrong would silently misroute
  live requests to the wrong data path. Needs a human decision about the
  actual rollover rule (or at minimum an explicit ops alert/checklist item)
  before it's a mechanical fix.

- `docs/internals/team-rankings.mdx`'s Known gaps: `CURRENT_YEAR`
  (`apps/debate-ai.com/lib/leaderboard/resolve.ts`) is a hardcoded season
  string; a request for the next season's year silently falls through to
  the historical Elo-only path until someone bumps the constant. Not picked
  up this run because auto-deriving the season from the current date isn't
  safe — the TOC bid list's season rollover doesn't necessarily land on a
  calendar-year boundary, and getting that wrong would silently misroute
  live requests to the wrong data path. Needs a human decision about the
  actual rollover rule (or at minimum an explicit ops alert/checklist item)
  before it's a mechanical fix.

---

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

---

## Contribution Guidelines

1. **Pick an issue** or propose your own - comment on the issue to claim it
2. **Start small** - break large features into PR-sized chunks
3. **Write tests** - aim for >80% coverage on new code
4. **Follow code style** - run linting/formatting before submitting
5. **Update docs** - README, API docs, and in-code comments

## Getting Started

```bash
# Clone and setup
git clone https://github.com/debate/debate-ai.com
cd debate-ai.com
bun install

# Run dev server
bun run dev

# Run tests
bun run test

# Typecheck
bun run typecheck
```

## Resources

- [Documentation site](packages/debate-help-docs) — `docs/features/*` and
  `docs/internals/*` cover almost every shipped feature and its known gaps
- [Architecture overview](.claude/architecture/overview.md)
- [Web app architecture](.claude/architecture/web-app.md)
- [Conventions](.claude/architecture/conventions.md)

---

*Last updated: 2026-09-19*
