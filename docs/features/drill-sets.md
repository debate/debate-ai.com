# Practice Drills

Shows every persisted "AI Drill Generator" `Drill` set, grouped by round —
overview, frontline, cross-ex, and collapse-scenario prompts derived from
that round's flow — with a "Clear" action per round.

- **Route:** `/drills`
- **Nav:** the global dock's Settings menu → **Practice Drills**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

Each persisted `DrillSetRecord` (keyed by `roundId` + the side the drills
were generated for) renders as its own card, sorted by `roundId` then
`sideKey` for a stable order. Inside a card, every drill shows a kind badge
and its prompt:

| Kind | Meaning |
| --- | --- |
| Overview | A whole-round overview prompt weighing every side currently represented in the flow |
| Frontline | A frontline-response prompt for a still-unanswered opposing argument |
| Cross-Ex | A cross-examination question for an unanswered argument |
| Collapse | A collapse-scenario recommendation for one of the opposing side's most vulnerable arguments |

## Data flow

```
state/drillSets.ts (localStorage: drillSets)
  → buildDrillSetsPanelView()      — sorts every persisted DrillSetRecord
                                      by roundId then sideKey
  → panels/DrillSetsPanel.tsx      — renders it, grouped by round
  → apps/debate-ai.com/app/drills/page.tsx  — mounts the panel as a route

Clearing a round's drill set:
panels/DrillSetsPanel.tsx
  → deleteDrillSet(roundId)        — state/drillSets.ts
  → panel re-reads buildDrillSetsPanelView() to refresh
```

Every drill-generation and persistence rule already existed and was
Vitest-covered; this feature closes follow-up (a), "a drill-panel UI that
reads/writes through the persistence store," named under the "📚 AI Drill
Generator" bullet in `TODO.md`, adding one small helper to
`state/drillSets.ts` — `buildDrillSetsPanelView`, which sorts
`listDrillSets`'s output for a stable panel display order — rather than
introducing new drill-generation logic. Vitest-covered in
`packages/debate-round/test/drillSets.test.ts`.

## Known gaps

- No actual AI-generated (rather than templated) drill script yet —
  follow-up (b) on the same bullet, not started.
- No affordance in this panel to generate a new drill set for a round —
  a set only appears here once something elsewhere calls `buildDrillSet`
  and `saveDrillSet` for that round.
