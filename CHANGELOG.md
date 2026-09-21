
### Completed

- **🔐 Fix the guest sign-in prompt's 30-minute cooldown resetting on a new
  tab.** Another repeat of the standing autonomous-routine prompt ("integrate
  all the tools into the UI... create user settings and link user db SQL with
  the ability to save flows/docs/debates in SQL and link to users... add
  tools into where needed in the UI... develop better tool UI") — as with
  every recent repeat, that prompt's own asks are already fully built:
  `user_settings`/`documents`/`saved_flows`/`saved_rounds`, 25+ bespoke
  `saved_*` D1 tables, and 60+ `TOOL_RECORD_COLLECTIONS` entries all linked
  to `user.id`, and every tool already reachable from the Tools page, the
  command palette and the feature catalog. Went looking for a still-open,
  one-PR-sized gap in the tool/account-linking system these entries keep
  auditing rather than re-auditing the whole thing from scratch, and found
  one explicitly flagged but never actually fixed:
  `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx`'s
  Known gaps said the guest sign-in prompt's 30-minute per-feature cooldown
  "lives in `sessionStorage`, so a user who dismisses a prompt without
  opting out entirely is asked again about that feature in a new tab" — and
  `components/layout/SignInPromptProvider.tsx` still read and wrote
  `sessionStorage` directly, unchanged. `lib/sign-in-prompt-preference.ts`
  (the separate, permanent "don't ask me again" opt-out next to it) even
  already carried a doc comment describing this exact fix as still to do.

  Extracted the cooldown's read/mark logic out of the provider into its own
  `apps/debate-ai.com/lib/sign-in-prompt-cooldown.ts`
  (`wasSignInPromptShownRecently` / `markSignInPromptShown` /
  `PROMPT_COOLDOWN_MS`), mirroring `sign-in-prompt-preference.ts`'s shape —
  same guard rails (no-op and never throws with no `localStorage`, swallows
  a write failure) — and switched its backing store from `sessionStorage` to
  `localStorage`, which a browser shares across tabs. The 30-minute window
  itself is unchanged; only the "which tab remembers it" scope moved, same
  as the opt-out it now sits next to. `SignInPromptProvider.tsx` dropped its
  own inline `PROMPT_COOLDOWN_MS`/`DISMISSED_KEY`/`readShown`/`markShown` in
  favour of the two new functions — no behavior change to the dialog itself,
  the opt-out check, or the "still saves locally either way" guarantee the
  rest of that flow already had.

  Vitest-covered: `apps/debate-ai.com/lib/__tests__/sign-in-prompt-cooldown.test.ts`
  (12 cases) — unshown defaults to false, true immediately after marking and
  up to (not including) the cooldown boundary, false once the window has
  fully elapsed, a value written for one feature is visible to a fresh call
  for that same feature with no in-memory state carried over (standing in
  for "a second tab", since `localStorage` in a unit test is only ever one
  object anyway), each feature tracked independently without clobbering
  another's cooldown, re-marking a feature restarts its window, and the same
  never-throws-with-no/refusing-`localStorage` guarantees
  `sign-in-prompt-preference.test.ts` already pins for its sibling module.
  Updated `tool-data-sync.mdx`'s Known gaps entry to a struck-through
  **Fixed** note (matching this doc's own convention for closed gaps),
  its "Telling a guest" section's description of the cooldown, and
  `sign-in-prompt-preference.ts`'s doc comment, which had described the
  `sessionStorage` version as the current state rather than as the thing it
  was proposing to fix.

  Ran the full verification gate: `bun install`, the root `bun run test`
  (504 files, 9406 tests passing, 12 new), `bun run typecheck` (17/17
  packages green, `debate-help-docs`'s MDX build included), and `bun run
  build` (production build; `apps/debate-ai.com` built clean, service worker
  generated). No `lint`/`format:check` script exists anywhere in this repo,
  so that step was skipped as not applicable.

  **Follow-up (not in scope here):** the two other Known gaps this same doc
  section still lists — sync running once per tab with no live push channel,
  and per-user rather than per-team sharing for judge profiles / prep notes —
  are each a small design decision or a sync-layer change, not a
  drop-in fix like this one, and neither was touched.

- **📇 Sync CardMirror's Learn review log to the account, and give it its
  first user-facing surface.** Another repeat of the standing
  autonomous-routine prompt ("integrate all the tools into the UI...
  create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built:
  `user_settings`/`documents`/`saved_flows`/`saved_rounds`, 25+ bespoke
  `saved_*` D1 tables, and 60+ `TOOL_RECORD_COLLECTIONS` entries all
  linked to `user.id`, and every tool already reachable from the Tools
  page, the command palette and the feature catalog. Audited the specific
  follow-ups earlier entries below had flagged as still open (CardMirror's
  personal-dictionary view/remove UI, its Learn flashcards/decks sync, the
  `qwksearch` file-sources credential-sync gap) and found most already
  closed by runs between when they were flagged and now — this changelog's
  own ordering isn't strictly chronological across the parallel automated
  runs that write to it, so a flagged follow-up can already be stale by
  the time a later entry cites it. The one still-open, one-PR-sized gap:
  of Learn's 8 sub-collections (`packages/debate-editor/src/editor/learn-store.ts`),
  cards and custom decks already synced to the account
  (`learn-cards-sync.ts`, `learn-decks-sync.ts`); the review log
  (`ReviewLogEntry[]` — `grade()`'s append-only grading history) neither
  synced nor had any UI reading it anywhere, not even the "Manage
  flashcards" overlay.

  Gave it its own bespoke sync, mirroring the cards/decks split (all 8
  sub-collections share one localStorage blob, so the generic
  `TOOL_RECORD_COLLECTIONS` mechanism would clobber the other 7 on every
  write) but simpler than either: a review-log entry is immutable once
  logged, so there's no optimistic-concurrency conflict to resolve, only
  add/remove. Added `reviewLogEntryId` (`` `${cardId}:${at}` `` — `at` is
  already a millisecond-precision ISO timestamp, so this needed no new id
  field or call-site reshaping), `isValidReviewLogEntry`, `listLog()`, and
  `adoptLogEntry()` (append-if-absent; deliberately never touches
  `schedules` — sync is purely informational history, not a replay of
  another device's grading) to `learn-store.ts`; `learn-review-log-client.ts`
  + `learn-review-log-sync.ts` (`LearnReviewLogSync`, mirroring
  `LearnCardsSync`'s init-merge-then-mirror shape); `saved_learn_review_log`
  (migration `0050`, keyed `(user_id, client_id)` same as
  `saved_learn_cards`/`saved_learn_decks`) and `/api/learn-review-log`
  (`GET` + `[entryId]` `PUT`/`DELETE`, account-only). Wired
  `learnReviewLogSync.init()` into `editor/index.ts` alongside the other
  two.

  Then closed the actual UI gap: `learn-review-log-ui.ts`'s
  `buildReviewLogSection` (an injectable-`store`/`sync` pure builder,
  mirroring `user-dictionary-ui.ts`'s testability split from its own
  overlay chrome) lists every logged review newest-first with the card's
  current front text, its grade, and when it happened, plus one coarse
  "Synced to your account" / "Not synced" line — not a per-entry badge;
  this sync has no per-record conflict state worth surfacing. Its
  `openReviewLogHistory` wraps that in its own small `.pmd-route-overlay`
  (stacks above the Manage overlay, z-index 1400 vs. 1090), opened from a
  new "History" button in `learn-manage-ui.ts`'s bar — a two-line,
  mechanical addition to that large untested vanilla-DOM file, keeping
  every actually-interesting bit (the list rendering, the sync-status
  line, the live re-render) in the tested module instead.

  Vitest-covered: `learn-store.test.ts` (`listLog`/`adoptLogEntry`/
  `isValidReviewLogEntry`/`reviewLogEntryId` — dedupe-by-id, never mints a
  schedule on adoption, validator rejection cases), `learn-review-log-client.test.ts`
  (mirroring `learn-cards-client.test.ts`), `learn-review-log-sync.test.ts`
  (init merge, ongoing mirror, delete-on-card-removal, signed-out no-op —
  mirroring `learn-cards-sync.test.ts` minus the conflict-handling cases,
  which don't apply here) and `learn-review-log-ui.test.ts` (empty state,
  card lookup incl. a deleted-card placeholder, newest-first sort, live
  re-render, sync-status transitions, reusing an already-in-flight
  `init()`).

  Ran the full verification gate: `bun install`, `debate-editor`'s own
  `bun run test` (42 files, 889 tests — 39 new across the 4 new/changed
  files) and `bun run typecheck`, `apps/debate-ai.com`'s `bun run typecheck`,
  the root `bun run test` (503 files, 9394 tests passing), `bun run typecheck`
  (17/17 packages green, `debate-help-docs`'s MDX build included — the new
  `learn-review-log-cloud-sync.mdx` page parses clean), and `bun run build`
  (production build; `/api/learn-review-log` and `/api/learn-review-log/:entryId`
  both present in the route manifest). No `lint`/`format:check` script
  exists anywhere in this repo, so that step was skipped as not
  applicable.

  **Follow-up (not in scope here):** Learn still has 5 unsynced
  sub-collections (schedules — deliberately local-only by design, not a
  gap; anchors, AI threads, notes, doc registry). Anchors/AI
  threads/notes are keyed by `(cardId, docId)` or `(threadId, docId)`
  rather than one string id, and the doc registry is keyed by `docId`
  with no natural per-user-visible list yet — each would need its own
  small design pass (a composite-key id scheme, at minimum) before
  mirroring this same bespoke-sync pattern, not just a repeat of this PR's
  shape. The `qwksearch` file-sources credential-sync gap
  (`apps/debate-ai.com/components/qwksearch/lib/file-sources.ts`, plain
  `localStorage` for SSH/S3/R2/B2/Google Docs/Turso credentials) remains
  open and still needs a maintainer security/product decision (encrypt
  server-side vs. strip credential fields vs. stay local-only by design)
  before implementation — confirmed unchanged this run.

- **🔗 Give the Debate Flow History tab a per-entry "synced to your account"
  indicator.** Another repeat of the standing autonomous-routine prompt
  ("integrate all the tools into the UI... create user settings and link
  user db SQL with the ability to save flows/docs/debates in SQL and link
  to users... add tools into where needed in the UI... develop better tool
  UI") — as with every re cent repeat, that prompt's own asks are already
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
