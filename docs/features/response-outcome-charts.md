# AI Response-Outcome Charts

Shows every persisted "AI Response-Outcome Charts" vulnerability report,
one card per round — a per-side exposure summary plus a "most exposed
arguments" bar chart derived from that round's already-flowed grid — with
a "Clear" action per round. Each argument also gets a "what if" picker
that recomputes its score (and the round's side summary/chart) under a
hypothetical extend/answer/concede choice, and a "Get AI counsel panel"
action that calls a real AI panel of three specialized debate "counsel"
roles to assess each exposed argument's likely response path and where
clash will concentrate.

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
  from `buildVulnerabilityChartDataFromReport`. Each bar has a "what if"
  picker (Extend / Answer / Concede) that recomputes that row's score via
  `applyHypotheticalAdjustments`; the hypothetical is scratch component
  state only, never persisted.
- An "AI Counsel Panel" section with a "Get AI counsel panel" button. Once
  requested, it renders an overall clash-summary paragraph plus each
  assessed argument's counsel role (Policy Counsel, Kritik Counsel, or
  Weighing Counsel), likely response path, and clash estimate — a real
  Anthropic call, not a heuristic.

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
  → deleteVulnerabilityReport(roundId)       — state/vulnerabilityReports.ts
  → deleteCounselPanelAssessment(roundId)    — state/counselPanelAssessments.ts
  → panel re-reads buildVulnerabilityReportsPanelView() to refresh

AI counsel-panel assessment ("Get AI counsel panel"):
flow/response-outcome-ai.ts
  → buildCounselPanelAiUserPrompt(input)     — composes the round's top
                                                exposed arguments (row,
                                                origin speech, unanswered
                                                status, heuristic score)
                                                into a prompt
  → parseCounselPanelAiResponse(raw)         — tolerant JSON parsing of
                                                the model's reply
flow/response-outcome-client.ts
  → requestCounselPanelAssessment(input)     — POSTs to the existing
                                                /api/reason-ai proxy
state/counselPanelAssessments.ts
  → saveCounselPanelAssessment(roundId, result)  — persists the result,
                                                     keyed by roundId
panels/VulnerabilityChartsPanel.tsx
  → renders the overall clash summary and each assessed argument's
    counsel role, likely response path, and clash estimate
```

Every vulnerability-scoring and chart-data rule already existed
(`getArgumentVulnerabilityReport`/`buildVulnerabilityChartData`/
`summarizeOutcomeBySide`) and was Vitest-covered; earlier slices closed
follow-up (b), "a chart/panel UI in `debate-round` that renders
`buildVulnerabilityChartData`/`summarizeOutcomeBySide`," and follow-up
(c), the "what if" hypothetical mode, both named under idea #4 ("AI
Response-Outcome Charts") in `TODO.md`. This slice closes the remaining
follow-up (a) — a real AI-panel call — by adding:

- `state/vulnerabilityReports.ts`, a localStorage-backed CRUD store for a
  round's derived `ArgumentVulnerability[]` report (plus the flow's
  `sideKeys`, needed to reconstruct the per-side rollup without the
  original raw `Flow`), mirroring the existing `flowSummaries.ts`
  persistence convention.
- `flow/response-outcome.ts`'s `summarizeOutcomeBySideFromReport`,
  `buildVulnerabilityChartDataFromReport`, and
  `applyHypotheticalAdjustments` — row-based variants and the "what if"
  recompute rule, so the panel can render an already-persisted report
  (and a hypothetical variant of it) without the original `Flow`.
- `flow/response-outcome-ai.ts`, a pure prompt-building/parsing module
  (mirroring `round/judge-decision-ai.ts`'s split) that asks the model to
  role-play three specialized debate "counsel" — Policy Counsel, Kritik
  Counsel, and Weighing Counsel — assign whichever role best fits each
  already-scored vulnerable argument, and estimate that argument's likely
  response path and clash point, plus one overall round-level clash
  summary.
- `flow/response-outcome-client.ts`, a small `fetch`-based client (mirroring
  `round/judge-decision-client.ts`) posting to the existing
  `/api/reason-ai` proxy.
- `state/counselPanelAssessments.ts`, a localStorage-backed store for a
  round's `CounselPanelAiResult`, keyed by `roundId`, mirroring
  `debate-card-search`'s `state/aiCardAssessments.ts` convention.

No new vulnerability-scoring logic is introduced — the deterministic
heuristic in `response-outcome.ts` is unchanged; the AI counsel panel is a
second, genuinely AI-backed assessment layered alongside it.

Vitest-covered in `packages/debate-round/test/vulnerabilityReports.test.ts`,
`packages/debate-round/test/response-outcome.test.ts`,
`packages/debate-round/test/response-outcome-ai.test.ts` (prompt
composition and tolerant JSON parsing, including an unrecognized
`counselRole`, missing fields, and prose/fence-wrapped replies),
`packages/debate-round/test/response-outcome-client.test.ts` (the `fetch`
client, with `fetch` mocked via `vi.stubGlobal`, covering the success
path, an endpoint override, a server error message, a non-JSON error body,
and an unparseable AI reply), and
`packages/debate-round/test/counselPanelAssessments.test.ts` (get/save/
delete, corrupt/missing storage, and per-`roundId` isolation).

A "Generate report for current round" form in the panel reads the round
workspace's currently selected flow (`state/store.ts`'s `useFlowStore`, the
same mechanism `DrillSetsPanel`'s "Generate drills for current round" form
uses) and derives+persists that round's vulnerability report via
`state/vulnerabilityReports.ts`'s new `buildAndSaveVulnerabilityReport` —
composing the existing `getArgumentVulnerabilityReport` + `getFlowSideKeys`
+ `saveVulnerabilityReport` in one step, mirroring `drillSets.ts`'s
`buildAndSaveDrillSet`. No new vulnerability-scoring logic. Vitest-covered
in `packages/debate-round/test/vulnerabilityReports.test.ts` (deriving and
persisting a report from a flow, overwriting an existing record for the
same round, and `sideKeys` derived correctly via `getFlowSideKeys`).

## Known gaps

- The AI counsel panel scores the round's currently-persisted report only
  (not a "what if" hypothetical) — requesting a fresh panel after applying
  a "what if" adjustment re-scores against the original saved report, not
  the hypothetical variant.
