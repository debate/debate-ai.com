<!-- template-git-repo:badges:start -->
<p align="center">
    <a href="https://debate-ai.com/docs"><img src="https://img.shields.io/badge/Docs-blue?logo=ReadTheDocs&logoColor=white" alt="Documentation" /></a>
    <a href="https://stackblitz.com/github/debate/debate-ai.com/tree/master/packages/debate-round"><img height="20px" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/stargazers"><img src="https://img.shields.io/github/stars/debate/debate-ai.com" alt="GitHub Stars" /></a>
    <a href="https://github.com/debate/debate-ai.com/issues"><img src="https://img.shields.io/github/issues/debate/debate-ai.com?logo=github" alt="GitHub Issues" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls"><img src="https://img.shields.io/github/issues-pr/debate/debate-ai.com?logo=github&label=PRs" alt="Open Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls?q=is%3Apr+is%3Aclosed"><img src="https://img.shields.io/github/issues-pr-closed/debate/debate-ai.com?logo=github&label=PRs%20merged&color=8957e5" alt="Merged Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/discussions"><img src="https://img.shields.io/github/discussions/debate/debate-ai.com" alt="GitHub Discussions" /></a>
    <a href="https://github.com/debate/debate-ai.com/commits/master/"><img src="https://img.shields.io/github/last-commit/debate/debate-ai.com.svg" alt="GitHub last commit" /></a>
    <br />
    <img src="https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white" alt="Bun" /> <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /> <img src="https://img.shields.io/badge/Next.js-black?logo=nextdotjs&logoColor=white" alt="Next.js" /> <img src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=white" alt="React" /> <img src="https://img.shields.io/badge/shadcn%2Fui-000000?logo=shadcnui&logoColor=white" alt="shadcn/ui" /> <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
</p>
<!-- template-git-repo:badges:end -->

# debate-round

FIAT — the live round workspace: the ag-Grid flow spreadsheet, column navigation and
split view, the round setup dialog (tournament, teams, judges, spectators, winner), speech
doc panels, export and history dialogs, and the flow/settings stores behind them.

```tsx
import { DebateFlowPage, useFlowStore } from "debate-round"
```

`PrepNotesPanel` (also exported from the package root) renders every
persisted "Strategy Sync Notes" `PrepNote` grouped by status — see
[`packages/debate-help-docs/content/docs/internals/prep-notes.mdx`](../../docs/features/prep-notes.md).

`OpponentTeamProfilesPanel` (also exported from the package root) renders
every persisted `debate-data-sync` `OpponentTeamProfile` as a scouting
roster — see
[`packages/debate-help-docs/content/docs/internals/opponent-team-profiles.mdx`](../../docs/features/opponent-team-profiles.md).

`DrillSetsPanel` (also exported from the package root) renders every
persisted "AI Drill Generator" `Drill` set, grouped by round — see
[`packages/debate-help-docs/content/docs/features/drill-sets.mdx`](../../docs/features/drill-sets.md).

`PreRoundBriefingsPanel` (also exported from the package root) renders
every persisted "Pre-Round Intelligence Panel" `PreRoundBriefingRecord`,
sorted by round — see
[`packages/debate-help-docs/content/docs/internals/pre-round-briefings.mdx`](../../docs/features/pre-round-briefings.md).

`CoachingSessionsPanel` (also exported from the package root) renders
every persisted "AI Coach Mode" `CoachingSessionRecord`, grouped by round +
side — see
[`packages/debate-help-docs/content/docs/features/coaching-sessions.mdx`](../../docs/features/coaching-sessions.md).

`FlowSummariesPanel` (also exported from the package root) renders every
persisted "Speech Transcript Summaries and Answers" `FlowSummaryRecord`,
one card per round, with suggested cross-exam questions and extension
ideas for anything still unanswered — see
[`packages/debate-help-docs/content/docs/internals/flow-summaries.mdx`](../../docs/features/flow-summaries.md).

`WordCountRoundsPanel` (also exported from the package root) lets a user
type a "Word-Count-Only Speech Format" round's speeches against a live
word-count readout and renders every persisted `WordCountRoundRecord` — see
[`packages/debate-help-docs/content/docs/features/word-count-rounds.mdx`](../../docs/features/word-count-rounds.md).

`ArgumentTreePanel` (also exported from the package root) renders every
persisted "Outline Filters and Argument Tree View" `ArgumentTreeRecord` as a
filterable, heading-grouped outline, with speech/side/kind/unanswered-only
controls that persist per round — see
[`packages/debate-help-docs/content/docs/internals/argument-tree-outline.mdx`](../../docs/features/argument-tree-outline.md).

`AiVersusRoundPanel` (also exported from the package root) lets a user
start an "Online Debate Versus AI" round (format + side), submit their own
speeches in turn order via `validateSpeechSubmission`, and renders every
persisted `AiVersusRoundRecord` — see
[`packages/debate-help-docs/content/docs/features/ai-versus-rounds.mdx`](../../docs/features/ai-versus-rounds.md).

`PracticeRoundSimulatorPanel` (also exported from the package root) lets a
user configure a "Practice Round Simulator" round (format, side, AI judge
paradigm, AI opponent persona) via `buildPracticeRoundSetup`, and renders
every persisted `PracticeRoundRecord` with its setup, submitted-speech
progress, and post-round feedback — see
[`packages/debate-help-docs/content/docs/internals/practice-round-simulator.mdx`](../../docs/features/practice-round-simulator.md).


`VulnerabilityChartsPanel` (also exported from the package root) renders
every persisted "AI Response-Outcome Charts" `VulnerabilityReportRecord`,
one card per round, with a per-side exposure summary and a "most exposed
arguments" bar chart — see
[`packages/debate-help-docs/content/docs/features/response-outcome-charts.mdx`](../../docs/features/response-outcome-charts.md).

`FlowAnnotationsPanel` (also exported from the package root) lets a viewer
drop a timestamped "Flow-in-Speech Flow Annotations" `FlowAnnotation` at the
`debate-videos` player's live playback position (or a manual timestamp),
and renders every persisted annotation with a "Jump to" action back into
the player — see
[`packages/debate-help-docs/content/docs/internals/flow-annotations.mdx`](../../docs/features/flow-annotations.md).

Composes `debate-timer` for speech timing and recording and `debate-editor` for speech
docs; the flow types themselves live in `src/types/flow.ts` (this package owns them —
`debate-timer` and `debate-card-search` keep their own copies to avoid a circular
dependency back on this package).

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

```
debate-round/
├── src/
│   ├── controls/     # column navigator, quick actions, split-mode toolbar
│   ├── dialogs/      # round editor, file export, flow history
│   ├── flow/         # ag-Grid flow spreadsheet and its renderers
│   ├── hooks/        # flow, speech, timer and URL-sync hooks
│   ├── layout/       # page header, sidebar, main content, speech doc panel
│   ├── navigation/   # flow tabs
│   ├── panels/       # DebateRoundPanel shell, PrepNotesPanel, OpponentTeamProfilesPanel, DrillSetsPanel, PreRoundBriefingsPanel, CoachingSessionsPanel, FlowSummariesPanel, WordCountRoundsPanel, ArgumentTreePanel, AiVersusRoundPanel, PracticeRoundSimulatorPanel, VulnerabilityChartsPanel
│   ├── state/        # zustand stores (flow, settings, history, profile)
│   ├── types/        # flow and settings types
│   ├── utils/        # flow + localStorage helpers
│   └── index.ts      # public entry point
└── test/             # Vitest suites for the flow and storage helpers
```

## Tests

```bash
bun run test        # or: npx vitest run
bun run coverage    # writes ./coverage for this package alone
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `50322f5` is **39.91%** (tracked under
the `debate-round` flag).
