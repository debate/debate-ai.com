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

## Known gaps

- Follow-up (b), extending `useTimerState`/`SpeechTimer` to support a
  non-timed, word-limited speech mode in the live round timer itself
  (rather than this standalone submission form), remains open — not
  started.
