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

Generating a summary from raw speech text (no manually flowed grid needed;
one or more speech/transcript entries at once):
panels/FlowSummariesPanel.tsx — "Generate from raw speech text" form
  → extractTranscriptsBulk(entries, startIndex, requestTranscriptExtraction)
                                          — round/bulk-transcript-extraction.ts
      → requestTranscriptExtraction()    — round/transcript-extraction-client.ts
                                            (once per entry, sequentially)
          → POST /api/reason-ai          — server-side Anthropic proxy
          → parseTranscriptExtractionAiResponse()  — round/transcript-extraction-ai.ts
                                            parses claim/warrant/impact/
                                            evidence per argument
      → buildFlowRowSummariesFromExtraction()  — round/transcript-extraction-ai.ts
                                              turns each entry's extracted
                                              arguments into synthetic
                                              FlowRowSummary rows (each
                                              isUnanswered: true), rowIndex
                                              continuing across entries
      → tracks each entry's outcome ("extracted"/"error") independently, so
        one failed speech doesn't drop the rest
  → saveFlowSummary()                    — state/flowSummaries.ts appends
                                            every successfully extracted row
                                            across the whole batch to that
                                            round's record in one call
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

## Bulk transcript upload

Closes idea #6's ("Speech Transcript Summaries and Answers") "Bulk
transcript upload (multiple speeches at once) instead of one at a time"
follow-up. Previously the "Generate from raw speech text" form only accepted
one speech label plus one transcript per "Extract with AI" click; now the
form manages a list of speech/transcript entries (starting with one,
extendable via "+ Add another speech", each independently removable once
there's more than one) all submitted together under one shared Round ID:

```
round/bulk-transcript-extraction.ts
  extractTranscriptsBulk(entries, startIndex, extract)
    — runs `extract` (requestTranscriptExtraction, in production; an
      injected stub in tests) over each entry in turn, sequentially — not
      Promise.all, since each entry's successful row count must be known
      before computing the next entry's rowIndex offset
    — tracks a per-entry "extracted" | "error" outcome, keyed by the
      entry's index in the submitted list, so one entry's failure doesn't
      stop the rest from running or being included in the result
    — returns { rows, outcomes, errors }: every successfully extracted row
      across the whole batch (rowIndex continuing past startIndex across
      entries), the per-entry outcome map, and a per-entry error message
      for any "error" entries
  summarizeBulkTranscriptOutcomes(outcomes)
    — reduces the outcome map into { extractedCount, errorCount } for the
      panel's single combined status/error message, mirroring
      state/bulkRoundSave.ts's BulkSaveOutcome/summarizeBulkSaveOutcomes
```

The panel calls `extractTranscriptsBulk` once per "Extract with AI" click
with every non-blank entry (blank speech/transcript pairs are silently
dropped rather than erroring), then makes exactly one `saveFlowSummary` call
appending all newly extracted rows from the whole batch — not one save per
entry — so a round's flow summary is written once regardless of how many
speeches were submitted together. Microphone dictation (the "🎤 Record"
button) now targets whichever entry's Record button was last clicked, tracked
via `dictationTargetIndex`, since each entry has its own independent
transcript textarea.

Vitest-covered in
`packages/debate-round/test/bulk-transcript-extraction.test.ts`: an empty
entry list short-circuits without calling `extract`; a single entry builds
rows starting at `startIndex`; `rowIndex` continues correctly across
multiple successful entries in submission order; a failed entry's error is
recorded without stopping the remaining entries from running or contributing
rows; a non-`Error` rejection is stringified for the error message; an
all-failing batch contributes no rows; and `summarizeBulkTranscriptOutcomes`
counts an empty map, a mixed map, and an all-error map correctly.

## Sending a summary to Prep Notes

Closes idea #6's ("Speech Transcript Summaries and Answers") "a one-click
'send to Prep Notes / Speech Document' action for a summary" follow-up (the
Prep Notes half — see this section's last paragraph for the Speech Document
half's status). Each round card has a "Send to Prep Notes" button that opens
a small "Your name" form; submitting it sends that round's rendered summary
text (the same text shown in the `<pre>` block above the cross-exam/extension
lists) to Prep Notes as one note, replacing the button with a "✓ Sent to Prep
Notes" badge.

`PrepNote` (`debate-round`'s `flow/strategy-sync-notes.ts`) previously
required a `flowId`/`boxPath` a `FlowSummaryRecord` doesn't have — this
slice's data-model change was extending it into a discriminated union of a
`BoxAnchoredPrepNote` (the original shape) and a new `RoundAnchoredPrepNote`
(`roundId` instead of `flowId`/`boxPath`), so a note can attach to a round as
a whole instead of one specific flow argument:

```
flow/strategy-sync-notes.ts
  isBoxAnchoredPrepNote(note) / isRoundAnchoredPrepNote(note)
    — type-guards distinguishing the two PrepNote variants
  createRoundPrepNote({ id, roundId, authorId, text, createdAt, assignedToId? })
    — mirrors createPrepNote's validation (non-blank roundId/authorId/text,
      text trimmed and clamped to MAX_NOTE_LENGTH) for the round-anchored shape
  getNotesForRound(notes, roundId)
    — round-anchored notes for one round, oldest first (getNotesForBox/
      getNotesForFlow now only ever match box-anchored notes)
  resolvePrepNoteBox(flow, note) / buildPrepNoteJumpHref(note)
    — resolvePrepNoteBox returns null for a round-anchored note (no box to
      resolve); buildPrepNoteJumpHref's signature is narrowed to
      BoxAnchoredPrepNote, so a caller must isBoxAnchoredPrepNote(note) first
state/prepNotes.ts (debate-team-collaboration)
  listPrepNotesForRound(roundId) / addRoundPrepNote({ roundId, authorId, text })
    — the persisted-store counterparts, mirroring listPrepNotesForBox/
      listPrepNotesForFlow and the createPrepNote+savePrepNote pattern
```

`PrepNotesPanel` renders a "Round `<roundId>`" badge instead of a "Jump to
argument" link for a round-anchored note, since there's no specific box to
jump to.

`FlowSummariesPanel` itself has no dependency on `debate-team-collaboration`
(where the `PrepNote` store lives) and doesn't gain one for this — it only
exposes an optional `onSendToPrepNotes` prop (hiding the action entirely when
omitted). `apps/debate-ai.com/app/summaries/FlowSummariesPanelWithPrepNotes.tsx`
is the app/page-layer wrapper that resolves the composition (calling
`addRoundPrepNote` on submit), mirroring
`app/coaching-programs/CoachingProgramRosterAnalyticsWithDrills.tsx`'s own
cross-package split; `app/summaries/page.tsx` renders that wrapper instead of
`FlowSummariesPanel` directly.

Vitest-covered in `packages/debate-round/test/strategy-sync-notes.test.ts`
(`createRoundPrepNote`'s valid/blank-`roundId`/blank-`authorId`/blank-text/
overlong-text cases, `isBoxAnchoredPrepNote`/`isRoundAnchoredPrepNote`,
`getNotesForRound`, and that `getNotesForBox`/`getNotesForFlow` exclude
round-anchored notes while `resolvePrepNoteBox` returns null for one) and
`packages/debate-team-collaboration/test/prepNotes.test.ts`
(`listPrepNotesForRound`, `addRoundPrepNote` persisting and returning a note,
generating a distinct id per note, and throwing without persisting anything
for blank text).

The Speech Document half of the original follow-up remains unbuilt: the only
existing "speech document" send target (`reason-editor`'s `SpeechDocument`)
lives in a package `debate-round`/`debate-practice-rounds` don't depend on,
so sending a summary there would need its own bridge — not attempted here.

## Known gaps

- Microphone dictation transcribes live speech only — it does not accept an
  already-recorded audio/video file upload. Idea #8's ("Video-Lecture-Training
  Coach AI") identical "recording" follow-up is a separate, still-open gap in
  `docs/features/coach-materials.md`.
