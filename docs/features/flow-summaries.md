# Speech Transcript Summaries

Shows every persisted "Speech Transcript Summaries and Answers" flow
summary, one card per round — a concise per-argument summary of that
round's flow, plus suggested cross-examination questions and extension
ideas for anything still unanswered — with a "Clear" action per round.
A "Generate from raw speech text" form lets AI derive a round's summary
directly from a pasted transcript instead of a manually flowed grid.

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

Generating a summary from raw speech text (no manually flowed grid needed):
panels/FlowSummariesPanel.tsx — "Generate from raw speech text" form
  → requestTranscriptExtraction()        — round/transcript-extraction-client.ts
      → POST /api/reason-ai              — server-side Anthropic proxy
      → parseTranscriptExtractionAiResponse()  — round/transcript-extraction-ai.ts
                                            parses claim/warrant/impact/
                                            evidence per argument
  → buildFlowRowSummariesFromExtraction()  — round/transcript-extraction-ai.ts
                                              turns extracted arguments into
                                              synthetic FlowRowSummary rows,
                                              each isUnanswered: true
  → saveFlowSummary()                    — state/flowSummaries.ts appends the
                                            new rows to that round's record
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

A later slice closes the AI-call half of follow-up (a), "audio/video
transcription plus an AI call to extract claims/warrants/impacts/evidence
from raw speech text rather than relying on a manually flowed grid":
`round/transcript-extraction-ai.ts` (prompt-build + parse, mirroring
`judge-decision-ai.ts`'s structured-JSON split) and
`round/transcript-extraction-client.ts` (the `/api/reason-ai` network call)
turn a pasted speech transcript into extracted claim/warrant/impact/evidence
arguments, and `buildFlowRowSummariesFromExtraction` renders them as the
same `FlowRowSummary` shape a manually flowed grid would produce — so an
extracted argument gets the same cross-exam/extension suggestions as any
other row. Vitest-covered in
`packages/debate-round/test/transcript-extraction-ai.test.ts` and
`packages/debate-round/test/transcript-extraction-client.test.ts`.

## Known gaps

- No audio/video transcription — the AI extraction form above requires an
  already-transcribed speech text (pasted in), not an audio/video
  recording; that transcription step remains open as a further follow-up.
