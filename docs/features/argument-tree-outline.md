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
four filter controls — **Kind** (all / headings only / arguments only),
**Side**, **Speech**, and an **Unanswered only** toggle — populated from the
distinct side keys and speech names actually present in that round's tree.
Changing a control re-filters the tree in place via the existing
`filterArgumentTree`/`flattenArgumentTree` helpers and saves the chosen
filter through `saveArgumentTreeFilterSelection`, so it's restored the next
time the panel loads. A "Clear" action deletes the round's persisted tree.

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

## Known gaps

- Follow-up (b), finer argument-type tagging (link/impact/turn/answer/
  extension) and contributor/evidence-status fields, none of which exist in
  the `Box`/`Flow` schema today, remains open — not started.
- Nothing in the live round-flowing page (`DebateFlowPage`/
  `FlowMainContent`) calls `buildAndSaveArgumentTree` yet, so a round's
  outline only appears here once something computes and saves it — the same
  "real trigger not wired" gap already noted for several other panels (e.g.
  `flow-summaries.md`).
