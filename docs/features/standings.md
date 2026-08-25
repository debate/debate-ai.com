# CX NDCA Standings

Lets a user record a team's result at a tournament — the outround finish,
prelim record, division, and bid level — and see cumulative, ranked season
standings across every recorded result. This is the "(c) a standings
dashboard UI (likely under `/rank`)" follow-up named under idea #1 ("CX
NDCA Standings") in `TODO.md`'s Product Feature Ideas list.

- **Route:** `/standings`
- **Nav:** the global dock's Settings menu → **CX NDCA Standings**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to record one team's result at one tournament: team ID, tournament
name, date, division, bid level, outround finish, and prelim win/loss
record. Saving appends a new record (a team can attend many tournaments).

Below the form, every persisted result is aggregated into a ranked
standings table — rank, team, total qualification points, tournaments
counted vs. attended, cumulative prelim record, and best finish — sorted by
total points descending, ties broken by team id.

Qualification points default to `ndca-standings.ts`'s
`DEFAULT_QUALIFICATION_POINTS_TABLE`, an explicitly illustrative default —
no public, authoritative NDCA point table exists for this repo to hardcode.
A **Points table** section above the standings table now lets a user save
their own circuit's point weights (per outround finish, points per prelim
win, and the bid-level bonus rate) for this browser, so standings no longer
have to stay stuck on the illustrative default. See "Custom points table"
below and idea #1's follow-up (b).

## Data flow

```
rankings/ndca-standings.ts
  → computeTournamentPoints(result, table)   — scores one result
  → buildStandings(resultsByTeam, options)   — aggregates each team's
                                                results into a TeamStanding
  → rankStandings(standings)                 — sorts/ranks by total points

state/qualificationPointsTable.ts (localStorage: qualificationPointsTable)
  → savePersistedQualificationPointsTable(table)     — saves a custom table
  → resetPersistedQualificationPointsTable()         — clears the override
  → getEffectiveQualificationPointsTable()           — the saved table, or
                                                        DEFAULT_QUALIFICATION_POINTS_TABLE

state/tournamentResults.ts (localStorage: tournamentResults)
  → saveTournamentResult(record)         — appends a new result
  → buildStandingsFromStore(options)     — groups every persisted result by
                                            teamId and runs buildStandings/
                                            rankStandings, scoring with
                                            options.pointsTable if given,
                                            else getEffectiveQualificationPointsTable()
  → panels/StandingsPanel.tsx            — renders the result-entry form,
                                            the points-table editor, and the
                                            ranked standings table
  → apps/debate-ai.com/app/standings/page.tsx  — mounts the panel as a route

Recording a result:
panels/StandingsPanel.tsx
  → saveTournamentResult({ id, teamId, tournamentName, date, division,
                            bidLevel, finish, prelimWins, prelimLosses })
  → panel re-reads buildStandingsFromStore() to refresh

Saving a custom points table:
panels/StandingsPanel.tsx
  → savePersistedQualificationPointsTable({ outroundPoints,
                                             pointsPerPrelimWin,
                                             bidLevelBonusRate })
  → panel re-reads buildStandingsFromStore() to refresh with the new table
```

Every points-scoring, aggregation, and ranking rule already existed and was
Vitest-covered (`packages/debate-data-sync/test/ndca-standings.test.ts`);
this feature adds the persistence layer and dashboard UI without
introducing new standings logic. `state/tournamentResults.ts` is
Vitest-covered in
`packages/debate-data-sync/test/tournamentResults.test.ts`, and
`state/qualificationPointsTable.ts` is Vitest-covered in
`packages/debate-data-sync/test/qualificationPointsTable.test.ts`.

## Custom points table

The **Points table** section at the top of `/standings` shows every
`QualificationPointsTable` field as an editable number input: one per
outround finish (Champion through Prelims only), points per prelim win, and
the bid-level bonus rate. **Save points table** persists it via
`savePersistedQualificationPointsTable` and immediately re-scores the
standings below with it; **Reset to default** clears the saved override
(disabled when none is saved) and reverts to the illustrative default. A
saved table is stored per-browser (`localStorage`, key
`qualificationPointsTable`) and validated on read — a corrupt or
incompletely-shaped stored value is treated as "none saved" rather than
thrown, falling back to the default.

## Known gaps

- Follow-up (a), a real Tabroom/NDCA scraper that produces
  `TournamentResult` records automatically (today's `sync-tournaments.ts`
  only fetches tournament names, not per-team results), remains open —
  every result is entered by hand through this panel's form.
- Follow-up (b) is now closed for the "stuck with a fixed illustrative
  table" half — a user can save their own circuit's `QualificationPointsTable`
  (see "Custom points table" above). A genuinely real, authoritative,
  circuit-sourced default table still can't exist here — no such public
  data source exists for this repo to hardcode — so the table a new user
  sees before saving their own remains the illustrative default.
- The saved points table is per-browser `localStorage`, not a shared team
  resource — two teammates on different devices can score the same
  standings with different tables, the same known gap most other
  localStorage-backed panels in this repo have.
- No reviewer-identity/permission checks on who may change the saved
  points table (no auth system in this repo yet).
