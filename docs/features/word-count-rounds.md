# Word-Count-Only Speech Format

Lets a debater type each speech of a word-count-limited practice round
against a live word-count readout, and save the round — the "(a) a
submission UI ... that calls `getWordCountStatus` while a debater types and
reads/writes through the persistence store" follow-up named under idea #2
("Word-Count-Only Speech Format") in `TODO.md`'s Product Feature Ideas list.

- **Route:** `/word-count`
- **Nav:** the global dock's Settings menu → **Word-Count Speeches**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to pick a round ID and a `debate-timer` word-count style (currently
just "Public Forum (Word Count)"), then one text area per speech in that
style. Each speech shows a live badge — current word count against its
limit, and how many words remain (or how many it's over) — recomputed on
every keystroke via `debate-timer`'s `getWordCountStatus`. Saving calls
`saveWordCountRound`, storing only the speeches with non-empty text.

Below the form, every persisted round renders as its own card (sorted by
`roundId`), each submitted speech's word count recomputed via
`getWordCountRoundStatuses`, with a "Clear" action.

Each speech's textarea also has a "🎤 Record"/"Stop recording" button
(hidden, with a muted explanatory note instead, in a browser without
`SpeechRecognition` support) that dictates directly into that speech's
draft text via the browser's own Web Speech API — the same
`round/microphone-transcription.ts`/`hooks/useMicrophoneTranscription.ts`
wiring used by the Speech Transcript Summaries and Video-Lecture-Training
Coach AI panels. Only one speech dictates at a time; starting a new
speech's recording is disabled while another is still listening.

## Data flow

```
debate-timer/src/formats/word-count-format.ts
  → getWordCountStatus(text, wordLimit)   — live status while typing

state/wordCountRounds.ts (localStorage: wordCountRounds)
  → buildWordCountRoundsPanelView()   — sorts every persisted
                                         WordCountRoundRecord by roundId
  → panels/WordCountRoundsPanel.tsx   — renders the submission form and
                                         every persisted round
  → apps/debate-ai.com/app/word-count/page.tsx  — mounts the panel as a route

Saving a round:
panels/WordCountRoundsPanel.tsx
  → saveWordCountRound({ roundId, styleKey, submittedSpeeches })
  → panel re-reads buildWordCountRoundsPanelView() to refresh

Clearing a round:
panels/WordCountRoundsPanel.tsx
  → deleteWordCountRound(roundId)
  → panel re-reads buildWordCountRoundsPanelView() to refresh
```

Every word-count and persistence rule already existed and was
Vitest-covered; this feature closes follow-up (a) on the "Word-Count-Only
Speech Format" bullet, adding one small helper to `state/wordCountRounds.ts`
— `buildWordCountRoundsPanelView`, which sorts `listWordCountRounds`'s
output for a stable panel display order — rather than introducing new
word-count logic. Vitest-covered in
`packages/debate-round/test/wordCountRounds.test.ts`.

## Word-limit mode in the live round

The same round can also be run under a word limit inside the flow page
(`/debate`) instead of on this standalone form — the "(b) extending
`useTimerState`/`SpeechTimer` to support a non-timed, word-limited speech
mode in the live round timer itself" follow-up under the same idea.

Each speech header bar shows a **Type** toggle (next to the countdown) when a
flow has a round. Turning it on replaces that speech's countdown with a
`SpeechWordCounter`: a compact `words / limit` readout that opens a popover
holding the speech text, its remaining-words figure, and a fill bar. The
readout turns yellow at 90% of the limit and red once over it. Toggling it
off restores the countdown; the choice persists in localStorage
(`wordLimitModeEnabled`).

Where the limit comes from:

1. the `wordCountStyles` entry whose speech name matches the live column
   (case-insensitively), e.g. `AC` → 600 words; otherwise
2. `estimateWordLimit(minutes)` applied to the live timed style's speech
   length, so word-limit mode works for every debate style rather than only
   the authored word-count ones.

If neither source resolves a limit, the countdown stays in place rather than
showing an empty meter.

Text typed here is persisted through the **same** `wordCountRounds` store the
form uses — keyed by the flow's `roundId`, with untouched speeches dropped —
so a round typed in the live header bar appears on `/word-count` and a round
saved there loads back into the header bar.

```
hooks/useWordCountSpeechMode.ts        — React state + persistence timing
  → round/word-count-speech-mode.ts    — resolveSpeechWordLimit,
                                          getSpeechWordCountStatus,
                                          load/persistWordCountSpeechMode
  → state/wordCountRounds.ts           — same localStorage key as the form
  → debate-timer SpeechWordCounter     — the meter itself
  → layout/SpeechHeaderBar.tsx         — toggle + swap for SpeechTimer
```

Vitest-covered in
`packages/debate-round/test/word-count-speech-mode.test.ts` (limit
resolution, mode state, live status, and the store round-trip).

## Known gaps

- ~~The compact ticking timer in `FlowPageHeader` (mobile header) still shows
  the countdown only~~ `FlowPageHeader.tsx` is dead code — it is not
  imported or rendered anywhere in the app. `SpeechHeaderBar` is the
  component actually used for both desktop and mobile layouts (via its
  `onMobileMenuClick` prop, wired in `DebateRoundPanel.tsx` whenever
  `state.isMobile`), and it already renders the word-limit toggle and
  `SpeechWordCounter` in every layout mode. No further follow-up is needed
  here.
- Microphone dictation now feeds the word counter on the standalone
  `/word-count` form (see "What it shows" above). The live in-round
  word-limit popover — `debate-timer`'s `SpeechWordCounter`, opened from
  `SpeechHeaderBar`'s meter — is a separate component in a different
  package and still has no dictation button; its speech text is typed or
  pasted only.
