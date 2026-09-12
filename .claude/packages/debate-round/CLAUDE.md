# CLAUDE.md — `debate-round` (FIAT)

Private. The live debate round workspace. Entry `src/index.ts`, tests in
`test/`. One of the two load-bearing packages in the repo.

Owns: the **ag-Grid flow spreadsheet**, column navigation and split view, round
setup dialogs (tournament, teams, judges, spectators, winner), speech doc
panels, export/history tooling, and the flow/settings stores. Also exports the
**roster panels** — prep notes, opponent team profiles, drill sets, pre-round
briefings, coaching sessions, flow summaries — that render records persisted by
the practice tools.

## Who depends on you

`debate-team-collaboration` (prep notes and notifications moved out of here) and
`debate-practice-drills` both build on this package. Changing a public export
or a store shape ripples into both. `debate-flow`'s `EbbFlowEmbed` mounts
*inside* a round, so key handling and layout are shared concerns.

## Rules

- **This runs live, during a round, under time pressure.** A debater cannot
  reload. Data loss in the flow grid or the speech doc is the worst bug this
  repo can ship — anything touching the stores needs a test for the
  interrupted/refresh case.
- **The flow stores are the source of truth**, not component state. Don't cache
  round data in a component and write back later.
- Round setup and export shapes are persisted — a field rename is a migration,
  not a refactor. Check `debate-data-sync`'s shared record types
  (`OpponentTeamProfile` and friends) before renaming anything on a roster
  panel.
- ag-Grid is a heavy dependency with its own idioms. Follow the existing usage
  rather than introducing a second pattern.
