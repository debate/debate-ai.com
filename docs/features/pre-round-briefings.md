# Pre-Round Briefings

Shows every persisted "Pre-Round Intelligence Panel" `PreRoundBriefing` —
opponent scouting, judge tendencies, head-to-head record, and team prep
notes combined into one briefing per round — with a "Clear" action per
round.

- **Route:** `/briefings`
- **Nav:** the global dock's Settings menu → **Pre-Round Briefings**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

Each persisted `PreRoundBriefingRecord` (keyed by `roundId`) renders as its
own card, sorted by `roundId` for a stable order. A card's header shows the
round's event line (tournament, division, round label) and a badge with the
prior head-to-head record against that opponent. Below the header, every
briefing section (Event, Opponent scouting, Prior meetings, Judge
tendencies, Team prep notes) renders as its own labeled block, showing "no
data on file" for whichever pieces the briefing wasn't built with.

## Data flow

```
state/preRoundBriefings.ts (localStorage: preRoundBriefings)
  → buildPreRoundBriefingsPanelView()   — sorts every persisted
                                           PreRoundBriefingRecord by roundId
  → panels/PreRoundBriefingsPanel.tsx   — renders it, one card per round
  → apps/debate-ai.com/app/briefings/page.tsx  — mounts the panel as a route

Clearing a round's briefing:
panels/PreRoundBriefingsPanel.tsx
  → deletePreRoundBriefing(roundId)     — state/preRoundBriefings.ts
  → panel re-reads buildPreRoundBriefingsPanelView() to refresh
```

Every briefing-composition and persistence rule already existed and was
Vitest-covered; this feature closes follow-up (b), "a briefing panel UI
that renders it on a round-information page," named under idea #12
("Pre-Round Intelligence Panel") in `TODO.md`, adding one small helper to
`state/preRoundBriefings.ts` — `buildPreRoundBriefingsPanelView`, which
sorts `listPreRoundBriefings`'s output for a stable panel display order —
rather than introducing new briefing-composition logic. Vitest-covered in
`packages/debate-round/test/preRoundBriefings.test.ts`.

## Known gaps

- No real data sources for tournament results, pairings, event details, or
  room assignments yet — follow-up (a) on the same idea, not started; a
  briefing only appears here once something elsewhere calls
  `buildPreRoundBriefing`/`buildPreRoundBriefingFromStores` and
  `savePreRoundBriefing` for that round.
- No affordance in this panel to generate a new briefing for a round.
