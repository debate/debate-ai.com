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

## Known gaps

- Nothing in the live round-flowing page (`DebateFlowPage`/
  `FlowMainContent`) calls `buildAndSaveArgumentTree` yet, so a round's
  outline only appears here once something computes and saves it — the same
  "real trigger not wired" gap already noted for several other panels (e.g.
  `flow-summaries.md`).
- Nothing in the live flow-editing UI (`FlowSpreadsheet` or elsewhere) lets a
  user actually set a `Box`'s `argumentType`/`authorId`/`evidenceStatus`
  yet — these fields exist in the schema and are read/filtered/rendered
  end-to-end here, but populating them today requires setting them directly
  on a `Box` (e.g. programmatically, or via a future flow-grid affordance).
