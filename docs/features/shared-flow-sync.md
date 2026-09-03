# Shared, Ai-Generated Debate Flow — Flow Edit Log + Sync

Lets a contributor log a proposed edit to a specific flow argument (their
own, or one they're relaying from a teammate) and previews how every
logged edit merges into the round's flow, flagging genuinely concurrent,
diverging edits for a human to resolve instead of silently overwriting
them.

- **Where:** the Coach hub's Flow section (`/coach`)
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

**Flow Edit Log** — a form to log a `FlowEdit`:

- **Flow ID**, **Author ID**, and **Box path** (a comma-separated path,
  e.g. `0, 1`) address exactly which flowed argument the edit targets, the
  same way `boxFromPath` already addresses a box elsewhere in the flow
  spreadsheet.
- **Content** is the box's proposed new text (empty models clearing it).

Below the form, every persisted edit is grouped by flow, newest first,
with a **Clear** action per group that deletes every edit logged for that
flow.

**Shared Flow Sync** — the merge preview immediately above it, reused
unmodified from the earlier first slice: given the edits logged for the
round workspace's currently selected flow, it shows how many boxes would
update, flags any conflicting boxes (edits from different authors with
different content landing within a configurable window of each other —
5 seconds by default), and an **Apply** action.

## Data flow

```
flow/shared-flow-sync.ts               — createFlowEdit (validates + builds one FlowEdit),
                                           mergeFlowEdits, applyMergedEditsToFlow,
                                           buildSharedFlowSyncSummaryText
state/flowEdits.ts (localStorage: flowEdits)
  → listFlowEdits() / listFlowEditsForFlow(flowId)
  → panels/FlowEditLogPanel.tsx        — renders the log-an-edit form + logged-edit list
  → apps/debate-ai.com/components/coach/CoachHub.tsx
      → reads listFlowEdits() via debate-ui's useStoreSnapshot, filters to the
        round workspace's currently selected flow, and hands the result to
        panels/SharedFlowSyncPanel.tsx as its `edits` prop

Logging an edit:
panels/FlowEditLogPanel.tsx
  → createFlowEdit({ ... })            — flow/shared-flow-sync.ts (throws on an empty
                                           boxPath or blank authorId)
  → saveFlowEdit(edit)                 — state/flowEdits.ts
  → panel re-reads listFlowEdits() to refresh, and calls the optional
    onChange prop so a composing screen's own snapshot (CoachHub's) refreshes too

Applying a merge:
panels/SharedFlowSyncPanel.tsx "Apply" button
  → applyMergedEditsToFlow(flow, result.merged)  — flow/shared-flow-sync.ts
  → CoachHub's onApply writes the updated flow back into the round
    workspace's useFlowStore (setFlows) and clears the flow's logged
    edits via clearFlowEditsForFlow, so an applied edit doesn't linger
    and get re-offered for merging next time
```

This closes the data-source gap left open by the "Feature panels" PR that
first mounted `SharedFlowSyncPanel` in the app: nothing recorded a
`FlowEdit`, so `CoachHub` always passed an empty array and the panel only
ever rendered its own-edits empty state. It adds:

- `flow/shared-flow-sync.ts`: `createFlowEdit`/`CreateFlowEditInput`,
  mirroring `flow-annotations.ts#createFlowAnnotation`'s validation style
  (a non-empty `boxPath`, a non-blank `authorId`, `content` trimmed and
  length-clamped).
- `state/flowEdits.ts`: `listFlowEdits`, `listFlowEditsForFlow`,
  `saveFlowEdit`, `deleteFlowEdit`, `clearFlowEditsForFlow`, mirroring the
  existing `flowAnnotations.ts`/`prepNotes.ts` persistence convention.
- `panels/FlowEditLogPanel.tsx`: the log-an-edit form + logged-edit list,
  with an optional `onChange` callback for a composing screen.
- `CoachHub.tsx`: wires real, persisted edits into `SharedFlowSyncPanel`
  and applies an accepted merge back into the round workspace.

Vitest-covered in `packages/debate-round/test/shared-flow-sync.test.ts`
(`createFlowEdit`: valid input, trimming, empty-content clearing,
length-clamping, empty-`boxPath`/blank-`authorId` validation errors) and
`packages/debate-round/test/flowEdits.test.ts` (empty/corrupt/non-array
storage, cross-flow listing and ordering, upsert-by-id, delete,
clear-by-flow).

## FlowSpreadsheet affordance

Every cell in the live `FlowSpreadsheet` grid now shows a small commit-icon
badge next to its text for logging or reviewing that box's `FlowEdit`s,
without leaving the grid for the separate `FlowEditLogPanel` form:

- A box with one or more logged edits shows a filled badge with the pending
  count; hovering lists each edit's author and content, newest first.
- A box with none shows a faint, still-clickable affordance — this is the
  entry point for logging a new edit, since a box with zero prior edits is
  exactly when a contributor wants to add one.
- Clicking either state opens an `EditReviewPopover` at the click position
  (mirroring `GridContextMenu`'s fixed-position overlay — an AG Grid cell
  clips normal in-flow content, so this renders as a sibling of the grid).
  It lists the box's already-logged edits and a small form (Author ID,
  Content, prefilled with the cell's current value) to log a new one
  directly against `state/flowEdits.ts`.

This closes the remaining half of follow-up (b), "a `FlowSpreadsheet`-grid
affordance for logging or reviewing an edit," named under idea #16
("Shared, Ai-Generated Debate Flow") in `TODO.md`. It adds:

- `flow/edit-cells.ts`: `sortEditsNewestFirst` — orders a box's edits
  newest first for the badge tooltip and popover list. Box-path derivation
  is reused directly from `annotation-cells.ts#boxPathForCell`/
  `columnIndexFromField` (generic to any per-cell, box-addressed feature,
  not specific to annotations).
- `state/flowEdits.ts`: `listFlowEditsForBox`, mirroring
  `flowAnnotations.ts#listFlowAnnotationsForBox`.
- `flow/EditBadge.tsx`: the commit-icon badge, shared by both cell
  renderers below. Unlike `AnnotationBadge` (which renders nothing for an
  empty box), this always renders — it's the log-a-new-edit entry point
  too.
- `flow/EditReviewPopover.tsx`: the fixed-position overlay, mirroring
  `GridContextMenu`'s click-outside/Escape-to-close pattern.
- `flow/AnnotationCellRenderer.tsx` / `flow/FirstColumnCellRenderer.tsx`:
  now also render `EditBadge` alongside the existing `AnnotationBadge`.
- `flow/useFlowGridConfig.ts` / `flow/FlowSpreadsheet.tsx`: wire an
  `onOpenEditReview` callback (which positions the popover from the
  clicked badge's event, the same way `onCellContextMenu` positions
  `GridContextMenu`) into both renderers' `cellRendererParams`.

Vitest-covered in `packages/debate-round/test/edit-cells.test.ts`
(newest-first ordering), `packages/debate-round/test/EditBadge.test.tsx`
(empty-box vs. populated render, singular/plural wording, tooltip
ordering, "(cleared)" fallback), and a new `listFlowEditsForBox` describe
block in `packages/debate-round/test/flowEdits.test.ts` (exact box-path
match, excluding prefix/extension paths and other flows).

## Common Argument Library flow-note suggestions

As a contributor types a `FlowEdit`'s **Content** in `FlowEditLogPanel`, a
"Suggested from Common Argument Library" list scores the in-progress text
against every persisted `LibraryCard` (`debate-card-search`'s Common
Argument Library — the combined Shared Evidence Library plus tagged
Contributions Feed corpus) and shows the closest matches with an
**Insert** action per suggestion. Clicking **Insert** fills the Content
field with that card's formatted note (`argBlock — caseArea (topic)
[tags]`) — still fully editable before logging, never applied to the box
automatically, keeping a human in control of the actual flow.

This closes follow-up (c) under idea #16 ("Shared, Ai-Generated Debate
Flow") in `TODO.md`: "composing the Common Argument Library's tagged card
corpus to suggest (not auto-apply) a pre-filled flow note from matching
evidence." It adds:

- `flow/flow-note-suggestions.ts`: `deriveLibraryCardKeywords` (mirrors
  `debate-card-search`'s `llm-card-scoring.ts#deriveArgBlockKeywords` —
  each of a card's `argBlock`/`topic`/`caseArea`/`tags` phrases kept whole
  plus its individual words over two characters),
  `suggestFlowNotesFromLibrary` (scores every card against the query by
  reusing `scoreRelevance` directly, dropping zero-score cards and capping
  at a limit), and `buildFlowNoteFromCard` (the inserted note's format).
- `debate-card-search`'s `state/evidenceLibraryEntries.ts`:
  `listCombinedPersistedLibraryCards`, the same evidence-library +
  tagged-contributions corpus `buildCombinedPersistedArgumentLibrary`
  already composed, now exposed flat for a caller that scores/searches
  individual cards instead of browsing the organized library.
- `panels/FlowEditLogPanel.tsx`: loads the combined corpus on mount and
  renders the suggestion list, recomputed as the Content field changes.

Vitest-covered in `packages/debate-round/test/flow-note-suggestions.test.ts`
(keyword derivation, blank-query/no-match/matching/ranking/limit/tie-break
cases for `suggestFlowNotesFromLibrary`, and `buildFlowNoteFromCard`'s
formatting with and without tags) and a new
`listCombinedPersistedLibraryCards` describe block in
`packages/debate-card-search/test/evidenceLibraryEntries.test.ts`.

## Live sync transport

A "Live sync" toggle next to the Flow Edit Log form turns on a short-poll
transport that shares a flow's edits across contributors' browsers, instead
of every edit staying local-only `localStorage`. This closes follow-up (a)
under idea #16 ("Shared, Ai-Generated Debate Flow") in `TODO.md`: "a live
transport (WebSocket or similar) that turns local edits into a shared
stream across a room/team" — implemented as a D1-backed poll rather than a
WebSocket/Durable Object push channel, consistent with this app's existing
serverless (Cloudflare Workers + D1) API-route architecture and the "or
similar" wording in the follow-up.

While the toggle is on for a given Flow ID:

- Every ~4 seconds, the panel pulls every server-recorded `FlowEdit` for
  that flow newer than the last one it has seen and folds them into the
  local `state/flowEdits.ts` store (`saveFlowEdit` already dedups by id, so
  a re-pulled edit is a no-op) — a pulled edit from a teammate shows up in
  the logged-edit list and `SharedFlowSyncPanel`'s merge preview without
  that teammate relaying it manually.
- Logging a new edit while sync is on also pushes it to the server, so
  other contributors' next poll picks it up.
- A pull/push failure never blocks local logging — it only flips the
  status pill next to the toggle to the server's error message; local
  `saveFlowEdit`/`listFlowEdits` keep working exactly as before regardless
  of network conditions.

It adds:

- `lib/database/schema.ts`'s `flowSyncEdits` table (`apps/debate-ai.com`) —
  one row per `FlowEdit`, upserted by its caller-assigned `id`, indexed by
  `flowId`.
- `app/api/flow-sync/route.ts` — `GET ?flowId&sinceMs` (every edit for that
  flow newer than `sinceMs`, oldest first, capped at 500) and
  `POST { id, flowId, boxPath, authorId, content, timestampMs }` (validates
  and upserts one edit by `id`), mirroring `app/api/doc/documents/route.ts`'s
  `getDBFromContext()`/drizzle convention.
- `flow/flow-sync-client.ts`: `pullRemoteFlowEdits`/`pushFlowEditToServer`,
  the fetch layer, mirroring `round/coach-feedback-client.ts`'s
  pure-module/fetch-client split so the network calls are unit-testable
  without mocking timers.
- `flow/flow-sync-cursor.ts`: `advanceSyncCursor` — the pure "what's the
  next `sinceMs` to poll from" bookkeeping, kept separate from the hook for
  the same testability reason.
- `hooks/useFlowSyncPolling.ts`: the poll-loop/push binding — `status`
  (`"idle" | "syncing" | "error"`), `lastError`, and `pushEdit`.
- `panels/FlowEditLogPanel.tsx`: the "Live sync on/off" toggle (scoped to
  the form's current Flow ID) and status pill, wired to the hook.

Vitest-covered in `packages/debate-round/test/flow-sync-client.test.ts`
(pull/push request shape, endpoint overrides, empty-`edits`-field fallback,
server-error-message propagation, non-JSON-error-body fallback) and
`packages/debate-round/test/flow-sync-cursor.test.ts` (`advanceSyncCursor`:
no-op on an empty pull, advances to the latest pulled timestamp, never
moves backwards past the current cursor). The polling hook itself and the
API route are not directly Vitest-covered — verified instead by the
package typecheck and the production build (`/api/flow-sync` appears in
the built route list), matching this repo's existing convention for other
React hooks (e.g. `useWordCountSpeechMode`) and D1-backed API routes.

## EditBadge same-tab refresh

Logging a new edit through `EditReviewPopover` now force-refreshes the
originating cell's `EditBadge` in the same render pass, instead of leaving
the count stale until AG Grid re-renders that cell for an unrelated reason
(scrolling, sorting, an edit elsewhere). `FlowSpreadsheet.tsx`'s
`handleEditLogged` (passed as `EditReviewPopover`'s `onLogged`) bumps the
existing `editReviewRefreshToken` (for the popover's own edit list) and
calls `gridRef.current.api.refreshCells({ rowNodes, columns, force: true })`
for exactly that box's row+column, via a new pure helper,
`flow/edit-cells.ts#gridCellForBoxPath`, which maps a `boxPath` to its AG
Grid `row-${index}` id and `col_${j}` field (the same conventions
`dataTransform.ts#buildRowData` and `useFlowGridConfig.ts`'s column defs
already use). Vitest-covered in `packages/debate-round/test/edit-cells.test.ts`
(row/column mapping, including a round-trip through `boxPathForCell`).

## Cross-tab live update

The refresh above only covers the same tab that logged the edit — a
teammate's second open tab (or a second browser window on the same machine)
still showed a stale `EditBadge` until it re-rendered for some unrelated
reason. `FlowSpreadsheet.tsx` now also subscribes to the browser's
`storage` event, which the spec fires only in *other* same-origin tabs/
windows, never the one that made the write, so it's exactly the missing
cross-tab signal. A new pure helper, `flow/live-update.ts`'s
`isFlowLiveUpdateStorageEvent`, checks whether the event's `key` is one of
the badge-backing stores (`flowAnnotations`, `flowEdits`, `prepNotes`, or
`null` for a `localStorage.clear()`); when it is, the listener calls
`gridRef.current.api.refreshCells({ force: true })` across the whole grid,
since a cross-tab event carries no row/column to target the way
`handleEditLogged`'s same-tab case does. This benefits the `AnnotationBadge`
and `PrepNoteBadge` the same way, closing the matching Known gap noted in
[`flow-annotations.md`](flow-annotations.md). Vitest-covered in
`packages/debate-round/test/live-update.test.ts` (every backing-store key,
the `null`-key clear-all case, and unrelated/substring-matching keys staying
ignored).

## Live sync toggle in `SharedFlowSyncPanel`

Until now, live sync could only be turned on from `FlowEditLogPanel`'s own
form — a contributor looking at the `SharedFlowSyncPanel` merge preview
(the panel directly above it in the Coach hub's Flow section) had no way
to see whether sync was on, or turn it on, without scrolling down to the
other panel's Flow ID field. `SharedFlowSyncPanel` already knows which
flow it's previewing (its own `flow` prop, not a separately typed Flow ID),
so it gains the identical "Live sync on/off" toggle + status pill
`FlowEditLogPanel` has, scoped to `flow.id` automatically.

While the toggle is on, the panel polls the same `/api/flow-sync` endpoint
(via the shared `useFlowSyncPolling` hook) for edits to `flow.id` newer
than the last one it has seen, folding them into `state/flowEdits.ts` the
same way `FlowEditLogPanel`'s own toggle does. A pulled edit calls the
panel's new optional `onSyncPulled` prop — mirroring `onChange` — so
`CoachHub` refreshes its own `listFlowEdits()` snapshot (the `edits` prop
this panel merges) in step; without a caller-supplied `onSyncPulled`, the
poll still runs and still writes to `state/flowEdits.ts`, it just doesn't
prompt an immediate re-render of the panel that's driven by props rather
than reading the store itself.

This closes the "`SharedFlowSyncPanel`/`CoachHub` do not surface the sync
toggle or status" Known gap recorded below. It adds:

- `panels/SharedFlowSyncPanel.tsx`: the toggle/status row (reusing
  `hooks/useFlowSyncPolling.ts` — no new sync logic), and the new
  `onSyncPulled` prop.
- `CoachHub.tsx`: passes its existing `refreshFlowEdits` (from
  `useStoreSnapshot`) as `onSyncPulled`, the same callback it already
  passes to `FlowEditLogPanel` as `onChange`.

The two toggles are independent `syncEnabled` state — turning sync on in
one panel doesn't flip the other's button, though both poll (and write
into) the same `state/flowEdits.ts` store for the same flow, so either one
being on is enough for a teammate's edits to show up everywhere.

Vitest-covered by an added case in `packages/debate-round/test/panels.test.tsx`
(the toggle renders "Live sync off" and the panel's own flow id by default).

## Cross-tab live update in `FlowEditLogPanel`

The "Cross-tab live update" section above only covers the `FlowSpreadsheet`
grid's per-box `EditBadge` — the standalone `FlowEditLogPanel` list view
(its "Logged edits" section, grouped by flow) still only refreshed on mount
or after its own log/clear actions, like every other still-unclaimed panel
named in the Known gap below. Added
`FLOW_EDIT_LOG_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
`isFlowEditLogPanelLiveUpdateStorageEvent` to the existing
`flow/live-update.ts` (mirroring the `PREP_NOTES_PANEL`/
`FLOW_LIVE_UPDATE_STORAGE_KEYS` split for prep notes: one predicate for the
grid badge, a narrower one for the standalone panel's own `flowEdits`-only
store read) and wired a `storage`-event listener into `FlowEditLogPanel.tsx`
that calls the panel's existing `refresh()` closure when the predicate
matches, so an edit logged or cleared in another tab shows up here without
a manual reload.

Vitest-covered by four new cases for `isFlowEditLogPanelLiveUpdateStorageEvent`
in `packages/debate-round/test/live-update.test.ts`.

## Side-by-side conflict diff

`SharedFlowSyncPanel`'s "Conflicts" section used to render each conflicting
box as a flat, unaligned list — every competing edit's full content on its
own line (`authorId: content`), leaving a reviewer to read each version end
to end to spot what actually changed. New `flow/flow-edit-diff.ts` adds a
pure word-level diff (`diffFlowEditContent`, an LCS-backed tokenizer that
keeps whitespace runs as their own tokens so segments reconstruct spacing
exactly) plus `buildFlowEditConflictDiff`, which picks the same edit
`mergeFlowEdits` would apply as the winner (the conflict's last edit —
latest timestamp, ties broken by id) and diffs every other competing edit
against it.

`SharedFlowSyncPanel`'s new `ConflictDiff` renders one row per challenger
edit: a left column showing the winning edit's content with words the
challenger dropped struck through, and a right column showing the
challenger's content with the words it added highlighted — both columns
share whatever text is unchanged, so a reviewer sees only what's actually in
dispute instead of two full paragraphs to compare by eye. Highlighting
reuses `panel-shell.tsx`'s existing tone surface classes (`critical` for
removed words, `positive` for added ones) rather than introducing new
colors.

Vitest-covered by `packages/debate-round/test/flow-edit-diff.test.ts`
(word-level diff correctness, including a cleared side and fully disjoint
content, plus `buildFlowEditConflictDiff`'s winner selection across a
three-way conflict) and a new case in `packages/debate-round/test/panels.test.tsx`
asserting the panel renders the diffed columns instead of the old flat list.

## Known gaps

- ~~The `EditBadge` still reads a box's edits from `localStorage` at cell
  render time; it does not live-update if another tab logs a new edit while
  the grid is open — only the same-tab, logged-through-its-own-popover case
  above is fixed. This cross-tab gap is shared with the `FlowSpreadsheet`
  annotation badge~~ Closed for the cross-*tab*, same-origin case: see
  [`flow-annotations.md`](flow-annotations.md)'s matching entry —
  `flow/live-update.ts` plus a `storage`-event listener in
  `FlowSpreadsheet` now force-refreshes the `EditBadge` (and
  `AnnotationBadge`/`PrepNoteBadge`) when another tab logs a `FlowEdit`.
  `DailyBestCardPanel`, `ContributionLeaderboardPanel` (see
  [`contribution-leaderboard.md`](contribution-leaderboard.md)'s "Cross-tab
  live update"), `TaskInboxPanel` (see
  [`task-inbox.md`](task-inbox.md)'s "Cross-tab live update"),
  `ProgressUnlocksPanel` (see [`progress-unlocks.md`](progress-unlocks.md)'s
  "Cross-tab live update"), `ResearchProgressPanel` (see
  [`research-progress-tracking.md`](research-progress-tracking.md)'s
  "Cross-tab live update"), `QuestStreaksPanel` (see
  [`quest-streaks.md`](quest-streaks.md)'s "Cross-tab live update"),
  `NewsStreamPanel` (see [`news-stream.md`](news-stream.md)'s "Cross-tab live
  update"), `ContributorAwardsPanel` (see
  [`contributor-awards.md`](contributor-awards.md)), `DailyQuestsPanel`
  (see [`daily-quests.md`](daily-quests.md)'s "Cross-tab live update"),
  `RevisionIncentivesPanel` (see [`revision-incentives.md`](revision-incentives.md)'s
  "Cross-tab live update"), `CardScoringPanel` (see
  [`llm-card-scoring.md`](llm-card-scoring.md)'s "Cross-tab live update"),
  `BrainstormBoardPanel` (see [`brainstorm-board.md`](brainstorm-board.md)'s
  "Cross-tab live update"), `GroupChallengesPanel` (see
  [`group-challenges.md`](group-challenges.md)'s "Cross-tab live update"),
  the standalone `FlowAnnotationsPanel` list view (see
  [`flow-annotations.md`](flow-annotations.md)'s Known gaps entry),
  `PrepNoteNotificationsPanel` (see [`prep-notes.md`](prep-notes.md)'s
  "Cross-tab live update"), `PrepNotesPanel` (see
  [`prep-notes.md`](prep-notes.md)'s own "Cross-tab live update" section),
  `ContributionsFeedPanel` (see
  [`contributions-feed.md`](contributions-feed.md)'s "Cross-tab live
  update"), `StrategyPanel` (see
  [`scout-to-strategy.md`](scout-to-strategy.md)'s "Cross-tab live update"),
  and `FlowEditLogPanel` itself (see "Cross-tab live update in
  `FlowEditLogPanel`" above) have since gained the equivalent mechanism for
  their own stores, but every other localStorage-backed panel in this repo
  still has none (Live Sync
  above is cross-*contributor*, via the server, not cross-tab within one
  browser, and remains the only path for a *different device/browser* to
  see the edit at all).
- Live sync is opt-in and per-Flow-ID, off by default, and pulls on a fixed
  ~4s poll rather than pushing instantly — a teammate's edit can take up to
  one poll interval to appear. The `FlowSpreadsheet` grid's `EditBadge`/
  `EditReviewPopover` affordance does not itself toggle or drive sync; it
  only reads whatever `state/flowEdits.ts` already has, whether that came
  from a local log or a synced pull.
- ~~`SharedFlowSyncPanel`/`CoachHub` do not surface the sync toggle or
  status — it lives only in `FlowEditLogPanel`'s own form, scoped to that
  form's Flow ID field.~~ Closed — see "Live sync toggle in
  `SharedFlowSyncPanel`" below.
- The flow-note suggestion query is the Content field's own in-progress
  text, not the box's existing content or the flow's topic — a
  contributor gets suggestions only once they've started typing something
  for the matcher to score against.
