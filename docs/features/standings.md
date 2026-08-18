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

Qualification points use `ndca-standings.ts`'s
`DEFAULT_QUALIFICATION_POINTS_TABLE`, an explicitly illustrative default,
not a real circuit-sourced point table (see idea #1's follow-up (b)).

## Data flow

```
rankings/ndca-standings.ts
  → computeTournamentPoints(result, table)   — scores one result
  → buildStandings(resultsByTeam, options)   — aggregates each team's
                                                results into a TeamStanding
  → rankStandings(standings)                 — sorts/ranks by total points

state/tournamentResults.ts (localStorage: tournamentResults)
  → saveTournamentResult(record)         — appends a new result
  → buildStandingsFromStore(options)     — groups every persisted result by
                                            teamId and runs buildStandings/
                                            rankStandings directly
  → panels/StandingsPanel.tsx            — renders the result-entry form and
                                            the ranked standings table
  → apps/debate-ai.com/app/standings/page.tsx  — mounts the panel as a route

Recording a result:
panels/StandingsPanel.tsx
  → saveTournamentResult({ id, teamId, tournamentName, date, division,
                            bidLevel, finish, prelimWins, prelimLosses })
  → panel re-reads buildStandingsFromStore() to refresh
```

Every points-scoring, aggregation, and ranking rule already existed and was
Vitest-covered (`packages/debate-data-sync/test/ndca-standings.test.ts`);
this feature adds the persistence layer and dashboard UI without
introducing new standings logic. `state/tournamentResults.ts` is
Vitest-covered in
`packages/debate-data-sync/test/tournamentResults.test.ts`.

## Known gaps

- Follow-up (a), a real Tabroom/NDCA scraper that produces
  `TournamentResult` records automatically (today's `sync-tournaments.ts`
  only fetches tournament names, not per-team results), remains open —
  every result is entered by hand through this panel's form.
- Follow-up (b), a real, circuit-sourced `QualificationPointsTable`,
  remains open — standings use the illustrative default table.
