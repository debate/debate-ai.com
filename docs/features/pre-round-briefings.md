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

## Freshness indicator

Closes idea #12's "a 'last updated' freshness indicator so a stale briefing
is obvious" follow-up: every round card now shows how long it's been since
its briefing was last saved, and flags it once that gets too old to trust —
pre-round facts like room assignments, lineups, or scouting notes can shift
within a single tournament day.

```
state/preRoundBriefings.ts#savePreRoundBriefing(record, now = Date.now())
  → stamps record.updatedAt = now on every save (ignoring any updatedAt
    already on the passed-in record), whether creating or overwriting

round/pre-round-briefing.ts
  → getBriefingAgeHours(updatedAt, now)  — whole hours since last save,
                                            undefined when updatedAt isn't set
  → isBriefingStale(updatedAt, now, thresholdHours = STALE_BRIEFING_THRESHOLD_HOURS)
                                          — true once age ≥ thresholdHours (24h)

panels/PreRoundBriefingsPanel.tsx
  → renders a badge next to each round's prior-meetings badge:
    outline while fresh, destructive once isBriefingStale reports true,
    hidden entirely when ageHours is undefined (a record persisted before
    updatedAt existed)
```

`updatedAt` is optional on `PreRoundBriefingRecord` so a briefing saved
before this field existed still deserializes — `getBriefingAgeHours`/
`isBriefingStale` simply report no age for it, and the panel hides the
badge rather than showing a wrong or made-up age. This mirrors
`debate-research-evidence`'s Peer Review System review-aging indicator
(`peer-review.ts#getReviewAgeDays`/`isReviewStale`,
`ReviewQueuePanel.tsx`'s age badge) almost exactly, down to the
`now`-injectable pure functions and the `undefined`-age-hides-the-badge
guard. Vitest-covered in `packages/debate-round/test/pre-round-briefing.test.ts`'s
`getBriefingAgeHours`/`isBriefingStale` suites (undefined-`updatedAt`,
hour flooring, a future `updatedAt` clamping to zero, the exact-threshold
boundary, and a custom threshold) and
`packages/debate-round/test/preRoundBriefings.test.ts`'s updated
`savePreRoundBriefing` suite (the default-`Date.now()` stamp, an injected
`now`, and a caller-supplied `updatedAt` being overwritten rather than
respected).

## Manual pairing/room assignments

Closes idea #12's "A manual pairing/room-assignment entry form as the
practical stand-in" follow-up, since real Tabroom pairings stay blocked
behind a login wall (`tourn/results`/`postings` pages 302-redirect to
`/user/login/login.mhtml` for automated requests — see `TODO.md`'s
"Confirmed blocker: Tabroom results/pairings/ballot data" note). A
"Pairing schedule" section sits between the "create briefing" form and the
"Log a round" form: round ID, tournament, division, round label, side
(Aff/Neg), and optional room/opponent-label/judge-name text fields —
mirroring `RoundEventInfo`'s shape, plus a free-text judge name (a pairing
sheet lists a judge by name, not by an already-persisted `JudgeProfile`
id). Saving validates the same required fields as the briefing form and
upserts a `RoundPairingRecord` keyed by `roundId`, so re-logging a round
whose room changed overwrites rather than duplicates it.

Unlike the rest of this feature, pairings are account-synced: signed in,
`hooks/useRoundPairings.ts` merges local and remote pairings by `roundId`
(filling gaps only, same as `useWordCountRounds`) and best-effort pushes
local saves/deletes to the account, backed by a new `saved_round_pairings`
D1 table (`drizzle/0021_nostalgic_northstar.sql`) and `/api/round-pairings`
routes — so a team's pairing schedule for a tournament follows a signed-in
user across devices.

Each saved pairing in the list has a "Use for briefing" action that
prefills the "create briefing" form's round ID/tournament/division/round
label/side/room/opponent-label fields from it, so the same information
doesn't have to be typed twice when writing up a full briefing for that
round.

```
Logging a pairing:
panels/PreRoundBriefingsPanel.tsx (pairing form state)
  → buildRoundPairingRecordFromDraft(draft)   — state/roundPairings.ts
  → savePairing(record)                       — hooks/useRoundPairings.ts
      → saveRoundPairing(record)              — state/roundPairings.ts
                                                 (localStorage: roundPairings)
      → when signed in: saveRoundPairingToAccount(record) (best-effort)
                                                 — round/round-pairings-client.ts
                                                 → PUT /api/round-pairings/:pairingId
                                                 → saved_round_pairings (D1)
  → panel re-renders from the hook's pairings state

Using a pairing to prefill a briefing:
panels/PreRoundBriefingsPanel.tsx
  → handleUsePairingForBriefing(pairing) copies the pairing's fields into
    the "create briefing" form's draft state (no store changes)

Removing a pairing:
panels/PreRoundBriefingsPanel.tsx
  → deletePairing(roundId)                    — hooks/useRoundPairings.ts
      → deleteRoundPairing(roundId)           — state/roundPairings.ts
      → when signed in: deleteSavedRoundPairingFromAccount(roundId) (best-effort)
```

Vitest-covered in `packages/debate-round/test/roundPairings.test.ts` (the
pure store and draft validation), `test/savedRoundPairings.test.ts` (the
structural validator shared by the API routes and the hook), and
`test/round-pairings-client.test.ts` (the fetch wrapper, mocking `fetch`).
`hooks/useRoundPairings.ts` itself is untested, matching this repo's
existing convention for account-synced, `localStorage`-backed hooks (e.g.
`useWordCountRounds`, `useCounselPanelAssessments`).

## Receiving a Scout-to-Strategy export

[Scout-to-Strategy](scout-to-strategy.md)'s **Send to Pre-Round Briefing**
action lets a team append a strategy recommendation's one-line summary
(recommended case plus overall risk level) as a new "Team prep notes"
bullet on an already-saved briefing here — see that doc's "Exporting a
recommendation into a Pre-Round Briefing" section. It only targets a
briefing already created via the form above (there's no round event info to
compose a fresh one from a matchup id alone), so create the briefing here
first if it doesn't exist yet.

## Known gaps

- No real data source for tournament results, event details, or ballots —
  a briefing's opponent-scouting/judge-tendency data still has to be
  entered by hand (via the Opponent Team Profiles / Judge Profiles stores)
  or supplied by a caller of `buildPreRoundBriefing`/
  `buildPreRoundBriefingFromStores` directly, and own round history is
  entered by hand via the "Log a round" form. Pairings/room assignments now
  have a dedicated manual-entry form (see above) as the practical stand-in
  for the still-blocked live Tabroom data.
