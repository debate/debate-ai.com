# Outline Filters and Argument Tree View

Renders a filterable, heading-grouped outline of a round's flow — the "(a) a
React tree/outline panel in `debate-round` that renders the filtered tree
next to (or instead of) `FlowSpreadsheet` and reads/writes through the
persistence store" follow-up named under idea #10 ("Outline Filters and
Argument Tree View") in `TODO.md`'s Product Feature Ideas list.

- **Route:** `/outline`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t outline` in Ctrl/Cmd-Shift-Space's command palette)
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

## Filter presets

Idea #10's "Save and reuse named filter presets instead of re-picking
filters each visit" follow-up. Each round card has a "Filter presets" row
above its controls: a dropdown to apply a saved preset, and a name field +
"Save preset" button to save the round's *current* filter combination under
a new name. A preset is a named `ArgumentTreeFilter` — global, not scoped to
any one round, so a combination saved on one round's outline can be applied
to any other round's; a field the preset doesn't set (or whose value
doesn't exist on that round's own distinct options) simply has no match,
same as picking every control by hand. Applying a preset replaces the
round's filter wholesale (not merged), so a field the preset leaves unset is
cleared rather than left at its prior value. A "Saved filter presets" card
above the round list shows every saved preset as a removable badge.

Local-first (works fully signed out, `localStorage` key
`outline-filter-presets`) and best-effort account-synced through the same
`/api/settings` row every other picker-style setting uses (the
`outlineFilterPresets` field), mirroring `wordLimitPresets.ts`/
`useWordLimitPresets`'s split and sync mechanism exactly. Up to 50 presets,
each name unique case-insensitively.

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

state/outlineFilterPresets.ts (pure validation/(de)serialization)
  → hooks/useOutlineFilterPresets.ts (localStorage: outline-filter-presets)
      — local-first state, best-effort synced via /api/settings's outlineFilterPresets field
  → panels/ArgumentTreePanel.tsx
      — "Filter presets" row per round: apply a preset (replaces that round's
        argumentTreeFilters selection) or save the round's current filter as
        a new named preset

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
round" action uses) and derives+persists that round's outline via
`buildAndSaveArgumentTreeFromCurrentFlow(flow)` — a thin wrapper over the
already-existing `buildAndSaveArgumentTree(flow, roundId)` that keys the
record by the flow's own `id`, stringified, mirroring
`roundContributorFlows.ts`'s "the flow's own numeric id stands in for
`roundId`" convention rather than requiring a separately-tracked `Round`
entity. No new tree-derivation logic was introduced — this slice only wires a
real caller to it. Vitest-covered in
`packages/debate-round/test/argumentTrees.test.ts`
(`buildAndSaveArgumentTreeFromCurrentFlow` keys the saved record by the
flow's `id`, and persists an empty tree without throwing for a flow with no
rows).

A later slice closed the remaining "still a manual trigger" half of that
gap: `hooks/useFlowEffects.ts` gained `useArgumentTreeAutoSync(flows,
selected)`, wired into `DebateFlowPage` alongside its existing
`useFlowPersistence` effect. It watches the currently selected flow and,
1.5s after it stops changing, calls a new `buildAndSaveArgumentTreeIfChanged`
(`state/argumentTrees.ts`) — the same derive-and-persist step
`buildAndSaveArgumentTree` performs, except it skips the localStorage write
entirely when the freshly derived tree is structurally identical to what's
already stored for that round, so an idle debounce tick (or one that only
touched something outside the tree, like a timer) doesn't thrash storage.
The manual "Generate outline for current round" button is unchanged and
still useful for generating an outline without leaving `/outline`. No
follow-ups remain open on this gap. Vitest-covered in
`packages/debate-round/test/argumentTrees.test.ts` (`buildAndSaveArgumentTreeIfChanged`
saving on a first sync, skipping the write and returning `undefined` when
unchanged, and saving+returning the new record on a real change).

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

## Tagging an argument from the flow grid (removed — see note)

> **⚠️ Known regression, discovered 2026-09-05:** PR #498 ("Remove flow
> spreadsheet grid, show round flows in round editor", merged 2026-09-03)
> deleted the AG Grid-based `FlowSpreadsheet` view along with
> `flow/ArgumentTagPopover.tsx`, `flow/argument-tagging.ts`, and
> `flow/GridContextMenu.tsx`, in favor of the new "ebb flow" split
> speech-editor view (`debate-flow`'s `EbbFlowEmbed.tsx`/`HotGrid.tsx`),
> which exposes no tagging UI. This is more than stale prose: the tagging
> popover described below was the *only* place in the app that ever wrote
> `Box.argumentType`/`Box.authorId`/`Box.evidenceStatus` (confirmed by
> searching the current tree — nothing else sets these fields). A flow
> created or edited since the removal has no way to be tagged, so `/outline`'s
> **Argument type**/**Contributor**/**Evidence status** filters (see "What it
> shows" above) and the "Unanswered only" toggle (`evidenceStatus`-driven)
> have nothing to filter on for it — they still work for flows tagged before
> 2026-09-03. Left as a "Known gap" below rather than rebuilt in this pass:
> restoring it needs a Handsontable-native tagging affordance in the new
> editor (cell metadata + a context-menu or toolbar action), not a port of
> the deleted AG Grid popover. The rest of this section (through "Outline
> export" below) is kept for history only.
>
> **Update, a later run:** scoping this found it's a bigger lift than "add a
> tagging UI to `HotGrid`" — `debate-flow-ebb` turns out to be a fully
> separate, CRDT-replicated spreadsheet editor
> (`lib/collab/types.ts`'s `CollabDoc`/`CollabSheet`/`CollabCell`,
> rank-ordered cells across columns), with no notion of `debate-round`'s own
> `Flow`/`Box` tree at all: nothing in `debate-flow-ebb` imports or writes
> `Box`, and no conversion between the two data models exists anywhere in
> the tree (confirmed by grepping both packages). So this isn't a missing
> UI affordance on top of an existing bridge between the two flow editors —
> there is no bridge, and building one (or an alternative tagging surface
> that doesn't route through `HotGrid` at all) is a real design decision a
> future run should scope deliberately rather than assume. See this repo's
> `TODO.md` "📊 Topic Coverage Dashboard" Completed entry for the
> investigation that found this.

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

### Suggested argument type

The popover also derives a suggested `argumentType` from the row's own
content via a deterministic keyword heuristic — `inferArgumentType` checks
the content (lowercased) against an ordered set of keyword rules (turn →
extension → answer → impact → link → contention, most-specific first, so
e.g. "this turns their impact" reads as a turn rather than an impact) and
returns the first rule's type that matches, or `undefined` if none do. When
a suggestion exists and differs from whatever the **Argument type** select
currently shows, a **"Suggested: turn — use it"**-style link appears under
the select; clicking it only fills the select, it never saves on its own —
closing the "nothing infers a tag" Known gap.

```
flow/argument-tagging.ts
  → inferArgumentType(content)   — keyword-rule argument-type suggestion

flow/ArgumentTagPopover.tsx
  → content prop                 — the row's own content, passed in
  → "Suggested: … — use it"      — fills the Argument type select on click

flow/FlowSpreadsheet.tsx
  → content={flow.children[rowIndex]?.content}
```

Vitest-covered in `packages/debate-round/test/argument-tagging.test.ts`
(each keyword rule, rule-priority ordering, case-insensitivity, and no
match for empty/whitespace/unmatched content) and
`packages/debate-round/test/ArgumentTagPopover.test.tsx` (the suggestion
renders when it differs from the current selection, and is hidden for
unmatched content or when the row is already tagged with the suggested
type).

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

### Multi-row selection bulk tagging

Idea #10's other still-open follow-up, "Multi-select rows to bulk-apply a
tag at once" — unlike "Neighbour preview and bulk section tagging" above
(which only reaches a row's same-section neighbours), this reaches an
arbitrary set of rows the flowing user explicitly picks, anywhere in the
flow. The grid's rows carry a checkbox selection column
(`rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true,
enableClickSelection: false }}` — `enableClickSelection: false` keeps a
plain row click doing what it always did, entering cell-edit mode, so
checking rows and editing them don't fight over the same click). Right-click
with two or more rows checked and the existing context menu gains a "Tag
Selected Rows… (N)" entry (disabled below two selected rows) alongside the
single-row "Tag Argument…" one; picking it opens the same
`ArgumentTagPopover`, in `bulkMode="selection"` this time, seeded blank
(there's no single row's tags to seed from) and listing every selected
row's own content/current tags instead of section neighbours. There's no
opt-in checkbox in this mode — picking "Tag Selected Rows…" is itself the
opt-in — so Save always applies to the full selection.

```
flow/argument-tagging.ts
  → getRowPreviewsForIndexes(flow, rowIndexes)  — previews for an arbitrary index set, in the order given
      (getSectionRowPreviews now delegates to this for the same-section case)

flow/ArgumentTagPopover.tsx
  → bulkMode: "section" | "selection" prop
      "section" (default): unchanged from "Neighbour preview and bulk section tagging" above
      "selection": header/list read "N selected rows", checkbox replaced by a fixed
                   "applied to all N rows" notice, onSave always fires with applyToSection=true

flow/FlowSpreadsheet.tsx
  → selectedRowIndexes state, updated from onSelectionChanged (event.api.getSelectedRows())
  → "Tag Selected Rows… (N)" context-menu entry, disabled when < 2 rows selected
  → handleSaveArgumentTags(rowIndexes, tags, applyToSection)
      rowIndexes.length > 1 ? rowIndexes : (applyToSection ? getSectionRowIndexes(...) : rowIndexes)
      → setRowsArgumentTags(flow, targetRowIndexes, tags)
```

Vitest-covered in `packages/debate-round/test/argument-tagging.test.ts`
(`getRowPreviewsForIndexes`'s selection-order preservation, de-duplication,
out-of-range dropping, content truncation, and the empty-list case) and
`packages/debate-round/test/ArgumentTagPopover.test.tsx` (the bulk header,
row list, and fixed apply notice rendered in `bulkMode="selection"`, no
checkbox present, and the default `bulkMode` staying exactly the prior
single-row behavior).

## Outline export

Idea #10's "Export the filtered tree to a Speech Document or outline file"
follow-up. Each round card has a "Download outline" button next to
"Clear" (disabled when the round's current filter matches nothing) that
downloads exactly the flattened, filtered rows currently rendered for that
round as a plain-text `.txt` outline — a heading renders as `## <content>`,
an argument row renders as `- [<speech>] <content>`, with any set tags
(`argumentType`, `authorId`, `evidenceStatus`, `isUnanswered`) appended as
`(type: turn; by: alex; evidence: cited; unanswered)`.

A `.docx` Speech Document export isn't attempted, for the same reason idea
#6's "send to Speech Document" follow-up stayed open: the only Speech
Document type in this repo lives in the `reason-editor` package, which
`debate-round` doesn't depend on.

```
flow/argument-tree-export.ts
  → buildArgumentTreeOutlineText(nodes, roundId)   — flattened+filtered nodes -> plain text
  → argumentTreeOutlineFilename(roundId)           — outline-round-4.txt, etc.

panels/ArgumentTreePanel.tsx
  → handleDownload(roundId, filtered)              — anchor+Blob download, mirroring
                                                       PreRoundBriefingsPanel.tsx's pattern
```

Vitest-covered in `packages/debate-round/test/argument-tree-export.test.ts`
(the header line, the no-rows-match message, heading vs. argument-row
rendering, the tag suffix in its fixed order and only-set-tags rendering,
multi-row ordering, and the filename's sanitization/collapsing/trimming/
no-alphanumeric-fallback behavior mirroring
`ai-versus-transcript.test.ts`/`pre-round-briefing.test.ts`'s own filename
suites).

## Known gaps

- No tagging UI exists in the current flow editor at all — see the
  "Tagging an argument from the flow grid (removed — see note)" section
  above. This is the actively relevant gap today; the bullets below
  describe the deleted popover's own limitations and are kept for history.
- Tagging is row-level, not per-speech: one row carries one
  `argumentType`/`authorId`/`evidenceStatus`, so a row whose 2AC answer was
  written by a different partner than its 1AC claim can't record both.
- No follow-ups remain open on the "nothing infers a tag" gap — see
  "Suggested argument type" above.
- The contributor field is a free-form typed id, not an authenticated user
  (the same gap `prep-notes.md` and `review-queue.md` record), so the
  Argument Tree Outline's contributor filter is only as reliable as what
  people type.
- No follow-ups remain open on the "row's tags aren't shown... / no bulk
  'tag every row in this section' action" gap — see "Neighbour preview and
  bulk section tagging" above.
- No follow-ups remain open on the "no saved/reusable filter combinations"
  gap — see "Filter presets" above.
- Applying a preset only sets the round's filter; it doesn't select or
  scroll to a particular round, so a preset saved while looking at one round
  still needs that round's card to already be visible/generated to see the
  effect.
- No follow-ups remain open on the "exporting the filtered tree" gap — see
  "Outline export" above.
- No follow-ups remain open on idea #10's "Multi-select rows to bulk-apply a
  tag at once" gap — see "Multi-row selection bulk tagging" above.
