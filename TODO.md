# TODO: Ideas for New Contributors

## Tracker Status

### In progress

_No task currently in progress._

### Completed

- **🧪 Give the Prep Notes assignee-notifications panel its first test
  coverage.** Another repeat of the standing autonomous-routine prompt
  ("integrate all the tools into the UI... create user settings and link
  user db SQL with the ability to save flows/docs/debates in SQL and link
  to users... add tools into where needed in the UI... develop better tool
  UI") — as with every recent repeat, that prompt's own asks are already
  fully built: `user_settings`/`documents`/`saved_flows`/`saved_rounds`,
  26+ bespoke `saved_*`/`saved_tool_records` D1 tables all linked to
  `user.id`, and every tool already reachable from the Tools page, the
  command palette and the feature catalog.

  This run first chased the immediately preceding run's own flagged
  follow-up — syncing `dailyMissionResults`/`challengeWinEvents` into the
  `TOOL_RECORD_COLLECTIONS` catalog now that a synthetic composite id
  (`contributorId:dayKey`/`contributorId:occurredAt`) would fix the "no
  single stable id field" blocker every prior run recorded — and got far
  enough to confirm that blocker is fixable (mirroring
  `user-dictionary.ts`'s own `{ id, word }[]` reshape), but stopped short of
  making the change: both stores can hold *other* contributors' rows in the
  same browser (a coach or teammate computing/recording a squad-mate's
  entry from their own device, per `internals/quest-streaks.mdx`'s "there is
  no contributor-identity system, only a free-text contributor id" note),
  and `TOOL_RECORD_COLLECTIONS`'s generic watcher syncs a collection's
  *entire* localStorage array to whichever account is currently signed in —
  it has no per-record ownership check. Joining the catalog as-is would
  therefore let one contributor's browser upload another contributor's
  computed mission-result/win-event rows into the *signed-in* contributor's
  own synced records, a data-ownership mismatch none of this catalog's
  existing entries have (every other synced store's records genuinely
  belong to the one signed-in browser). That is a product/schema judgment
  call — filter which rows this device may sync (e.g. only the
  session's own `contributorId`), or accept the mismatch — not a
  mechanical one, so left both stores out of the catalog and flagged this
  precisely below instead of guessing.

  Picked up a safer, unambiguous gap instead: `PrepNoteNotificationsPanel.tsx`
  (the Prep Notes assignee-notification digest — recipient lookup, one
  digest card per UTC day with expand/collapse, per-notification and
  per-group "Mark read", and a cross-tab `storage`-event live refresh) had
  zero component test coverage, unlike its own state layer
  (`state/prepNoteNotifications.ts`/`flow/prep-note-notifications.ts`,
  already covered by `prepNoteNotifications.test.ts`/
  `prep-note-notifications.test.ts`) — the same "real logic, never
  exercised end-to-end" gap `ArgumentLibraryPanel.test.tsx` closed two runs
  ago. Confirmed it wasn't an intentional exclusion first: unlike
  `useQuestStreakSync`/`useToolRecordSync` (documented as "intentionally
  untested" account-sync hooks), this panel is pure `localStorage` with no
  fetch, and `internals/prep-notes.mdx` has no "Tests" section calling out
  the gap as deliberate.

  Added `packages/debate-team-collaboration/test/helpers/mount.tsx` (this
  package's first use of the `debate-search-evidence`/`debate-timer`
  `mount`/`click`/`type`/`flush` `react-dom/client` + `act` pattern, copied
  verbatim rather than reinvented — this panel loads its notifications
  inside a `useEffect`, so a `node`-environment `renderToStaticMarkup`
  snapshot would never see them) and
  `packages/debate-team-collaboration/test/PrepNoteNotificationsPanel.test.tsx`
  (12 cases: the empty state before and after a lookup, restoring the last
  looked-up recipient on mount, persisting a new lookup to localStorage,
  looking up on Enter, grouping into one digest per UTC day newest-first,
  the total-unread badge, expand/collapse, marking one notification read,
  marking a whole digest group read, and the cross-tab `storage`-event
  refresh both firing on the matching key and being ignored for an
  unrelated one).

  Ran the full verification gate: `bun install`,
  `packages/debate-team-collaboration`'s own `bun run test` (47 files, 844
  tests — 12 new), the root `bun run test` (453 files, 8711 tests, all
  passing), `bun run typecheck` (17/17 packages green), and `bun run build`
  (production build, all three targets green — the build's own regenerated
  service-worker file list/version stamp were reverted before committing
  since they're unrelated build output, not a source change). No
  `lint`/`format:check` script exists anywhere in this repo, so that step
  was skipped as not applicable.

  **Follow-up (not in scope here):** syncing `dailyMissionResults`/
  `challengeWinEvents` still needs the ownership-scoping decision above
  before it can join `TOOL_RECORD_COLLECTIONS` — e.g. teaching the generic
  watcher to sync only the records whose `contributorId` matches the
  session's own, or a bespoke route the way `saved_flows`/`documents` have
  one, rather than the generic allowlist. The `qwksearch` file-sources
  credential-sync question, flagged by several prior runs, remains open for
  the same reason those runs recorded — it needs a maintainer
  product/security decision. `PrepNoteNotificationsPanel`'s loading-skeleton
  state (`digestGroups === null`, shown only before the first effect
  flushes) is unexercised by the new file, same as every other
  effect-loaded panel's equivalent transient state in this repo's existing
  tests.

- **📅 Close the stale "no cron infrastructure" Known gaps on Quest
  Streaks.** Another repeat of the standing autonomous-routine prompt
  ("integrate all the tools into the UI... create user settings and link
  user db SQL with the ability to save flows/docs/debates in SQL and link
  to users... add tools into where needed in the UI... develop better tool
  UI") — as with every recent repeat, that prompt's own asks are already
  fully built: `user_settings`/`documents`/`saved_flows`/`saved_rounds`,
  26+ bespoke `saved_*`/`saved_tool_records` D1 tables all linked to
  `user.id`, and every tool already reachable from the Tools page, the
  command palette and the feature catalog. The immediately preceding run's
  own flagged follow-up was to audit
  `packages/debate-help-docs/content/docs/internals/*.mdx` (27 files) for
  the same "gap already closed in code, doc never updated" staleness its
  own fix (`argument-library-collections.mdx`) had found in `features/`.
  Did that audit (delegated across all 27 files) and confirmed every other
  spot-checked "Known gaps" bullet still held — one came back stale.

  `internals/quest-streaks.mdx` and its sibling `features/quest-streaks.mdx`
  both said, in three places, that the repo has "no cron/scheduled-job
  infrastructure" for a scheduled mission-result check to run on. That
  stopped being true in commit `865e254` (2026-09-09, predating this doc's
  own last edit): `apps/debate-ai.com/wrangler.jsonc` now defines a real
  Cloudflare Workers cron trigger (`triggers.crons: ["0 8 * * 1"]`) and
  `worker/index.ts` exports a `scheduled` handler that already runs two
  independent jobs off that one weekly tick (the YouTube channel/view-count
  sync and a `reuse_check_log` purge) — the exact "piggyback on the one
  cron trigger this app has" pattern the doc claimed didn't exist.
  Quest-streak mission results genuinely aren't wired to it (the manual
  "Run today's mission check" button is still the only trigger), so
  reworded all three spots to say precisely that — infra exists, this job
  just isn't on it — instead of overclaiming there's no infra at all.

  This is a prose-only correctness fix (no behavior, schema, or API
  change), so no new Vitest coverage applies; ran the full verification
  gate anyway to confirm the doc edits didn't disturb anything: `bun
  install`, `bun run typecheck` (18/18 packages green), `bun run test`
  (451 files, 8700 tests, all passing, unchanged from before this edit),
  and `bun run build` (production build, all three targets green — the
  build's own regenerated service-worker file list/version stamp were
  reverted before committing since they're unrelated build output, not a
  source change). No `lint`/`format:check` script exists anywhere in this
  repo, so that step was skipped as not applicable.

  **Follow-up (not in scope here):** the audit's one low-confidence,
  unverifiable-from-code candidate — `internals/canonical-host-redirect.mdx`'s
  claim that nothing asserts `d.ebate.app` routing — is a Cloudflare
  dashboard config claim outside repo code, so it couldn't be confirmed or
  refuted here; worth a maintainer check rather than a guess. The
  `docs/guides/*.mdx` and `docs/reference/*.mdx` (if any) doc sets remain
  unaudited for the same staleness pattern. The remaining 6 Learn
  sub-collections, `dailyMissionResults`/`challengeWinEvents`, and the
  `qwksearch` credential-sync question all remain open for the same
  reasons every prior run recorded — none is a small mechanical slice, and
  the last still needs a maintainer product/security decision.

- **🧪 Close the stale "no rename/no tag editing" Known gaps on the Common
  Argument Library's saved collections, and give `ArgumentLibraryPanel` its
  first test coverage.** Another repeat of the standing autonomous-routine
  prompt ("integrate all the tools into the UI... create user settings and
  link user db SQL with the ability to save flows/docs/debates in SQL and
  link to users... add tools into where needed in the UI... develop better
  tool UI") — as with every recent repeat, that prompt's own asks are
  already fully built: `user_settings`/`documents`/`saved_flows`/
  `saved_rounds`, 26+ bespoke `saved_*`/`saved_tool_records` D1 tables all
  linked to `user.id`, and every tool already reachable from the Tools page,
  the command palette and the feature catalog. The immediately preceding
  run's own flagged follow-up (the remaining Learn sub-collections,
  `dailyMissionResults`/`challengeWinEvents`, `qwksearch` credential-sync)
  was explicitly recorded as containing no small mechanical slice, so this
  run did a fresh audit of `packages/debate-help-docs/content/docs/features/*.mdx`'s
  "Known gaps" sections instead of forcing one of those.

  Found one already fixed in code but never in its doc:
  `argument-library-collections.mdx` still listed "No rename for an existing
  collection" and "No editing a saved collection's tag list directly" as
  open gaps, but `hooks/useSavedArgumentCollections.ts`'s
  `renameCollection`/`updateCollection` (backed by
  `validateSavedArgumentCollectionRename`/`validateSavedArgumentCollectionTagsUpdate`
  in `lib/argument-library-collections.ts`, both already fully unit-tested)
  and `panels/ArgumentLibraryPanel.tsx`'s "Rename"/"Update" buttons were
  already written and wired together — git history shows both landed before
  the doc's last touch, which was only a package-rename commit. The doc also
  still named the panel's old package (`debate-card-search`, since renamed
  to `debate-search-evidence`). Rewrote the "Known gaps" section to "None
  open" (with the still-real no-optimistic-concurrency caveat every other
  `/api/settings` field has), corrected the package name, and expanded "What
  it shows"/"Data flow" to mention Rename/Update and the client module.

  While auditing this file to confirm the UI behavior actually matched the
  code (not just trusting the file existed), found the deeper gap: despite
  being a real, meaningfully-logicked panel (tag-chip filtering, saved-
  collection CRUD, a cross-store tag rename/merge tool, case-variant
  merging), `ArgumentLibraryPanel.tsx` had zero test coverage — no
  `ArgumentLibraryPanel.test.*` existed anywhere, unlike every sibling panel
  this repo's history has since added tests for (`FlowEditLogPanel`,
  `FlowHistoryList`, etc.). Added
  `packages/debate-search-evidence/test/ArgumentLibraryPanel.test.tsx` (11
  cases: empty state, topic-folder/tag-collection rendering, tag-chip
  toggle/clear, saving a collection, refusing a duplicate name, applying a
  saved collection's tags, renaming a collection, refusing a rename onto
  another collection's name, replacing a collection's tags via "Update",
  removing a collection, and the tag rename/merge tool rewriting a tag
  across every entry that carries it) — this is what actually verified the
  rename/update doc fix was safe to make, rather than taking the code at
  face value. Since this panel loads its library and saved collections
  inside `useEffect` (not from props), a `node`-environment
  `renderToStaticMarkup` snapshot would never see any of it — used the same
  real `jsdom` + `react-dom/client` + `act` pattern
  `debate-round/test/FlowEditLogPanel.test.tsx` and
  `debate-videos/test/glowing-effect-listeners.test.tsx` established, and
  added `packages/debate-search-evidence/test/helpers/mount.tsx` (this
  package's first use of that pattern), mirroring
  `debate-timer/test/helpers/mount.tsx`'s exact `mount`/`click`/`type`/
  `flush` API rather than inventing a new one — this repo has no
  `@testing-library` dependency, so every component test wraps `createRoot`/
  `act` directly.

  Ran the full verification gate: `bun install`, `packages/debate-search-evidence`'s
  own `bun run test` (40 files, 1178 tests — 11 new), the root `bun run test`
  (451 files, 8700 tests, all passing), `bun run typecheck` (18/18 packages
  green), and `bun run build` (production build, all three targets green).
  No `lint`/`format:check` script exists anywhere in this repo, so that step
  was skipped as not applicable.

  **Follow-up (not in scope here):** this run only audited the "Known gaps"
  sections under `packages/debate-help-docs/content/docs/features/`; the
  `internals/` doc set (e.g. `tool-data-sync.mdx`) wasn't re-checked for the
  same "gap already closed in code" staleness and may be worth the same
  audit next. `ArgumentLibraryPanel`'s "Possible duplicate tags" case-variant
  merge button and its cross-tab `storage`-event live-update path remain
  untested by the new file — real behavior, not a doc/code mismatch, so
  lower priority than the rename/update gap this run closed. The
  Learn-sub-collections/`dailyMissionResults`/`challengeWinEvents`/
  `qwksearch` follow-ups earlier runs flagged remain open for the same
  reasons those runs recorded.

- **🏷️ Give the Flow Edit Log its own "synced to your account" badge.**
  Another repeat of the standing autonomous-routine prompt ("integrate all
  the tools into the UI... create user settings and link user db SQL with
  the ability to save flows/docs/debates in SQL and link to users... add
  tools into where needed in the UI... develop better tool UI") — as with
  every recent repeat, that prompt's own asks are already fully built:
  `user_settings`/`documents`/`saved_flows`/`saved_rounds`, 26+ bespoke
  `saved_*`/`saved_tool_records` D1 tables all linked to `user.id`, and
  every tool already reachable from the Tools page, the command palette and
  the feature catalog. Picked up the standing follow-up the immediately
  preceding run flagged rather than starting a fresh audit: the run that
  added `getToolRecordSyncStatus` and wired it into `FlowHistoryList.tsx`'s
  History tab, then into CardMirror's personal dictionary, named "the
  flow-edit log (`packages/debate-team-collaboration`'s `flowEdits`
  collection, per `tool-data-sync.mdx`'s 'Coaching' section)" as the next
  list UI that wanted the same "synced vs. local-only" distinction and
  never closed it. (The `flowEdits` collection in question turned out to
  live in `debate-round`, not `debate-team-collaboration` — the earlier
  note conflated it with that package's similarly-named
  `roundContributorFlows`; `packages/debate-round/src/panels/
  FlowEditLogPanel.tsx`'s "Logged edits" list is `flowEdits`'s only reader.)

  Wired `getToolRecordSyncStatus('flowEdits', edit)` into
  `FlowEditLogPanel`'s "Logged edits" row renderer, mirroring
  `FlowHistoryList`'s exact pattern: a small "Synced" / "Not yet synced"
  `Pill` next to each edit's timestamp, omitted entirely (not a third
  state) when the status is `"unknown"` — before this collection has ever
  been baselined against the account. Unlike the vanilla-DOM dictionary
  section, this panel is already a plain React component that re-renders
  with its host, so no extra polling/refresh wiring was needed beyond the
  existing `useEffect`/`storage`-event refresh it already had.

  Vitest-covered: added `packages/debate-round/test/FlowEditLogPanel.test.tsx`
  (5 cases — no badge before the collection has a baseline, "Synced" once
  an edit's exact value has landed, "Not yet synced" for an edit baselined
  before it existed, "Not yet synced" for an edit changed after an earlier
  value landed, and no badge rendered alongside the empty state), reusing
  `debate-data-sync`'s own `markToolRecordsSynced`/`resetToolRecordAutoSync`
  test helpers the same way `FlowHistoryList.test.tsx` already does.
  Because `FlowEditLogPanel` loads its edits itself inside a `useEffect`
  (unlike `FlowHistoryList`, which receives its data as a prop),
  `renderToStaticMarkup` — which never runs effects — couldn't see the
  loaded list at all; used a real `jsdom` + `react-dom/client` render
  flushed with `act` instead, the same pattern
  `debate-videos/test/glowing-effect-listeners.test.tsx` already
  established for this repo's React-hook-driven component tests.

  Ran the full verification gate: `bun install`, `packages/debate-round`'s
  own `bun run test` (61 files, 1211 tests — 5 new), the root `bun run test`
  (450 files, 8689 tests, all passing), `bun run typecheck` (18/18 packages
  green), and `bun run build` (production build, all three targets green).
  No `lint`/`format:check` script exists anywhere in this repo, so that
  step was skipped as not applicable.

  **Follow-up (not in scope here):** the remaining 6 Learn sub-collections
  (schedules, anchors, AI threads, notes, review log, doc registry),
  `dailyMissionResults`/`challengeWinEvents` (composite-key gamification
  history), and the `qwksearch` file-sources credential-sync question all
  remain open for the same reasons every prior run recorded — none is a
  small mechanical slice, and the last still needs a maintainer
  product/security decision.

- **🏷️ Give CardMirror's personal dictionary the same "synced to your
  account" badge the Debate Flow History tab already has.** Another repeat
  of the standing autonomous-routine prompt ("integrate all the tools into
  the UI... create user settings and link user db SQL with the ability to
  save flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built:
  `user_settings`/`documents`/`saved_flows`/`saved_rounds`, 26+ bespoke
  `saved_*`/`saved_tool_records` D1 tables all linked to `user.id`, and
  every tool already reachable from the Tools page, the command palette
  and the feature catalog. Picked up a standing follow-up rather than
  starting a fresh audit: the run that added `getToolRecordSyncStatus`
  (`packages/debate-data-sync/src/state/tool-record-auto-sync.ts`) and
  wired it into `FlowHistoryList.tsx`'s History tab flagged that "the same
  per-record status is now available to any other synced tool's list UI
  (e.g. CardMirror's personal dictionary, the flow-edit log) that wants the
  same 'synced vs. local-only' distinction — this run only wired it into
  the one tab the prior run's follow-up named." A later run built the
  personal dictionary's only view/remove UI
  (`packages/debate-editor/src/editor/user-dictionary-ui.ts`) but never
  closed that flagged gap, so every word in the (already-synced,
  `spellcheckDictionary`) dictionary still looked identical whether it had
  reached the account or not — indistinguishable from a word added the
  same second, offline.

  Wired `getToolRecordSyncStatus('spellcheckDictionary', { id: word, word
  })` into `buildUserDictionarySection`'s row renderer, exactly mirroring
  `FlowHistoryList`'s own pattern: a small "Synced" / "Not yet synced"
  badge next to each word, omitted entirely (not shown as a third state)
  when the status is `"unknown"` — before this collection has ever been
  baselined against the account. New CSS
  (`.pmd-dictionary-sync-badge{,--synced,--pending}`) reuses the same
  small-chip language `.pmd-qcs-row-badge` already established rather than
  inventing a new visual pattern. `debate-editor` had no dependency on
  `debate-data-sync` before this (only `debate-round` and `debate-ui` did),
  so added `"debate-data-sync": "workspace:*"` to its `package.json` — the
  same workspace, no circular reference (`debate-data-sync` does not import
  `debate-editor`).

  Unlike `FlowHistoryList` (a React component that gets a fresh render
  whenever its host dialog's other state changes), the vanilla-DOM
  dictionary section has no natural re-render trigger once mounted, so a
  badge would otherwise stay "Not yet synced" for the rest of the session
  even after the account-sync watcher's next background tick actually
  landed it. Added a `setInterval(render, TOOL_RECORD_AUTO_SYNC_INTERVAL_MS)`
  — the same cadence the watcher itself polls on — and changed
  `buildUserDictionarySection`'s return type from a bare `HTMLElement` to
  `{ element, destroy }` (mirroring `settings-ui.ts`'s own
  `EmbeddedSettingsPanel` shape) so the interval is released via that
  file's existing `registerRowCleanup` mechanism rather than leaking one
  timer per settings-panel mount.

  Vitest-covered: extended `packages/debate-editor/test/user-dictionary-ui.test.ts`
  with a new `sync status badge` describe block (6 cases — no badge before
  the collection has a baseline, "Synced" once a word's exact value has
  landed, "Not yet synced" for a word baselined before it existed, "Not yet
  synced" immediately for a newly-typed word, the badge flipping to
  "Synced" once a simulated background flush lands under a fake-timers
  advance of exactly one watcher interval, and no further refresh — and no
  throw querying the now-detached-from-updates DOM — once `destroy()` has
  been called), reusing `debate-data-sync`'s own
  `markToolRecordsSynced`/`resetToolRecordAutoSync` test helpers the same
  way `FlowHistoryList.test.tsx` already does. Existing tests updated for
  the new `{ element, destroy }` return shape.

  Ran the full verification gate: `bun install`, `packages/debate-editor`'s
  own `bun run test` (34 files, 770 tests — 6 new), the root `bun run test`
  (449 files, 8684 tests, all passing), `bun run typecheck` (18/18 packages
  green, confirms the new `debate-data-sync` import resolves), and
  `bun run build` (production build, all three targets green). No
  `lint`/`format:check` script exists anywhere in this repo, so that step
  was skipped as not applicable.

  **Follow-up (not in scope here):** the flow-edit log
  (`packages/debate-team-collaboration`'s `flowEdits` collection, per
  `tool-data-sync.mdx`'s "Coaching" section) was named alongside the
  personal dictionary in the same flagged follow-up and remains undone —
  it has its own list UI this run did not audit closely enough to touch
  safely in the same slice. The remaining 6 Learn sub-collections
  (schedules, anchors, AI threads, notes, review log, doc registry),
  `dailyMissionResults`/`challengeWinEvents` (composite-key gamification
  history), and the `qwksearch` file-sources credential-sync question all
  remain open for the same reasons every prior run recorded — none is a
  small mechanical slice, and the last still needs a maintainer
  product/security decision.

- **🗂️ Sync CardMirror's Learn custom decks to the account.** Another
  repeat of the standing autonomous-routine prompt ("integrate all the
  tools into the UI... create user settings and link user db SQL with the
  ability to save flows/docs/debates in SQL and link to users... add tools
  into where needed in the UI... develop better tool UI") — as with every
  recent repeat, that prompt's own asks are already fully built:
  `user_settings`/`documents`/`saved_flows`/`saved_rounds`, 26+ bespoke
  `saved_*`/`saved_tool_records` D1 tables all linked to `user.id`, and
  every tool already reachable from the Tools page, the command palette
  and the feature catalog. Picked up the immediately preceding run's own
  flagged follow-up: Learn's flashcard store (`learn-store.ts`) keeps 8
  sub-collections in one shared blob, and that run synced only `cards` (a
  bespoke table, since the generic `TOOL_RECORD_COLLECTIONS` mechanism's
  one-array-per-key shape would have destroyed the other 7 sub-collections
  sharing the same key), leaving the other 7 explicitly flagged as future
  slices. Of those 7, custom decks (`CustomDeck`: `deckId`/`name`/
  `cardIds`/`createdAt`) was the next genuinely small one: it already has
  a stable id field and portable content, unlike schedules/anchors/AI
  threads/notes/log (all keyed by `cardId`/`docId` pairs, tied to
  device-local review state) or the doc registry (tracks local file
  paths, not portable content).

  Added `packages/debate-editor/src/editor/learn-decks-sync.ts`
  (`LearnDecksSync`, exported as a class like `LearnCardsSync`) and
  `learn-decks-client.ts` (fetch calls), following `learn-cards-sync.ts`/
  `learn-cards-client.ts`'s pattern exactly: `init()` best-effort merges
  against `/api/learn-decks` (adopts a remote deck missing locally by its
  own `deckId` via a new `LearnStore.upsertDeck` — a small additive
  create-or-replace mutation mirroring `upsertCard`, since no such method
  existed for decks), then subscribes to `LearnStore`'s existing generic
  `subscribe()` and diffs each deck's `{name, cardIds}` against the last-
  synced snapshot, catching `createDeck`/`renameDeck`/
  `setDeckMembership`/`deleteDeck` without `LearnStore` naming them
  individually. A synced deck's `cardIds` can reference a card that
  hasn't reached this device yet (a soft reference, same gap
  `learn-cards-sync.ts` already accepts) — not reconciled here.
  Web-only, same Electron boundary as the cards sync.

  Added the server side following `saved_learn_cards`'s exact shape: a
  new `saved_learn_decks` D1 table (`apps/debate-ai.com/lib/database/schema.ts`,
  migration `drizzle/0044_learn_decks_account_sync.sql`), one row per
  (user, deck) keyed by the deck's own id, and `/api/learn-decks`
  (`GET`) + `/api/learn-decks/[deckId]` (`PUT` upsert, `DELETE`) —
  validated by a new `isValidLearnDeckRecord`/`MAX_SAVED_LEARN_DECK_BYTES`
  pair added to `learn-store.ts` next to `CustomDeck`, re-exported via
  `debate-editor/engine`. Wired `learnDecksSync.init()` into the existing
  `void loadLearnStore().then(...)` boot call alongside
  `learnCardsSync.init()`. Documented at
  `packages/debate-help-docs/content/docs/features/learn-decks-cloud-sync.mdx`
  and cross-linked it from `learn-cards-cloud-sync.mdx`'s "What's
  intentionally excluded" section (decks are no longer excluded from
  sync — updated that list rather than leaving it stale).

  Vitest-covered: `packages/debate-editor/test/learn-decks-sync.test.ts`
  (new — 13 cases mirroring `learn-cards-sync.test.ts`'s coverage: stays
  unsynced when signed out, adopts a remote-only deck by its own id,
  pushes a local-only deck during merge, does not touch a deck present on
  both sides, `init()` is idempotent, pushes a newly created deck, pushes
  a renamed deck, pushes a deck on membership change, does NOT re-push on
  an unrelated store change like grading a card, deletes on `deleteDeck`,
  never mirrors while signed out, and applies the local change even when
  the account push rejects), `learn-decks-client.test.ts` (new — mirrors
  `learn-cards-client.test.ts`: GET/PUT/DELETE, 401 handling, id
  URL-encoding, server-error and non-JSON-body fallback messages), and 8
  new cases added to `learn-store.test.ts` (`isValidLearnDeckRecord`'s
  accept/reject cases, plus `upsertDeck` adding a new deck and replacing
  an existing one by id).

  Ran the full verification gate: `bun install`, `packages/debate-editor`'s
  own `bun run test` (34 files, 764 tests — 30 new), the root `bun run test`
  (449 files, 8678 tests, all passing), `bun run typecheck` (18/18 packages
  green, `debate-ai-web` included), and `bun run build` (production build,
  all three targets green — `/api/learn-decks` and `/api/learn-decks/:deckId`
  correctly listed among the built API routes). No `lint`/`format:check`
  script exists anywhere in this repo, so that step was skipped as not
  applicable.

  **Follow-up (not in scope here):** the remaining 6 Learn sub-collections
  (schedules, anchors, AI threads, notes, review log, doc registry) remain
  local-only by design — device-local review state or file-path
  bookkeeping, not portable shareable content, so they don't fit this
  sync's per-record shape without a materially different design (e.g.
  merging review state needs a real conflict-resolution policy, not
  last-write-wins). No optimistic-concurrency handling on the deck sync
  itself (documented as a known gap in the new doc page), matching every
  other `saved_*`/Learn-style sync in this repo except `saved_flows`. No
  dedicated deck-management UI exists yet (decks are only created/edited
  from the home screen's scope picker), so there's no natural place yet
  for a per-deck sync-status indicator — flagged rather than building a
  new UI surface to hang it on. The `qwksearch` file-sources
  credential-sync question, flagged by several prior runs, remains open
  for the same reason those runs recorded — it needs a maintainer
  product/security decision, not a mechanical fix.

- **🔁 Sync CardMirror's Learn flashcard content to the account.** Another
  repeat of the standing autonomous-routine prompt ("integrate all the
  tools into the UI... create user settings and link user db SQL with the
  ability to save flows/docs/debates in SQL and link to users... add tools
  into where needed in the UI... develop better tool UI") — as with every
  recent repeat, that prompt's own asks are already fully built:
  `user_settings`/`documents`/`saved_flows`/`saved_rounds`, 25+ bespoke
  `saved_*`/`saved_tool_records` D1 tables all linked to `user.id`, and
  every tool already reachable from the Tools page, the command palette
  and the feature catalog. This run finally picked up the standing
  follow-up three prior runs had each re-flagged and deferred: CardMirror's
  "Learn" spaced-repetition flashcard store
  (`packages/debate-editor/src/editor/learn-store.ts`) was entirely
  device-local. Each prior run judged it too large a first slice because
  the store keeps 8 sub-collections (cards, schedules, anchors, AI
  threads, notes, review log, decks, doc registry) merged in ONE
  localStorage/IndexedDB blob under one key, which doesn't fit the generic
  `TOOL_RECORD_COLLECTIONS` mechanism's one-array-per-key shape (confirmed
  again this run by reading `tool-record-mirror.ts`: it overwrites the
  entire key with just an array, which would have destroyed the other 7
  sub-collections). Rather than deferring again, decomposed it into a
  genuinely small first slice: sync only `cards` (a card's portable
  CONTENT — `id`/`type`/`front`/`back`), leaving schedule/anchors/threads/
  notes/log/decks/docs local-only, mirroring the exact split
  `packages/debate-editor/src/editor/quick-cards-store.ts` already
  established for its own sibling reusable-content library ("the card
  DEFINITION is the durable, shareable unit; per-user scheduling/retrieval
  state isn't part of a quick card") — a restored card starting with no
  schedule pressure is already how `upsertCard` and the manage GUI's own
  JSON export/import treat a card with no carried schedule, so this isn't
  a new product behavior, just its cloud equivalent.

  Added `packages/debate-editor/src/editor/learn-cards-sync.ts`
  (`LearnCardsSync`, exported as a class — not just its `learnCardsSync`
  singleton — so tests can construct isolated instances, mirroring
  `QuickCardsStore`'s own convention) and `learn-cards-client.ts` (fetch
  calls), following `quick-cards-store.ts`/`quick-cards-client.ts`'s
  pattern almost exactly: `init()` best-effort merges against
  `/api/learn-cards` (adopts a remote card missing locally by its own id
  via `upsertCard`, so an adopted card keeps its identity instead of
  duplicating; pushes any local-only card up), then subscribes to
  `LearnStore`'s existing generic `subscribe()` (fires on *any* mutation)
  and diffs the current card list's content against the last-synced
  snapshot on each notification — this, not patching individual mutator
  methods, is what catches every card-mutating path (`upsertCard`,
  `importCards`, `deleteCard`, and `forgetDoc`'s bulk prune) without
  `LearnStore` having to name them individually, and keeps `LearnStore`
  itself host-agnostic/pure per its own module doc (no changes to it
  beyond one additive validator). Web-only (Electron's Learn store stays
  local-only for now, same boundary `quick-cards-store.ts` draws for its
  own Electron backend) — gated on `getElectronHost()`.

  Added the server side following `saved_quick_cards`'s exact shape: a new
  `saved_learn_cards` D1 table (`apps/debate-ai.com/lib/database/schema.ts`,
  migration `drizzle/0043_learn_cards_account_sync.sql`), one row per
  (user, card) keyed by the card's own id, and `/api/learn-cards`
  (`GET`, returning every synced card in full for the merge-on-init) +
  `/api/learn-cards/[cardId]` (`PUT` upsert, `DELETE`) — validated by
  `isValidLearnCardRecord`/`MAX_SAVED_LEARN_CARD_BYTES`, added to
  `learn-store.ts` next to `CardDef` and re-exported via
  `debate-editor/engine`, mirroring `isValidQuickCardRecord`'s exact
  precedent for cross-package import into the Next.js route. Wired
  `learnCardsSync.init()` into the existing `void loadLearnStore()` boot
  call in `packages/debate-editor/src/editor/index.ts`. Added a small
  "Synced to your account" / "Not synced — sign in to sync" status line to
  the Learn manage GUI's toolbar (`learn-manage-ui.ts`), next to the
  existing Export/Import buttons, updated on the same store-subscription
  render pass the card count already uses. Documented the feature at
  `packages/debate-help-docs/content/docs/features/learn-cards-cloud-sync.mdx`,
  mirroring `quick-cards-cloud-save.mdx`'s template (not wired into the
  feature catalog, matching that doc's own precedent — both document a
  sub-feature of the single `reason-editor` catalog entry, not a
  standalone tool).

  Vitest-covered: `packages/debate-editor/test/learn-cards-sync.test.ts`
  (new — 12 cases: stays unsynced when signed out, adopts a remote-only
  card by its own id, pushes a local-only card during merge, does not
  touch an id present on both sides, `init()` is idempotent, pushes a
  newly created card, pushes an edited card keyed by content, does NOT
  re-push on an unrelated store change like grading, deletes on
  `deleteCard`, deletes on `forgetDoc`'s bulk prune — not just
  `deleteCard` — never mirrors while signed out, and applies the local
  change even when the account push rejects), `learn-cards-client.test.ts`
  (new — mirrors `quick-cards-client.test.ts`'s convention: GET/PUT/DELETE,
  401 handling, id URL-encoding, server-error and non-JSON-body fallback
  messages), and 6 new `isValidLearnCardRecord` cases added to
  `learn-store.test.ts`.

  Ran the full verification gate: `bun install`, `packages/debate-editor`'s
  own `bun run test` (32 files, 734 tests — 27 new), the root `bun run test`
  (447 files, 8648 tests, all passing), `bun run typecheck` (18/18 packages
  green, `debate-ai-web` included — confirms the new API routes and schema
  compile), `packages/debate-help-docs`'s own typecheck (confirms the new
  MDX page compiles), and `bun run build` (production build, all three
  targets green — `/api/learn-cards` and `/api/learn-cards/:cardId`
  correctly listed among the built API routes). No `lint`/`format:check`
  script exists anywhere in this repo, so that step was skipped as not
  applicable.

  **Follow-up (not in scope here):** the other 7 Learn sub-collections
  (schedules, anchors, AI threads, notes, review log, decks, doc registry)
  remain local-only by design — they live in one shared blob per device,
  not one row per record, so syncing any of them needs its own bespoke
  schema/merge design, not an extension of this slice. No optimistic-
  concurrency handling on the card-content sync itself (documented as a
  known gap in the new doc page) — editing the same card from two
  signed-in devices at once has the last write win, matching every other
  `saved_*`/quick-cards-style sync in this repo except `saved_flows`
  (which alone has conflict detection). The `qwksearch` file-sources
  credential-sync question, flagged by several prior runs, remains open
  for the same reason those runs recorded — it needs a maintainer
  product/security decision, not a mechanical fix.

- **🔗 Give the Debate Flow History tab a per-entry "synced to your account"
  indicator.** Another repeat of the standing autonomous-routine prompt
  ("integrate all the tools into the UI... create user settings and link
  user db SQL with the ability to save flows/docs/debates in SQL and link
  to users... add tools into where needed in the UI... develop better tool
  UI") — as with every recent repeat, that prompt's own asks are already
  fully built: `user_settings`/`documents`/`saved_flows`/`saved_rounds`,
  25+ bespoke `saved_*` D1 tables, and 60+ `TOOL_RECORD_COLLECTIONS`
  entries all linked to `user.id`, and every tool already reachable from
  the Tools page, the command palette and the feature catalog. Picked up
  the immediately preceding run's own flagged follow-up rather than
  starting a fresh audit: the new "History" tab (`FlowHistoryDialog.tsx`/
  `FlowHistoryList.tsx`) had no way to tell a synced entry apart from a
  local-only one, and that run assumed closing the gap needed new
  sync-layer design work first, since `tool-record-auto-sync.ts`'s watcher
  "currently only diffs-and-pushes; nothing tracks or exposes 'has record
  X's current value reached the account'". Reading that module rather than
  taking the assumption at face value found the opposite: the watcher
  already keeps exactly that answer in memory (`snapshots`, a per-collection
  map of each record's last-landed serialized JSON, advanced only once a
  push actually succeeds) — it just never exposed it to a caller. Surfacing
  it was one small, pure query function, not a sync redesign.

  Added `getToolRecordSyncStatus(collectionKey, record)` to
  `packages/debate-data-sync/src/state/tool-record-auto-sync.ts`, returning
  `"synced"` | `"pending"` | `"unknown"` by re-running the exact same
  id-then-JSON-equality comparison `flushToolRecordCollection` already uses
  to decide what to push, against the same `snapshots` map — `"unknown"`
  before this collection has ever been baselined (signed out, or before the
  first post-sign-in hydrate), so a viewer is never told a record is "not
  synced" when sync hasn't even started yet. No changes to the watcher's
  own push/diff logic. Wired it into `FlowHistoryList.tsx`: each entry now
  renders a small badge — "Synced" or "Not yet synced" — next to its label,
  reusing the same `Badge` primitive `FlowHistoryDialog.tsx`'s "via round"
  badge already uses; the badge is omitted entirely (rather than shown as
  a third state) when the status is `"unknown"`. Replaced the tab's old
  blanket "Auto-saved as you work. Synced to your account." caption — which
  asserted sync unconditionally, even signed out — with the per-entry badges
  and a plain "Auto-saved as you work."

  Vitest-covered: `packages/debate-data-sync/test/tool-record-auto-sync.test.ts`
  (7 new cases — unknown before baselining, synced after a real flush,
  pending for a record that never reached the account, pending again once a
  synced record's value changes locally, unknown for an unkeyable record,
  unknown for an unregistered collection, and back to unknown after a
  sign-out reset) and `packages/debate-round/test/FlowHistoryList.test.tsx`
  (4 new cases — no badge before any baseline exists, "Synced" once an
  entry's exact value has landed, "Not yet synced" for an entry baselined
  with nothing in it yet, and "Not yet synced" for a locally-edited entry
  even though an earlier value of it landed).

  Ran the full verification gate: `bun install`, `packages/debate-data-sync`'s
  own `bun run test` (32 files, 600 tests — 7 new) and `packages/debate-round`'s
  (60 files, 1206 tests — 4 new), the root `bun run test` (445 files, 8621
  tests passing), `bun run typecheck` (18/18 packages green), and
  `bun run build` (production build, all three targets green). No
  `lint`/`format:check` script exists anywhere in this repo, so that step
  was skipped as not applicable.

  **Follow-up (not in scope here):** the same per-record status is now
  available to any other synced tool's list UI (e.g. CardMirror's personal
  dictionary, the flow-edit log) that wants the same "synced vs. local-only"
  distinction — this run only wired it into the one tab the prior run's
  follow-up named. The `dailyMissionResults`/`challengeWinEvents`
  (composite-key/no-id gamification history — confirmed this run that
  giving them a synthetic `id` would mean reshaping the record type across
  ~80 existing call sites in `debate-contributor-progress`'s and
  `debate-team-collaboration`'s test suites, a materially larger change
  than "one entry in a list") and `qwksearch` file-sources credential-sync
  gaps flagged by earlier runs remain open for the same reasons those runs
  recorded.

- **🕘 Restore Debate Flow's missing "History" tab UI for the auto-saved
  flow log.** Another repeat of the standing autonomous-routine prompt
  ("integrate all the tools into the UI... create user settings and link
  user db SQL with the ability to save flows/docs/debates in SQL and link
  to users... add tools into where needed in the UI... develop better tool
  UI") — as with every recent repeat, that prompt's own asks are already
  fully built: `user_settings`/`documents`/`saved_flows`/`saved_rounds`,
  25+ bespoke `saved_*` D1 tables, and 60+ `TOOL_RECORD_COLLECTIONS`
  entries all linked to `user.id`, and every tool already reachable from
  the Tools page, the command palette and the feature catalog. Picked up
  the previous run's own flagged follow-up ("the History tab still has no
  way to tell a synced entry apart from a local-only one") and found it
  understated the gap: `packages/debate-round/src/dialogs/FlowHistoryDialog.tsx`
  had no History tab at all. Its `dateGroups`/`toggleDate`/`expandedRounds`/
  `toggleRound`/`selectedId`/`handleLoadFlow`/`handleClearHistory` state and
  logic all still existed — none of it was ever removed — but the dialog's
  JSX only ever rendered two tabs ("Rounds" and "Saved to account"), so
  every one of those was dead code computing a view nothing displayed. The
  `flow-history` auto-saved undo/version log (`packages/debate-round/src/state/store.ts`,
  account-synced two runs ago via the `flowHistory` `TOOL_RECORD_COLLECTIONS`
  entry) had, in effect, no user-facing surface at all — not even a
  "synced vs. local" distinction to build, since there was no view to add
  one to.

  Added a real "History" tab: `packages/debate-round/src/state/flowHistoryGrouping.ts`
  (`groupFlowHistoryByDate`, a pure day-grouping helper extracted from the
  dead `dateGroups` logic, mirroring `state/bulkRoundSave.ts`'s
  framework-free split so it's unit-testable without rendering the dialog)
  and `packages/debate-round/src/dialogs/FlowHistoryList.tsx` (a new
  presentational component: collapsible day groups, newest first, each
  entry showing its label and time with a restore action, an empty state,
  and a "Clear history" action wired to the dialog's existing
  `handleClearHistory`). `FlowHistoryDialog.tsx` now renders this as a
  third tab and had its orphaned `dateGroups`/`toggleDate`/`expandedDates`/
  `expandedRounds`/`toggleRound`/`selectedId` state and logic deleted —
  fully superseded, not just unused. Deliberately did not attempt a
  synced-vs-local-only indicator per entry: `debate-data-sync`'s watcher
  syncs by periodic snapshot-diff (see `tool-record-auto-sync.ts`) and
  exposes no per-record sync status to the UI layer, so that would be new
  sync infrastructure, not a UI fix — flagging as a real follow-up rather
  than guessing at a design for it.

  Vitest-covered: `packages/debate-round/test/flowHistoryGrouping.test.ts`
  (new — empty input, single-day grouping preserves order, multiple days
  split and order correctly, and an interleaved history re-groups onto its
  day boundaries) and `packages/debate-round/test/FlowHistoryList.test.tsx`
  (new — `react-dom/server` render test following `test/panels.test.tsx`'s
  established pattern for this package's DOM-less `environment: "node"`
  Vitest config: empty state, entries grouped and labelled under their
  day, singular/plural entry count, and multiple days rendered separately).

  Ran the full verification gate: `bun install`, `packages/debate-round`'s
  own `bun run test` (60 files, 1202 tests — 8 new) and `bun run typecheck`,
  the root `bun run test` (442 files, 8566 tests passing) and
  `bun run typecheck` (18/18 packages green), and `bun run build`
  (production build, all three targets green). No `lint`/`format:check`
  script exists anywhere in this repo, so that step was skipped as not
  applicable.

  **Follow-up (not in scope here):** a per-entry "synced to your account"
  indicator on the History tab needs `debate-data-sync`'s watcher to
  surface per-record sync status to callers first (it currently only
  diffs-and-pushes; nothing tracks or exposes "has record X's current
  value reached the account"), which is sync-layer design work, not a UI
  addition — noted rather than attempted here. The `dailyMissionResults`/
  `challengeWinEvents` (composite-key, no single stable id) and
  `qwksearch` file-sources credential-sync gaps flagged by earlier runs
  remain open for the same reasons those runs recorded.

- **🔄 Sync the Debate Flow workspace's auto-saved history to the account.**
  Another repeat of the standing autonomous-routine prompt ("integrate all
  the tools into the UI... create user settings and link user db SQL with
  the ability to save flows/docs/debates in SQL and link to users... add
  tools into where needed in the UI... develop better tool UI") — as with
  every recent repeat, that prompt's own asks are already fully built:
  `user_settings`/`documents`/`saved_flows`/`saved_rounds`, 25+ bespoke
  `saved_*` D1 tables, and 60+ `TOOL_RECORD_COLLECTIONS` entries all linked
  to `user.id`, and every tool already reachable from the Tools page, the
  command palette and the feature catalog. A fresh repo-wide audit (this
  run's designated branch had already been merged as PR #835, so it
  restarted from `master` and re-audited rather than resuming stale work)
  cross-referenced every `localStorage` key in the repo against both the
  `TOOL_RECORD_COLLECTIONS` catalog and the bespoke `saved_*` tables, and
  found one real gap: `/debate`'s Debate Flow workspace already
  account-syncs the flows and rounds you explicitly click "save to cloud"
  on (`saved_flows`/`saved_rounds`), but a *second*, separate store —
  `debate-round/src/state/store.ts`'s `flow-history` key, the auto-saved
  undo/version log `FlowHistoryDialog`'s own "History" tab reads — had no
  sync at all, and wasn't named in `tool-data-sync.mdx`'s catalog or any
  Known-gaps list. Each entry (`{ id, flow, timestamp, label }`, `id` a
  stable `${flow.id}-${Date.now()}` assigned once and never mutated)
  already matched the generic catalog's required shape exactly, so this
  was a one-entry addition rather than a schema-design task.

  Added `flowHistory` to `packages/debate-data-sync/src/state/toolRecordCollections.ts`'s
  `TOOL_RECORD_COLLECTIONS` (`storageKey: "flow-history"`, `idField: "id"`,
  section "Flowing and writing", href `/debate`) — per that module's own
  design ("Adding a tool to the sync is one entry in this list, and nothing
  else"), no change was needed to `debate-round` itself: the generic
  watcher in `tool-record-auto-sync.ts` picks up any collection named in
  the catalog without the owning package knowing the sync exists, and
  already handles an oversized record (a very large flow past the generic
  mechanism's 200KB-per-record cap, vs. `saved_flows`' own 2MB cap) by
  holding just that record back locally rather than failing the whole
  collection's sync or retrying forever — confirmed by reading
  `tool-record-auto-sync.ts`'s existing oversized-record handling rather
  than assuming it, since that was the one real risk worth checking before
  picking this candidate.

  Vitest-covered: added `flowHistory: "id"` to
  `packages/debate-data-sync/test/tool-record-catalog.test.ts`'s
  `EXPECTED_ID_FIELDS` map and a dedicated `findToolRecordCollection`
  regression test, following this file's existing per-addition convention
  (the catalog's own generic tests in `toolRecordCollections.test.ts`
  already cover any new entry's shape automatically). Updated
  `tool-data-sync.mdx`'s "Flowing and writing" enumeration to name the new
  collection. No UI changes: the History tab already reads/writes the same
  `flow-history` key, so it starts reflecting synced data with no code
  changes there, matching this catalog's established pattern for a
  pure data-layer addition.

  Ran the full verification gate: `bun install`, `packages/debate-data-sync`'s
  own `bun run test` (32 files, 593 tests passing), the root `bun run test`
  (440 files, 8558 tests passing), `bun run typecheck` (18/18 packages
  green), and `bun run build` (production build, all three targets green).
  No `lint`/`format:check` script exists anywhere in this repo, so that
  step was skipped as not applicable.

  **Follow-up (not in scope here):** the "History" tab still has no way to
  tell a synced entry apart from a local-only one, or to see it arrive on a
  second device without reopening the dialog — the same "no view/remove UI
  beyond the raw sync" gap the personal spellcheck dictionary had before
  its own follow-up UI pass. Left out here to keep this slice a pure,
  low-risk data-layer addition, consistent with how every other collection
  in this catalog first joined it. `dailyMissionResults`/`challengeWinEvents`
  (`packages/debate-contributor-progress/src/state/dailyMissionResults.ts`,
  `packages/debate-team-collaboration/src/state/challengeWinEvents.ts`)
  remain flagged as real gamification history with no sync, but their
  records carry no single stable id field (composite
  `(contributorId, dayKey)` or none at all) — joining the catalog would mean
  adding a synthetic id to the record type in the owning package first, a
  larger change than "one entry in a list."

- **📖 Give CardMirror's synced personal spellcheck dictionary a view/remove
  UI.** Another repeat of the standing autonomous-routine prompt ("integrate
  all the tools into the UI... create user settings and link user db SQL
  with the ability to save flows/docs/debates in SQL and link to users...
  add tools into where needed in the UI... develop better tool UI") — as
  with every recent repeat, that prompt's own asks are already fully built:
  `user_settings`/`documents`/`saved_flows`/`saved_rounds`, 25+ bespoke
  `saved_*` tables, and 60+ `saved_tool_records` collections (including
  `spellcheckDictionary`, added two runs ago) all linked to `user.id`. This
  run picked up that same run's own flagged follow-up instead of searching
  for a new gap: the personal dictionary synced to the account but stayed
  invisible everywhere except the editor's right-click "Add to Dictionary"
  action — no page could show what words were saved or remove one, short of
  clearing `localStorage` by hand. A one-line "better tool UI" gap in an
  already-synced tool, and exactly the kind of small, mechanical slice this
  routine should prefer over a fresh audit.

  Added `packages/debate-editor/src/editor/user-dictionary-ui.ts`
  (`buildUserDictionarySection`) — pulled into its own module rather than
  inlined in `settings-ui.ts`, matching that file's own precedent
  (`user-dictionary.ts` itself was split out the same way) so the new DOM
  logic stays unit-testable without importing `settings-ui.ts`'s much larger
  dependency graph (host detection, pairing, collab, ...). Renders the
  current dictionary alphabetically with a per-word remove button, an empty
  state when nothing's saved, and an "Add a word" field (button + Enter) so
  a word can be added without the right-click flow. `settings-ui.ts` wires
  it in with one `querySelector('[data-setting-key="editorSpellcheck"]')` +
  `insertAdjacentElement('afterend', ...)` call inside
  `buildEmbeddedSettingsPanel`'s existing `category === 'general'` branch —
  right after the "Editor spellcheck" toggle it belongs to, on the app's own
  `/settings` page (where that toggle already lives; the in-editor gear-icon
  modal renders no General-category rows at all, by existing design, so
  there was nothing to wire there). New CSS (`.pmd-dictionary-*`) mirrors
  the existing `.pmd-reader-*` add/remove-list rows already in
  `style.css` rather than inventing a new visual pattern.

  Vitest-covered: `packages/debate-editor/test/user-dictionary-ui.test.ts`
  (new — empty state, alphabetical listing, remove-and-persist, back to
  empty state after removing the last word, add via button, add via Enter,
  and blank/whitespace-only input is ignored). No changes needed to
  `user-dictionary.ts` itself or the sync mechanism — this was purely a UI
  gap.

  Ran the full verification gate: `bun install`, `packages/debate-editor`'s
  own `bun run test` (30 files, 707 tests — 8 new), the root `bun run test`
  (440 files, 8545 tests, all passing), `bun run typecheck` (18/18 packages
  green), and `bun run build` (production build, all three targets green).
  No `lint`/`format:check` script exists anywhere in this repo, so that step
  was skipped as not applicable.

  **Follow-up (not in scope here):** CardMirror's "Learn"
  flashcards/spaced-repetition system (`packages/debate-editor/src/editor/learn-store.ts`,
  localStorage key `pmd-learn-store`) remains unsynced — still flagged by
  the last two runs as real user-authored content with no account sync, but
  not a small first slice: the blob mixes cards, SM2 schedules, a review
  log, AI Q&A threads, anchored notes, and custom decks in one JSON blob
  that doesn't fit `TOOL_RECORD_COLLECTIONS`'s one-array-of-id-bearing-
  records shape, so it needs a bespoke table (or several) plus API routes —
  closer to `saved_flows`/`documents` in scope than to this fix. The
  `qwksearch` file-sources credential-sync question (configured SSH/S3/R2/
  B2/Google Docs/Turso research backends embedding plaintext credentials)
  also remains open, still needing a maintainer product/security decision
  before it's implementable.

- **📄 Wire three real feature docs into the feature catalog's "Learn more"
  links.** Another repeat of the standing autonomous-routine prompt
  ("integrate all the tools into the UI... create user settings and link
  user db SQL with the ability to save flows/docs/debates in SQL and link
  to users... add tools into where needed in the UI... develop better tool
  UI") — as with every recent repeat, that prompt's own asks are already
  fully built: `user_settings`/`documents`/`saved_flows`/`saved_rounds`,
  25+ bespoke `saved_*` tables, and 60+ `saved_tool_records` collections
  all linked to `user.id`. A background audit re-checked every remaining
  localStorage-backed store in the repo for an un-synced gap and found
  only two: `qwksearch/lib/file-sources.ts` (configured SSH/S3/R2/B2/Google
  Docs/Turso research backends) embeds plaintext credentials, so syncing it
  raises a security/product design question outside this routine's
  "unambiguous, low-risk" scope rather than a mechanical fix; and
  `researchProgressGoals.ts` turned out to already be fully account-synced
  via `/api/settings`'s `researchProgressGoal` field
  (`lib/research-progress-goal-sync.ts` / `useResearchProgressGoalSync.ts`),
  so re-doing it would have duplicated existing work.

  Pivoted to the same theme's "tool discoverability / better tool UI"
  angle instead. `packages/debate-feature-catalog/src/feature-catalog.ts`'s
  `APP_FEATURES` catalog backs `/features`, `debate-ui`'s `FeaturesPanel`
  (both copies, `packages/debate-ui` and its `apps/debate-ai.com` mirror),
  and News Stream's "Tool spotlight" posts — each renders a "Learn more"
  link from an entry's optional `doc` field via `featureDocUrl`/
  `docs-links.ts`. Three entries with a real, on-topic doc file already
  sitting under `packages/debate-help-docs/content/docs/features/` had no
  `doc` field wired up, so those three tools rendered no "Learn more" link
  anywhere the catalog is read: `videos` (missing `video-library.md`),
  `common-argument-library` (missing `argument-library-collections.md`),
  and `contributions-feed` (missing `contributions-feed.md`). Invisible to
  CI because `feature-catalog.test.ts`'s existing check only validates a
  `doc` field *if present* (ends in `.md`), never that one exists when a
  matching doc file does. A repo-wide cross-check of every file under that
  docs directory against every catalog `doc:` reference confirmed these
  three were the only gap in either direction — no catalog entry points at
  a missing file, and every other doc-less file under that directory
  (`app-nav-dock.mdx`, `flow-cloud-save.mdx`, `user-settings.mdx`, and 15
  others) documents an internal mechanism or sub-topic with no matching
  top-level catalog `id`, not a missed 1:1 mapping.

  Added the three `doc` fields (`.md`, matching every other entry's
  convention even though the files on disk are `.mdx` — `featureDocUrl`
  strips the extension either way) and a pinned `it.each` regression test
  naming exactly these three `{id, doc}` pairs, rather than a
  filename-derived sweep, since a doc's filename doesn't reliably match its
  catalog entry's `id` (e.g. `videos` ↔ `video-library.md`).

  Ran the full verification gate: `bun install`, `bun run typecheck`
  (18/18 packages green), `bun run test` (439 files, 8537 tests passing —
  3 new), and `bun run build` (production build, all three targets green).
  No `lint`/`format:check` script exists anywhere in this repo, so that
  step was skipped as not applicable.

  **Follow-ups (not in scope here):** (1) the `qwksearch` file-sources
  credential-sync question above needs a maintainer decision (encrypt
  server-side, split credential fields out of the synced payload, or leave
  local-only by design) before it's implementable — flagging rather than
  guessing. (2) CardMirror's "Learn" flashcards/spaced-repetition store
  (`packages/debate-editor/src/editor/learn-store.ts`, localStorage key
  `pmd-learn-store`) remains unsynced and remains too large for a first
  slice, as previously noted: one blob mixes 8 sub-collections (cards,
  schedules, anchors, AI threads, notes, review log, decks, doc registry)
  with no flat-array shape, so joining the generic `TOOL_RECORD_COLLECTIONS`
  mechanism would mean splitting the host's persistence format entirely
  (`learn-store-host.ts`'s single `pmd-learn-store` key, mirrored in both
  the browser and Electron hosts) — a bespoke-schema design task, not a
  mechanical one.

- **🔤 Sync the CardMirror editor's personal spellcheck dictionary to the
  account.** Another repeat of the standing autonomous-routine prompt
  ("integrate all the tools into the UI... create user settings and link
  user db SQL with the ability to save flows/docs/debates in SQL and link
  to users... add tools into where needed in the UI... develop better tool
  UI") — as with every recent repeat, that prompt's own asks are already
  fully built and reconfirmed again this run: `user_settings`/`documents`/
  `saved_flows`/`saved_rounds` and 25+ other `saved_*`/`saved_tool_records`
  D1 tables all linked to `user.id` (`apps/debate-ai.com/lib/database/schema.ts`),
  and every tool already reachable from the Tools page, CardMirror's own
  `MenuBar`/command palette (`Mod-Shift-Space`), and the feature catalog
  (`apps/debate-ai.com/lib/__tests__/tool-catalog-consistency.test.ts`
  reconfirmed all three catalogs still agree). A repo-wide audit for a
  `localStorage`-backed store with real per-user content and no account sync
  at all (not already covered by `TOOL_RECORD_COLLECTIONS` or a bespoke
  `saved_*` table) turned up one: `packages/debate-editor/src/editor/viewport-spellcheck.ts`'s
  `pmd-user-dictionary` store (words added via the editor's right-click "Add
  to Dictionary") was a bare `string[]`, unsynced and undocumented as an
  intentional exclusion in `tool-data-sync.mdx`.

  Pulled the store into its own module, `packages/debate-editor/src/editor/user-dictionary.ts`
  (`parseUserDictionary`/`serializeUserDictionary`/`loadUserDictionary`/
  `saveUserDictionary`), reshaped to `{ id, word }[]` (id === word) so it fits
  `TOOL_RECORD_COLLECTIONS`'s required shape — a JSON array under one
  `localStorage` key, each record keyed by one stable string field.
  `loadUserDictionary` reads the older bare-string-array shape transparently
  and migrates it to the new shape in place on load, so an existing
  dictionary starts syncing on the editor's next load rather than only after
  the next word is added; a dictionary with nothing saved yet is left alone
  rather than seeded with `[]`. `viewport-spellcheck.ts` now calls this
  module instead of owning the storage format itself — no behavior change to
  spellchecking, suggestions, or the "Add to Dictionary"/"Ignore" menu
  actions. Registered one new entry, `spellcheckDictionary`
  (`packages/debate-data-sync/src/state/toolRecordCollections.ts`, section
  "Flowing and writing", href `/reason-editor`) — the sync mechanism itself
  needed no changes, matching this catalog's "adding a tool to the sync is
  one entry in this list, and nothing else" design; it now also appears
  automatically under Settings → Account → Tool data.

  Vitest-covered: `packages/debate-editor/test/user-dictionary.test.ts` (new
  — parses the current and legacy shapes, drops malformed entries, handles
  null/corrupt/non-array input, round-trips through serialize, and covers
  `loadUserDictionary`'s in-place migration and no-op-when-already-current
  and nothing-saved-yet cases) and
  `packages/debate-data-sync/test/tool-record-catalog.test.ts` (added
  `spellcheckDictionary` to `EXPECTED_ID_FIELDS` and a dedicated
  `findToolRecordCollection` assertion, following this file's existing
  per-addition test convention). Updated `tool-data-sync.mdx`'s "Flowing and
  writing" enumeration to name the new collection.

  Ran the full verification gate: `bun install`, `bun run test` (root config
  — 439 files, 8534 tests passing), `packages/debate-editor`'s own
  `bun run test` (29 files, 699 tests) and `packages/debate-data-sync`'s
  (32 files, 592 tests) both passing standalone, `bun run typecheck`
  (18/18 packages green, `debate-ai-web` included), and `bun run build`
  (production build). No `lint`/`format:check` script exists anywhere in
  this repo, so that step was skipped as not applicable.

  **Follow-up (not in scope here):** the dictionary has no view/remove UI
  anywhere — only the right-click "Add to Dictionary" action exists, so a
  synced word is invisible until CardMirror's own settings UI
  (`packages/debate-editor/src/editor/settings-ui.ts`, ~6700 lines of
  hand-built DOM, no React) grows a small management list. Left out of this
  slice to keep the sync change (and its risk) isolated from a UI addition
  to that large vanilla-DOM file. A background audit this run also
  identified CardMirror's "Learn" flashcards/spaced-repetition system
  (`packages/debate-editor/src/editor/learn-store.ts`, localStorage key
  `pmd-learn-store`) as unsynced — cards, SM2 schedules, review log, AI Q&A
  threads, anchored notes, and custom decks all in one JSON blob. Real
  user-authored content lost on a cleared browser or a device switch, but
  **not** a small first slice: the blob mixes several record types that
  don't fit `TOOL_RECORD_COLLECTIONS`'s one-array-of-id-bearing-records
  shape, so it needs a bespoke table (or several) plus API routes, closer to
  `saved_flows`/`documents` than to this dictionary fix. Worth a dedicated
  future task once someone has time to design that schema.

---

## Top 5 Ideas for New Contributors

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
git clone https://github.com/yourorg/debate-ai.com
cd debate-ai.com
npm install  # or pnpm/yarn/bun

# Run dev server
npm run dev

# Run tests
npm test

# Lint & format
npm run lint
npm run format
```

## Resources

- [Architecture Overview](docs/architecture.md)
- [API Documentation](docs/api.md)
- [Database Schema](docs/schema.md)
- [Design System](docs/design-system.md)

---

*Last updated: 2026-09-14*
*Feel free to add more ideas or expand on existing ones!*