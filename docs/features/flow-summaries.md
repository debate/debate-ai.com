# Speech Transcript Summaries

Shows every persisted "Speech Transcript Summaries and Answers" flow
summary, one card per round — a concise per-argument summary of that
round's flow, plus suggested cross-examination questions and extension
ideas for anything still unanswered — with a "Clear" action per round.
A "Generate from raw speech text" form lets AI derive a round's summary
directly from a pasted transcript instead of a manually flowed grid.

- **Route:** `/summaries`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t summaries` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

Each persisted `FlowSummaryRecord` (keyed by `roundId`) renders as its own
card, sorted by `roundId` for a stable order. Inside a card:

- The round's per-argument summary text — one line per non-heading
  argument, noting where it was introduced and flagging anything unanswered
  since a later speech.
- If any argument is currently unanswered, two suggestion lists built from
  that round's unanswered rows: cross-examination questions to press the
  point live, and extension ideas to frame it as dropped/conceded — ranked
  strongest opportunity first (see "Ranking by strength" below), each item
  tagged with its rank and, when recorded, the underlying row's
  `evidenceStatus`.

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

Dictating the transcript text instead of pasting/typing it:
panels/FlowSummariesPanel.tsx — "🎤 Record" button
  → useMicrophoneTranscription()         — hooks/useMicrophoneTranscription.ts
      → browser SpeechRecognition/webkitSpeechRecognition API
      → onSegment(finalizedText)         — for each finalized dictated segment
  → appendDictatedSegment()              — round/microphone-transcription.ts
                                            joins the segment onto the
                                            textarea's current value
  → (unchanged) "Extract with AI" reads the same extractTranscriptText state
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

A further slice closes the "recording" half of follow-up (a) — this repo has
no server-side/paid transcription service, so instead a "🎤 Record" button
next to the Transcript text field uses the browser's own Web Speech API
(`SpeechRecognition`/`webkitSpeechRecognition`) to dictate directly into the
same field the AI extraction above reads:
`round/microphone-transcription.ts` (feature detection via
`isMicrophoneTranscriptionSupported`, `appendDictatedSegment` for
joining dictated segments onto existing text, and
`describeMicrophoneTranscriptionError` for readable recognition errors) and
`hooks/useMicrophoneTranscription.ts` (the actual `SpeechRecognition`
instance, wired to the panel's `extractTranscriptText` state). A browser
without support (no `SpeechRecognition`/`webkitSpeechRecognition`
constructor) shows a disabled explanatory message in place of the button
instead of a silent no-op. No follow-ups remain open on this idea's
"Speech Transcript Summaries and Answers" text-extraction path.
Vitest-covered in
`packages/debate-round/test/microphone-transcription.test.ts` (feature
detection with/without a prefixed constructor and for an SSR/`undefined`
host, dictated-segment joining including whitespace edge cases, and every
known/unknown recognition error code). The React hook itself
(`hooks/useMicrophoneTranscription.ts`) is not directly unit-tested, matching
every other browser-API hook in this repo (e.g.
`debate-timer/src/hooks/useSpeechRecorder.ts`) — there is no jsdom
environment in this repo's Vitest setup.

## Ranking by strength

Closes idea #6's ("Speech Transcript Summaries and Answers") "rank
suggested cross-exam questions/extension ideas by strength rather than a
flat list" follow-up. Previously both lists rendered in flow order (the
order arguments happen to appear in the flow); now they render strongest
opportunity first:

```
panels/FlowSummariesPanel.tsx
  → rankUnansweredRowsByStrength(rows)   — flow/flow-transcript-summary.ts
      filters to unanswered rows and orders them by computeRowStrength(row)
      descending, ties broken by original order (stable sort)
  → suggestCrossExamQuestions(ranked)    — unchanged; maps 1:1 over its
  → suggestExtensionIdeas(ranked)          input, so passing already-ranked
                                            rows makes its output ranked too
```

`computeRowStrength` scores a row primarily by its recorded
`evidenceStatus` (`cited` &gt; `contested` &gt; `unverified`/unset), with the
argument thread's depth (`entries.length` — how many speeches have already
engaged it) as a tiebreaker within the same evidence tier: a well-cited
argument dropped now costs the other side more than a shakier one, and a
longer-running thread dropped now reads as a clearer concession than a
one-off point. `suggestCrossExamQuestions`/`suggestExtensionIdeas`
themselves are unchanged — they still just map over whatever rows they're
given — so `flow/drill-generator.ts`'s `buildCrossExamDrills`, which relies
on its input rows staying in the same order as its output prompts, is
unaffected.

Vitest-covered in `packages/debate-round/test/flow-transcript-summary.test.ts`
(evidence-tier ordering, the thread-depth tiebreaker, evidence tier always
outranking thread depth, excluding answered rows, stable-order ties, and
the ranked-input integration with `suggestCrossExamQuestions`/
`suggestExtensionIdeas`).

## Known gaps

- Microphone dictation transcribes live speech only — it does not accept an
  already-recorded audio/video file upload. Idea #8's ("Video-Lecture-Training
  Coach AI") identical "recording" follow-up is a separate, still-open gap in
  `docs/features/coach-materials.md`.
