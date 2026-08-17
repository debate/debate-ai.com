# AI Response-Outcome Charts

Shows every persisted "AI Response-Outcome Charts" vulnerability report,
one card per round — a per-side exposure summary plus a "most exposed
arguments" bar chart derived from that round's already-flowed grid — with
a "Clear" action per round.

- **Route:** `/outcomes`
- **Nav:** the global dock's Settings menu → **AI Response-Outcome Charts**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

Each persisted `VulnerabilityReportRecord` (keyed by `roundId`) renders as
its own card, sorted by `roundId` for a stable order. Inside a card:

- A per-side exposure summary — each side's argument count, unanswered
  count, and average vulnerability score (0-100) — built from
  `summarizeOutcomeBySideFromReport`.
- A "most exposed arguments" bar chart — the round's arguments sorted by
  `vulnerabilityScore` descending, each rendered as a labeled bar — built
  from `buildVulnerabilityChartDataFromReport`.

## Data flow

```
flow/response-outcome.ts
  → scoreArgumentVulnerability(row)              — scores one flowed
                                                     argument row 0-100
  → getArgumentVulnerabilityReport(flow)          — every argument row
                                                     scored and sorted
  → summarizeOutcomeBySideFromReport(report, sideKeys)
                                                   — rolls a report up per
                                                     side (row-based; no
                                                     Flow needed)
  → buildVulnerabilityChartDataFromReport(report) — top-N chart-ready
                                                     points (row-based; no
                                                     Flow needed)

state/vulnerabilityReports.ts (localStorage: vulnerabilityReports)
  → buildVulnerabilityReportsPanelView()   — sorts every persisted
                                              VulnerabilityReportRecord by
                                              roundId
  → panels/VulnerabilityChartsPanel.tsx    — renders each round's side
                                              summary and exposure chart
  → apps/debate-ai.com/app/outcomes/page.tsx  — mounts the panel as a route

Clearing a round's report:
panels/VulnerabilityChartsPanel.tsx
  → deleteVulnerabilityReport(roundId)  — state/vulnerabilityReports.ts
  → panel re-reads buildVulnerabilityReportsPanelView() to refresh
```

Every vulnerability-scoring and chart-data rule already existed
(`getArgumentVulnerabilityReport`/`buildVulnerabilityChartData`/
`summarizeOutcomeBySide`) and was Vitest-covered; this feature closes
follow-up (b), "a chart/panel UI in `debate-round` that renders
`buildVulnerabilityChartData`/`summarizeOutcomeBySide`," named under idea
#4 ("AI Response-Outcome Charts") in `TODO.md`. It adds:

- `state/vulnerabilityReports.ts`, a localStorage-backed CRUD store for a
  round's derived `ArgumentVulnerability[]` report (plus the flow's
  `sideKeys`, needed to reconstruct the per-side rollup without the
  original raw `Flow`), mirroring the existing `flowSummaries.ts`
  persistence convention.
- `flow/response-outcome.ts`'s `summarizeOutcomeBySideFromReport` and
  `buildVulnerabilityChartDataFromReport` — row-based variants of
  `summarizeOutcomeBySide`/`buildVulnerabilityChartData`, split out the
  same way `flow-transcript-summary.ts`'s `buildFlowSummaryTextFromRows`
  was, so the panel can render an already-persisted report without the
  original `Flow`. No new vulnerability-scoring logic is introduced.

Vitest-covered in `packages/debate-round/test/vulnerabilityReports.test.ts`
and the added cases in `packages/debate-round/test/response-outcome.test.ts`.

## Known gaps

- No actual AI-panel call (multiple "counsel" model roles) that evaluates
  likely response paths and clash points beyond this deterministic
  heuristic — follow-up (a) on the same idea, not started.
- No "what if" mode that recomputes the score against a hypothetical
  strategic choice rather than only the flow's current state — follow-up
  (c) on the same idea, not started.
- No affordance in this panel to generate a new vulnerability report for a
  round — a report only appears here once something elsewhere calls
  `getArgumentVulnerabilityReport` and `saveVulnerabilityReport` for that
  round.
