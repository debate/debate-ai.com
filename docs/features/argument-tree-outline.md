# Outline Filters and Argument Tree View

Renders a filterable, heading-grouped outline of a round's flow — the "(a) a
React tree/outline panel in `debate-round` that renders the filtered tree
next to (or instead of) `FlowSpreadsheet` and reads/writes through the
persistence store" follow-up named under idea #10 ("Outline Filters and
Argument Tree View") in `TODO.md`'s Product Feature Ideas list.

- **Route:** `/outline`
- **Nav:** the global dock's Settings menu → **Argument Tree Outline**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

Every persisted `ArgumentTreeRecord` (one card per round). Each card has
seven filter controls — **Kind** (all / headings only / arguments only),
**Side**, **Speech**, **Argument type** (link / impact / turn / answer /
extension / ..., from `Box.argumentType`), **Contributor** (from
`Box.authorId`), **Evidence status** (cited / contested / unverified, from
`Box.evidenceStatus`), and an **Unanswered only** toggle — the type/
contributor options are populated from the distinct values actually present
in that round's tree. Changing a control re-filters the tree in place via
the existing `filterArgumentTree`/`flattenArgumentTree` helpers and saves
the chosen filter through `saveArgumentTreeFilterSelection`, so it's
restored the next time the panel loads. Each argument row renders its
argument-type badge, contributor id, and evidence-status badge (contested
rendered as a destructive badge) alongside its content when those fields are
set on the underlying `Box`. A "Clear" action deletes the round's persisted
tree.

## Data flow

```
flow/argument-tree.ts
  → buildArgumentTree(flow)              — derives a heading-grouped tree
  → filterArgumentTree(tree, filter)     — applies the chosen filter
  → flattenArgumentTree(nodes)           — flattens back to row order

state/argumentTrees.ts (localStorage: argumentTrees)
  → buildAndSaveArgumentTree(flow, roundId)  — derives + persists a round's tree
  → buildArgumentTreesPanelView()            — sorts every persisted tree by roundId
  → panels/ArgumentTreePanel.tsx             — renders the outline + filter controls
  → apps/debate-ai.com/app/outline/page.tsx  — mounts the panel as a route

state/argumentTreeFilters.ts (localStorage: argumentTreeFilters)
  → saveArgumentTreeFilterSelection({ roundId, filter })  — persists the chosen filter
  → getArgumentTreeFilterSelection(roundId)               — restores it on load

Clearing a round:
panels/ArgumentTreePanel.tsx
  → deleteArgumentTree(roundId)
  → panel re-reads buildArgumentTreesPanelView() to refresh
```

This closes follow-up (a) on the "Outline Filters and Argument Tree View"
idea. The tree-derivation and filtering logic already existed and was
Vitest-covered (`packages/debate-round/test/argument-tree.test.ts`); this
slice adds `state/argumentTrees.ts` — a new `ArgumentTreeRecord` persistence
store (mirroring `flowSummaries.ts`/`drillSets.ts`) with a
`buildAndSaveArgumentTree` convenience for deriving and saving a round's tree
in one step — and `panels/ArgumentTreePanel.tsx`, which reads/writes through
both this new store and the existing `argumentTreeFilters.ts` filter-
selection store. Vitest-covered in
`packages/debate-round/test/argumentTrees.test.ts`.

A later slice closed the "nothing in the live round-flowing page calls
`buildAndSaveArgumentTree`" Known gap: `ArgumentTreePanel.tsx` gained a
"Generate outline for current round" action that reads the round
workspace's currently selected flow (`state/store.ts`'s `useFlowStore`, the
same mechanism `VulnerabilityChartsPanel`'s "Generate report for current
round" action uses) and derives+persists that round's outline via the
already-existing `buildAndSaveArgumentTree(flow, roundId)`. No new
tree-derivation logic was introduced — `buildAndSaveArgumentTree` already
existed and was already Vitest-covered in
`packages/debate-round/test/argumentTrees.test.ts`; this slice only wires a
real caller to it.

A later slice closed follow-up (b) — `debate-core`'s `Box` type gained three
new optional fields: `argumentType?: ArgumentType` (a
`"contention" | "link" | "impact" | "turn" | "answer" | "extension"` union),
`authorId?: string` (mirroring `FlowEdit.authorId`'s attribution
convention from the Shared, AI-Generated Debate Flow idea), and
`evidenceStatus?: EvidenceStatus` (a `"cited" | "contested" | "unverified"`
union). `flow-transcript-summary.ts`'s `summarizeFlowRow` now reads these
off a row's underlying `Box` (the same box `isHeading` is already read
from) onto `FlowRowSummary`, `argument-tree.ts`'s `toNode` carries them onto
`ArgumentTreeNode`, and `ArgumentTreeFilter` gained matching
`argumentType`/`authorId`/`evidenceStatus` filter fields, applied in
`argumentMatches` alongside the existing `speech`/`sideKey`/
`onlyUnanswered` checks. `ArgumentTreePanel.tsx` renders three new filter
selects (populated from the tree's own distinct values) and per-row
argument-type/contributor/evidence-status badges. No follow-ups remain open
on this idea.

## Tagging an argument from the flow grid

The three filters above only have something to filter on once a row carries
tags, and until this slice nothing in the app could set them. Right-clicking
any row in the live flow grid (`FlowSpreadsheet`, the round-flowing page)
now offers **Tag Argument…**, which opens a small popover — the same
fixed-position, click-outside/Escape-to-close overlay pattern as the
`PrepNotePopover`/`EditReviewPopover` badges — with an **Argument type**
select, an **Evidence status** select, and a **Contributor** field. The
contributor field is a `datalist`-backed input suggesting whichever author
ids are already used elsewhere in the same flow, so an id stays consistent
across rows instead of being retyped per row.

Choosing **None** for a select (or clearing the contributor field) removes
that tag rather than leaving the previous value in place. Saving writes the
tags onto the row's *root* `Box` and pushes the updated children up through
`FlowSpreadsheet`'s existing `onUpdate` callback — tags live on the flow
itself, not in a separate store. Row-level (not per-cell) is deliberate:
`summarizeFlowRow` already reads all three fields from a row's root box, so
that is what `buildArgumentTree`/`filterArgumentTree` and this panel see.

Whatever tags a row carries also render as a compact `link · cited · alex`
label in the grid's first column, next to the existing annotation/edit/
prep-note badges, and are echoed in the context-menu entry itself
(**Tag Argument… (link · cited · alex)**).

`dataTransform.ts`'s `buildRowData`/`rowDataToBoxes` round trip now carries
the three fields as well. Without that, an ordinary cell edit — which
rebuilds every `Box` from the grid's flat row data — silently dropped a
row's tags.

```
flow/argument-tagging.ts
  → getRowArgumentTags(flow, rowIndex)         — reads a row's current tags
  → setRowArgumentTags(flow, rowIndex, tags)   — returns a new Flow with the row retagged
  → formatArgumentTags(tags)                   — "link · cited · alex" label
  → listAuthorIdsInFlow(flow)                  — contributor suggestions

flow/ArgumentTagPopover.tsx                    — the tagging overlay
flow/FlowSpreadsheet.tsx                       — "Tag Argument…" context-menu entry
  → onUpdate({ children })                     — saves the tags onto the flow
flow/FirstColumnCellRenderer.tsx               — renders the row's tag label
flow/dataTransform.ts                          — round-trips the tags through grid edits
```

Vitest-covered in `packages/debate-round/test/argument-tagging.test.ts`
(reading tags, setting all three, clearing a tag and a whitespace-only
contributor, the out-of-range-row no-op, tags feeding `filterArgumentTree`,
the `buildRowData` → `rowDataToBoxes` round trip, label formatting, and the
contributor roster).

### Neighbour preview and bulk section tagging

The popover also shows how the row's neighbours in the same "section" (the
content rows between the nearest preceding heading and the next one, or the
flow's leading rows if none precede it) are already tagged, and offers a
checkbox to apply the chosen tags to every one of those neighbours at once
instead of just the row that was right-clicked — closing the "a row's tags
aren't shown in the `ArgumentTagPopover` for the row's neighbours, and there
is no bulk 'tag every row in this section' action" Known gap.

```
flow/argument-tagging.ts
  → getSectionRowIndexes(flow, rowIndex)   — every content-row index sharing rowIndex's section
  → getSectionRowPreviews(flow, rowIndex)  — those rows' own content + current tags, for display
  → setRowsArgumentTags(flow, rowIndexes, tags)  — bulk form of setRowArgumentTags

flow/ArgumentTagPopover.tsx
  → sectionRows prop           — renders each neighbour's content + tag label
  → "Also tag these N rows…" checkbox → onSave(tags, applyToSection)

flow/FlowSpreadsheet.tsx
  → handleSaveArgumentTags(rowIndex, tags, applyToSection)
      applyToSection ? getSectionRowIndexes(flow, rowIndex) : [rowIndex]
      → setRowsArgumentTags(flow, targetRowIndexes, tags)
```

A "section" is derived positionally from `Box.isHeading` (the same
forward-scan convention `dataTransform.ts`'s `parentHeadingId` and
`argument-tree.ts`'s `buildArgumentTree` heading-nesting already use), not a
new field on `Box` — no data-model change was needed. Right-clicking a
heading row itself targets the content rows that immediately follow it, up
to (not including) the next heading. Vitest-covered in
`packages/debate-round/test/argument-tagging.test.ts` (section boundaries
around single/multiple headings, a heading-row target, leading
rows before any heading, an out-of-range row, the bulk apply's
duplicate/out-of-range-index handling and its all-invalid no-op, and the
section-preview label truncation) and
`packages/debate-round/test/ArgumentTagPopover.test.tsx` (the neighbour
list and checkbox render when `sectionRows` is non-empty, and neither
renders when it's empty).

## Known gaps

- `ArgumentTreePanel.tsx`'s "Generate outline for current round" action is
  a manual trigger a user has to click — the live round-flowing page
  (`DebateFlowPage`/`FlowMainContent`) still doesn't call
  `buildAndSaveArgumentTree` automatically as a round is flowed, so a
  round's outline only updates here once someone visits `/outline` and
  regenerates it.
- Tagging is row-level, not per-speech: one row carries one
  `argumentType`/`authorId`/`evidenceStatus`, so a row whose 2AC answer was
  written by a different partner than its 1AC claim can't record both.
- Nothing infers a tag — every row is tagged by hand from the context menu;
  there is no heuristic or AI pass that proposes an argument type from the
  row's own content.
- The contributor field is a free-form typed id, not an authenticated user
  (the same gap `prep-notes.md` and `review-queue.md` record), so the
  Argument Tree Outline's contributor filter is only as reliable as what
  people type.
- No follow-ups remain open on the "row's tags aren't shown... / no bulk
  'tag every row in this section' action" gap — see "Neighbour preview and
  bulk section tagging" above.
