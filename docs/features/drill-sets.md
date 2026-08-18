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

## AI-generated practice script

Each drill has a "Get AI script" action (label becomes "Regenerate AI
script" once one exists). It calls `round/drill-script-client.ts`'s
`requestDrillScript` — a small `fetch` client that POSTs the drill's kind,
template prompt, and side to the existing `/api/reason-ai` Anthropic proxy
— and saves the reply on that drill's index via
`state/drillSets.ts`'s `saveDrillAiScript`. The result renders under the
template prompt line; a per-drill error message renders instead on
failure. This is an actual, ready-to-read practice script (e.g. the real
frontline response text), not another restatement of the template prompt.

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

Generating a drill's AI script:
panels/DrillSetsPanel.tsx
  → requestDrillScript({ sideKey, drill })  — round/drill-script-client.ts
    → POST /api/reason-ai (system + user prompt from round/drill-script-ai.ts)
  → saveDrillAiScript(roundId, drillIndex, script)  — state/drillSets.ts
  → panel re-reads buildDrillSetsPanelView() to refresh
```

Every drill-generation and persistence rule already existed and was
Vitest-covered; this feature closes follow-up (a), "a drill-panel UI that
reads/writes through the persistence store," named under the "📚 AI Drill
Generator" bullet in `TODO.md`, adding one small helper to
`state/drillSets.ts` — `buildDrillSetsPanelView`, which sorts
`listDrillSets`'s output for a stable panel display order — rather than
introducing new drill-generation logic. A later slice closes follow-up
(b), "an actual AI-generated (rather than templated) script," adding
`round/drill-script-ai.ts` and `round/drill-script-client.ts` plus the
panel's "Get AI script" action and `saveDrillAiScript`. Vitest-covered in
`packages/debate-round/test/drillSets.test.ts`,
`packages/debate-round/test/drill-script-ai.test.ts`, and
`packages/debate-round/test/drill-script-client.test.ts`.

## Known gaps

- No affordance in this panel to generate a new drill set for a round —
  a set only appears here once something elsewhere calls `buildDrillSet`
  and `saveDrillSet` for that round.
