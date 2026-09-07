# Word-Count-Only Speech Format

Lets a debater type each speech of a word-count-limited practice round
against a live word-count readout, and save the round — the "(a) a
submission UI ... that calls `getWordCountStatus` while a debater types and
reads/writes through the persistence store" follow-up named under idea #2
("Word-Count-Only Speech Format") in `TODO.md`'s Product Feature Ideas list.

- **Route:** `/word-count`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t word-count` in Ctrl/Cmd-Shift-Space's command palette)
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
  → useWordCountRounds().saveRound({ roundId, styleKey, submittedSpeeches })
  → saveWordCountRound(...) (local) + best-effort saveWordCountRoundToAccount(...)

Clearing a round:
panels/WordCountRoundsPanel.tsx
  → useWordCountRounds().deleteRound(roundId)
  → deleteWordCountRound(roundId) (local) + best-effort deleteSavedWordCountRoundFromAccount(roundId)

Clearing all synced history:
panels/WordCountRoundsPanel.tsx
  → useWordCountRounds().clearAllRounds()
  → clearWordCountRounds() (local) + best-effort deleteAllSavedWordCountRoundsFromAccount()
```

See "Account-synced round history" below for `useWordCountRounds`'s local-first
merge/sync behavior.

Every word-count and persistence rule already existed and was
Vitest-covered; this feature closes follow-up (a) on the "Word-Count-Only
Speech Format" bullet, adding one small helper to `state/wordCountRounds.ts`
— `buildWordCountRoundsPanelView`, which sorts `listWordCountRounds`'s
output for a stable panel display order — rather than introducing new
word-count logic. Vitest-covered in
`packages/debate-round/test/wordCountRounds.test.ts`.

## Custom word-limit presets

TODO.md idea #2's "a per-style word-limit preset manager (add/edit/remove
custom limits instead of only the built-in registry)" follow-up. Before this,
every word-limited speech's limit came only from `debate-timer`'s single
hardcoded "Public Forum (Word Count)" style or an estimate — there was no way
for a user to set their own limit for a speech.

**Manage presets:** the **Word limit presets** section on `/settings`
(`WordLimitPresetsPanel`) — add a speech name (e.g. `AC`, `1AR`, or any label
used elsewhere) and a word limit, edit an existing preset's limit inline, or
remove one. Local-first (works fully signed out, synced to `localStorage`
under `word-limit-presets`) and best-effort synced to the account through the
same `/api/settings` route (`wordLimitPresets` field) every other setting
uses, so presets follow a signed-in user across devices — mirrors
`FavoriteToolsSettings`/`useFavoriteTools`'s split for the same reason
(`hooks/useWordLimitPresets.ts`).

**Where it applies:** the standalone `/word-count` form
(`WordCountRoundsPanel`, including its persisted-round list) resolves a
speech's limit via `getWordCountRoundStatuses`, which checks a matching
preset (`findPresetWordLimit`, by name, case-insensitively) before falling
back to the style's authored `wordLimit`.

A preset's name is matched exactly (case-insensitively) against the live or
authored speech name; it does not scope to one word-count style, so a preset
named `AC` applies to every style whose speech list includes an `AC` entry.

```
state/wordLimitPresets.ts        — validation, (de)serialization, findPresetWordLimit
hooks/useWordLimitPresets.ts     — localStorage-first state + account sync
panels/WordLimitPresetsPanel.tsx — add/edit/remove UI, rendered on /settings
state/wordCountRounds.ts         — getWordCountRoundStatuses checks presets first
panels/WordCountRoundsPanel.tsx  — passes presets through
```

Vitest-covered in `packages/debate-round/test/wordLimitPresets.test.ts`
(validation, serialization, and lookup) plus preset-priority cases added to
`word-count-speech-mode.test.ts` and `wordCountRounds.test.ts`.
`WordLimitPresetsPanel`/`useWordLimitPresets` themselves are untested,
matching this package's existing convention for account-synced,
`localStorage`-backed hooks and their settings-page UI (e.g.
`useFavoriteTools`/`FavoriteToolsSettings`).

## Word-count trend view

TODO.md idea #2's "a trend view showing a debater's word-count-vs-limit
history across past submissions" follow-up. Before this, a round's word
counts were only visible per-round, in the persisted-round list on
`/word-count` — there was no view across rounds over time.

`WordCountRoundRecord` now carries an optional `createdAt` timestamp,
stamped automatically by `saveWordCountRound` the first time a `roundId` is
saved and preserved across later updates to that same `roundId` (both save
sites — the standalone form and the live in-round meter, since both call
`saveWordCountRound` — get this for free). A record persisted before this
field existed has no `createdAt` and is excluded from the trend view rather
than sorted arbitrarily.

`buildWordCountTrendData(presets)` (`state/wordCountRounds.ts`) flattens
every persisted round's submitted speeches into a single list sorted by
`createdAt`, recomputing each entry's word count/limit/over-limit status the
same way `getWordCountRoundStatuses` does (so it never goes stale if a
format's limits or a user's presets change later, and honors a matching
custom preset the same way).

**Where it shows:** a "Word-count trend" section on `/word-count`, below the
persisted-round list (`WordCountRoundsPanel`) — a chronological bar-per-
submission list (mirroring `VulnerabilityChartsPanel`'s hand-rolled div/CSS
bar chart, `packages/debate-round/src/panels/VulnerabilityChartsPanel.tsx`,
rather than a charting library), with a per-speech-name filter dropdown once
more than one speech name has history.

```
state/wordCountRounds.ts        — createdAt stamping, buildWordCountTrendData
panels/WordCountRoundsPanel.tsx — "Word-count trend" section + speech filter
```

Vitest-covered in `packages/debate-round/test/wordCountRounds.test.ts`
(`createdAt` stamping/preservation, and `buildWordCountTrendData`'s
chronological ordering, legacy-record exclusion, style-mismatch skip, and
preset-priority cases).

## Account-synced round history

TODO.md idea #2's "account-sync round history itself (today `wordCountRounds`
is local-storage-only, unlike `wordLimitPresets`), so the trend view follows a
signed-in user across devices instead of staying per-browser" follow-up.
Before this, `wordCountRounds` (and therefore the trend view above) never left
the browser it was saved in.

**Storage:** a new `saved_word_count_rounds` D1 table — one row per
`(user, roundId)` pair, `data` holding the whole `WordCountRoundRecord`
JSON-stringified (migration `0015_magenta_microbe.sql`). Unlike `saved_flows`/
`saved_rounds` (whose list route returns only a derived label, with a
per-item route for the full blob), a word-count round's payload is small
enough that `GET /api/word-count-rounds` returns every record in full, so
there's no separate summary/detail split.

**Sync model:** local-first, like `wordLimitPresets`, but merged by `roundId`
rather than replaced as a whole list — round history is an unboundedly
growing, independently-addressable set of records (closer to `saved_flows`/
`saved_rounds`), not a small bounded settings list. `useWordCountRounds`
(`hooks/useWordCountRounds.ts`) is `WordCountRoundsPanel`'s sole entry point
into `state/wordCountRounds.ts` now:

- On mount, a one-time account merge (deduped across instances via a
  module-level promise, mirroring `useWordLimitPresets`) reconciles local and
  remote history: a remote record with no local counterpart is adopted
  locally via `adoptWordCountRound` — preserving its original `createdAt` so
  the trend view still sorts it correctly, unlike `saveWordCountRound`'s
  fresh-stamp-on-first-save behavior — and a local-only record (saved before
  this feature existed, or offline) is best-effort pushed to the account.
- A `roundId` present on **both** sides is resolved rather than skipped —
  TODO.md idea #2's "resolving a same-`roundId` conflict between two
  devices instead of only filling gaps" follow-up. Every `saveWordCountRound`
  call now also stamps `updatedAt` (refreshed on every save, unlike the
  once-only `createdAt`), and the pure
  `resolveWordCountRoundConflict(local, remote)` in `state/wordCountRounds.ts`
  compares the two sides' `updatedAt`: the newer copy wins — adopted locally
  via `adoptWordCountRound` if remote is newer, or best-effort re-pushed to
  the account via `saveWordCountRoundToAccount` if local is newer. A record
  with no `updatedAt` (saved before this field existed) always loses to one
  that has it. If neither side has a usable timestamp — both missing, or
  exactly equal — the merge leaves both sides untouched, the same
  conservative default this hook used before conflict resolution existed,
  rather than guessing which is "right."
- `saveRound`/`deleteRound` apply locally first (so saving/clearing a round
  is never blocked by the network), then best-effort sync the same change to
  the account when signed in.
- `clearAllRounds` — the "delete all my synced history" bulk action (a
  fresh next-step named in TODO.md's idea #2 entry once its other
  follow-ups closed) — clears every locally persisted round in one write
  (`clearWordCountRounds`, returning the removed `roundId`s) and, when
  signed in, best-effort issues a single `DELETE /api/word-count-rounds`
  against the whole collection rather than one request per round. This is a
  deliberate deviation from `useJudgeDecisions`'s `deleteRoundHistory`
  (which loops individual per-id `DELETE`s against the account, since a
  round's decisions aren't a single row) — a word-count round's account
  rows are already one-per-`roundId`, so a whole-collection `DELETE` on
  `/api/word-count-rounds` — scoped to `eq(userId)`, no `clientId` filter —
  clears them all in one round trip instead of N.

**Where it shows:** the same hint text pattern as `WordLimitPresetsPanel`'s
"N custom word limits applied" line — `WordCountRoundsPanel` now shows
"Round history ... is synced to your account" once signed in, or a prompt to
sign in otherwise.

**"Synced from another device" notice:** TODO.md idea #2's own next-named
follow-up ("surfacing a 'synced just now from another device' toast when the
merge actually adopts a remote copy"). The merge decision itself is now the
pure, directly-tested `planWordCountRoundMerge(localRecords, remoteRecords)`
in `state/wordCountRounds.ts` (`useWordCountRounds`'s `ensureRemoteMerged`
applies its `adopt`/`pushLocal` lists rather than deciding inline). Whenever
`adopt` is non-empty — a `roundId` new to this device, or an existing one
where the remote copy won `resolveWordCountRoundConflict` — those `roundId`s
are surfaced as `justSyncedRoundIds` from the hook, and
`WordCountRoundsPanel` renders a dismissible banner
(`buildWordCountSyncNoticeMessage`, e.g. "🔄 Synced round round-1 from
another device.") above the submission form. A module-level
`consumeSyncNotice` hands the pending notice to exactly one hook instance so
a later mount that awaits the same already-resolved merge doesn't re-show
it; dismissing it (or navigating away and back) doesn't re-trigger another
account fetch — the notice only ever appears once per merge, not once per
panel visit.

```
lib/database/schema.ts (apps/debate-ai.com)     — saved_word_count_rounds table
app/api/word-count-rounds/route.ts              — GET: list; DELETE: clear every synced record
app/api/word-count-rounds/[roundId]/route.ts    — PUT/DELETE: upsert/remove one record
state/savedWordCountRounds.ts                   — isValidWordCountRoundRecord, size cap
round/word-count-rounds-client.ts               — fetch wrapper (list/save/delete/delete-all)
state/wordCountRounds.ts                        — adoptWordCountRound (preserves createdAt), clearWordCountRounds, planWordCountRoundMerge, buildWordCountSyncNoticeMessage
hooks/useWordCountRounds.ts                     — local-first merge + sync, clearAllRounds, justSyncedRoundIds/dismissSyncNotice
panels/WordCountRoundsPanel.tsx                 — uses saveRound/deleteRound/clearAllRounds, renders the sync notice banner
```

Vitest-covered: `adoptWordCountRound`'s createdAt-preserving/overwrite
behavior, `clearWordCountRounds`'s remove-everything/no-op behavior,
`resolveWordCountRoundConflict`'s newer-wins/missing-timestamp/tie cases,
`planWordCountRoundMerge`'s adopt/push decisions (new-to-either-side and
same-`roundId` conflicts alike), and `buildWordCountSyncNoticeMessage`'s
empty/singular/plural phrasing, all in `wordCountRounds.test.ts`;
`isValidWordCountRoundRecord` (including `updatedAt`) in
`savedWordCountRounds.test.ts`; the fetch wrapper's request shapes and
401/error handling, including `deleteAllSavedWordCountRoundsFromAccount`, in
`word-count-rounds-client.test.ts`. `useWordCountRounds` and its wiring in
`WordCountRoundsPanel` are untested, matching this package's existing
convention for account-synced, `localStorage`-backed hooks and their UI
(e.g. `useWordLimitPresets`) — the merge loop's decision-making itself is
covered indirectly via `planWordCountRoundMerge`/`resolveWordCountRoundConflict`'s
direct unit tests.

## Known gaps

- ~~The compact ticking timer in `FlowPageHeader` (mobile header) still shows
  the countdown only~~ `FlowPageHeader.tsx` is dead code — it is not
  imported or rendered anywhere in the app. `SpeechHeaderBar` is the
  component actually used for both desktop and mobile layouts (via its
  `onMobileMenuClick` prop, wired in `DebateRoundPanel.tsx` whenever
  `state.isMobile`), and it already renders the word-limit toggle and
  `SpeechWordCounter` in every layout mode. No further follow-up is needed
  here.
- ~~Microphone dictation now feeds the word counter on the standalone
  `/word-count` form ... The live in-round word-limit popover ...
  still has no dictation button~~ `debate-timer`'s `SpeechWordCounter` (the
  live in-round popover, opened from `SpeechHeaderBar`'s meter) now has the
  same "🎤 Record" button too (see "Word-limit mode in the live round"
  above), via a `debate-timer`-local copy of the dictation wiring. Both
  halves of this gap are closed; there is no remaining gap tracked here.
