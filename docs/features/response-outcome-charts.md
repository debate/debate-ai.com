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
- **Nav:** the Tools page's Coaching & Analytics group; the Reason Editor's
  Workspace menu (`t outcome` in Ctrl/Cmd-Shift-Space's command palette)
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
  Anthropic call, not a heuristic. Every requested assessment is appended to
  that round's history log instead of overwriting the prior one — the
  newest assessment renders expanded, with older ones collapsed into a
  "Show past assessments (N)" toggle and a "Clear history" action next to
  the "Get AI counsel panel" button.
- A "Download report" button next to "Clear" that exports the round's
  currently-shown side summary, exposure chart, and latest AI counsel-panel
  assessment as a downloadable plain-text file — see "Report download"
  below.

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
flow/response-outcome.ts
  → buildCounselPanelTopArguments(effectiveReport)
                                              — trims the panel's current
                                                report (the persisted report,
                                                or a "what if"-adjusted
                                                variant via
                                                applyHypotheticalAdjustments)
                                                to the top exposed arguments
flow/response-outcome-ai.ts
  → buildCounselPanelAiUserPrompt(input)     — composes those top exposed
                                                arguments (row, origin
                                                speech, unanswered status,
                                                heuristic score) into a
                                                prompt
  → parseCounselPanelAiResponse(raw)         — tolerant JSON parsing of
                                                the model's reply
flow/response-outcome-client.ts
  → requestCounselPanelAssessment(input)     — POSTs to the existing
                                                /api/reason-ai proxy
hooks/useCounselPanelAssessments.ts
  → appendAssessment(roundId, result)        — state/counselPanelAssessments.ts's
                                                appendCounselPanelAssessment,
                                                stamping a fresh id/generatedAt
                                                and appending to that round's
                                                history log (never overwrites),
                                                then best-effort syncs to the
                                                account when signed in
panels/VulnerabilityChartsPanel.tsx
  → renders the newest assessment's overall clash summary and each assessed
    argument's counsel role, likely response path, and clash estimate,
    expanded by default; older assessments for the round collapse behind a
    "Show past assessments (N)" toggle
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
  `debate-card-search`'s `state/aiCardAssessments.ts` convention. (Since
  reworked into an append-only history log — see "Counsel-panel assessment
  history" below.)

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

The "Get AI counsel panel" action scores whichever report the chart and
side summary above it are currently rendering — the round's persisted
report, or a "what if"-adjusted variant when an Extend/Answer/Concede
pick is active — via `flow/response-outcome.ts`'s
`buildCounselPanelTopArguments(effectiveReport)`, so an active hypothetical
is reflected in the AI counsel call too, not just the chart. Previously
the counsel call always scored `record.report` (the original persisted
report), silently ignoring an active "what if" adjustment even though the
chart/side-summary above it did reflect it. Vitest-covered in
`packages/debate-round/test/response-outcome.test.ts`'s
`buildCounselPanelTopArguments` suite (ranked top-N trimmed to the
counsel-request fields, the default limit, and reflecting a
hypothetical-adjusted report's recomputed score/unanswered status instead
of the original).

## Counsel-panel assessment history

Closes idea #4's "a timeline of past AI counsel-panel assessments for a
round, not just the latest" follow-up in `TODO.md`'s Product Feature Ideas
list. Every requested "Get AI counsel panel" assessment is now appended to
that round's history log — its own generated `id` — instead of overwriting
the round's prior assessment, mirroring idea #5's exact
`judgeDecisions.ts`/`useJudgeDecisions.ts` history-log/account-sync pattern:

- `state/counselPanelAssessments.ts`: reworked from a `roundId`-keyed
  overwrite store into an append-only log (`CounselPanelAssessmentRecord =
  { id, roundId, result, generatedAt }`) — `appendCounselPanelAssessment`,
  `listCounselPanelAssessmentsForRound` (newest-first),
  `getLatestCounselPanelAssessmentForRound`, `deleteCounselPanelAssessment`,
  `deleteCounselPanelAssessmentsForRound` ("Clear history" bulk action),
  `buildCounselPanelAssessmentsPanelView` (grouped by round for the panel),
  and `adoptCounselPanelAssessment` (upsert-by-id, for merging in a synced
  remote record). A `MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND` cap (20,
  matching `judgeDecisions.ts`'s cap) trims the oldest entry once a
  heavily-re-consulted round's log exceeds it.
- `state/savedCounselPanelAssessments.ts` /
  `flow/counsel-panel-assessments-client.ts`: structural validation
  (`isValidCounselPanelAssessmentRecord`) and a `fetch` client
  (`listSavedCounselPanelAssessments`/`saveCounselPanelAssessmentToAccount`/
  `deleteSavedCounselPanelAssessmentFromAccount`) for the new
  `/api/counsel-panel-assessments` D1-backed routes — account-only (401
  signed out), one `saved_counsel_panel_assessments` row per assessment
  (many rows can share a `roundId`), upserted by the assessment's own
  `clientId`. Same shape as `saved_judge_decisions`
  (`drizzle/0019_greedy_true_believers.sql`).
- `hooks/useCounselPanelAssessments.ts`: local-first state, merged with and
  best-effort synced to the account when signed in — mirrors
  `useJudgeDecisions.ts`'s merge-by-id logic (a remote record with no local
  counterpart is adopted; a local-only record is best-effort pushed up;
  neither direction overwrites an id both sides already have, since an
  assessment is generated once and never edited).
- `panels/VulnerabilityChartsPanel.tsx`: renders the newest assessment for a
  round expanded (with its generation timestamp), older ones behind a "Show
  past assessments (N)" toggle each with their own timestamp, and a "Clear
  history" button next to "Get AI counsel panel" that clears the round's
  full assessment history (both local and, when signed in, account-synced).
  "Clear" (the round's vulnerability report) also clears its assessment
  history via the same `deleteRoundHistory` the "Clear history" button
  uses.

Vitest-covered in `packages/debate-round/test/counselPanelAssessments.test.ts`
(append/list/get/delete/adopt, the per-round cap and its trimming, and
grouping/sorting for the panel view),
`packages/debate-round/test/savedCounselPanelAssessments.test.ts`
(structural validation, including every counsel role and each rejected
malformed field), and
`packages/debate-round/test/counsel-panel-assessments-client.test.ts` (the
`fetch` client's success path, a signed-out 401, and server error messages,
mirroring `judge-decisions-client.test.ts`'s coverage).

## Report download

Closes idea #4's "chart export/share (image or link) action" follow-up in
`TODO.md`'s Product Feature Ideas list — the plain-text/"link"-shaped half
of it. Nothing in this repo renders a chart to a bitmap today, so a
share-image export isn't attempted; instead a "Download report" button
next to each round's "Clear" action exports exactly what that round's
card is currently showing:

- `flow/response-outcome-report.ts#buildResponseOutcomeReportText` — a
  pure string builder taking the round id, its `SideOutcomeSummary[]`,
  its `VulnerabilityChartPoint[]`, and (optionally) its latest
  `CounselPanelAssessmentRecord`. Renders the per-side exposure summary,
  the "most exposed arguments" list in the same score-descending order the
  bar chart renders, and — when a counsel-panel assessment has been
  requested — that assessment's overall clash summary plus each assessed
  argument's counsel role, likely response path, and clash estimate. Older
  history entries are not included, only the newest.
- `responseOutcomeReportFilename(roundId)` — a filesystem-safe filename
  (e.g. `response-outcome-round-1-report.txt`), mirroring
  `round/ai-versus-transcript.ts#aiVersusTranscriptFilename`'s exact
  slugification rule.
- `panels/VulnerabilityChartsPanel.tsx`'s `handleDownloadReport` wraps the
  built text in a `Blob` and triggers the download via the same
  anchor+Blob pattern `AiVersusRoundPanel.tsx`'s "Download transcript"
  action already uses.

Because the button reads the same `sideSummaries`/`chartPoints` the card
renders, a report downloaded while a "what if" hypothetical is active
captures that hypothetical's recomputed numbers, not the round's persisted
report.

Vitest-covered in
`packages/debate-round/test/response-outcome-report.test.ts`: the header,
per-side summary lines (including singular/plural argument count),
chart-point ordering, placeholder text for an empty round, an omitted AI
counsel panel section when no assessment exists yet, a rendered assessment
section with its per-argument detail, a fallback row-index label when an
assessed row has no matching chart point, and the filename slugification
rules (simple id, mixed-case/punctuation, leading/trailing punctuation,
and an id with no alphanumeric characters at all).

## Known gaps

- No known gaps remain for this idea.
