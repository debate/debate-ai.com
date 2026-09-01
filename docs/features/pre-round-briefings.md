# Pre-Round Briefings

Shows every persisted "Pre-Round Intelligence Panel" `PreRoundBriefing` —
opponent scouting, judge tendencies, head-to-head record, and team prep
notes combined into one briefing per round — with a "Clear" action per
round, and a form to create a new one by hand.

- **Route:** `/briefings`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t briefings` in Ctrl/Cmd-Shift-Space's command palette)
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

A second "Log a round" form sits below the "create briefing" form: this
team's own tournament, date, division, side, opponent (picked from an
already-persisted Opponent Team Profile), and result (Won/Lost). Saving
appends a record to a persisted own-round-history store; every logged round
lists below the form with a "Remove" action. When a briefing is created (or
re-generated via `buildPreRoundBriefingFromStores`) with a matching
`opponentTeamId`, the briefing's "Prior meetings" section and badge now show
the real head-to-head record built from these logged rounds, instead of
always reading "No recorded prior meetings."

## Data flow

```
Creating a briefing:
panels/PreRoundBriefingsPanel.tsx (form state)
  → buildPreRoundBriefingRecordFromDraft(draft)   — state/preRoundBriefings.ts
      → buildPreRoundBriefingFromStores(...)      — round/pre-round-briefing.ts
          resolves opponentTeamId/judgeId against the persisted
          opponentTeamProfiles.ts / judgeProfiles.ts stores by id, and
          resolves ownRecords against the persisted own-round-history
          history via getOwnRoundHistoryAgainst(opponentTeamId)
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

Logging this team's own round history:
panels/PreRoundBriefingsPanel.tsx ("Log a round" form state)
  → saveOwnRoundHistoryRecord(record)   — state/ownRoundHistory.ts
                                           (localStorage: ownRoundHistory)
  → panel re-reads listOwnRoundHistory() to refresh the logged-rounds list
  → round/pre-round-briefing.ts's buildPreRoundBriefingFromStores reads it
    back via getOwnRoundHistoryAgainst(opponentTeamId) the next time a
    briefing is created/generated for that opponent

Removing a logged round:
panels/PreRoundBriefingsPanel.tsx
  → deleteOwnRoundHistoryRecord(id)     — state/ownRoundHistory.ts
  → panel re-reads listOwnRoundHistory() to refresh
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

The "Log a round"/own-round-history store closes this doc's own
previously-listed "Prior meetings" gap below: a new
`state/ownRoundHistory.ts` persists `OpponentRoundRecord`s logged from this
team's own perspective (an id-per-round, append-only store mirroring
`debate-data-sync`'s `tournamentResults.ts` convention), and
`round/pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores` now
resolves `ownRecords` from it by `opponentTeamId` — the same
store-resolution pattern it already used for `opponentProfile`/
`judgeProfile` — introducing no new head-to-head computation logic (it
still delegates to the existing `getHeadToHeadRecords`/
`summarizePriorMeetings`). Vitest-covered in
`packages/debate-round/test/ownRoundHistory.test.ts` and the new
`buildPreRoundBriefingFromStores` cases in
`packages/debate-round/test/pre-round-briefing.test.ts`.

## Download a briefing

Closes idea #12's "a print/export view of a briefing for offline use before
a round" follow-up: each round card now has a "Download" action next to
"Clear" that saves the briefing as a plain-text file, for reading offline
(no network/app needed) before or during a round.

```
panels/PreRoundBriefingsPanel.tsx — "Download" button
  → buildPreRoundBriefingText(briefing, roundId)   — round/pre-round-briefing.ts
      (prepends a "Pre-Round Briefing — Round <id>" header line when a
       roundId is passed, then every section as already rendered on-page)
  → Blob + anchor download, named via preRoundBriefingFilename(roundId)
                                                    — round/pre-round-briefing.ts
                                                      (same anchor+Blob
                                                       pattern
                                                       VulnerabilityChartsPanel.tsx's
                                                       "Download report" and
                                                       AiVersusRoundPanel.tsx's
                                                       "Download transcript"
                                                       already use)
```

`buildPreRoundBriefingText` already existed (fully Vitest-covered) but was
never called from any panel — this is the first thing to actually invoke
it. Its `roundId` parameter is optional and additive, so the one existing
call site (the Vitest suite) is unaffected. No new download-mechanics code
was introduced; this reuses the exact anchor+Blob pattern already
established by every prior "export/download" follow-up in this repo rather
than adding a `window.print()`-based print view, since a plain-text
download is what every other completed export follow-up in this codebase
has settled on. Vitest-covered in
`packages/debate-round/test/pre-round-briefing.test.ts`'s
`buildPreRoundBriefingText`/`preRoundBriefingFilename` suites (round-header
presence, filename sanitization/collapsing/trimming/fallback).

## Known gaps

- No real data sources for tournament results, pairings, event details, or
  room assignments yet — follow-up (a) on the same idea, not started; a
  briefing's event/opponent/judge fields still have to be entered by hand
  or supplied by a caller of `buildPreRoundBriefing`/
  `buildPreRoundBriefingFromStores` directly. Own round history is also
  entered by hand via the "Log a round" form — it isn't reconstructed from
  any real tournament-results/pairings source either.
- No "last updated" freshness indicator on a briefing card yet — a
  still-open follow-up on this same idea.
