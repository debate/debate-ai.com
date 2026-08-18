# Speech Transcript Summaries

Shows every persisted "Speech Transcript Summaries and Answers" flow
summary, one card per round — a concise per-argument summary of that
round's flow, plus suggested cross-examination questions and extension
ideas for anything still unanswered — with a "Clear" action per round.

- **Route:** `/summaries`
- **Nav:** the global dock's Settings menu → **Speech Transcript Summaries**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

Each persisted `FlowSummaryRecord` (keyed by `roundId`) renders as its own
card, sorted by `roundId` for a stable order. Inside a card:

- The round's per-argument summary text — one line per non-heading
  argument, noting where it was introduced and flagging anything unanswered
  since a later speech.
- If any argument is currently unanswered, two suggestion lists built from
  that round's unanswered rows: cross-examination questions to press the
  point live, and extension ideas to frame it as dropped/conceded.

## Data flow

```
state/flowSummaries.ts (localStorage: flowSummaries)
  → buildFlowSummariesPanelView()        — sorts every persisted
                                            FlowSummaryRecord by roundId
  → panels/FlowSummariesPanel.tsx        — renders each round's summary
                                            text (buildFlowSummaryTextFromRows)
                                            plus suggestCrossExamQuestions/
                                            suggestExtensionIdeas for
                                            unanswered rows
  → apps/debate-ai.com/app/summaries/page.tsx  — mounts the panel as a route

Clearing a round's flow summary:
panels/FlowSummariesPanel.tsx
  → deleteFlowSummary(roundId)  — state/flowSummaries.ts
  → panel re-reads buildFlowSummariesPanelView() to refresh
```

Every summary-derivation and persistence rule already existed and was
Vitest-covered; this feature closes follow-up (b), "a summary/cross-ex
panel UI in `debate-round` that renders
`buildFlowSummaryText`/`suggestCrossExamQuestions`/`suggestExtensionIdeas`
... and reads/writes through the persistence store," named under idea #6
("Speech Transcript Summaries and Answers") in `TODO.md`. It adds two small
helpers rather than new summary-derivation logic:
`flow-transcript-summary.ts`'s `buildFlowSummaryTextFromRows` (the
row-mapping half of `buildFlowSummaryText`, extracted so the panel can
render already-persisted `FlowRowSummary[]` without needing the original
raw `Flow`), and `state/flowSummaries.ts`'s `buildFlowSummariesPanelView`,
which sorts `listFlowSummaries`'s output for a stable panel display order.
Vitest-covered in `packages/debate-round/test/flowSummaries.test.ts` and
`packages/debate-round/test/flow-transcript-summary.test.ts`.

## Known gaps

- No audio/video transcription or AI call to extract claims/warrants/
  impacts from raw speech text — follow-up (a) on the same idea, not
  started; this panel only renders summaries already derived from a
  manually flowed grid.
- No affordance in this panel to generate a new flow summary for a round —
  a summary only appears here once something elsewhere calls
  `getFlowRowSummaries` and `saveFlowSummary` for that round.
