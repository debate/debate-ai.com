# Pre-Round Briefings

Shows every persisted "Pre-Round Intelligence Panel" `PreRoundBriefing` —
opponent scouting, judge tendencies, head-to-head record, and team prep
notes combined into one briefing per round — with a "Clear" action per
round, and a form to create a new one by hand.

- **Route:** `/briefings`
- **Nav:** the global dock's Settings menu → **Pre-Round Briefings**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A "create briefing" form sits above the list: round ID, tournament,
division, round label, side (Aff/Neg), an optional room and opponent
label, an optional pick from every already-persisted Opponent Team
Profile / Judge Profile, and free-text team prep notes (one per line).
Saving validates the required fields inline and, on success, composes and
persists a new `PreRoundBriefingRecord` and clears the form (keeping the
tournament/division filled in, for entering several rounds of the same
tournament in a row).

Each persisted `PreRoundBriefingRecord` (keyed by `roundId`) renders as its
own card below the form, sorted by `roundId` for a stable order. A card's
header shows the round's event line (tournament, division, round label) and
a badge with the prior head-to-head record against that opponent. Below the
header, every briefing section (Event, Opponent scouting, Prior meetings,
Judge tendencies, Team prep notes) renders as its own labeled block, showing
"no data on file" for whichever pieces the briefing wasn't built with.

## Data flow

```
Creating a briefing:
panels/PreRoundBriefingsPanel.tsx (form state)
  → buildPreRoundBriefingRecordFromDraft(draft)   — state/preRoundBriefings.ts
      → buildPreRoundBriefingFromStores(...)      — round/pre-round-briefing.ts
          resolves opponentTeamId/judgeId against the persisted
          opponentTeamProfiles.ts / judgeProfiles.ts stores by id
  → savePreRoundBriefing(record)                  — state/preRoundBriefings.ts
  → panel re-reads buildPreRoundBriefingsPanelView() to refresh

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
Vitest-covered; the panel UI closed follow-up (b), "a briefing panel UI
that renders it on a round-information page," named under idea #12
("Pre-Round Intelligence Panel") in `TODO.md`. The "create briefing" form
closes this doc's own previously-listed "no affordance … to generate a new
briefing" gap, adding one new pure, testable helper —
`buildPreRoundBriefingRecordFromDraft` in `state/preRoundBriefings.ts` —
that validates the draft and delegates to the existing
`buildPreRoundBriefingFromStores` rather than introducing new
briefing-composition logic. Vitest-covered in
`packages/debate-round/test/preRoundBriefings.test.ts`.

## Known gaps

- No real data sources for tournament results, pairings, event details, or
  room assignments yet — follow-up (a) on the same idea, not started; a
  briefing's event/opponent/judge fields still have to be entered by hand
  or supplied by a caller of `buildPreRoundBriefing`/
  `buildPreRoundBriefingFromStores` directly.
- The form's head-to-head "Prior meetings" section is always "No recorded
  prior meetings" — it isn't wired to a caller-supplied `ownRecords`/
  `opponentTeamId` history the way `buildPreRoundBriefingFromStores`
  supports when called directly; the form only fills in scouting/tendency
  data by id, not head-to-head history.
