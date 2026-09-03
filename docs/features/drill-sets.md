# Practice Drills

Shows every persisted "AI Drill Generator" `Drill` set, grouped by round —
overview, frontline, cross-ex, and collapse-scenario prompts derived from
that round's flow — with a "Clear" action per round.

- **Route:** `/drills`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t drills` in Ctrl/Cmd-Shift-Space's command palette)
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

## Difficulty rating and filtering

Every generated drill carries a `difficulty` rating (`easy`/`medium`/`hard`),
derived from the associated argument's `vulnerabilityScore` (see
`flow/response-outcome.ts`) via `flow/drill-generator.ts`'s
`vulnerabilityScoreToDifficulty`: a highly exposed argument — unanswered,
drawing opposing pressure, little same-side defense — makes for an "easy"
drill (there's obvious material to work with), while a well-defended
argument makes for a "hard" one. The whole-round overview drill, which has
no single associated argument, is always rated "medium". Each drill's badge
shows its difficulty next to its kind badge, and a "Difficulty" dropdown
above the drill list narrows every round's drills to one difficulty at a
time via `filterDrillsByDifficulty`.

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

## Generating a drill set

A "Generate drills for current round" form at the top of the panel derives
and persists a new `DrillSetRecord` from the round workspace's currently
selected flow (`state/store.ts`'s `useFlowStore` — the same mechanism
`CoachingProgramsPanel`'s "Save current flow" action uses). Given a typed
side (e.g. `aff`/`neg`), it calls `state/drillSets.ts`'s
`buildAndSaveDrillSet`, which composes the existing `buildDrillSet` +
`saveDrillSet` in one step; no new drill-generation logic. The action is
disabled with an inline hint when no flow is currently selected in the
workspace, and overwrites any existing drill set for that round, same as
`saveDrillSet`.

## Completion tracking

Each drill has a "Mark practiced"/"✓ Practiced" toggle button
(`state/drillSets.ts`'s `toggleDrillCompletion`, storing indexes into
`drills` on the record's `completedDrillIndexes` field), and each round
card shows a `MeterBar` progress meter — "N of M" drills marked practiced,
turning `positive` once every drill in the round is marked — driven by
`getDrillSetCompletionStats`. This closes the "completion tracking" half of
the two follow-ups named under the "📚 AI Drill Generator" bullet, but only
locally: it does not yet feed the separate `debate-card-search` Progress
Unlocks tier system (the "tied into Progress Unlocks" half of that same
follow-up), and "drill scheduling/reminders" remains untouched. Both stay
open follow-ups — see Known gaps.

## Data flow

```
state/drillSets.ts (localStorage: drillSets)
  → buildDrillSetsPanelView()      — sorts every persisted DrillSetRecord
                                      by roundId then sideKey
  → panels/DrillSetsPanel.tsx      — renders it, grouped by round
  → apps/debate-ai.com/app/drills/page.tsx  — mounts the panel as a route

Generating a round's drill set:
panels/DrillSetsPanel.tsx
  → buildAndSaveDrillSet(currentFlow, roundId, sideKey)  — state/drillSets.ts
    → buildDrillSet(currentFlow, sideKey)  — flow/drill-generator.ts
  → panel re-reads buildDrillSetsPanelView() to refresh

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

Toggling a drill's completion:
panels/DrillSetsPanel.tsx
  → toggleDrillCompletion(roundId, drillIndex)  — state/drillSets.ts
  → panel re-reads buildDrillSetsPanelView() to refresh
  → getDrillSetCompletionStats(record)  — derives the round's "N of M"
    MeterBar caption/ratio, recomputed on every render (not persisted)
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
`packages/debate-round/test/drill-script-client.test.ts`. A later slice adds
`buildAndSaveDrillSet` to `state/drillSets.ts` and the panel's "Generate
drills for current round" form, closing the "no affordance in this panel to
generate a new drill set for a round" known gap — see "Generating a drill
set" above. Vitest-covered in `packages/debate-round/test/drillSets.test.ts`
(deriving and persisting a drill set from a flow, overwriting an existing
record for the same round, and `collapseLimit` passing through to
`buildDrillSet`).

A later slice adds the difficulty rating and filter dropdown described in
"Difficulty rating and filtering" above, closing the "difficulty rating with
filtering" follow-up named under the "📚 AI Drill Generator" bullet in
TODO.md's Research Crowdsourcing Organizer Features. Vitest-covered in
`packages/debate-round/test/drill-generator.test.ts`
(`vulnerabilityScoreToDifficulty`'s thresholds, `filterDrillsByDifficulty`,
and each drill builder's difficulty rating).

A later slice adds the completion tracking described in "Completion
tracking" above, closing the local-tracking half of the "completion
tracking tied into Progress Unlocks" follow-up named under the "📚 AI Drill
Generator" bullet. Vitest-covered in
`packages/debate-round/test/drillSets.test.ts` (`toggleDrillCompletion`
toggling a drill on/off, tracking multiple completed drills sorted by
index, leaving `drills`/`aiScripts`/other rounds' records untouched,
no-ops for an unknown roundId or an out-of-range drillIndex; and
`getDrillSetCompletionStats`'s zero/partial/full completion counts, its
handling of stale out-of-range indexes, and a zero — not `NaN` — ratio for
a record with no drills).

## Known gaps

Two follow-ups remain open on the "📚 AI Drill Generator" bullet: drill
scheduling/reminders, and tying the now-tracked local completion state into
the separate `debate-card-search` Progress Unlocks tier system (awarding
tiers/badges for practiced drills isn't wired up yet — this slice only
tracks and displays completion within `DrillSetsPanel` itself).
