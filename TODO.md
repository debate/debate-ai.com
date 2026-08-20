
## Tracker Status

### In progress

_No task currently in progress._

### Completed
- **Flow-in-Speech Flow Annotations / Shared, Ai-Generated Debate Flow —
  cross-tab live update for FlowSpreadsheet's annotation/edit/prep-note
  badges.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): both `docs/features/flow-annotations.md`
  and `docs/features/shared-flow-sync.md` documented the same gap — the
  `FlowSpreadsheet` grid's `AnnotationBadge`/`EditBadge` (and, incidentally,
  `PrepNoteBadge`) read straight from `localStorage` at cell-render time and
  never live-update if a *different browser tab* logs a new annotation,
  edit, or prep note while the grid is open; only the same-tab,
  logged-through-its-own-popover case (the prior "force-refresh FlowSpreadsheet
  EditBadge after logging via popover" run, PR #270) was fixed. This closes
  that cross-tab half: a new pure helper,
  `packages/debate-round/src/flow/live-update.ts`'s
  `isFlowLiveUpdateStorageEvent`, recognizes the browser's `storage`
  event — which the spec fires only in *other* same-origin tabs, never the
  tab that made the write — for the three badge-backing `localStorage` keys
  (`flowAnnotations`, `flowEdits`, `prepNotes`), plus the `null`-key
  `localStorage.clear()` case. `FlowSpreadsheet.tsx` now subscribes to that
  event and calls `gridRef.current.api.refreshCells({ force: true })` across
  the whole grid when it fires (a cross-tab event carries no row/column to
  target the way the existing same-tab refresh does). This is additive only:
  it doesn't change what any badge shows, only how promptly a *different*
  open tab picks up someone else's change; it still doesn't help a different
  device/browser see the edit (that's what the existing, separate Live Sync
  server transport is for).
  Vitest-covered (4 new cases in
  `packages/debate-round/test/live-update.test.ts`: every backing-store key
  recognized, the `null`-key clear-all case, an unrelated store's key
  ignored, and a key that merely contains a badge-store name as a substring
  also ignored).
  Documented in `docs/features/shared-flow-sync.md` (new "Cross-tab live
  update" data-flow section) and `docs/features/flow-annotations.md` (both
  files' "Known gaps" cross-tab bullets closed and cross-referenced to each
  other).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (158 files / 2253 tests, all pass — 4 new cases), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including `/debate`) all pass.
  PR: [#276](https://github.com/debate/debate-ai.com/pull/276).
- **Shared Evidence Library — tag rename/merge tool.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/evidence-library.md`'s
  Known gaps said there was "No tag rename/merge tool — the Tags field's
  autocomplete only suggests reusing an existing tag while typing; renaming
  or merging a tag already applied to existing entries would mean rewriting
  every entry that carries it, and isn't implemented." This adds exactly
  that: two new pure helpers in `packages/debate-card-search/src/lib/argument-library.ts`,
  `renameTagInList` (rewrites a single card's tag list, deduping if the
  target tag is already present) and `renameTagAcrossCards` (applies it
  across a `LibraryCard[]`, returning each unaffected card as the exact same
  object reference and throwing on a blank or identical old/new tag), plus a
  persisted `renameTagAcrossPersistedEntries` in
  `state/evidenceLibraryEntries.ts` that applies the rewrite to the real
  evidence repository and writes back only when something actually changed.
  `panels/ArgumentLibraryPanel.tsx` (`/cards/argument-library`, where the
  tag collections themselves are browsable) gets a new "Rename/merge tag"
  form: a dropdown of existing tags plus a new-name field, showing how many
  entries changed (or that nothing did) after each rename. Renaming into an
  already-used tag name merges the two rather than erroring or duplicating.
  This only rewrites the evidence-library repository's own entries — a
  Contributions Feed submission's tags are a separate store/form and are
  left untouched, as documented in the panel's own copy and in
  `docs/features/evidence-library.md`.
  Vitest-covered (8 new cases in
  `packages/debate-card-search/test/argument-library.test.ts`:
  `renameTagInList` for replace/unchanged-reference/dedupe-merge, and
  `renameTagAcrossCards` for a multi-card rename leaving an unrelated card
  untouched by reference, merging into an existing tag, a true no-op when
  the tag is unused anywhere, and throwing on a blank old tag, a blank new
  tag, and identical old/new tags; 4 new cases in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`:
  `renameTagAcrossPersistedEntries` for rewrite-and-persist, merge, a true
  no-write no-op verified against the raw `localStorage` string, and
  throwing on a blank new tag).
  Documented in `docs/features/evidence-library.md` (new "Tag rename/merge"
  data-flow section; Known gaps' "No tag rename/merge tool" bullet closed
  and replaced with the real remaining scope — Contributions Feed tags
  aren't covered).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (157 files / 2249 tests, all pass — 12 new cases), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including `/cards/argument-library`) all
  pass.
  PR: [#275](https://github.com/debate/debate-ai.com/pull/275).
- **Online Debate Versus AI — "Regenerate last AI speech" affordance.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/ai-versus-rounds.md`'s
  Known gaps said the AI speech-generation call had no retry/regenerate
  action if the generated speech was unsatisfactory — a user had to clear
  the whole round and start over, losing every already-delivered speech
  (the user's own included) along with it. This adds exactly the narrower
  "regenerate affordance" that gap bullet named, without touching any
  existing turn-order, validation, or persistence logic: two new pure
  helpers in `packages/debate-round/src/state/aiVersusRounds.ts`,
  `canRegenerateLastAiSpeech` (true only when a round's most recently
  submitted speech was the AI's) and `replaceLastAiSpeech` (returns a copy
  of the round record with that last speech's text swapped in place —
  keeping its slot name/speaker and every earlier speech, including any of
  the user's, untouched — throwing if the last speech wasn't the AI's).
  `panels/AiVersusRoundPanel.tsx` wires a new "Regenerate last AI speech"
  button that appears whenever `canRegenerateLastAiSpeech` is true
  (regardless of whose turn is next, including after the round is
  complete): it rebuilds the exact same `AiSpeechRequest` that
  `buildAiResponseRequest` produced when that speech was first generated
  (by passing `submittedCount - 1` and the speeches delivered before it,
  so the regeneration responds to the same context the original call did,
  carrying no memory of the text it's replacing), calls the existing
  `requestAiVersusSpeech`/`requestAiVersusSpeechWithPersona` client exactly
  as "Generate AI speech" does, and saves the result through
  `replaceLastAiSpeech`. The "Generate AI speech" and "Regenerate" buttons
  now disable each other while either request is in flight.
  Vitest-covered (6 new cases in
  `packages/debate-round/test/aiVersusRounds.test.ts`: `canRegenerateLastAiSpeech`
  for no submitted speeches, a user-authored last speech, and an
  AI-authored last speech; `replaceLastAiSpeech` for the text swap itself,
  non-mutation of the input record, throwing when the last speech isn't
  the AI's, and throwing when there are no submitted speeches yet).
  Documented in `docs/features/ai-versus-rounds.md` (new "Regenerating the
  last AI speech" data-flow section and "What it shows" paragraph; Known
  gaps' "no retry/regenerate action" bullet closed and replaced with the
  real remaining gap — only the most recently submitted speech can be
  regenerated, not an earlier one mid-round, since `submittedSpeeches` is a
  flat, append-only array with no per-slot identity beyond position).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (157 files / 2236 tests, all pass — 6 new cases), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including every existing route, `/versus-ai`
  among them) all pass.
  PR: [#274](https://github.com/debate/debate-ai.com/pull/274).
- **Prep Notes — note-creation UI directly on the live flow.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/prep-notes.md`'s
  Known gaps section said there was "no note-creation UI" — a `PrepNote`
  could only be created programmatically (e.g. in a test), never through
  the app itself; `PrepNotesPanel` only surfaced and updated existing
  notes. Rather than the "future flow-view affordance" that gap bullet
  speculated about, this adds exactly that affordance to the existing
  `FlowSpreadsheet` grid, mirroring the `EditBadge`/`EditReviewPopover`
  pattern already used for `FlowEdit`s: a new `flow/PrepNoteBadge.tsx`
  (always-visible per-cell badge, showing a note count once any exist)
  renders next to the existing annotation/edit badges in both
  `FirstColumnCellRenderer` and `AnnotationCellRenderer`; clicking it opens
  a new `flow/PrepNotePopover.tsx` (lists the box's existing notes, plus an
  "author id" + "text" form) positioned via `FlowSpreadsheet.tsx`'s new
  `handleOpenPrepNote`/`prepNoteBoxNotes`/`handlePrepNoteCreated`, which
  mirror the file's existing edit-review state exactly (including
  force-refreshing just the affected cell via `gridCellForBoxPath` after a
  note is created, so the badge's count updates immediately). Submitting
  the popover's form calls `strategy-sync-notes.ts`'s already-existing
  `createPrepNote` and `state/prepNotes.ts`'s already-existing
  `savePrepNote` directly — no new mutation logic, only a new
  `listPrepNotesForBox(flowId, boxPath)` query helper (wrapping
  `strategy-sync-notes.ts`'s existing `getNotesForBox`) added to
  `state/prepNotes.ts` to feed the badge/popover. A note created this way
  is the same persisted `PrepNote` store `PrepNotesPanel` already reads, so
  it immediately shows up there too, groupable/assignable/cycleable exactly
  like a note created any other way.
  Vitest-covered (6 new cases: 2 in
  `packages/debate-round/test/prepNotes.test.ts` for `listPrepNotesForBox`
  — filtering by exact flow+box path, and an empty-box case; 4 in the new
  `packages/debate-round/test/PrepNoteBadge.test.tsx`, mirroring
  `EditBadge.test.tsx` — the always-rendered zero-notes affordance, the
  badge's title listing every note oldest-first, singular vs. plural
  wording). `PrepNotePopover` itself has no dedicated test file, matching
  this repo's existing convention for `EditReviewPopover` (no test file
  either) — popover components here are verified via the production build
  only. Documented in `docs/features/prep-notes.md` (new "Create a note"
  section; Known gaps' "No note-creation UI" bullet closed and replaced
  with the real remaining gap — the popover's "Author ID" field is
  free-form/unauthenticated, same as every other id field in this
  auth-less repo). Verified from a clean install: `bun install` (2050
  packages), `bun run test` (157 files / 2229 tests, all pass — 6 new
  cases), `bun run typecheck` (11 in-scope packages pass — `debate-ai-web`
  has no `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including every existing route, `/debate`
  and `/prep-notes` among them) all pass.
  PR: [#273](https://github.com/debate/debate-ai.com/pull/273).
- **Prep Notes — "jump to argument" link back to a note's flow box.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/prep-notes.md`'s
  Known gaps section said `PrepNotesPanel` had no "jump to argument" link
  back to the flow box a note is about, since that panel is cross-flow and
  doesn't mount a live `Flow` for `resolvePrepNoteBox` to resolve against.
  Rather than mounting a `Flow` into the cross-flow panel, the link instead
  hands off to `/debate`, which already owns one. Added
  `flow/strategy-sync-notes.ts`'s `buildPrepNoteJumpHref`/
  `parsePrepNoteJumpParams` (a `/debate?flowId=&boxPath=` deep link and its
  tolerant inverse — returns `null` rather than throwing on a
  missing/malformed param) and `flow/edit-cells.ts`'s `jumpToBoxInGrid`
  (scrolls to and flashes a box's AG Grid cell via the existing
  `gridCellForBoxPath`, returning `false` as a no-op if the row isn't in
  the grid's current row model yet). A new
  `hooks/useJumpToPrepNoteBox.ts`, mounted by `DebateFlowPage` alongside
  the existing `useRoundFromSlug`/`useSyncUrlWithRound` URL-sync hooks,
  reads the deep link's `flowId`/`boxPath`, selects the matching flow tab
  by id (`flows.findIndex`, not the store's array-index `selected`), and
  retries `jumpToBoxInGrid` both immediately (grid already mounted) and via
  a new `onFlowGridReady` callback threaded through `FlowMainContent` (for
  a flow whose grid hasn't mounted yet). `PrepNotesPanel.tsx` renders a
  "Jump to argument" link per note using `buildPrepNoteJumpHref`.
  Vitest-covered (10 new cases: 8 in
  `packages/debate-round/test/strategy-sync-notes.test.ts` for
  `buildPrepNoteJumpHref`/`parsePrepNoteJumpParams` — round-tripping,
  single-segment paths, and missing/non-numeric/negative-segment
  malformed-param cases each returning `null`; 2 in
  `packages/debate-round/test/edit-cells.test.ts` for `jumpToBoxInGrid`
  against a fake grid API — a successful scroll+flash, and the no-op
  `false` case when the row isn't found). Documented in
  `docs/features/prep-notes.md` (new "Jump to argument" section; Known
  gaps' "No 'jump to argument' link" bullet closed and replaced with the
  real remaining gap — a stale `boxPath` silently no-ops rather than
  erroring). Verified from a clean install: `bun install` (2050 packages),
  `bun run test` (156 files / 2224 tests, all pass — 10 new cases), `bun
  run typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run
  build:web` (production build, including every existing route,
  `/prep-notes` and `/debate` among them) all pass.
  PR: [#272](https://github.com/debate/debate-ai.com/pull/272).
- **Shared Evidence Library — true incremental search-index updates instead
  of a full rebuild on every cache invalidation.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/evidence-library.md`'s
  Known gaps section said `state/evidenceLibraryEntries.ts`'s cached
  `EvidenceSearchIndex` still fell back to a full
  `buildEvidenceSearchIndex` re-tokenize-everything pass over every live
  entry whenever its cache-invalidation fingerprint changed, even when a
  write only actually touched one entry. Added
  `lib/evidence-search-index.ts`'s `addEntryToIndex`/`removeEntryFromIndex`/
  `updateEntryInIndex`, each mutating an `EvidenceSearchIndex` in place and
  touching only the postings lists the affected entry itself contributes to
  (tracked per-entry via a new `entryTermsById` map on the index, so
  `removeEntryFromIndex` never has to scan the full vocabulary) —
  `buildEvidenceSearchIndex` itself is now just `addEntryToIndex` called
  once per entry into an empty index. `getCachedEvidenceSearchIndex` now
  diffs the live-entry set its cached index was last built/updated from
  (`cachedLiveEntriesById`, keyed by id) against the current one and applies
  the incremental functions only for entries actually added, removed, or
  changed (by content, not just presence) — an unrelated write (e.g. a
  different entry's peer-review transition) leaves every other entry's
  postings untouched, and `buildEvidenceSearchIndex` is now only ever called
  for the very first build. Vitest-covered (7 new cases in
  `packages/debate-card-search/test/evidence-search-index.test.ts`:
  add/replace without duplicating postings, remove drops only the removed
  entry's own terms while leaving a shared term's other postings intact,
  removing a term's last entry drops it from the postings map entirely,
  removing an unindexed id is a no-op, update drops stale terms and adds new
  ones, and an index built purely via repeated `addEntryToIndex` calls
  matches one built directly; 4 existing cache tests in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts` rewritten
  to assert `buildEvidenceSearchIndex` is *not* called again on a
  save/delete/peer-review-transition/edit while the matching incremental
  function *is*, alongside the existing result-correctness assertions).
  Documented in `docs/features/evidence-library.md` (new "Incremental
  indexing" section; Known gaps' entry for this closed — no further
  follow-up remains open on the "📋 Shared Evidence Library" bullet).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (156 files / 2214 tests, all pass), `bun run typecheck` (11 in-scope
  packages pass — `debate-ai-web` has no `typecheck` script; this repo has
  no `lint` script), and `bun run build:web` (production build, including
  every existing route) all pass.
- **Shared, Ai-Generated Debate Flow — force-refresh the `FlowSpreadsheet`
  `EditBadge` cell after logging through its own popover.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/shared-flow-sync.md`'s
  Known gaps section said the `EditBadge` "doesn't refresh in place after
  logging one through its own popover until the grid next re-renders that
  cell" — a same-tab staleness bug, distinct from the cross-tab gap it was
  bundled with. AG Grid's React cell renderers (`AnnotationCellRenderer`)
  read `state/flowEdits.ts` directly from `localStorage` at render time and
  don't re-render on their own when a sibling React state change happens;
  `FlowSpreadsheet.tsx` already had an `editReviewRefreshToken` bump for the
  popover's own edit list, but nothing told AG Grid to redraw the grid cell
  itself. Added `flow/edit-cells.ts`'s `gridCellForBoxPath(boxPath)`, a pure
  helper mapping a box path to its AG Grid `row-${index}` id and `col_${j}`
  field (mirroring `dataTransform.ts#buildRowData`'s and
  `useFlowGridConfig.ts`'s existing conventions — the same pair
  `annotation-cells.ts#boxPathForCell` derives a `boxPath` from). Wired a new
  `handleEditLogged` callback into `EditReviewPopover`'s `onLogged` prop that
  bumps the existing refresh token and calls
  `gridRef.current.api.refreshCells({ rowNodes, columns, force: true })` for
  exactly that cell. Vitest-covered (3 new cases in
  `packages/debate-round/test/edit-cells.test.ts`'s `gridCellForBoxPath`
  suite: first-row/first-column mapping, a later row/column pair, and a
  round-trip through `boxPathForCell` for arbitrary indices). Verified with
  `bun run test` (156 files / 2206 tests, all pass — 3 new cases), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no `typecheck`
  script; this repo has no `lint` script), and `bun run build` (both
  buildable packages pass). Docs updated at
  `docs/features/shared-flow-sync.md` (new "EditBadge same-tab refresh"
  section; Known gaps narrowed to the remaining cross-tab case, now
  explicitly distinguished from Live Sync's cross-*contributor* mechanism).
  PR: https://github.com/debate/debate-ai.com/pull/270.
- **Practice Round Simulator — wire post-round feedback generation to a live round flow.**
  Found via this run's own doc/tracker-drift audit of every
  `docs/features/*.md` "Known gaps" section (following the same audit
  pattern the last several runs used): `docs/features/practice-round-simulator.md`'s
  Known gaps section was itself stale — it still said follow-up (a)'s AI
  opponent-speech and AI judge-decision calls were "not started," but both
  already existed and were wired into `PracticeRoundSimulatorPanel.tsx`
  ("Generate AI opponent speech" / "Get AI judge decision"). Doc text
  corrected. Underneath that stale half, the doc's real remaining claim —
  "feedback generation isn't wired to a live round flow in this app yet" —
  was accurate: `buildPracticeRoundFeedback` (which needs an already-flowed
  `Flow`) had no caller anywhere in the app, so every practice round's card
  permanently showed "no post-round feedback yet." Added
  `buildAndSavePracticeRoundFeedback(flow, roundId, sideKey)` to
  `packages/debate-round/src/state/practiceRounds.ts`, which derives a
  round's `PracticeRoundFeedback` (judged under that round's own already-
  saved `setup.judgeParadigm`) and saves it onto the round's persisted
  record — returning `undefined` without writing anything if no record is
  stored for that `roundId` yet. `PracticeRoundSimulatorPanel.tsx` gained a
  "Generate post-round feedback for current round" form per round, reading
  the round workspace's currently selected flow via `state/store.ts`'s
  `useFlowStore` — the same mechanism `CoachingSessionsPanel`'s "Generate
  coaching session for current round" action already uses — enabled only
  while the selected flow's id matches that card's `roundId`. No new
  coaching-session or judge-paradigm logic was introduced; this composes
  the existing `buildPracticeRoundFeedback` (itself built on `flow/coach-mode.ts`'s
  `buildCoachingSession`) directly. Vitest-covered (4 new cases in
  `packages/debate-round/test/practiceRounds.test.ts`'s
  `buildAndSavePracticeRoundFeedback` suite: no-op + `undefined` for an
  unstored `roundId`, deriving feedback under the round's own judge
  paradigm and saving it, preserving the record's other fields (`setup`,
  `judgeDecision`) when saving feedback, and overwriting previously
  generated feedback). Verified with `bun run test` (156 files / 2203
  tests, all pass — 4 new cases), `bun run typecheck` (11 in-scope packages
  pass — `debate-ai-web` has no `typecheck` script; this repo has no `lint`
  script), and `bun run build` (both buildable packages pass, `/practice-round`
  present in the route list). Docs updated at
  `docs/features/practice-round-simulator.md` (Known gaps section now reads
  "No known gaps remain for this idea"). PR:
  https://github.com/debate/debate-ai.com/pull/269.
- **Flow Annotations — switch video on cross-recording "Jump to".** Closes
  one of the four "Newly discovered small gaps" logged by the previous run's
  doc/tracker drift audit (see the entry below): `FlowAnnotationsPanel.handleJump`
  (`packages/debate-round/src/panels/FlowAnnotationsPanel.tsx`) and the
  matching `FlowSpreadsheet.handleJumpToAnnotation`
  (`packages/debate-round/src/flow/FlowSpreadsheet.tsx`) only seeked within
  the already-active video — if an annotation's own recording wasn't the one
  loaded in the persistent player, "Jump to" showed a disabled/no-op
  affordance instead of opening the right video first. Added a pure,
  dependency-injected `jumpToAnnotation(annotation, deps)` helper in
  `packages/debate-round/src/flow/flow-annotations.ts`: same-video jumps
  still seek in place via `sendYouTubeCommand("seekTo", ...)` +
  `"playVideo"`; a different (or no) video loaded instead calls
  `deps.setActiveVideo(videoId, videoId, undefined, timestampMs / 1000)`
  (falling back to the bare `videoId` as the title, since no stored catalog
  maps one to a title — `FlowAnnotation` itself never carried one). Both
  `FlowAnnotationsPanel` and `FlowSpreadsheet` now call this one helper
  instead of duplicating the guard, and the panel's "Jump to" button is
  disabled only when the annotation has no `videoId` at all. `debate-videos`'s
  `useVideoPlayerStore.setActiveVideo`
  (`packages/debate-videos/src/state/videoPlayerStore.ts`) gained an optional
  4th `startTimeSeconds` param that overrides its saved-resume-timestamp
  lookup, feeding the existing `&start=` YouTube-embed URL param — chosen
  over firing a `seekTo` postMessage immediately after switching, because
  research this run confirmed the iframe's new document isn't guaranteed to
  have loaded yet and this codebase has no "player ready" signal anywhere to
  gate on (no prior "switch then seek" pattern existed to reuse). No new
  annotation-model or persistence logic; `AnnotationBadge`/`AnnotationCellRenderer`
  needed no changes (they're pure/props-driven, with no video-matching gate
  of their own). Vitest-covered (4 new cases in
  `packages/debate-round/test/flow-annotations.test.ts`'s `jumpToAnnotation`
  suite, using fake injected deps: same-video seek, cross-video switch,
  switch when nothing is loaded, and the no-`videoId` no-op). Verified with
  `bun run test` (156 files / 2199 tests, all pass — 4 new cases),
  `bun run typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script; this repo has no `lint` script), and `bun run build`
  (both buildable packages pass, `/annotations` present in the route list).
  Docs updated at `docs/features/flow-annotations.md` (new "Cross-recording
  'Jump to'" section; the sole remaining Known gap is the same
  title-fallback caveat noted above — a video catalog mapping `videoId` to a
  title doesn't exist anywhere in this repo yet). PR:
  https://github.com/debate/debate-ai.com/pull/268.
- **AI Response-Outcome Charts — AI counsel panel now scores an active "what if" hypothetical.**
  Closes one of the four "Newly discovered small gaps" logged by the
  previous run's doc/tracker drift audit (see that entry below):
  `docs/features/response-outcome-charts.md`'s Known gap that
  `VulnerabilityChartsPanel.handleGetCounselPanel`
  (`packages/debate-round/src/panels/VulnerabilityChartsPanel.tsx`) built
  its AI counsel request's top arguments from `record.report` — the
  original persisted report — instead of `effectiveReport`, the report
  with the panel's own "what if" (Extend/Answer/Concede) hypothetical
  adjustments applied via `applyHypotheticalAdjustments`. The chart and
  side summary above the counsel-panel button already rendered
  `effectiveReport`, so an active hypothetical was silently ignored by the
  AI counsel call even though the rest of the card reflected it.
  Extracted the inline top-arguments derivation (previously duplicated
  logic in the panel) into a new pure helper,
  `buildCounselPanelTopArguments(report, options)` in
  `packages/debate-round/src/flow/response-outcome.ts`, which composes the
  existing `buildVulnerabilityChartDataFromReport` + a per-row field trim
  in one step. `handleGetCounselPanel` now takes `effectiveReport` as a
  parameter (passed from the render scope where it's already computed) and
  calls `buildCounselPanelTopArguments(effectiveReport)` instead of
  rebuilding the list from `record.report` inline. No change to the
  vulnerability-scoring heuristic itself. Vitest-covered (3 new cases in
  `packages/debate-round/test/response-outcome.test.ts`'s
  `buildCounselPanelTopArguments` suite: ranked top-N trimmed to the
  counsel-request fields, the default limit of 10, and reflecting a
  hypothetical-adjusted report's recomputed score/unanswered status instead
  of the original report's). Verified with `bun run test` (156 files /
  2195 tests, all pass — 3 new cases), `bun run typecheck` (11 in-scope
  packages pass — `debate-ai-web` has no `typecheck` script; this repo has
  no `lint` script), and `bun run build` (both buildable packages pass,
  `/outcomes` present in the route list). Docs updated at
  `docs/features/response-outcome-charts.md` (closes its only Known gap;
  the section now reads "No known gaps remain for this idea"). PR:
  https://github.com/debate/debate-ai.com/pull/267.
- **AI Coach Mode — "generate coaching session for current round" form.**
  Closed `docs/features/coaching-sessions.md`'s only remaining Known gap —
  the same doc/tracker-drift pattern the three most recent runs already
  closed for Pre-Round Briefings, Practice Drills, and Response-Outcome
  Charts, found via a systematic audit this run of every `docs/features/*.md`
  "Known gaps" section against the actual current code (see "Doc/tracker
  drift audit" note below for what else that audit surfaced).
  `CoachingSessionsPanel.tsx` (`/coaching`) now has a "Generate coaching
  session for current round" form (a side input + button, disabled with an
  inline hint when no flow is currently selected), reading the round
  workspace's currently selected flow via `state/store.ts`'s `useFlowStore`
  — the same mechanism `DrillSetsPanel`'s "Generate drills for current
  round" action already uses. It calls one new helper,
  `buildAndSaveCoachingSession` in
  `packages/debate-round/src/state/coachingSessions.ts`, which composes the
  existing `buildCoachingSession` (from `flow/coach-mode.ts`) +
  `saveCoachingSession` in one step (mirroring `drillSets.ts`'s
  `buildAndSaveDrillSet`) — no new coaching-prompt derivation logic.
  Vitest-covered (4 new cases in
  `packages/debate-round/test/coachingSessions.test.ts`: deriving and
  persisting a session from a flow, overwriting an existing record for the
  same round+side pair, keeping sessions for different sides of the same
  round distinct, and `collapseLimit` passing through to
  `buildCoachingSession`). Verified with `bun run test` (156 files / 2192
  tests, all pass — 4 new cases), `bun run typecheck` (11 in-scope packages
  pass — `debate-ai-web` has no `typecheck` script; this repo has no `lint`
  script), and `bun run build` (both buildable packages pass, `/coaching`
  present in the route list). Docs updated at
  `docs/features/coaching-sessions.md`; no follow-ups remain open on this
  bullet. PR: https://github.com/debate/debate-ai.com/pull/266.

  Doc/tracker drift audit (systematic pass this run over all 39
  `docs/features/*.md` files with a "Known gaps" section, verifying each
  listed gap against the actual current code rather than trusting the doc's
  own claim):
  - 4 stale docs found and fixed this run (doc claimed a gap that was
    already closed in code): `reason-editor-outline-nav.md` (the
    ProseMirror decoration plugin that hides collapsed ranges,
    `collapsedHeadingsPlugin`, already exists and is wired in),
    `judge-paradigm-selections.md` (the AI judge-decision call using
    `buildJudgeParadigmPrompt` already exists — `judge-decision-ai.ts` /
    `judge-decision-client.ts` / `judge-decision-store-wiring.ts`, wired
    into `JudgeDecisionPanel.tsx`/`PracticeRoundSimulatorPanel.tsx`),
    `contributor-awards.md` (a real submitted-contribution flow already
    exists via `ContributionsFeedPanel.tsx`), and `group-challenges.md`
    (`CoachingProgramsPanel.tsx` already reads through this store via
    `state/persistedCoachingProgramBoard.ts`'s `listGroupChallenges` call).
  - 4 real, small, non-external-infra-blocked gaps were also found and
    logged below as new backlog items for a future run (not implemented
    this run, to keep this run's diff to the one task above): a missing
    "regenerate AI speech" action in AI-Versus Rounds, completed
    research-task history that's never pruned, the Flow Annotations "Jump
    to" action not switching videos, and the Response-Outcome Charts AI
    counsel call ignoring an active "what if" hypothetical. See "Newly
    discovered small gaps" below.
  - Every other audited doc's "Known gaps" section checked out as accurate
    against the current code — either still genuinely open, or already
    correctly documented as blocked on external infrastructure this repo
    doesn't have (Tabroom authentication, audio/video transcription, no
    reviewer/auth system). See "Remaining backlog audit" below for the
    external-infra items, unchanged from prior runs.

  Newly discovered small gaps (found by this run's doc/tracker drift audit;
  each is small and not blocked by external infrastructure — good
  candidates for a future run's "select a new idea" step before reaching
  for `IDEAS.md`/Product Feature Ideas):
  - `docs/features/ai-versus-rounds.md`: `AiVersusRoundPanel.tsx` has no way
    to replace a just-generated AI speech — only "Generate AI speech" to
    append one. Add a "Regenerate" action (re-calling
    `requestAiVersusSpeech`/`requestAiVersusSpeechWithPersona` and
    overwriting the last `submittedSpeeches` entry) gated to when the last
    speech is AI-authored.
  - `docs/features/research-progress-tracking.md`:
    `state/researchProgress.ts` has no way to delete a topic's completed-task
    history records — they accumulate forever. Add a
    `deleteCompletedTaskHistoryForTopic(topic)` export.
  - `docs/features/flow-annotations.md`: `FlowAnnotationsPanel.handleJump`
    (and the matching `FlowSpreadsheet` badge) only seeks within the
    already-active video — if the annotation's video isn't loaded, it gives
    up instead of switching videos first via `debate-videos`'s
    `useVideoPlayerStore.setActiveVideo(videoId, title, meta?)`.
  - `docs/features/response-outcome-charts.md`:
    `VulnerabilityChartsPanel.handleGetCounselPanel`
    (`packages/debate-round/src/panels/VulnerabilityChartsPanel.tsx:128-142`)
    builds its AI counsel request's `topArguments` from `record.report` (the
    original persisted report) instead of `effectiveReport` (the report with
    the panel's own "what if" hypothetical adjustments applied via
    `applyHypotheticalAdjustments`) — so an active what-if adjustment is
    silently ignored by the AI counsel call even though the rendered chart
    reflects it.
- **AI Response-Outcome Charts — add a "generate report for current round" form.**
  TODO.md's idea #4 ("AI Response-Outcome Charts") already said "No
  follow-ups remain open," but `docs/features/response-outcome-charts.md`'s
  "Known gaps" still listed one — the same doc/tracker drift the two most
  recent runs closed for Pre-Round Briefings and Practice Drills: "No
  affordance in this panel to generate a new vulnerability report for a
  round — a report only appears here once something elsewhere calls
  `getArgumentVulnerabilityReport` and `saveVulnerabilityReport` for that
  round." `VulnerabilityChartsPanel` (`/outcomes`) now has a "Generate
  report for current round" form (a button, disabled with an inline hint
  when no flow is currently selected), reading the round workspace's
  currently selected flow via `state/store.ts`'s `useFlowStore` — the same
  mechanism `DrillSetsPanel`'s "Generate drills for current round" action
  already uses. It calls one new helper,
  `buildAndSaveVulnerabilityReport` in
  `packages/debate-round/src/state/vulnerabilityReports.ts`, which composes
  the existing `getArgumentVulnerabilityReport` + `getFlowSideKeys` +
  `saveVulnerabilityReport` in one step (mirroring `drillSets.ts`'s
  `buildAndSaveDrillSet`) — no new vulnerability-scoring logic. Unlike the
  Drill Sets form, no side-key input is needed since a vulnerability report
  scores every side's arguments in one pass. Vitest-covered (3 new cases in
  `packages/debate-round/test/vulnerabilityReports.test.ts`: deriving and
  persisting a report from a flow, overwriting an existing record for the
  same round, and `sideKeys` deriving correctly via `getFlowSideKeys`).
  Verified with `bun run test` (156 files / 2188 tests, all pass — 3 new
  cases), `bun run typecheck` (11 in-scope packages pass — `debate-ai-web`
  has no `typecheck` script), and `bun run build` (both buildable packages
  pass, `/outcomes` present in the route list). Docs updated at
  `docs/features/response-outcome-charts.md`; no follow-ups remain open on
  this bullet. The remaining backlog audited by prior runs (Tabroom-
  authentication-gated data sources, missing transcription service, and the
  browser-extension idea) is unaffected and still accurate — see the
  Pre-Round Briefings entry below for the full audit.

- **Pre-Round Briefings — persist and wire in a team's own round history.**
  Closes the real (not form-oversight) gap the previous run documented in
  `docs/features/pre-round-briefings.md`'s "Known gaps": the "create
  briefing" form's "Prior meetings" section always rendered "No recorded
  prior meetings" even when an opponent profile was picked, because
  `round/pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores` already
  supported a head-to-head `ownRecords`/`opponentTeamId` history when
  called directly, but no persisted store of a team's own round history
  existed for it to read from. Added
  `packages/debate-round/src/state/ownRoundHistory.ts`, a new
  `OpponentRoundRecord`-per-logged-round localStorage store (append-only,
  synthetic id per record, mirroring `debate-data-sync`'s
  `tournamentResults.ts` convention) with `listOwnRoundHistory`/
  `saveOwnRoundHistoryRecord`/`deleteOwnRoundHistoryRecord`/
  `getOwnRoundHistoryAgainst`. `buildPreRoundBriefingFromStores` now
  resolves `ownRecords` from this store by `opponentTeamId` the same way it
  already resolved `opponentProfile`/`judgeProfile` by id — no new
  head-to-head computation logic; it still delegates to the existing
  `getHeadToHeadRecords`/`summarizePriorMeetings`. `PreRoundBriefingsPanel`
  (`/briefings`) gained a "Log a round" form (tournament, date, division,
  side, an opponent picked from an already-persisted Opponent Team Profile,
  and Won/Lost), with a "Remove" action per logged round — otherwise the
  store would have been just as unreachable from the shipped app as the
  briefing store was before last run's "create briefing" form. Vitest-
  covered: a new `packages/debate-round/test/ownRoundHistory.test.ts` (10
  cases covering empty/corrupt/non-array storage, append-not-overwrite,
  delete, and head-to-head filtering including records with no
  `opponentTeamId`), plus 2 new cases in
  `packages/debate-round/test/pre-round-briefing.test.ts` covering
  `buildPreRoundBriefingFromStores` resolving `ownRecords` from the store
  and an explicitly supplied `ownRecords` still taking precedence over it.
  Verified with `bun run test` (156 files / 2186 tests, all pass — 1 new
  file, 12 new cases), `bun run typecheck` (11 in-scope packages pass —
  `debate-ai-web` has no `typecheck` script), and `bun run build` (both
  buildable packages pass). Docs updated at
  `docs/features/pre-round-briefings.md`; no follow-ups remain open on this
  gap. The remaining backlog audited by the previous run (Tabroom-
  authentication-gated data sources, missing transcription service, and the
  browser-extension idea) is unaffected and still accurate — see that
  entry below.

- **Practice Drills — add a "generate drills for current round" form.** The
  "📚 AI Drill Generator" bullet in TODO.md's Research Crowdsourcing
  Organizer Features list said "No follow-ups remain open," but
  `docs/features/drill-sets.md`'s "Known gaps" still listed one: "No
  affordance in this panel to generate a new drill set for a round — a set
  only appears here once something elsewhere calls `buildDrillSet` and
  `saveDrillSet` for that round" — the same doc/tracker drift idea #12's
  Pre-Round Briefings form closed last run. `DrillSetsPanel` (`/drills`) now
  has a "Generate drills for current round" form (a side-key input plus a
  button, disabled with an inline hint when no flow is currently selected),
  reading the round workspace's currently selected flow via
  `state/store.ts`'s `useFlowStore` — the same mechanism
  `CoachingProgramsPanel`'s "Save current flow" action already uses. It
  calls one new helper, `buildAndSaveDrillSet` in
  `packages/debate-round/src/state/drillSets.ts`, which composes the
  existing `buildDrillSet` + `saveDrillSet` in one step (mirroring
  `roundContributorFlows.ts`'s `buildAndSaveRoundContributorFlow`) — no new
  drill-generation logic. Vitest-covered (3 new cases in
  `packages/debate-round/test/drillSets.test.ts`: deriving and persisting a
  drill set from a flow, overwriting an existing record for the same round,
  and `collapseLimit` passing through to `buildDrillSet`). Verified with
  `bun run test` (155 files / 2174 tests, all pass), `bun run typecheck` (11
  in-scope packages pass — `debate-ai-web` has no `typecheck` script), and
  `bun run build` (both buildable packages pass). Docs updated at
  `docs/features/drill-sets.md`; no follow-ups remain open on this bullet.

- **Pre-Round Briefings — add a "create briefing" form.** Idea #12
  ("Pre-Round Intelligence Panel")'s follow-up (b) was only partly closed:
  `docs/features/pre-round-briefings.md`'s "Known gaps" said "No affordance
  in this panel to generate a new briefing for a round" — `savePreRoundBriefing`
  and `buildPreRoundBriefingFromStores` existed and were Vitest-covered, but
  were called only from tests, so `/briefings` was permanently empty for a
  real user. Added a "create briefing" form to `PreRoundBriefingsPanel`
  (round ID, tournament/division/round-label/side/room/opponent-label,
  optional picks from already-persisted Opponent Team Profiles / Judge
  Profiles, free-text prep notes), backed by one new pure helper,
  `buildPreRoundBriefingRecordFromDraft` in
  `packages/debate-round/src/state/preRoundBriefings.ts`, which validates
  the draft and delegates to the existing `buildPreRoundBriefingFromStores`
  — no new briefing-composition logic. Vitest-covered (12 new cases in
  `packages/debate-round/test/preRoundBriefings.test.ts`: minimal valid
  draft, whitespace/missing-field validation, optional room/opponent-
  label/prep-notes, resolving an opponent/judge profile by id, and the
  "no data on file" fallback for an unresolved id). Documented in
  `docs/features/pre-round-briefings.md`, including the still-open gap that
  the form doesn't collect this team's own round history, so "Prior
  meetings" always renders "No recorded prior meetings" even when an
  opponent profile is picked — `buildPreRoundBriefingFromStores` supports a
  head-to-head `ownRecords`/`opponentTeamId` history when called directly,
  but no persisted store of a team's own round history exists yet for the
  form to read from; a real follow-up, not a form oversight.

- **AI Practice Opponent — `docs/features/practice-opponent.md`.** Every
  idea in TODO.md's Product Feature Ideas and Research Crowdsourcing
  Organizer Features lists already has "No follow-ups remain open"
  implementations except for a handful explicitly documented as blocked on
  an external dependency this repo doesn't have (see below); of those
  already-closed ideas, the "AI Practice Opponent" persona picker
  (`OpponentPersonaPickerPanel` at `/practice-opponent`, in the global
  dock's Settings menu) was the one implemented slice missing its
  `docs/features/*.md` entry — every sibling idea (e.g. "AI Judge Decision
  Modes" → `judge-paradigm-selections.md`) has one. Added
  `docs/features/practice-opponent.md`, documenting the route, nav
  location, the four built-in personas, the full save/clear/AI-speech data
  flow (including `round/opponent-persona-speech-wiring.ts`'s
  `getOpponentPersonaForRound`), and existing Vitest coverage. No code
  changed; this is a documentation-only completion.

  Remaining backlog audit (for future runs, so this isn't re-discovered):
  every other open follow-up left in TODO.md is blocked on an external
  dependency, not on missing implementation effort —
  - Idea #1 "CX NDCA Standings" follow-up (a), a real Tabroom/NDCA scraper:
    confirmed via a live fetch this run that Tabroom's tournament-results
    pages (e.g. `/index/tourn/results/index.mhtml?tourn_id=...`) require an
    authenticated Tabroom login and render only a login form to an
    unauthenticated request — unlike the public `/index/index.mhtml`
    tournament-name index `sync-tournaments.ts` already scrapes. No
    Tabroom credentials exist in this repo, so a real per-team results
    scraper can't be built or tested against real data right now. Follow-up
    (b), a real circuit-sourced `QualificationPointsTable`, has the same
    blocker noted in `ndca-standings.ts` — no authoritative public source
    this repo can cite is available.
  - "Opponent Team Profiles" and "Judge Profiles" follow-up (a), a real
    Tabroom pairings/ballots data source: same authentication blocker as
    above (pairings/ballots live behind the same login-gated Tabroom
    pages).
  - Idea #12 "Pre-Round Intelligence Panel" follow-up (a), real tournament
    results/pairings/event-details/room-assignment data sources: same
    Tabroom authentication blocker.
  - Idea #6 "Speech Transcript Summaries" and idea #8 "Video-Lecture-
    Training Coach AI," each idea's remaining audio/video-transcription
    half of follow-up (a): no transcription service (e.g. Whisper-style
    API) exists in this repo or its dependencies, and the browser-native
    Web Speech API only transcribes live microphone input, not an uploaded
    recording — not a safe, testable slice without a real service
    dependency.
  - Idea #7 "On Page Card Reuse Search" follow-up (a), an actual browser
    extension: this is a genuinely new project (manifest, content script,
    packaging) rather than a vertical slice of the existing Next.js app,
    and the existing check logic reads a client-side `localStorage` store
    that a separate extension origin can't reach without a new backend API
    endpoint first — too large to safely scope as one incremental slice.

- **Shared Evidence Library — cache the search index across calls.**
  Closes the remaining follow-up named under the "📋 Shared Evidence
  Library" bullet in TODO.md's Research Crowdsourcing Organizer Features
  list ("caching the index across calls instead of rebuilding it on every
  search"), and the matching "Known gaps" entry in
  `docs/features/evidence-library.md`. `state/evidenceLibraryEntries.ts`'s
  `searchPersistedEvidenceLibraryWithIndex` no longer rebuilds
  `EvidenceSearchIndex` on every call — a new `getCachedEvidenceSearchIndex`
  reuses the previously built index unless the data it depends on could have
  changed. Liveness depends on two independently-written stores (this
  store's own `EvidenceLibraryEntry` records, and `state/peerReviews.ts`'s
  `CardReview` records — a review transition can flip an entry's liveness
  with no write to this store at all), so rather than a write-time counter
  on each store's own write functions (which would miss any storage change
  made outside them), the cache compares each store's raw persisted JSON
  string against the strings it was built from —
  `state/peerReviews.ts`'s new `getPeerReviewsRawSnapshot()` exposes the
  peer-review side of that fingerprint. Vitest-covered in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts` (a
  repeat call with nothing changed reuses the cached index rather than
  calling `buildEvidenceSearchIndex` again; saving an entry, deleting an
  entry, and a peer-review transition that flips an entry's live status
  each force a rebuild whose results reflect the change) and
  `packages/debate-card-search/test/peerReviews.test.ts`
  (`getPeerReviewsRawSnapshot` changes value on save/delete and stays
  identical across repeat calls with nothing changed). Verified with
  `bun run test` (155 files / 2165 tests, all pass), `bun run typecheck` (11
  in-scope packages pass — `debate-ai-web` has no `typecheck` script), and
  `bun run build` (both buildable packages pass). Docs updated at
  `docs/features/evidence-library.md`. Remaining gap, recorded there: a
  cache-invalidating rebuild is still a full pass over every live entry, not
  true incremental indexing that updates only the entries a write actually
  touched.
- **Shared Evidence Library — wire `EvidenceLibraryPanel` to the real search index.**
  Closes the remainder of follow-up (c) named under the "📋 Shared Evidence
  Library" bullet in TODO.md's Research Crowdsourcing Organizer Features
  list, and the matching "Known gaps" entry in
  `docs/features/evidence-library.md` ("`EvidenceLibraryPanel` isn't wired
  to it yet — the panel still calls the original keyword-overlap
  `searchPersistedEvidenceLibrary`"), left open by PR #256.
  `EvidenceLibraryPanel`'s two search call sites (the live-filter effect and
  `refreshResults`, used after every submit/edit/delete/reuse-check) now
  call `state/evidenceLibraryEntries.ts`'s `searchPersistedEvidenceLibraryWithIndex`
  instead of the original `searchPersistedEvidenceLibrary` — a drop-in swap,
  since both share the same `EvidenceSearchQuery` input and
  `EvidenceSearchResult` output shape and non-text filter semantics, so the
  panel's search box, kind filter, and topic/case-area/tags filters are now
  all served by PR #256's TF-IDF-ranked inverted index instead of a full
  keyword-overlap re-scan on every keystroke. `searchPersistedEvidenceLibrary`
  stays exported, unchanged, for any other caller. Vitest-covered in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts` with a
  new suite exercising the panel's actual call shape —
  `buildEvidenceSearchFormQuery`'s output fed straight into
  `searchPersistedEvidenceLibraryWithIndex` — covering a combined
  text+topic+tags filter match, a filter combination that narrows past every
  entry, and peer-review gating through that same query shape (the
  indexed search's own unit tests, filter-by-filter, were already added in
  PR #256). Verified with `bun run test` (155 files / 2157 tests, all pass),
  `bun run typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script), and `bun run build` (both buildable packages pass).
  Docs updated at `docs/features/evidence-library.md`. Follow-up remaining,
  recorded there: caching the index across calls instead of rebuilding it on
  every search is not started — this store still has no write-time hook to
  invalidate a cache.
  PR: [#258](https://github.com/debate/debate-ai.com/pull/258).
- **Shared Evidence Library — real search index.**
  Closes follow-up (c) named under the "📋 Shared Evidence Library" bullet in
  TODO.md's Research Crowdsourcing Organizer Features list ("a real search
  index (e.g. Typesense) once entries are persisted at scale"). Adds
  `packages/debate-card-search/src/lib/evidence-search-index.ts`'s
  `buildEvidenceSearchIndex`/`searchEvidenceLibraryWithIndex` — a real
  token → postings-list inverted index ranked by TF-IDF (term frequency ×
  inverse document frequency across the indexed corpus), so ranking a query
  no longer means re-scoring every entry's full text on every call (only
  entries sharing a query term are ever visited) and a rarer, more
  distinctive term outranks one nearly every entry shares — unlike
  `searchEvidenceLibrary`'s existing presence/absence keyword-overlap ratio.
  Kept a drop-in alternative: same `EvidenceSearchQuery` input,
  `EvidenceSearchResult` output shape, and kind/topic/caseArea/tags filter
  semantics (reusing `filterCardsByTags` directly, same as the original).
  `state/evidenceLibraryEntries.ts`'s new `searchPersistedEvidenceLibraryWithIndex`
  composes it against the persisted repository with the same "live"/peer-
  review gating `searchPersistedEvidenceLibrary` already uses, added
  alongside — not replacing — that existing function, so no current caller's
  behavior changes. The index is rebuilt fresh from the live entries on
  every call rather than cached (this store has no write-time hook to
  invalidate a cached index); that's still the query-time win the follow-up
  asked for, since ranking no longer requires visiting every entry. Vitest-
  covered in `packages/debate-card-search/test/evidence-search-index.test.ts`
  (index construction, postings/term-frequency correctness, TF-IDF ranking
  including a dedicated case showing a rarer term outranks a common one,
  every filter combination, and candidate-set parity against
  `searchEvidenceLibrary` on a shared fixture) and new cases in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
  (mirroring `searchPersistedEvidenceLibrary`'s own suite: peer-review
  gating, empty-repository, kind filtering, empty-text-query). Verified with
  `bun run test` (155 files / 2154 tests, all pass), `bun run typecheck` (11
  in-scope packages pass — `debate-ai-web` has no `typecheck` script), and
  `bun run build` (both buildable packages pass). Docs updated at
  `docs/features/evidence-library.md`. Follow-up remaining, recorded there:
  `EvidenceLibraryPanel` still calls the original `searchPersistedEvidenceLibrary`,
  not the indexed version — wiring the panel to it (or caching the index
  across calls instead of rebuilding it on every search) is not started.
  PR: [#256](https://github.com/debate/debate-ai.com/pull/256).
- **Peer Review System — reviewer permission gating for approve/reject/publish.**
  Closes follow-up (b) named under the "🗣️ Peer Review System" bullet in
  TODO.md's Research Crowdsourcing Organizer Features list ("reviewer
  identity/permission checks once auth/roles exist") and the matching
  "Known gaps" entry in `docs/features/review-queue.md` ("No reviewer
  identity/permission checks (no auth/roles in this repo yet), so any
  visitor can act as any reviewer and take any lifecycle action").
  No auth/roles system exists in this repo, so rather than fabricating a
  role model this slice derives a reviewer's permission from their own
  contribution record — the same "derive eligibility from a contributor's
  own track record instead of a caller-supplied value" approach
  `lib/tiered-task-routing.ts` already uses to derive a contributor's
  `SkillLevel` for task routing. `debate-card-search` adds
  `lib/reviewer-permissions.ts`'s `MIN_REVIEWER_TIER` (`"veteran"`),
  `hasReviewerPermission`, `InsufficientReviewerPermissionError`,
  `deriveReviewerTier` (looks a reviewer's `ContributorStats` up in a
  leaderboard and runs `progress-unlocks.ts`'s `computeContributorTier`;
  a reviewer with no stats is `"novice"`, not an error), and
  `approveReviewAsReviewer`/`rejectReviewAsReviewer`/`publishReviewAsReviewer`
  — permission-checked wrappers that throw before the underlying
  `lib/peer-review.ts` transition runs, so the state machine's own
  `InvalidReviewTransitionError`/`UnresolvedBlockingCommentsError` checks
  still apply after the gate. `state/peerReviews.ts` adds
  `derivePersistedReviewerTier` (composes `deriveReviewerTier` against
  `state/contributions.ts`'s `buildPersistedLeaderboard`) plus
  `approvePersistedReviewAsReviewer`/`rejectPersistedReviewAsReviewer`/
  `publishPersistedReviewAsReviewer`, which apply a gated transition to the
  stored review and save it — returning `undefined` for an unknown `cardId`
  (mirroring `state/contributions.ts`'s `applyPersistedContributionUpdate`
  convention) and re-throwing without saving when the gate or the state
  machine rejects. `ReviewQueuePanel` (`/cards/reviews`) gets a "Your
  reviewer ID" field; its Approve/Reject/Publish buttons now route through
  the gated store functions, while Submit/Resubmit/Request changes/comment
  actions stay open to anyone. Vitest-covered in
  `packages/debate-card-search/test/reviewer-permissions.test.ts` (tier
  comparison at/above/below the threshold, caller-supplied minimum tier,
  `deriveReviewerTier`'s missing-reviewer and real-stats paths, each gated
  wrapper's allow/deny path, and that the state machine still rejects an
  illegal transition once permission is granted) and new cases in
  `packages/debate-card-search/test/peerReviews.test.ts` (derived tier from
  real persisted contributions, each persisted wrapper's save-on-success,
  unknown-`cardId` `undefined`, and that a denied action leaves the stored
  review's status untouched). Verified with `bun run test` (154 files / 2130
  tests, all pass), `bun run typecheck` (11 in-scope packages pass —
  `debate-ai-web` has no `typecheck` script), and `bun run build` (both
  buildable packages pass). Docs updated at
  `docs/features/review-queue.md`. Remaining gap, recorded there rather
  than as a follow-up on this bullet: reviewer identity is a free-form
  typed id, not an authenticated user, so the tier gate reflects that id's
  record but nothing stops a visitor from typing someone else's — a real
  identity check needs an auth system this repo doesn't have.
  PR: [#254](https://github.com/debate/debate-ai.com/pull/254).
- **Community Research Hub — searchable directory of every crowdsourcing and pre-round/practice space.**
  Closes the "🧩 Community Research Hub" bullet ("A shared space where
  debaters contribute cards, evidence, and summaries to a common argument
  pool") under Research Crowdsourcing Organizer Features in TODO.md — the
  only bullet in that section with no recorded status, because every
  sibling bullet under it already shipped its own dedicated panel/route
  and closed itself out independently, and `/research`'s `ResearchHub`
  already tabs across the card-search-side ones, but nothing tied all of
  them — including the round/practice-side spaces `ResearchHub` doesn't
  cover (Opponent/Judge Profiles, AI Coach Mode, Practice Round Simulator,
  AI Drill Generator) — into one place a debater could browse or search.
  `debate-card-search` adds `lib/community-research-hub.ts`'s
  `COMMUNITY_RESEARCH_HUB_ENTRIES` (a static registry of all 17 sibling
  spaces' title/description/route, taken from each route's own page
  metadata), `buildCommunityResearchHubSections` (groups entries into five
  categories — Evidence & Cards, Team Collaboration, Pre-Round
  Intelligence, Practice & Coaching, Recognition & Progress),
  `searchCommunityResearchHubEntries` (case-insensitive title/description
  substring filter), and `buildCommunityResearchHubSummaryText`. A new
  `CommunityResearchHubPanel` renders a search box over the categorized
  directory at `/community-hub`, added to the global dock's Settings menu
  alongside Research Workspace. This panel has no store of its own — every
  entry just links out to a space that already persists (or doesn't need
  to persist) its own state. Vitest-covered in
  `packages/debate-card-search/test/community-research-hub.test.ts`
  (registry shape, section grouping/ordering, search matching/case-
  insensitivity/empty-query, and summary-text pluralization). Verified
  with `bun run test` (153 files / 2107 tests, all pass), `bun run
  typecheck` (11 in-scope packages pass — `debate-ai-web` has no
  `typecheck` script), and `bun run build` (both buildable packages pass,
  `/community-hub` present in the route list). Docs added at
  `docs/features/community-research-hub.md`. No repo-wide `lint` script
  exists so none was run. No follow-ups open on this bullet; idea #7's
  browser extension and the round/practice spaces' own remaining
  follow-ups (real Tabroom/ballot-sourced data, audio/video transcription)
  are unrelated to this bullet and untouched here.
  PR: [#252](https://github.com/debate/debate-ai.com/pull/252).
- **On Page Card Reuse Search — page-URL reuse-check first slice.**
  Closes the first slice of idea #7 ("On Page Card Reuse Search") in
  TODO.md's Product Feature Ideas list — "See if any one has cut this
  article in the chrome ext." `debate-card-search`'s
  `lib/shared-evidence-library.ts` adds an optional `sourceUrl` field to
  `EvidenceLibraryEntry`, `normalizeSourceUrl` (strips scheme, a leading
  `www.`, query string/fragment, and a trailing slash so tracking
  parameters and scheme/`www.` differences don't defeat a match),
  `findEntriesBySourceUrl`, `checkPageForExistingCards` (a
  `{ url, alreadyCut, matches }` result), and `buildPageReuseCheckSummaryText`.
  `state/evidenceLibraryEntries.ts`'s new `checkPersistedPageForExistingCards`
  composes that pure check against the persisted repository, gated to "live"
  entries the same way `searchPersistedEvidenceLibrary` already is (an entry
  held under an in-progress peer review doesn't count as "already cut"
  either). `EvidenceLibraryPanel` (`/cards/library`) gets a new optional
  Source URL field on the submission form and a "Check this page" box — paste
  a URL, see whether it's already been cut plus every matching entry — the
  reuse check a browser extension would eventually run automatically against
  the current tab's URL; no chrome extension exists in this repo, so this
  panel is the check's only caller today and the pure/persisted functions
  are the extension-callable first slice. No follow-ups remain open except
  (a), the actual browser extension itself, not started. Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts`
  (`normalizeSourceUrl`, `findEntriesBySourceUrl`, `checkPageForExistingCards`,
  `buildPageReuseCheckSummaryText`) and
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
  (`checkPersistedPageForExistingCards`, including the peer-review-gating
  case). Verified with `bun install` (2050 packages), `bun run test` (152
  files / 2096 tests, all pass), `bun run typecheck` (11 in-scope packages
  pass — `debate-ai-web` has no `typecheck` script), and `bun run build`
  (both buildable packages pass). Docs updated at
  `docs/features/evidence-library.md`. No repo-wide `lint` script exists so
  none was run.
  PR: [#251](https://github.com/debate/debate-ai.com/pull/251).
- **Shared, Ai-Generated Debate Flow — server-backed live sync transport.**
  Closes follow-up (a) under idea #16 ("Shared, Ai-Generated Debate Flow")
  in TODO.md's Product Feature Ideas list — "a live transport (WebSocket or
  similar) that turns local edits into a shared stream across a
  room/team" — the only follow-up open on that idea, and closes
  `docs/features/shared-flow-sync.md`'s "Known gaps" entry for it.
  `apps/debate-ai.com/lib/database/schema.ts` adds a `flowSyncEdits` D1
  table (one row per `FlowEdit`, upserted by its caller-assigned `id`,
  indexed by `flowId`), generated via `drizzle-kit generate` into
  `drizzle/0002_first_mister_sinister.sql`. A new
  `app/api/flow-sync/route.ts` exposes `GET ?flowId&sinceMs` (every edit
  for that flow newer than `sinceMs`, oldest first, capped at 500) and
  `POST { id, flowId, boxPath, authorId, content, timestampMs }`
  (validates and upserts by `id`), mirroring `app/api/doc/documents/route.ts`'s
  `getDBFromContext()`/drizzle convention — a short-poll transport rather
  than a WebSocket/Durable Object push channel, consistent with this app's
  existing serverless (Cloudflare Workers + D1) architecture and the
  follow-up's own "WebSocket or similar" wording. `debate-round` adds
  `flow/flow-sync-client.ts` (`pullRemoteFlowEdits`/`pushFlowEditToServer`,
  the fetch layer, mirroring `round/coach-feedback-client.ts`'s
  pure-module/fetch-client split), `flow/flow-sync-cursor.ts`
  (`advanceSyncCursor`, the pure next-`sinceMs` bookkeeping), and
  `hooks/useFlowSyncPolling.ts` (the poll-loop/push binding —
  `status`/`lastError`/`pushEdit`, ~4s interval). `FlowEditLogPanel.tsx`
  gets a "Live sync on/off" toggle (scoped to the form's current Flow ID)
  and a status pill: while on, it polls for other contributors' edits to
  that flow and folds them into the existing local `state/flowEdits.ts`
  store (`saveFlowEdit` already dedups by id), and pushes newly logged
  edits to the server; a pull/push failure only updates the status
  pill — local logging keeps working regardless of network conditions.
  Vitest-covered in `packages/debate-round/test/flow-sync-client.test.ts`
  (pull/push request shape, endpoint overrides, empty-`edits`-field
  fallback, server-error-message propagation, non-JSON-error-body
  fallback) and `packages/debate-round/test/flow-sync-cursor.test.ts`
  (`advanceSyncCursor`: no-op on an empty pull, advances to the latest
  pulled timestamp, never moves backwards). The polling hook and the API
  route are not directly Vitest-covered, matching this repo's convention
  for other React hooks (e.g. `useWordCountSpeechMode`) and D1-backed API
  routes — instead verified by package typecheck, the production build
  (`/api/flow-sync` appears in the built route list), and a manual
  end-to-end run against the local D1 emulation (`bun run dev` +
  `wrangler d1 execute debate_db --local --file=drizzle/0002_first_mister_sinister.sql`):
  GET before any data returns `{"edits":[]}`, POST persists and returns the
  edit, GET with `sinceMs=0` returns it, GET with `sinceMs` at the edit's
  own timestamp correctly excludes it, and re-POSTing the same `id` with
  new content upserts in place rather than duplicating. Verified from a
  clean install: `bun install` (2050 packages), `bun run test` (152 files /
  2077 tests, all pass), `bun run typecheck` (11 in-scope packages pass —
  `debate-ai-web` has no `typecheck` script, so `app/api/flow-sync/route.ts`
  is covered by the build instead), and `bun run build` (both buildable
  packages pass, `/api/flow-sync` appears in the built route list). Docs
  updated at `docs/features/shared-flow-sync.md`. No repo-wide `lint`
  script exists (checked root/app/package `package.json` scripts) so none
  was run.
  PR: [#250](https://github.com/debate/debate-ai.com/pull/250).
- **Coaching Programs and Group Challenges — member practice-round setup/feedback wiring.**
  Closes idea #13's remaining "(c) wiring a member's practice-round
  setup/feedback (Practice Round Simulator) into the space" follow-up in
  TODO.md's Product Feature Ideas list, and closes
  `docs/features/coaching-programs.md`'s "Known gaps" entry (it had already
  been marked "no known gaps remain" prematurely — this was the one real gap
  left). `round/coaching-program.ts` adds a `CoachingProgramMemberPracticeRound`
  type (`contributorId` + `practice-round-simulator.ts`'s `PracticeRoundSetup`
  + optional `PracticeRoundFeedback`) and an optional `memberPracticeRounds`
  input/output on `buildCoachingProgramBoard`, composed the same way as the
  existing `memberFlows`/`memberDrills` pair — scoped to the program roster,
  keyed by `contributorId`. `state/roundContributorFlows.ts`'s new
  `buildCoachingProgramMemberPracticeRounds(memberIds)` resolves this
  entirely from already-persisted state: a roster member's recorded
  `RoundContributorFlowRecord.roundId` (added for the prior "roundId-to-contributor
  mapping" slice) already names the same id `state/practiceRounds.ts` keys its
  `PracticeRoundRecord`s by, so this just joins the two existing stores rather
  than needing a new contributorId-keyed practice-round store — a member
  whose recorded round has no persisted `PracticeRoundRecord` (no Practice
  Round Simulator session started for it) is simply excluded.
  `state/persistedCoachingProgramBoard.ts`'s `buildPersistedCoachingProgramBoard`
  now defaults `memberPracticeRounds` to that resolution (still overridable
  by an explicit argument, e.g. for tests), mirroring `memberFlows`'s
  existing default. `CoachingProgramsPanel.tsx`'s roster now shows a
  "Practice round recorded" badge per member (upgrading to "Practice round +
  feedback" once feedback has been generated), alongside the existing "Flow
  recorded" badge. `buildCoachingProgramSummaryText` gains a
  "N member practice round(s) recorded" status line, and a new
  `buildMemberPracticeRoundSummaryText` renders one member's setup (plus
  feedback once generated) as text, mirroring `buildMemberDrillSummaryText`.
  Vitest-covered in `packages/debate-round/test/roundContributorFlows.test.ts`
  (the join, roster filtering, missing-`PracticeRoundRecord` exclusion, and
  feedback inclusion), `packages/debate-round/test/coaching-program.test.ts`
  (board composition, roster scoping, summary-text pluralization, and the new
  per-member summary helper), and
  `packages/debate-round/test/persistedCoachingProgramBoard.test.ts`
  (defaulting from persisted state, excluding a flow with no matching
  practice round, and an explicit `memberPracticeRounds` argument overriding
  the persisted lookup). Docs updated at `docs/features/coaching-programs.md`.
  Verified from a clean install: `bun install` (2050 packages), `bun run test`
  (150 files / 2064 tests, all pass), `bun run typecheck` (11 in-scope
  packages pass), and `bun run build` (both buildable packages pass,
  `/coaching-programs` appears in the built route list). No repo-wide `lint`
  script exists (checked root/app/package `package.json` scripts) so none was
  run.
  PR: [#248](https://github.com/debate/debate-ai.com/pull/248).
- **Coaching Programs and Group Challenges — roundId-to-contributor mapping for member drill sets.**
  Closes the remaining "(b-continued, remaining)" follow-up named under idea
  #13 ("Coaching Programs and Group Challenges") in TODO.md's Product
  Feature Ideas list — "a roundId-to-contributor mapping so a member's
  already-flowed practice round can generate a drill set on this board" —
  and closes `docs/features/coaching-programs.md`'s "Known gaps" entry. A
  new `packages/debate-round/src/state/roundContributorFlows.ts` adds a
  `contributorId`-keyed localStorage store (`listRoundContributorFlows`/
  `getRoundContributorFlow`/`saveRoundContributorFlow`/
  `deleteRoundContributorFlow`/`buildAndSaveRoundContributorFlow`), mirroring
  the existing `argumentTrees.ts`/`vulnerabilityReports.ts` roundId-keyed
  persistence convention but keyed by contributor instead, so saving a new
  flow for a member overwrites their previous one rather than accumulating
  every round they've ever flowed — matching `round/coaching-program.ts`'s
  `CoachingProgramMemberFlow`, which only wants one current flow per member.
  Its `buildCoachingProgramMemberFlows(memberIds)` resolves a program
  roster's member flows straight from that store. `state/persistedCoachingProgramBoard.ts`'s
  `buildPersistedCoachingProgramBoard` now defaults its `memberFlows`
  parameter to that resolution (still overridable by an explicit argument,
  e.g. for tests) instead of always passing an empty list, so a program's
  live board picks up real member drill sets automatically.
  `CoachingProgramsPanel.tsx` gets a "Member flows" roster under each open
  program's board: a side-key input and "Save current flow" action per
  roster member that reads the live round workspace's currently selected
  flow (`state/store.ts`'s `useFlowStore`, imported directly — the one
  exception to this package's panels otherwise being self-contained, mirroring
  how `apps/debate-ai.com/components/coach/CoachHub.tsx` already documents
  `SharedFlowSyncPanel` as its one such exception) and records it via
  `buildAndSaveRoundContributorFlow`, showing a "Flow recorded"/"No flow
  recorded" badge per member plus a "Clear" action. No follow-ups remain open
  on idea #13. Vitest-covered in
  `packages/debate-round/test/roundContributorFlows.test.ts` (list/get/save/
  upsert/delete, `buildAndSaveRoundContributorFlow`, and
  `buildCoachingProgramMemberFlows` filtering to a given roster and excluding
  non-roster contributors) and new cases added to
  `packages/debate-round/test/persistedCoachingProgramBoard.test.ts`
  (defaulting member flows from a roster member's persisted record,
  excluding a persisted flow for a contributor outside the roster, and an
  explicit `memberFlows` argument still overriding the persisted lookup).
  Docs updated at `docs/features/coaching-programs.md`. Verified from a
  clean install: `bun install` (2050 packages), `bun run test` (150 files /
  2049 tests, all pass), `bun run typecheck` (11 in-scope packages pass), and
  `bun run build` (both buildable
  packages pass, `/coaching-programs` appears in the built route list). No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run.
  PR: [#246](https://github.com/debate/debate-ai.com/pull/246).
- **Video-Lecture-Training Coach AI — document-upload text extraction.**
  Closes the "document" half of follow-up (a) named in
  `team-coach-materials.ts`'s file doc-comment for idea #8
  ("Video-Lecture-Training Coach AI") in TODO.md's Product Feature Ideas
  list: "transcription/parsing that turns an uploaded recording or document
  into a `CoachMaterial`'s `text`." A new
  `packages/debate-speech-writer/src/coach/document-material-extraction.ts`
  adds `detectDocumentKind`/`extractMaterialTextFromDocument`, dispatching
  an uploaded file by extension — `.txt`/`.md`/`.markdown` are read
  directly via `Blob#text()`, `.docx` goes through `debate-card-parser`'s
  existing `convertDocxToHTML(file, { plainTextOnly: true })` (the same
  Verbatim-parsing pipeline `docx-to-cards.ts` already uses), reusing that
  OOXML pipeline rather than reimplementing it. `debate-speech-writer` now
  depends on `debate-card-parser` (`workspace:*`), mirroring
  `reason-editor`'s existing identical dependency. The extracted text is
  whitespace-normalized and validated non-empty, throwing a plain `Error`
  for an unsupported extension or a document with no readable text.
  `CoachMaterialsPanel.tsx` gets an "Upload a document" button next to the
  Material text field (mirroring `debate-round`'s `FileExportDialog.tsx`
  hidden-file-input convention) that fills the text field — and the title
  field, if still empty — from the extraction result, showing a plain error
  message on failure. Recording (audio/video) transcription, the other half
  of follow-up (a), remains open — no transcription service exists in this
  repo. `convertDocxToHTML`'s default renderer (`docx-preview`) needs a
  browser `DOMParser`, so the `.docx` path only works from this
  `"use client"` panel in a real browser; `extractMaterialTextFromDocument`
  takes an injectable `convertDocx` option so its dispatch/validation logic
  stays Vitest-covered under this repo's Node test environment without
  needing a DOM (confirmed by directly invoking `convertDocxToHTML` outside
  a DOM environment, which throws `ReferenceError: DOMParser is not
  defined` — the same reason no test exists anywhere in this repo for
  `debate-card-parser`'s own `docx-to-html.ts`). Vitest-covered in
  `packages/debate-speech-writer/test/document-material-extraction.test.ts`
  (`detectDocumentKind`: text/docx extensions, case-insensitivity, an
  unsupported or missing extension; `extractMaterialTextFromDocument`: a
  string text file's content whitespace-normalized, a `Blob` text file's
  content, an empty text file throws, an unsupported extension throws, a
  `.docx` file's text extracted through an injected `convertDocx` stub
  (asserting it's called with `{ plainTextOnly: true }`) and
  whitespace-normalized, and a `.docx` file yielding no readable text
  throws). Docs updated at `docs/features/coach-materials.md`. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run. Verified from a clean install: `bun install`
  (2050 packages), `bun run test` (149 files / 2033 tests, all pass),
  `bun run typecheck` (11 in-scope packages pass), and `bun run build`
  (both buildable packages pass, `/coach-materials` appears in the built
  route list). PR: [#244](https://github.com/debate/debate-ai.com/pull/244).
- **Shared Evidence Library — topic/case-area/tag filter controls.**
  Closes the "no topic/case-area/tag filter controls in the search half of
  the panel — only free text and kind are exposed" gap named in
  `docs/features/evidence-library.md`'s "Known gaps" for the "📋 Shared
  Evidence Library" bullet in TODO.md's Research Crowdsourcing Organizer
  Features list. `packages/debate-card-search/src/lib/shared-evidence-library.ts`
  adds `buildEvidenceSearchFormQuery`, a pure helper that narrows a search
  panel's five raw filter-field values (free text, kind, topic, case area,
  comma-separated tags) into an `EvidenceSearchQuery` — trimming
  `topic`/`caseArea` and parsing `tags` into a list, and omitting any blank
  field so it doesn't narrow the search — rather than requiring the panel to
  hand-assemble that query itself. `panels/EvidenceLibraryPanel.tsx` gains
  Topic/Case area/Tags filter inputs alongside the existing free-text search
  box and kind filter, all combined through this one helper; `searchEvidenceLibrary`
  and `searchPersistedEvidenceLibrary` already supported every one of these
  fields (no new search/ranking logic). Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts` (blank
  fields omitted from the built query, kind/topic/caseArea/tags each included
  when set, whitespace-only topic/caseArea trimmed away, comma-separated
  tags parsed and empty entries dropped, and the combined query verified
  against `searchEvidenceLibrary` directly). Docs updated at
  `docs/features/evidence-library.md`. Verified from a clean install:
  `bun install`, `bun run test` (148 files / 2023 tests passed), `bun run
  typecheck` (11 packages passed), `bun run build` (both buildable packages
  passed, `/cards/library` appears in the built route list) — no repo-wide
  `lint` script exists.
- **Coaching Programs and Group Challenges — coaching-program board UI.**
  Closes the dashboard-view half of the "(b-continued)" follow-up named
  under idea #13 ("Coaching Programs and Group Challenges") in the Product
  Feature Ideas list: "a dashboard view that renders each program's full
  `buildCoachingProgramBoard`, wiring `debate-round`'s `CoachingProgramsPanel`
  to this new store and a live topic-sprint composition." `debate-round`'s
  new `state/persistedCoachingProgramBoard.ts` adds
  `buildPersistedCoachingProgramBoard`, composing a program's config
  (`state/coachingPrograms.ts`), its topic sprint's inputs
  (`debate-card-search`'s `state/topicSprints.ts`'s
  `readPersistedTopicSprintInputs`), the persisted group-challenge roster
  (`state/groupChallenges.ts`), the real, persisted contribution feed
  (`state/contributions.ts`), and persisted win events
  (`state/challengeWinEvents.ts`) directly with `round/coaching-program.ts`'s
  existing `buildCoachingProgramBoard` — mirroring `topicSprints.ts`'s own
  "compose every input from its own store" convention — rather than requiring
  a caller to assemble all four. `CoachingProgramsPanel` now has a "View
  board" action per program that opens a topic input and renders the
  composed board's summary (via the existing `buildCoachingProgramSummaryText`)
  once a topic is entered, reusing `PrepRoomPanel`'s topic-switcher +
  `whitespace-pre-line` summary-text convention. `memberFlows` stays an
  empty, caller-supplied list — no `roundId`-to-contributor mapping for a
  member's flowed practice round is persisted anywhere in this repo yet, so
  member drills render as "No member drill sets yet" until that mapping
  exists — leaving the rest of the "(b-continued)" follow-up open, as noted
  in `docs/features/coaching-programs.md`'s "Known gaps." Vitest-covered in
  `packages/debate-round/test/persistedCoachingProgramBoard.test.ts`
  (undefined for an unknown program id, an empty topic sprint/challenge
  board when nothing else is stored, the persisted challenge roster/
  contribution feed/win events composed into live challenge-board standings,
  a contribution with no `submittedAt` excluded, and `memberDrills` staying
  empty with no supplied `memberFlows`). Documented at
  `docs/features/coaching-programs.md` (new). Verified from a clean install:
  `bun install`, `bun run test` (148 files / 2015 tests passed), `bun run
  typecheck` (11 packages passed), `bun run build` (both buildable packages
  passed, `/coaching-programs` appears in the built route list) — no
  repo-wide `lint` script exists.
- **Coaching Programs and Group Challenges — persisted challenge win events +
  live standings in the Group Challenges panel.** Closes the "persisted
  challenge win events" half of the "(b-continued)" follow-up named under
  idea #13 ("Coaching Programs and Group Challenges") in the Product Feature
  Ideas list: "a dashboard view that renders each program's full
  `buildCoachingProgramBoard` (still needs persisted challenge win events and
  topic-sprint contributions in a form the board could read live... none of
  which exist yet)". `debate-card-search`'s new `state/challengeWinEvents.ts`
  persists `group-challenges.ts`'s `ChallengeWinEvent` records to
  localStorage as one flat, squad-wide list — mirroring
  `group-challenges.ts`'s own design, where a win event isn't scoped to one
  challenge but matched against any `win_target` challenge whose roster and
  window contain it, the same way a `contribution_target` challenge matches
  against the shared contribution feed. Its new
  `buildPersistedGroupChallengeBoard` composes the persisted challenge
  roster (`state/groupChallenges.ts`), the real, persisted contribution feed
  (`state/contributions.ts`, reusing `dailyQuests.ts`'s `hasSubmittedAt`
  guard convention), and this store's persisted win events into a live
  `GroupChallengeProgress[]` board. `GroupChallengesPanel.tsx` now renders
  each challenge's live standings (via `group-challenges.ts`'s own
  `buildGroupChallengeSummaryText`, plus a per-member standing list with an
  MVP marker) below its config, and a `win_target` challenge gets a "Record a
  win" action (contributor ID + button) wired to `recordChallengeWinEvent` —
  closing the panel's own previously-noted gap: "it doesn't render
  `computeGroupChallengeProgress`'s live standings, since those need
  caller-supplied contributions/win events that aren't persisted in a form
  this panel could read live yet." The rest of the "(b-continued)" follow-up
  — wiring `CoachingProgramsPanel` (in `debate-round`) to render a program's
  full `buildCoachingProgramBoard` off this and the topic-sprint composition,
  plus a `roundId`-to-contributor mapping for member drills — remains open,
  not started; `debate-round` would need to depend on this new store the
  same way `coaching-program.ts` already depends on `group-challenges.ts`.
  Vitest-covered in
  `packages/debate-card-search/test/challengeWinEvents.test.ts`
  (`listChallengeWinEvents`: empty/corrupt/non-array storage; `recordChallengeWinEvent`:
  appends and accumulates events; `buildPersistedGroupChallengeBoard`: empty
  roster, a persisted win event reflected in a `win_target` challenge's
  standings, a win event outside the roster or window excluded, a persisted
  contribution reflected in a `contribution_target` challenge's standings,
  and a contribution with no `submittedAt` excluded). Verified from a clean
  install: `bun install`, `bun run test` (2010 tests passed), `bun run
  typecheck` (11/11 packages passed), `bun run build:web` (built
  successfully). PR: #240.

- **Peer Review System — gate a card's Shared Evidence Library visibility on
  its review lifecycle.** Closes follow-up (c) named under the "🗣️ Peer
  Review System" bullet in the Research Crowdsourcing Organizer Features
  list: "wiring a review's lifecycle to whatever eventually persists
  submitted cards, so `publishReview` can gate a card actually going live."
  `debate-card-search`'s `lib/peer-review.ts` now has `isCardLive`, a pure
  helper treating a card with no `CardReview` at all as live (peer review is
  opt-in, not required, mirroring this repo's other "works standalone, gated
  further once the gating feature exists" slices) and a card with an
  in-progress review (anything short of `published`) as not-yet-live.
  `state/evidenceLibraryEntries.ts`'s new `isEntryLive`/
  `listPendingReviewEntries` look up an `EvidenceLibraryEntry`'s review by
  treating its `id` as the review's free-form `cardId`, and
  `searchPersistedEvidenceLibrary` now filters to only live entries before
  searching — starting a review on an already-submitted card pulls it out of
  the shared library's search results until `publishReview` moves it to
  `published`. `EvidenceLibraryPanel` renders every held-back entry in a new
  "Pending review" section (still editable/deletable) so its author doesn't
  lose track of it. Follow-up (b), reviewer identity/permission checks, stays
  open — it still needs an auth/identity system this repo doesn't have, same
  as every other follow-up gated on that. Vitest-covered in
  `packages/debate-card-search/test/peer-review.test.ts` (`isCardLive`) and
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
  (`isEntryLive`, `listPendingReviewEntries`, and
  `searchPersistedEvidenceLibrary`'s new gating cases). Docs updated at
  `docs/features/review-queue.md` and `docs/features/evidence-library.md`.
  Verified: `bun run test` (146 files / 2000 tests passed), `bun run
  typecheck` (11 packages passed), `bun run build` (both buildable packages
  passed) — no repo-wide `lint` script exists.
  [PR #239](https://github.com/debate/debate-ai.com/pull/239).
- **Research Task Routing — "my tasks" inbox filter.** Closes follow-up (e)
  named under the "🧭 Research Task Routing" bullet in the Research
  Crowdsourcing Organizer Features list: "scoping the inbox to 'my tasks'
  once contributor identity/auth exists." This repo still has no
  auth/identity system, so — mirroring the "🔄 Strategy Sync Notes" assignee
  notification's identical free-form-id workaround — `debate-card-search`'s
  `state/routedTaskQueues.ts` now has `filterTaskInboxViewByContributor`,
  which scopes a `buildTaskInboxView` result down to one contributor's own
  assignments (dropping a topic entirely once none of its assignments
  match that contributor, and clearing `unassignedTasks` since an
  unassigned task isn't anyone's yet). `TaskInboxPanel` now has a "My
  tasks" field — a free-form contributor-id filter, not a login — that
  scopes the rendered inbox to it, closing the last open follow-up on the
  "Research Task Routing" bullet. Vitest-covered in
  `packages/debate-card-search/test/routedTaskQueues.test.ts` (empty view,
  a mixed-assignee topic keeping only the requested contributor, a topic
  with no matching assignments dropped entirely, `unassignedTasks` cleared
  on a surviving topic). Docs updated at
  `docs/features/task-inbox.md`. Verified: `bun run test` (146 files /
  1989 tests passed), `bun run typecheck` (11 packages passed), `bun run
  build` (both buildable packages passed) — no repo-wide `lint` script
  exists.
  [PR #238](https://github.com/debate/debate-ai.com/pull/238).
- **Strategy Sync Notes — assignee notification.** Closes follow-up (b)
  named under the "🔄 Strategy Sync Notes" bullet in the Research
  Crowdsourcing Organizer Features list: "an assignee notification once a
  notification system exists." No notification system existed anywhere in
  this repo before this slice; it adds the first one, scoped narrowly to
  the one event that follow-up named — a `PrepNote` being assigned to a
  teammate — rather than a speculative, general-purpose system for events
  that don't exist yet. `debate-round` now has
  `flow/prep-note-notifications.ts`'s `PrepNoteNotification` data model
  plus `createPrepNoteAssignedNotification`/`markNotificationRead`/
  `getNotificationsForRecipient`/`getUnreadNotifications`/
  `countUnreadForRecipient`/`buildNotificationSummaryText`, mirroring
  `flow/strategy-sync-notes.ts`'s own pure-model conventions. A persisted
  store, `state/prepNoteNotifications.ts`, saves `PrepNoteNotification`
  records to localStorage and adds `recordPrepNoteAssignedNotification`,
  which `state/prepNotes.ts`'s `assignPersistedPrepNote` now calls on every
  real assignment (not an unassignment), so assigning a note to a teammate
  actually notifies them instead of requiring a caller to build and save
  the notification itself. A new `PrepNoteNotificationsPanel` renders a
  recipient's notifications (looked up by a free-form teammate id, since
  this repo has no auth/identity system) newest first at `/notifications`,
  with a "Mark read" action per unread notification, wired into the global
  dock's Settings menu and mounted at
  `apps/debate-ai.com/app/notifications/page.tsx`. No follow-ups remain
  open on the "🔄 Strategy Sync Notes" bullet. Vitest-covered in
  `packages/debate-round/test/prep-note-notifications.test.ts` (the pure
  model), `packages/debate-round/test/prepNoteNotifications.test.ts` (the
  persisted store), and new cases added to
  `packages/debate-round/test/prepNotes.test.ts` (an assignment records a
  notification for the new assignee; an unassignment and an assignment to
  an unknown note id do not). Docs updated at
  `docs/features/prep-notes.md`. Verified: `bun run test` (146 files /
  1985 tests passed), `bun run typecheck` (11 packages passed), `bun run
  build` (both buildable packages passed, `/notifications` appears in the
  built route list) — no repo-wide `lint` script exists.
- **Speech Transcript Summaries and Answers — AI extraction from raw speech
  text.** Closes the AI-call half of follow-up (a) named under idea #6 in
  the Product Feature Ideas list: "audio/video transcription plus an AI
  call to extract claims/warrants/impacts/evidence from raw speech text
  rather than relying on a manually flowed grid." This slice adds the
  AI-call half only (a pasted transcript, not audio/video) — the
  transcription half stays open as a further follow-up, mirroring this
  repo's established "AI call now, richer input source later" slicing
  (e.g. Video-Lecture-Training Coach AI). `debate-round` now has
  `round/transcript-extraction-ai.ts` (prompt-build + parse, mirroring
  `judge-decision-ai.ts`'s structured-JSON split) and
  `round/transcript-extraction-client.ts` (the `/api/reason-ai` network
  call, mirroring `coach-feedback-client.ts`), converting extracted
  claim/warrant/impact/evidence arguments into synthetic `FlowRowSummary`
  rows (`buildFlowRowSummariesFromExtraction`) appended to a round's
  persisted flow summary via the existing `saveFlowSummary`. A "Generate
  from raw speech text" form is now wired into `FlowSummariesPanel`, so an
  extracted argument gets the same cross-exam/extension suggestions as any
  row derived from a manually flowed grid — no new panel-rendering logic
  was needed. Vitest-covered in
  `packages/debate-round/test/transcript-extraction-ai.test.ts` and
  `packages/debate-round/test/transcript-extraction-client.test.ts`. Docs
  updated at `docs/features/flow-summaries.md`. Verified: `bun run test`
  (144 files / 1959 tests passed), `bun run typecheck` (11 packages
  passed), `bun run build` (both buildable packages passed) — no
  repo-wide `lint` script exists.
- **Top Contributor Awards — finer-grained `ContributionKind` for original
  arguments and refutations.** Closes follow-up (a) named in
  `lib/contributor-awards.ts` and under the "🏆 Top Contributor Awards"
  bullet in the Research Crowdsourcing Organizer Features list in TODO.md: a
  finer-grained `ContributionKind` (or separate tag) for "original argument"
  and "refutation" contributions, neither of which exists as a distinct kind
  today. Adds `"original-argument"` and `"refutation"` to
  `community-rating.ts`'s `ContributionKind` union, extends
  `contributor-awards.ts`'s `DEFAULT_AWARD_CATEGORY_LABELS`/`kindOrder` with
  "Best Original Argument"/"Best Refutation" categories, and wires the two
  new kinds into every existing kind picker (`ContributionsFeedPanel`,
  `DailyQuestsPanel`, `GroupChallengesPanel`), so a contributor can now
  submit — and win an award for — an original-argument or refutation
  contribution, closing the last open follow-up on the "Top Contributor
  Awards" bullet. Vitest-covered in
  `packages/debate-card-search/test/contributor-awards.test.ts` (new cases
  for both kinds plus the extended stable-order assertion). Docs updated at
  `docs/features/contributor-awards.md`. Verified from a clean install:
  `bun install`, `bun run test` (142 files / 1937 tests passed), `bun run
  typecheck` (11 packages passed), `bun run build` (both buildable packages
  passed) — no repo-wide `lint` script exists.
  [PR #235](https://github.com/debate/debate-ai.com/pull/235).

- **Top Contributor Awards — announce/freeze action.** Closes follow-up (b)
  named under the "🏆 Top Contributor Awards" bullet in the Research
  Crowdsourcing Organizer Features list in TODO.md: "a scheduled job that
  periodically calls `buildTopContributorAwards` and persists/announces the
  winners." This repo has no scheduled-job infrastructure (same caveat
  already noted for the Daily Best Card Challenge's identical follow-up), so
  `debate-card-search` adds `state/contributorAwardAnnouncements.ts`'s
  `buildPersistedTopContributorAwards`/`announceContributorAwards`/
  `listAnnouncedContributorAwards`/`getAnnouncedContributorAwards`, mirroring
  `state/dailyBestCardAnnouncements.ts`'s idempotent-per-UTC-day
  freeze-on-announce pattern exactly: `announceContributorAwards` persists
  the current award standings under a separate
  `contributorAwardAnnouncements` storage key keyed by day, and a later
  same-day contribution that would change the live standings does not
  retroactively change an already-announced result. `ContributorAwardsPanel`
  now shows the live (unannounced) standings plus an "Announce today's
  awards" action (disabled when there's nothing to announce yet) that
  freezes them, and renders the announced history below, reusing
  `buildTopContributorAwardsFromStore` for the live view exactly as before —
  no new scoring or grouping logic. Vitest-covered in
  `packages/debate-card-search/test/contributorAwardAnnouncements.test.ts`
  (empty-store cases, announce-and-persist, the idempotent freeze against a
  later stronger same-day contribution, and the history/lookup helpers).
  Docs updated at `docs/features/contributor-awards.md`. Follow-up (a),
  a finer-grained `ContributionKind` (or separate tag) for "original
  argument" and "refutation" contributions, remains open — already being
  addressed by a separate, independent PR
  ([#228](https://github.com/debate/debate-ai.com/pull/228)) at the time
  of this entry. `bun run typecheck` (11 packages, all pass), `bun run
  test` (142 files / 1936 tests, all pass), and `bun run build` all pass.
  No repo-wide `lint` script exists (checked root/package `package.json`
  scripts), matching this bullet's prior entries. PR:
  [#233](https://github.com/debate/debate-ai.com/pull/233).
- **Legacy Verbatim / Cardmirror Compatibility — send-to-speech-document
  command.** Closes follow-up (b) named under idea #14 ("Legacy Verbatim /
  Cardmirror Compatibility") in the Product Feature Ideas list: "a 'send
  selected evidence to a speech document' command" — the last open gap
  noted in `docs/features/legacy-verbatim-shortcuts.md`'s "Known gaps"
  section. `reason-editor` adds `engine/speech-document.ts`'s
  `SpeechDocument`/`SpeechDocumentBlock` model plus
  `createSpeechDocument`/`buildSpeechDocumentBlock` (null for
  blank/whitespace-only text)/`appendSpeechDocumentBlock`/
  `removeSpeechDocumentBlock`/`buildSpeechDocumentText`, and
  `state/speechDocuments.ts` (mirroring the existing
  `collapsedHeadings.ts` localStorage-persistence convention — the second
  such store in this package) for list/get/save/delete plus
  `findSpeechDocumentByTitle` and `sendSelectionToSpeechDocument`
  (find-or-create by title, then build+append+save a block). A new
  `Mod-Shift-S` keyboard shortcut and "→Speech" toolbar button
  (`verbatim-shortcuts-extension.ts`'s
  `sendSelectionToSpeechDocumentViaPrompt`, wired into
  `Toolbar.tsx`) send the live editor selection — tagged with the
  editor's `exportName` as the block's `sourceLabel` — to a
  named speech document, prompting for its title and confirming with a
  short alert. A new `SpeechDocumentsPanel` renders every persisted speech
  document with its blocks (per-block "Remove"), a plain-text preview, and
  a per-document "Delete" action, mounted at `/speech-documents`.
  Vitest-covered in `packages/reason-editor/test/speech-document.test.ts`
  (model/pure-helper success and blank-text/no-op cases) and
  `packages/reason-editor/test/speechDocuments.test.ts` (persistence
  CRUD, corrupt/non-array storage, case-insensitive title matching,
  find-or-create send semantics, blank-text no-op). No follow-ups remain
  open on idea #14.
- **Shared, Ai-Generated Debate Flow — Common Argument Library flow-note
  suggestions.** Closes follow-up (c) named under idea #16 ("Shared,
  Ai-Generated Debate Flow") in the Product Feature Ideas list: "composing
  the Common Argument Library's tagged card corpus to suggest (not
  auto-apply) a pre-filled flow note from matching evidence." `debate-round`
  adds `flow/flow-note-suggestions.ts`'s `deriveLibraryCardKeywords`
  (mirroring `debate-card-search`'s `llm-card-scoring.ts#deriveArgBlockKeywords`
  — each of a `LibraryCard`'s `argBlock`/`topic`/`caseArea`/`tags` phrases
  kept whole plus its individual words over two characters),
  `suggestFlowNotesFromLibrary` (scores every card in a corpus against a
  query by reusing `scoreRelevance` directly, dropping zero-score cards,
  ranking by score with a deterministic id tie-break, and capping at a
  limit), and `buildFlowNoteFromCard` (formats a matched card into
  insertable note text). `debate-card-search`'s
  `state/evidenceLibraryEntries.ts` adds `listCombinedPersistedLibraryCards`,
  the same evidence-library-plus-tagged-contributions corpus
  `buildCombinedPersistedArgumentLibrary` already composed, now exposed flat
  for a caller (like this one) that scores individual cards instead of
  browsing the organized library; `buildCombinedPersistedArgumentLibrary`
  itself now composes that new function rather than duplicating the logic.
  `FlowEditLogPanel` loads the combined corpus on mount and, as the
  contributor types the edit's Content field, renders a "Suggested from
  Common Argument Library" list (recomputed via `useMemo`) with an Insert
  action per suggestion that fills Content with the card's formatted note —
  still fully editable before logging, never applied to the box
  automatically, keeping this idea's "keep humans in control of the actual
  flow" requirement intact. This is the last open follow-up on idea #16;
  only follow-up (a) (a live transport syncing edits across a room/team in
  real time) remains open. Vitest-covered in
  `packages/debate-round/test/flow-note-suggestions.test.ts` (keyword
  derivation, blank-query/no-match/matching/ranking/limit/tie-break cases,
  and note-formatting with and without tags) and a new
  `listCombinedPersistedLibraryCards` describe block in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`. Docs
  updated at `docs/features/shared-flow-sync.md`. `bun run test` (1898
  tests), `bun run typecheck` (11 packages), and `bun run build` all pass;
  no repo-wide `lint` script exists (checked root/package `package.json`
  scripts) so none was run, matching this bullet's prior entries.

- **Topic Coverage Dashboard — Contributions Feed as a second real
  argBlock/word-count source.** Closes follow-up (a) named under the
  "📊 Topic Coverage Dashboard" bullet in the Research Crowdsourcing
  Organizer Features list: "an `argBlock`/word-count field wired into a
  real card-submission flow beyond the existing `/cards/library`
  evidence-library form." `lib/contribution-leaderboard.ts`'s
  `AttributedContribution` gains an optional `wordCount` field, matching
  `topic-coverage.ts`'s `CoverageCardSummary.wordCount` tagging.
  `ContributionsFeedPanel` gains an optional "Content" body-text field
  (with a live word-count readout) that stamps `wordCount` on submission
  via the existing `computeWordCount` helper — the same one
  `EvidenceLibraryPanel` already uses. `state/trackedArguments.ts`'s
  `buildPersistedTopicCoverageReport` now composes every topic-scoped
  Contributions Feed entry carrying both `argBlock` and `wordCount`
  alongside the existing evidence-library entries into the coverage
  report, so a card submitted through either flow counts toward a
  topic's coverage. A contribution missing either field (both stay
  optional, matching the rest of that form) is silently excluded rather
  than counted with a fabricated word count. Vitest-covered by four new
  cases in `packages/debate-card-search/test/trackedArguments.test.ts`.
  Docs updated at `docs/features/topic-coverage-dashboard.md`. `bun run
  test` (1885 tests), `bun run typecheck` (11 packages), and `bun run
  build` all pass; no repo-wide `lint` script exists (checked
  root/package `package.json` scripts), matching this bullet's prior
  entries.

- **Shared, Ai-Generated Debate Flow — FlowSpreadsheet edit-review/log
  affordance.** Closes the remaining half of follow-up (b) named under idea
  #16 ("Shared, Ai-Generated Debate Flow") in the Product Feature Ideas
  list: "a `FlowSpreadsheet`-grid affordance for logging/reviewing an edit
  (today's `FlowEditLogPanel` is a separate form, not part of the grid
  itself)." `debate-round` adds `flow/edit-cells.ts`'s
  `sortEditsNewestFirst` (reusing `annotation-cells.ts`'s
  `boxPathForCell`/`columnIndexFromField` directly — box-path derivation is
  generic to any per-cell, box-addressed feature, not specific to
  annotations), `state/flowEdits.ts`'s `listFlowEditsForBox` (mirroring
  `flowAnnotations.ts#listFlowAnnotationsForBox`), `flow/EditBadge.tsx` (a
  commit-icon badge that, unlike `AnnotationBadge`, always renders — a box
  with zero edits is exactly when a contributor wants to log one), and
  `flow/EditReviewPopover.tsx` (a fixed-position overlay mirroring
  `GridContextMenu`'s click-outside/Escape-to-close pattern, since an AG
  Grid cell clips normal in-flow content). `AnnotationCellRenderer` and
  `FirstColumnCellRenderer` now render `EditBadge` alongside the existing
  `AnnotationBadge`, and `useFlowGridConfig`/`FlowSpreadsheet` wire an
  `onOpenEditReview` callback (positioning the popover from the clicked
  badge's event, the same way `onCellContextMenu` positions
  `GridContextMenu`) into both renderers. A contributor can now see and log
  a box's proposed edits directly from the live grid instead of switching
  to the separate `FlowEditLogPanel` form on the Coach hub. Vitest-covered
  in `packages/debate-round/test/edit-cells.test.ts`,
  `packages/debate-round/test/EditBadge.test.tsx`, and a new
  `listFlowEditsForBox` describe block in
  `packages/debate-round/test/flowEdits.test.ts`. Docs updated at
  `docs/features/shared-flow-sync.md`. `bun run test` (1881 tests), `bun
  run typecheck` (11 packages), and `bun run build` all pass; no
  repo-wide `lint` script exists (checked root/package `package.json`
  scripts) so none was run, matching this bullet's prior entries.

- **LLM Card Scoring — real argument-block keywords and a real submitted-card
  corpus.** Closes follow-up (b) named under the "🧠 LLM Card Scoring" bullet
  in the Research Crowdsourcing Organizer Features list: "wiring real
  argument-block keywords and a real submitted-card corpus into the scorer."
  `lib/llm-card-scoring.ts` adds `deriveArgBlockKeywords`, a pure helper
  turning a topic's tracked argument-block labels (e.g. "Warming DA") into
  `scoreRelevance`-ready keywords — the label itself plus its individual
  words (longer than two characters, so short tags like "DA"/"CP" don't
  drown out real words). `state/cardScores.ts` adds
  `deriveArgBlockKeywordsForTopic`, composing that pure helper against a
  topic's already-persisted tracked-argument checklist
  (`state/trackedArguments.ts`), and `buildRealCorpusTexts`, pulling every
  persisted Shared Evidence Library entry's text
  (`state/evidenceLibraryEntries.ts`) as the real, site-wide uniqueness
  comparison corpus — `buildPersistedCardScoreRanking` now passes that corpus
  into `rankCardScores` by default, so a submitted card is flagged as a
  likely duplicate against the team's actual shared card repository, not
  just other cards submitted through this scoring form. `CardScoringPanel`
  gains a topic switcher (mirroring `TopicCoverageDashboardPanel`'s pattern)
  and a "Use tracked keywords" action that fills the keywords field from
  `deriveArgBlockKeywordsForTopic`, still editable before submitting — a
  topic with no tracked arguments yet, or no topic chosen at all, still
  falls back to hand-typed keywords so ad hoc scoring keeps working. No
  follow-ups remain open on this bullet. Docs updated at
  `docs/features/llm-card-scoring.md`. `bun run test` (1859 tests), `bun run
  typecheck` (11 packages), and `bun run build` all pass; no repo-wide
  `lint` script exists (checked root/package `package.json` scripts) so
  none was run, matching this bullet's prior entries.

- **Team Collaboration Mode — persisted topic-sprint composition.** Closes
  follow-up (b) named under the "🤝 Team Collaboration Mode" bullet in the
  Research Crowdsourcing Organizer Features list: "persisting a topic
  sprint's other inputs (so the full `buildTopicSprint` composition can be
  rendered, not just the note thread)." Previously
  `panels/TopicSprintPanel.tsx` — an existing panel rendering
  `team-collaboration-mode.ts`'s full `buildTopicSprint` composition (quest
  board, task routing, progress board, notes) — required its caller to
  hand-supply `quests`/`contributions`/`coverageReport`/`assignments` on
  every render; only `contributors` and `notes` already defaulted to
  persisted state. Its one real caller, `apps/debate-ai.com/components/
  research/ResearchHub.tsx`'s Sprint tab, worked around this by hand-
  deriving a coverage report straight from the evidence library and always
  passing `contributions: []`, so the quest board could never show real
  progress and the coverage report ignored the topic's own tracked-argument
  checklist. `debate-card-search` adds `state/topicSprints.ts`
  (`readPersistedTopicSprintInputs`/`buildPersistedTopicSprint`), composing
  all six `buildTopicSprint` inputs from their own already-persisted
  stores — `state/dailyQuests.ts`'s quest templates, `state/contributions.ts`'s
  timestamped contributions, `state/trackedArguments.ts`'s
  `buildPersistedTopicCoverageReport`, `state/contributorAvailability.ts`,
  a new `state/researchProgress.ts` `listTrackedAssignmentsForTopic`
  (this topic's completed-plus-still-active assignments, scoped down from
  the same completed-task history and routed queues
  `buildPersistedResearchProgressBoard` already reads across every topic),
  and `state/sprintNotes.ts` — mirroring `state/prepRooms.ts`'s
  `buildPersistedPrepRoom` "compose every input from its own store"
  convention rather than requiring a caller to assemble them.
  `TopicSprintPanel` now makes those four props optional, re-reading
  `readPersistedTopicSprintInputs` whenever its `topic` prop changes and
  falling back to it for any prop the caller doesn't override, and
  `ResearchHub.tsx`'s Sprint tab now just passes a `topic`, dropping its
  hand-derived coverage report, quest list, and routing-based assignment
  list entirely. `sprint.routing` itself is unchanged — it's still a live
  re-route of the topic's current coverage gaps against current contributor
  availability, not a readback of whatever was last routed and saved to
  `routedTaskQueues.ts`; only `sprint.progressBoard` reads the persisted
  routed/completed assignments. Vitest-covered in
  `packages/debate-card-search/test/topicSprints.test.ts` (each input read
  individually against an empty store and a populated one, plus an
  end-to-end composed sprint) and a new `listTrackedAssignmentsForTopic`
  describe block in `test/researchProgress.test.ts` (empty/combined/topic-
  scoped-exclusion cases). No follow-ups remain open on this bullet. Docs
  updated at `docs/features/team-collaboration-mode.md`. `bun run test`
  (1848 tests), `bun run typecheck`, and `bun run build` all pass; no
  repo-wide `lint` script exists (checked root/package `package.json`
  scripts) so none was run, matching this bullet's prior entries.

- **Common Argument Library — Contributions Feed topic/caseArea/tags
  wiring.** Closes follow-up (a) named under the "📚 Common Argument
  Library" bullet in the Research Crowdsourcing Organizer Features list:
  "wiring a `topic`/`caseArea`/`tags` field into wherever submitted cards
  are eventually persisted beyond the existing evidence-library store."
  Previously the Common Argument Library (`/cards/argument-library`) only
  organized entries submitted through the dedicated `/cards/library`
  Evidence Library form — a contribution submitted through the more
  general-purpose Contributions Feed (`/cards/contributions`) had no way to
  be filed into a topic folder or tag collection, since
  `contribution-leaderboard.ts`'s `AttributedContribution` carried no
  `topic`/`caseArea`/`tags` fields at all. `contribution-leaderboard.ts`
  adds optional `topic`/`caseArea`/`tags` fields to
  `AttributedContribution`, mirroring its existing optional `argBlock`
  convention. `argument-library.ts` adds `contributionToLibraryCard` (a
  pure conversion from a tagged contribution to a `LibraryCard`, excluding
  a contribution missing `topic` or `caseArea` — both required on
  `LibraryCard` but optional on a contribution, since not every
  contribution is filed into the library — and falling back to
  `"Untagged"`/`0` for `argBlock`/`wordCount`, since a contribution carries
  no card body to measure a real word count from) and
  `buildLibraryCardsFromContributions`. `state/evidenceLibraryEntries.ts`
  adds `buildCombinedPersistedArgumentLibrary`, composing the persisted
  evidence-library repository with every persisted, tagged Contributions
  Feed submission (via `state/contributions.ts`'s already-exported
  `listContributions`) into one combined library.
  `ContributionsFeedPanel.tsx`'s submission form gains optional Topic/Case
  area/Tags fields (plumbed the same optional-spread way as the existing
  Argument block field) and a per-entry badge row rendering
  `topic`/`caseArea`/`tags` when present. `ArgumentLibraryPanel.tsx` now
  reads through `buildCombinedPersistedArgumentLibrary` instead of the
  evidence-library-only `buildPersistedArgumentLibrary` (which remains,
  unchanged, for any other caller). No follow-ups remain open on this
  bullet. Vitest-covered in
  `packages/debate-card-search/test/argument-library.test.ts`
  (`contributionToLibraryCard`'s tagged/defaulted/missing-topic/
  missing-caseArea/both-missing cases, `buildLibraryCardsFromContributions`'
  filtering) and `evidenceLibraryEntries.test.ts` (`buildCombinedPersistedArgumentLibrary`'s
  empty/evidence-only/combined/excluded-contribution cases). `bun run test`
  (1847 tests), `bun run typecheck`, and `bun run build` all pass; no
  repo-wide `lint` script exists, matching this file's prior entries.

- **Outline Filters and Argument Tree View — argument-type/contributor/
  evidence-status tagging.** Closes follow-up (b) named under the "Outline
  Filters and Argument Tree View" bullet (idea #10) in the Product Feature
  Ideas list: "finer argument-type tagging (link/impact/turn/answer/
  extension) and contributor/evidence-status fields, none of which exist in
  the `Box`/`Flow` schema today." Previously `argument-tree.ts`'s
  `ArgumentTreeNode`/`ArgumentTreeFilter` could only distinguish
  heading-vs-argument rows and filter by speech/side/unanswered status,
  since `debate-core`'s `Box` type carried no argument-role, authorship, or
  evidence-support metadata. `packages/debate-core/src/types/flow.ts` adds
  an `ArgumentType` union (`"contention" | "link" | "impact" | "turn" |
  "answer" | "extension"`), an `EvidenceStatus` union (`"cited" |
  "contested" | "unverified"`), and three new optional `Box` fields —
  `argumentType`, `authorId` (mirroring `FlowEdit.authorId`'s existing
  per-edit attribution convention from idea #16), and `evidenceStatus`.
  `flow-transcript-summary.ts`'s `summarizeFlowRow` now reads these off a
  row's underlying `Box` (the same box `isHeading` is already read from)
  onto `FlowRowSummary`, `argument-tree.ts`'s `toNode` carries them onto
  `ArgumentTreeNode`, and `ArgumentTreeFilter` gained matching
  `argumentType`/`authorId`/`evidenceStatus` fields applied in
  `argumentMatches` alongside the existing checks — a heading is still kept
  whenever it has at least one surviving descendant, so the new filters
  compose with the existing heading-grouping behavior for free.
  `ArgumentTreePanel` gets three new filter selects (Argument type,
  Contributor, Evidence status — the first two populated from the tree's
  own distinct values, mirroring the existing Side/Speech select pattern)
  and per-row badges (argument-type badge, contributor id, evidence-status
  badge with "contested" rendered as a destructive badge). No follow-ups
  remain open on this idea; nothing in the live flow-editing UI lets a user
  set these new `Box` fields yet (populating them today requires setting
  them directly on a `Box`), as noted in
  `docs/features/argument-tree-outline.md`'s "Known gaps". Vitest-covered
  in `packages/debate-round/test/flow-transcript-summary.test.ts` (pass-
  through and undefined-when-unset) and `argument-tree.test.ts` (node
  pass-through plus filtering by each new field individually and combined
  with `kind: "argument"`). `bun run test` (1836 tests), `bun run
  typecheck`, and `bun run build` all pass; no repo-wide `lint` script
  exists (checked root/package `package.json` scripts) so none was run,
  matching this bullet's prior entries.

- **Scout-to-Strategy Workflow — AI-panel case-choice evaluation.** Closes
  follow-up (c) named under the "🧭 Scout-to-Strategy Workflow" bullet in the
  Research Crowdsourcing Organizer Features list: "an actual AI-panel
  evaluation of case choice instead of the tag-overlap heuristic." Previously
  `StrategyPanel.tsx`'s case recommendation came entirely from
  `scout-to-strategy.ts`'s deterministic tag-overlap heuristic — no AI
  evaluation of case fit against the judge's tendencies or the matchup's
  risk factors. Adds `round/case-choice-ai.ts` (`buildCaseChoiceAiUserPrompt`/
  `parseCaseChoiceAiResponse`, mirroring `judge-decision-ai.ts`'s
  prompt/parse split) and `round/case-choice-client.ts`
  (`requestCaseChoiceEvaluation`, posting to the existing `/api/reason-ai`
  Anthropic proxy). The prompt composes an already-built
  `StrategyRecommendation`'s own case rankings (name, tags, opponent-tag
  overlap score), judge-adaptation notes, and risk level/factors — no new
  scouting data source is introduced — asking the model to weigh a case's
  fit against the judge's tendencies and the matchup's risk factors, not
  just the raw overlap score. `StrategyPanel.tsx` gets a "Get AI case-choice
  evaluation" action per matchup that calls this and saves the parsed
  `recommendedCase`/`reasoning`/`caseAssessments` on
  `state/strategyRecommendations.ts`'s new
  `StrategyRecommendationRecord.aiCaseChoice` field via the new
  `saveStrategyRecommendationAiCaseChoice` (additive/optional, mirroring
  `drillSets.ts`'s `aiScripts` convention), rendering it alongside the
  deterministic recommendation. Vitest-covered in
  `packages/debate-round/test/case-choice-ai.test.ts` (prompt composition,
  fallback text for empty case options/risk factors, tolerant JSON
  parsing — well-formed, fenced, prose-wrapped, malformed-entry filtering),
  `case-choice-client.test.ts` (the `/api/reason-ai` request contract,
  endpoint override, error propagation, unparseable-response handling,
  mirroring `judge-decision-client.test.ts`), and additions to
  `strategyRecommendations.test.ts` covering
  `saveStrategyRecommendationAiCaseChoice` (set/overwrite/no-op-when-missing/
  leaves-other-matchups-untouched). No follow-ups remain open on this idea.
  `docs/features/scout-to-strategy.md` updated. `bun run test` (1828 tests),
  `bun run typecheck`, and `bun run build` all pass; no repo-wide `lint`
  script exists (checked root/package `package.json` scripts) so none was
  run, matching this bullet's prior entries.

- **Scout-to-Strategy Workflow — side-aware risk heuristic.** Closes
  follow-up (b) named under the "🧭 Scout-to-Strategy Workflow" bullet in
  the Research Crowdsourcing Organizer Features list: "wiring
  `ourSide`/likely opponent side into the risk heuristic." Previously
  `assessMatchupRisk` in `packages/debate-round/src/round/scout-to-strategy.ts`
  flagged any notable opponent side preference or judge side bias as risky,
  without knowing which side our team is running — so it couldn't tell
  whether the opponent's strong side or the judge's favored side was
  actually the side we'd face. `scout-to-strategy.ts` adds
  `getLikelyOpponentSide` (the side opposite `ourSide`, since a round is
  two-sided) and threads an optional `ourSide?: DebateSide` through
  `BuildStrategyRecommendationInput`/`BuildStrategyRecommendationFromStoresInput`
  into `assessMatchupRisk`. When `ourSide` is known, the opponent-side check
  is scoped to their win rate specifically on the likely-opponent side (≥2
  recorded rounds there, ≥65% win rate) instead of any notable side
  preference, and the judge-side check only flags a bias toward the
  likely-opponent side — a bias toward our own side is no longer treated as
  a risk factor. Without `ourSide`, both checks fall back to the prior
  side-agnostic behavior, so existing callers are unaffected.
  `StrategyPanel.tsx` gets an "Our side" selector (Aff/Neg/Unspecified)
  wired into the build action. Vitest-covered in
  `packages/debate-round/test/scout-to-strategy.test.ts` (`getLikelyOpponentSide`
  both directions; `assessMatchupRisk`/`buildStrategyRecommendation`/
  `buildStrategyRecommendationFromStores` with `ourSide` supplied: flags the
  opponent's strong record on the likely-opponent side, does not flag their
  strong record on the side they won't face us on, ignores a likely-side
  record below the 2-round minimum, flags a judge bias toward the
  likely-opponent side, and does not flag a judge bias toward our own
  side). Follow-up (c) — an actual AI-panel evaluation of case choice
  instead of the tag-overlap heuristic — remains open, not started. Docs
  added at `docs/features/scout-to-strategy.md`. No repo-wide `lint` script
  exists (checked root/app/package `package.json` scripts) so none was run.
  Verified from a clean install: `bun install` (2050 packages), `bun run
  test` (133 files / 1806 tests, all pass), `bun run typecheck` (all 11
  in-scope packages pass), and `bun run build:web` (`debate-ai-web`
  succeeds, `/strategy` route present) all pass. PR:
  [#222](https://github.com/debate/debate-ai.com/pull/222).
- **Shared, Ai-Generated Debate Flow — Flow Edit Log + real merge-preview
  data source.** Closes the data-source gap called out under "Feature
  panels" (PR #214) for idea #16 ("Shared, Ai-Generated Debate Flow") in
  Product Feature Ideas: `SharedFlowSyncPanel` merged and flagged
  conflicts in whatever `FlowEdit[]` it was handed, but nothing recorded
  one, so `CoachHub` always passed an empty array and the panel only ever
  rendered its own-edits empty state. `debate-round`'s
  `flow/shared-flow-sync.ts` adds `createFlowEdit`/`CreateFlowEditInput`,
  mirroring `flow-annotations.ts#createFlowAnnotation`'s validation style
  (non-empty `boxPath`, non-blank `authorId`, `content` trimmed and
  length-clamped). A new `state/flowEdits.ts` persists `FlowEdit` records
  to localStorage (`listFlowEdits`/`listFlowEditsForFlow`/`saveFlowEdit`/
  `deleteFlowEdit`/`clearFlowEditsForFlow`), mirroring the existing
  `flowAnnotations.ts`/`prepNotes.ts` convention. A new
  `panels/FlowEditLogPanel.tsx` renders a log-an-edit form (Flow ID,
  Author ID, Box path, Content) plus every logged edit grouped by flow,
  with a "Clear" action per group and an optional `onChange` callback for
  a composing screen. `apps/debate-ai.com/components/coach/CoachHub.tsx`
  now reads every logged edit through `debate-ui`'s `useStoreSnapshot`,
  filters to the round workspace's currently selected flow, hands the
  result to `SharedFlowSyncPanel` as real `edits` (replacing the
  hardcoded `edits={[]}`), mounts `FlowEditLogPanel` alongside it wired to
  refresh that snapshot, and wires `SharedFlowSyncPanel`'s `onApply` to
  write the merged flow back into the round workspace's `useFlowStore`
  and clear the flow's logged edits so an applied edit doesn't linger and
  get re-offered for merging next time. `SharedFlowSyncPanel` itself is
  unchanged — still the only panel driven entirely by props. Follow-ups
  (a) a live transport (e.g. WebSocket) and (c) suggesting a pre-filled
  flow note from matching evidence remain open, not started; follow-up
  (b)'s `FlowSpreadsheet`-grid affordance (as opposed to the separate
  `FlowEditLogPanel` form) is also still open. Vitest-covered in
  `packages/debate-round/test/shared-flow-sync.test.ts` (`createFlowEdit`:
  valid input, trimming, empty-content clearing, length-clamping,
  empty-`boxPath`/blank-`authorId` validation errors) and
  `packages/debate-round/test/flowEdits.test.ts` (empty/corrupt/non-array
  storage, cross-flow listing/ordering, upsert-by-id, delete,
  clear-by-flow). Docs added at `docs/features/shared-flow-sync.md`. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run. Verified: `bun install` (2050 packages),
  `bun run test` (133 files / 1798 tests, all pass), `bun run typecheck`
  (all 11 in-scope packages pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/coach` route present) all pass. PR:
  [#221](https://github.com/debate/debate-ai.com/pull/221).
- **Flow-in-Speech Flow Annotations — `FlowSpreadsheet` annotation
  affordance.** Closes follow-up (b) under idea #15 ("Flow-in-Speech Flow
  Annotations") in Product Feature Ideas: "a flow-grid affordance
  (`FlowSpreadsheet`) that surfaces annotations on their box via
  `listFlowAnnotationsForBox` and links back to the timestamp." New
  `debate-round`'s `flow/annotation-cells.ts` adds `boxPathForCell` (derives
  a grid cell's `boxPath` from its row's `originalIndex` and column index,
  matching how `dataTransform.ts#buildRowData` flattens a box chain via
  `children[0]`), `columnIndexFromField`, and `pickJumpAnnotation` (earliest
  annotation by timestamp). `flow/AnnotationBadge.tsx` renders a small clock
  badge (tooltip listing every annotation's formatted timestamp + note) on
  any cell whose box has a persisted `FlowAnnotation`; a new
  `flow/AnnotationCellRenderer.tsx` wires it into every `FlowSpreadsheet`
  column after the first, and `FirstColumnCellRenderer.tsx` now renders the
  same badge alongside its existing heading/indent/chevron behavior.
  Clicking a badge calls a new `handleJumpToAnnotation` in
  `FlowSpreadsheet.tsx` that reuses `FlowAnnotationsPanel.handleJump`'s
  exact `sendYouTubeCommand`/`useVideoPlayerStore` mechanism and guard
  (seeks/plays only when the annotation's `videoId` matches the recording
  currently loaded in the persistent player; otherwise a no-op). No new
  annotation data model or persistence changes — this composes the
  already-existing `flow/flow-annotations.ts` +
  `state/flowAnnotations.ts` with the live grid. No follow-ups remain open
  on idea #15. Vitest-covered in
  `packages/debate-round/test/annotation-cells.test.ts` (box-path
  derivation including the negative-column-index clamp, field parsing, and
  earliest-annotation selection including a non-mutation check) and
  `packages/debate-round/test/AnnotationBadge.test.tsx` (empty vs.
  populated render, singular/plural wording, tooltip content). Verified:
  `bun run test` (132 files / 1781 tests, all pass), `bun run typecheck`
  (11 of 12 in-scope packages have a typecheck script; all pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/debate` and
  `/annotations` routes present) all pass. No repo-wide `lint` script
  exists, so none was run.
  PR: [#220](https://github.com/debate/debate-ai.com/pull/220).
- **Common Argument Library — tag-autocomplete affordance.** Closes
  follow-up (c), "a tag-autocomplete/tag-management affordance," under the
  "📚 Common Argument Library" bullet in Research Crowdsourcing Organizer
  Features. `debate-card-search`'s `lib/argument-library.ts` adds
  `parseTagsInput` (splits a comma-separated tags field into its
  already-completed tags and the in-progress fragment still being typed
  after the last comma), `applyTagSuggestion` (replaces that fragment with a
  chosen suggestion, leaving a trailing `", "` so typing can continue), and
  `suggestTags` (ranks a known-tag corpus against the in-progress fragment —
  case-insensitive prefix matches first, then substring matches, each group
  alphabetical — excluding tags already added to the field and the exact tag
  already typed in full, capped at a default of 8). `state/
  evidenceLibraryEntries.ts`'s new `listPersistedTags` supplies that corpus
  by reusing `buildTagCollections` over the persisted evidence repository
  directly, rather than introducing a separate tag registry. `
  EvidenceLibraryPanel`'s Tags field now renders the live suggestions (and
  refreshes its known-tag corpus after every save) as click-to-append
  buttons beneath the input, so a contributor reuses an existing tag instead
  of coining a near-duplicate, without changing the field's existing
  free-text, comma-separated shape. Tag renaming/merging across existing
  entries — the fuller "tag-management" half of the follow-up's name — is
  out of scope; nothing in this repo persists a separate tag registry to
  manage, and rewriting every entry that carries a renamed tag is a
  separate, riskier slice than autocomplete. Vitest-covered in
  `packages/debate-card-search/test/argument-library.test.ts` (`
  parseTagsInput`'s trailing-comma/blank-segment/no-comma cases,
  `applyTagSuggestion`'s first-tag/mid-field/trailing-comma cases, and
  `suggestTags`'s empty-query, prefix-vs-substring ranking, case-insensitive
  matching, exclude-already-added, exclude-exact-match, default/explicit
  limit, and case-insensitive-dedup cases). Verified: `bun run test` (130
  files / 1769 tests, all pass), `bun run typecheck` (11 of 12 in-scope
  packages have a typecheck script; all pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/cards/library` route present) all pass. No
  repo-wide `lint` script exists, so none was run.
  PR: [#219](https://github.com/debate/debate-ai.com/pull/219).
- **Team Collaboration Mode / Collaboration Prep Room — shared "active now"
  presence signal.** Closes follow-up (c) under the "🤝 Team Collaboration
  Mode" bullet in Research Crowdsourcing Organizer Features ("a
  presence/live-status signal for who's currently active") and, reusing the
  exact same primitive, follow-up (b) under the "🧑‍🤝‍🧑 Collaboration Prep
  Room" bullet ("a live presence/who's-active signal") — TODO.md's own
  earlier note on the Prep Room entry already flagged these as the same
  signal. There's no WebSocket (or other live-transport) infrastructure
  anywhere in this repo, so presence is modeled as an explicit,
  caller-recorded heartbeat rather than a push signal: new
  `debate-card-search`'s `lib/topic-presence.ts` adds a `PresenceHeartbeat`
  model (one heartbeat per topic + contributor pair, upserted via
  `recordPresenceHeartbeat`) and `listActiveContributors`, which treats a
  contributor as "active" only while their most recent heartbeat for that
  topic is within a freshness window (5 minutes by default, via
  `DEFAULT_PRESENCE_STALE_AFTER_MS`). `state/topicPresence.ts` persists
  heartbeats to localStorage under `topicPresenceHeartbeats`, mirroring the
  existing `sprintNotes.ts`/`prepNotes.ts` persistence convention. Wired into
  both already-shipped panels: `SprintNotesPanel.tsx` (`/cards/collaboration`)
  now renders each topic group's live "active now" roster plus a "Your ID" +
  "I'm active here" control per topic, and `PrepRoomPanel.tsx`
  (`/cards/prep-room`) renders the same roster/control for its single open
  topic — both re-poll `listPersistedActiveContributors` every 30 seconds
  client-side so a contributor who goes quiet drops off the roster without
  needing a new write. No changes to either panel's existing note/search/
  routing behavior. Vitest-covered in
  `packages/debate-card-search/test/topic-presence.test.ts` (pure
  heartbeat-upsert and freshness-window logic, including the exact
  stale-boundary millisecond and future-timestamped clock-skew cases) and
  `test/topicPresence.test.ts` (the persisted store, including corrupt/
  non-array localStorage recovery). No follow-ups remain open on either
  bullet. Verified: `bun run test` (130 files / 1751 tests, all pass),
  `bun run typecheck` (11 of 12 in-scope packages have a typecheck script;
  all pass), and `bun run build:web` (`debate-ai-web` succeeds, both
  `/cards/collaboration` and `/cards/prep-room` routes present) all pass. No
  repo-wide `lint` script exists, so none was run.
  PR: [#218](https://github.com/debate/debate-ai.com/pull/218).
- **Daily Quests and Targets — streak/reward layer on the quest board.**
  Closed follow-up (c) under the "🎯 Daily Quests and Targets" bullet in
  Research Crowdsourcing Organizer Features: "a streak/reward layer once
  the Gamified Quests idea's streak logic is composed in." Added
  `buildStreakRewardText` to `lib/gamified-quests.ts` — a pure helper that
  renders a contributor's already-computed `ContributorQuestStreak` as a
  reward line, calling out a badge earned exactly today separately from
  badges earned on prior days — and wired a "Your streak" section into
  `DailyQuestsPanel` with a "Record today's mission" action that composes
  the existing `computeAndSavePersistedDailyMissionResult`/
  `buildPersistedContributorQuestStreak` from `state/dailyMissionResults.ts`
  (the same helpers `QuestStreaksPanel` already used). No changes to any
  persistence or streak-computation logic — this is a composition and
  reward-messaging layer only. No follow-ups remain open on this bullet.
  Merged as [PR #217](https://github.com/debate/debate-ai.com/pull/217).
  Vitest-covered in `packages/debate-card-search/test/gamified-quests.test.ts`
  (6 new cases: no streak yet, continuing an existing streak, a plain
  non-milestone completion, a freshly-earned milestone badge, not
  re-announcing a badge earned on a prior day, and a custom milestone
  list). Docs added in `docs/features/daily-quests.md`. Verified:
  `bun run test` (125 files / 1701 tests, all pass), `bun run typecheck`
  (11 of 12 in-scope packages have a typecheck script; all pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/cards/quests` route
  present) all pass; `codecov/patch` and `codecov/project` both reported
  success on the PR. No repo-wide `lint` script exists, so none was run.
  The PR's only failing check was `Vercel` (account-wide "Deployment rate
  limited — retry in 24 hours"), the same infra-level daily quota that hit
  PR #209 earlier the same day — unrelated to this diff, confirmed via the
  identical error message and target URL, and nothing to fix in code.
- **Word-Count-Only Speech Format — live-round word-limited speech mode.**
  Closed follow-up (b) under idea #2 ("Word-Count-Only Speech Format"):
  "extending `useTimerState`/`SpeechTimer` to support a non-timed,
  word-limited speech mode in the live round timer itself." Added
  `round/word-count-speech-mode.ts` (limit resolution, mode state, store
  round-trip through the existing `wordCountRounds` store),
  `hooks/useWordCountSpeechMode.ts`, and `debate-timer`'s
  `SpeechWordCounter`, wiring a word-limit toggle into `SpeechHeaderBar`
  that replaces the live countdown with a `words / limit` meter. Merged as
  [PR #209](https://github.com/debate/debate-ai.com/pull/209). Vitest-covered
  in `packages/debate-round/test/word-count-speech-mode.test.ts` (18 tests).
  Verified: `bun run test`, `bun run typecheck`, `bun run build:web` all
  pass. Correction to this PR's own docs: `docs/features/word-count-rounds.md`
  had flagged "the mobile `FlowPageHeader` countdown is unchanged" as a known
  gap, but `FlowPageHeader.tsx` is dead code — it is not imported or rendered
  anywhere in the app. The component actually used for both desktop and
  mobile (via its `onMobileMenuClick` prop, wired in `DebateRoundPanel.tsx`
  whenever `state.isMobile`) is `SpeechHeaderBar` itself, which already
  renders the word-limit toggle and `SpeechWordCounter` in every layout mode
  (split view and spreadsheet view alike). So the mobile experience already
  has the word-limit meter; no further follow-up is needed on this idea.
- **Community-Rated Summaries and Highlights — real reviewer-credibility
  system.** Closes follow-up (b) under idea #11 ("Community-Rated Summaries
  and Highlights") in the Product Feature Ideas list: "a real
  reviewer-credibility system instead of a caller-supplied weight per
  endorsement (the feed's 'Endorse' button records a fixed full-credibility
  placeholder)". `debate-card-search`'s `lib/community-rating.ts` gains
  `computeReviewerCredibility(reviewerContributions, weights?)` (pure) —
  derives a 0-1 endorsement-credibility weight from a reviewer's own scored
  contribution history: the average blended helpfulness score of their own
  contributions (via the existing `computeHelpfulnessBreakdown`), dampened
  toward a `MIN_REVIEWER_CREDIBILITY` (0.1) floor while their contribution
  count is below a saturation threshold (5), so one or two lucky
  contributions can't buy full endorsement weight immediately, and a
  reviewer with no contributions of their own still gets a low, non-zero
  floor weight rather than nothing. `state/contributions.ts` gains
  `recordPersistedEndorsementFromReviewer(id, reviewerId)`, composing this
  with the existing `listContributionsByContributor`/`recordPersistedEndorsement`
  to look up the endorsing reviewer's own persisted contributions, derive
  their credibility, and record the endorsement — the existing
  `recordPersistedEndorsement(id, reviewerWeight)` (raw-weight) function is
  unchanged and still used internally. `ContributionsFeedPanel.tsx`'s
  "Endorse" action now requires a typed "Reviewer ID" (mirroring
  `ReviewQueuePanel`'s existing reviewer-id-input convention) instead of
  always recording a fixed `reviewerWeight: 1`. Vitest-covered in
  `packages/debate-card-search/test/community-rating.test.ts`
  (`computeReviewerCredibility`: no-history floor, dampened low-history
  case, saturated high-history case, history-count cap, strong-vs-weak
  track record ordering, never exceeds 1) and
  `packages/debate-card-search/test/contributions.test.ts`
  (`recordPersistedEndorsementFromReviewer`: derives weight from the
  reviewer's real persisted history, floors at `MIN_REVIEWER_CREDIBILITY`
  for an unknown reviewer, no-op for a missing contribution id). Docs
  updated at `docs/features/contribution-leaderboard.md`'s "Known gaps".
  Verified: `bun install` (2050 packages), `bun run test` (123 files / 1670
  tests, all pass), `bun run typecheck` (all 12 in-scope packages pass),
  and `bun run build:web` (`debate-ai-web` succeeds) all pass. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run. PR: [#216](https://github.com/debate/debate-ai.com/pull/216).
- **Feature panels — shared panel kit, two workspace hubs, and the two
  remaining slice panels.**
  [PR #214](https://github.com/debate/debate-ai.com/pull/214).
  `packages/debate-ui/src/panels/panel-shell.tsx` adds the shared panel
  vocabulary (`PanelShell`/`PanelSection`/`StatGrid`/`StatTile`/`MeterBar`/
  `Pill`/`PanelRow`/`EmptyState`/`SummaryText`/`LabeledField`, with one
  five-value tone scale — neutral/info/positive/warning/critical — that the
  coverage, status and risk vocabularies across the slices all map onto), and
  `packages/debate-ui/src/panels/use-store-snapshot.ts` adds the hook a
  props-free panel reads a store through: it defers the `localStorage` read to
  an effect after mount so a server render and the first client render agree,
  and hands back a `refresh()` for panels that write.
  <br />
  This PR was opened against a tree where almost no slice had a screen yet and
  proposed one panel per slice. By the time it merged, every one of those
  slices had already grown its own panel on master, mounted on its own route
  and — for card scoring, the AI-versus round, the evidence library, the
  brainstorm board and flow annotations — wired to a real `/api/reason-ai`
  call this PR's versions did not have. Those panels were kept as they are;
  only the two panels covering a slice with no screen at all landed here:
  `debate-card-search`'s `TopicSprintPanel` (the full `buildTopicSprint`
  composition — quest board, routing, per-contributor progress and the shared
  note wall for one topic, where `SprintNotesPanel` renders only the notes,
  closing follow-up (b) under "🤝 Team Collaboration Mode") and
  `debate-round`'s `SharedFlowSyncPanel` (a merge preview over
  `flow/shared-flow-sync.ts`, flagging boxes two partners edited within the
  same conflict window). Each package's `src/panels/index.ts` is now a barrel
  its `src/index.ts` re-exports wholesale, so a new panel no longer needs a
  second export line.
  <br />
  **App surface** — `/research` (`components/research/ResearchHub.tsx`) and
  `/coach` (`components/coach/CoachHub.tsx`) are tabbed hubs grouping every
  existing panel by the stage of work it belongs to, both reachable from the
  dock's settings menu. The individual `/cards/*` and round routes still mount
  the same panels one at a time; the hubs are the view for working across
  them. Since each panel reads its own store, the hubs are almost pure
  navigation — the exceptions are the two prop-driven panels above, for which
  the research hub derives the coverage report, coverage quests and routed
  assignments from the persisted evidence library and availability profiles,
  and the coach hub passes the flow currently selected in the round
  workspace's zustand store. Where no data source exists yet (quest
  contributions carry no timestamp in the contribution store, and nothing
  records `FlowEdit`s), the hub passes an empty list and the panel renders its
  own empty state instead of fabricating data.
  <br />
  `reason-editor`'s existing `OutlineNavPanel` already covers the outline nav
  this PR also proposed — and additionally syncs the collapsed set into the
  live `collapsedHeadingsPlugin` and offers per-heading Move ↑/↓ — so its
  `OutlinePanel` was dropped rather than added alongside. Vitest-covered by
  render tests in `packages/debate-ui/test/panel-shell.test.tsx`,
  `packages/debate-card-search/test/panels.test.tsx` (`TopicSprintPanel`) and
  `packages/debate-round/test/panels.test.tsx` (`SharedFlowSyncPanel`) —
  these render through `react-dom/server` rather than a DOM testing library,
  since every package's Vitest environment is `node`. No repo-wide `lint`
  script exists (checked root/app/package `package.json` scripts) so none was
  run. Verified: `bun install`, `bun run typecheck` (all 11 in-scope packages
  pass), `bun run test`, and `bun run build:web` (`debate-ai-web` succeeds,
  `/research` and `/coach` routes present) all pass.
- **Daily Best Card Challenge — persisted announcements.**
  [PR #192](https://github.com/debate/debate-ai.com/pull/192).
  Closes follow-up (b) under the "🕵️ Daily Best Card Challenge" bullet in
  Research Crowdsourcing Organizer Features — "a scheduled job or view that
  persists/announces the day's winner." Follow-ups (a) and (c) were already
  closed by the earlier "Daily Best Card Challenge — banner/widget UI" slice
  below, which composes `state/contributions.ts`'s
  `buildDailyBestCardsFromStore`/`getTodaysBestCardFromStore` — themselves
  reading the `submittedAt` timestamp `ContributionsFeedPanel` already stamps
  on every submission — into the `/cards/best-card` banner. A new
  `packages/debate-card-search/src/state/dailyBestCardAnnouncements.ts` layers
  announcements on top of those existing store helpers rather than re-reading
  and re-narrowing the contribution store itself:
  `buildPersistedDailyBestCards`/`getPersistedBestCardForDay` delegate to them
  (so every result stays an `AttributedDailyBestCard`, keeping the winner's
  `contributorId`), and `announceDailyBestCard` freezes a day's computed
  winner under a separate `dailyBestCardAnnouncements` localStorage key, keyed
  by UTC day. It is idempotent, so a stronger card submitted after a day is
  announced does not retroactively change that day's recorded winner.
  `listAnnouncedDailyBestCards`/`getAnnouncedDailyBestCard` read that
  announcement history back. `DailyBestCardPanel` (still mounted at
  `/cards/best-card`, reachable from the global dock's Settings menu as
  "Daily Best Card") now renders today's live leader — with its contributor,
  helpfulness score, likes, and saves — behind an "Announce today's winner"
  action, showing the frozen announced winner for the day once announced,
  plus the history of previously announced days. No follow-ups remain open on
  this idea. Documented in `docs/features/daily-best-card.md`. Vitest-covered
  in `packages/debate-card-search/test/dailyBestCardAnnouncements.test.ts`
  (empty-store cases, filtering out non-card and undated contributions,
  the live-leader lookup, announce/idempotency including the
  later-stronger-card-doesn't-change-the-announcement case, and listing/
  lookup of announced history). No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run. Verified:
  `bun install` (2050 packages), `bun run test`, `bun run typecheck` (all 11
  in-scope packages pass), and `bun run build:web` (`debate-ai-web` succeeds,
  `/cards/best-card` route present, no new route) all pass.
- **Gamified Quests — daily mission-check trigger UI.**
  Closes follow-up (a) under the "🎮 Gamified Quests" bullet in the
  Research Crowdsourcing Organizer Features list — "a real trigger, i.e. a
  UI action or scheduled job, to call
  `computeAndSavePersistedDailyMissionResult` on an actual cadence." No
  scheduled-job/cron infrastructure exists anywhere in this repo (every
  feature here is client-side, localStorage-backed), so this closes the
  follow-up with a UI action rather than a background job.
  `debate-card-search`'s `QuestStreaksPanel` (at `/cards/streaks`) gains a
  "Run today's mission check" form — a free-text contributor id (mirroring
  `DailyQuestsPanel`/`ContributionsFeedPanel`'s existing no-auth
  convention, since no contributor identity/auth system exists) plus a
  button that calls the already-existing
  `computeAndSavePersistedDailyMissionResult(contributorId,
  listQuestTemplates(), Date.now())` — composing `state/dailyQuests.ts`'s
  saved quest-template roster with `state/dailyMissionResults.ts`'s
  existing compute-and-save helper, which itself already reads a
  contributor's real, persisted contributions — and re-renders the roster
  via the panel's existing `buildPersistedQuestStreakRoster` read path. An
  empty contributor id shows a form-level validation error instead of
  calling the store. No new lib/state logic was introduced or changed;
  this wires an existing, already-Vitest-covered helper into the UI for
  the first time. No follow-ups remain open on this bullet. Docs added in
  `docs/features/quest-streaks.md`. Verified: `bun install` (2050
  packages), `bun run test` (119 files / 1590 tests, all pass — the
  existing `test/dailyMissionResults.test.ts` coverage of
  `computeAndSavePersistedDailyMissionResult` was untouched by this
  change), `bun run typecheck` (11 of 12 in-scope packages have a
  typecheck script; all pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/cards/streaks` route present, no new
  route) all pass. No repo-wide `lint` script exists (checked root/app/
  package `package.json` scripts) so none was run.
- **Team Brainstorm Assist — seed boards from coverage gaps.**
  Closes the "boards aren't seeded from the coverage-gap prompts" gap noted
  under the "🧠 Team Brainstorm Assist" bullet in the Research Crowdsourcing
  Organizer Features list in `docs/features/brainstorm-board.md`'s Known
  gaps section. `packages/debate-card-search/src/state/brainstormIdeas.ts`
  adds `buildBrainstormBoardsPanelViewForTopic(topic)`, composing the
  already-persisted `state/trackedArguments.ts`'s
  `buildPersistedTopicCoverageReport` with the existing, previously-unused
  pure `lib/team-brainstorm-assist.ts` `buildBrainstormBoardsForCoverageGaps`
  to produce one board per under-covered tracked argument/category pair —
  each showing its seeding prompt even with zero submitted ideas — merged
  with every other board that already has at least one submitted idea but
  isn't itself a coverage-gap seed, so nothing previously visible disappears
  once a topic is chosen. `BrainstormBoardPanel.tsx` gains a topic switcher
  (mirroring `TopicCoverageDashboardPanel`'s free-text input + saved-topic
  buttons, reading the same tracked topics via `listTrackedTopics`) that
  swaps the board list between the topic-less `buildBrainstormBoardsPanelView`
  and the new topic-scoped view, plus a "No ideas submitted yet." hint on an
  empty board and a topic-aware empty-state message. No new coverage-gap or
  ranking logic was introduced — this is a composition and rendering layer
  only. Vitest-covered in
  `packages/debate-card-search/test/brainstormIdeas.test.ts` (a seeded board
  with no ideas yet, a seeded board populated with an already-submitted
  idea, merging in a non-seed board with a submitted idea, and an untracked
  topic falling back to exactly the topic-less board list). Docs updated in
  `docs/features/brainstorm-board.md`. Verified: `bun install` (2050
  packages), `bun run test` (120 files / 1602 tests, all pass), `bun run
  typecheck` (11 of 12 in-scope packages have a typecheck script; all pass),
  and `bun run build:web` (`debate-ai-web` succeeds, `/cards/brainstorm`
  route present, no new route) all pass. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
- **Legacy Verbatim / Cardmirror Compatibility — editor keyboard-shortcut
  wiring.** Closes follow-up (a) under idea #14 ("Legacy Verbatim /
  Cardmirror Compatibility") in the Product Feature Ideas list: "wiring
  these commands into actual keyboard-shortcut handlers in
  `reason-editor`'s toolbar/editor view". `debate-card-parser`'s
  `moveOutlineNode` is now generic (`<T>` instead of hardcoded to
  `OutlineNode`) so a caller with its own outline shape — not just this
  module's `Card`/`OutlineItem` — can reuse the same bounds-checked swap
  directly; its `resolveHtmlBoundary` and the swap itself also gained two
  non-null assertions the array accesses already guaranteed safe, needed
  once this file is typechecked under `reason-editor`'s stricter
  `noUncheckedIndexedAccess` setting (see below). `reason-editor` gains
  two new engine modules: `engine/verbatim-shortcuts.ts`
  (`applyCondenseToHtml`, wrapping `condenseCardHtml` with a no-op
  fallback when nothing's underlined; `buildInsertShortCiteTransaction`,
  reusing `formatShortCiteTag` to insert a "Smith 24"-style short cite tag
  at the selection, marked `cite_mark`) and `engine/outline/heading-move.ts`
  (`buildMoveHeadingSectionTransaction`, reusing `moveOutlineNode` to
  validate/resolve a heading swap against the live document's
  `OutlineHeading[]` then swapping the two headings' document ranges via a
  ProseMirror transaction; `findHeadingAtPos`, resolving which heading's
  section the cursor is currently in). A new `VerbatimShortcuts` TipTap
  extension (`react/verbatim-shortcuts-extension.ts`) binds four
  shortcuts on the live editor: `Mod-Shift-K` (insert short cite),
  `Mod-Shift-D` (condense to read text), `Alt-ArrowUp`/`Alt-ArrowDown`
  (move the current heading's section), and `Mod-Shift-E` for emphasis —
  bound to the schema's own `toggleMark('emphasis_mark')` rather than
  `debate-card-parser`'s HTML-string `toggleEmphasisHtml`, since the
  schema already models emphasis as a real mark (the same one the
  existing "Emph" toolbar button toggles); using the raw-HTML helper
  against a live ProseMirror document would be the wrong layer.
  `condenseCardHtml`/`formatShortCiteTag`/`moveOutlineNode` are imported
  from their specific `debate-card-parser` source files rather than the
  package barrel, so `reason-editor`'s typecheck isn't forced to also
  clear the many pre-existing `noUncheckedIndexedAccess` errors in
  unrelated parser modules (`citation-extractor.ts`, `card-utils.ts`,
  etc.) the barrel re-exports — out of scope for this slice.
  `react/Toolbar.tsx` gains "+Cite"/"Condense" buttons; `react/OutlineNavPanel.tsx`
  gains a Move ↑/↓ button pair per heading (the mouse-driven counterpart to
  the Alt-Arrow shortcuts). `condenseCardHtml`/`toggleEmphasisHtml`'s
  follow-up (c) ("send selected evidence to a speech document") remains
  open — needs a speech-document send target that doesn't exist yet — as
  does the "video-lecture" idea's transcription follow-up, unrelated. Docs
  added at `docs/features/legacy-verbatim-shortcuts.md`. Vitest-covered in
  `packages/debate-card-parser/test/verbatim-shortcuts.test.ts` (new
  "generic" case: `moveOutlineNode` against a caller-shaped
  `{id, level}` array unrelated to `Card`/`OutlineItem`),
  `packages/reason-editor/test/verbatim-shortcuts.test.ts`
  (`applyCondenseToHtml`: condenses/joins/falls-back cases;
  `buildInsertShortCiteTransaction`: dated/undated cite insertion,
  replacing an existing selection, blank-author no-op), and
  `packages/reason-editor/test/heading-move.test.ts`
  (`buildMoveHeadingSectionTransaction`: swap down/up, content travels
  with its heading, out-of-bounds/unknown-id no-ops;
  `findHeadingAtPos`: mid-section, on-heading, and empty-outline cases).
  Verified: `bun install` (2050 packages), `bun run test` (122 files /
  1656 tests, all pass), `bun run typecheck` (all 11 in-scope packages
  pass — this slice is what first exercised `debate-card-parser`'s source
  under `reason-editor`'s stricter typecheck settings, hence the two
  non-null-assertion fixes above), and `bun run build:web`
  (`debate-ai-web` succeeds, `/reason-editor` route present, no new
  route) all pass. No repo-wide `lint` script exists (checked root/app/
  package `package.json` scripts) so none was run.
- **Revision Incentives — evidence-staleness signal.** Closes follow-up (c)
  under the "🔁 Revision Incentives" bullet in the Research Crowdsourcing
  Organizer Features list below, also the sole "Known gap" in
  `docs/features/revision-incentives.md` ("No evidence-staleness signal
  beyond rewarding a refresh after the fact"). `lib/revision-incentives.ts`
  gains `computeEvidenceStaleness(evidenceYear, currentYear)` (pure) — an
  `EvidenceStalenessSignal` flagging a citation stale once it's
  `STALE_EVIDENCE_THRESHOLD_YEARS` (3) years old or older, or has no
  parseable year at all (`evidenceYear === 0`) — a forward-looking signal
  independent of any revision, unlike the existing `evaluateRevision`'s
  `evidenceRefreshed`, which only rewards a refresh after it happens.
  `lib/shared-evidence-library.ts` gains `getEvidenceStaleness`, composing
  that directly against `deriveCardSnapshotFromEntry`'s parsed
  `evidenceYear` for a real `EvidenceLibraryEntry`, and
  `getStaleEvidenceEntries`, filtering a list down to stale `card` entries
  (a reusable analytic `block` never cites outside evidence, so it's
  excluded). `panels/EvidenceLibraryPanel.tsx` now renders a "Stale
  evidence" badge on any `card` search result flagged stale as of the
  current year, so a contributor sees which cards need a refresh before
  editing, not only after. No new scoring logic was introduced beyond the
  staleness threshold itself. Docs updated at
  `docs/features/revision-incentives.md` (Known gaps now empty) and
  `docs/features/evidence-library.md`. Vitest-covered in
  `packages/debate-card-search/test/revision-incentives.test.ts`
  (`computeEvidenceStaleness`: at/just-below the age threshold, an unknown
  year, a current-year citation, and a future-dated citation clamped to
  zero age) and
  `packages/debate-card-search/test/shared-evidence-library.test.ts`
  (`getEvidenceStaleness`: old/recent/undated/blank citations;
  `getStaleEvidenceEntries`: excludes blocks and fresh cards, returns empty
  when nothing is stale). Verified: `bun install` (2050 packages), `bun run
  test` (120 files / 1638 tests, all pass), `bun run typecheck` (all 11
  in-scope packages pass), and `bun run build:web` (`debate-ai-web`
  succeeds, `/cards/library` route present, no new route) all pass. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run. PR: https://github.com/debate/debate-ai.com/pull/210.
- **Shared Evidence Library — edit/delete affordance wired to Revision Incentives.**
  Closes the "No edit/delete affordance in the panel" gap noted in
  `docs/features/evidence-library.md`'s Known gaps, and follow-up (a) under
  the "🔁 Revision Incentives" bullet in the Research Crowdsourcing Organizer
  Features list ("wiring an actual card-edit/save flow to call
  `saveRevisionRecord` with a before/after snapshot"). `lib/shared-evidence-library.ts`
  gains `deriveCardSnapshotFromEntry`, which derives a Revision Incentives
  `CardSnapshot` from a real `EvidenceLibraryEntry` — reusing the existing
  `llm-card-scoring.ts` `scoreClarity`/`scoreUsability` heuristics directly
  for `qualitySignals`, and parsing a 4-digit year out of the entry's `cite`
  for `evidenceYear`/`citationCompleteness` (no citation scores 0, a citation
  with a parseable year scores 1, any other non-blank citation scores 0.5) —
  and `buildEvidenceEntryRevision`, which composes that derivation over a
  before/after entry pair into a `CardRevision`. No new scoring logic was
  introduced; `evaluateRevision`/`buildRevisionIncentiveLeaderboard` are
  reused unchanged. `state/evidenceLibraryEntries.ts` gains
  `saveEvidenceLibraryEntryRevision`, which composes
  `buildEvidenceEntryRevision` against this store's own before (looked up by
  id) and after (the caller's edit) entries and records the result via the
  already-persisted `saveRevisionRecord` — but only when the save overwrites
  an existing entry id, so a brand-new submission never records a spurious
  revision. `panels/EvidenceLibraryPanel.tsx` now renders **Edit** and
  **Delete** actions on every search result: Edit loads the entry back into
  the submission form (now labeled "Editing entry …") with a required "Your
  contributor ID" field, and saving calls `saveEvidenceLibraryEntryRevision`
  instead of a plain overwrite; Delete calls the already-existing
  `deleteEvidenceLibraryEntry`. A real edit through this flow now shows up on
  the Revision Incentives leaderboard at `/cards/revisions`, which previously
  had no way to ever gain a row. No follow-ups remain open on the "no edit/
  delete affordance" gap; follow-up (c) under "Revision Incentives" (a real
  evidence-staleness signal beyond rewarding a refresh after the fact)
  remains open, not started. Docs updated at
  `docs/features/evidence-library.md` and
  `docs/features/revision-incentives.md`. Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts`
  (`deriveCardSnapshotFromEntry`: year-parsing/citation-completeness across a
  dated citation, an undated non-blank citation, and a blank citation, plus
  `wordCount` and `qualitySignals` derivation; `buildEvidenceEntryRevision`:
  correct `cardId`/`contributorId` wiring and an end-to-end
  `evaluateRevision` score for both a real rewarded edit and a no-op edit)
  and `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
  (`saveEvidenceLibraryEntryRevision`: a brand-new entry records no
  revision, an overwrite records one crediting the given contributor, and
  successive edits each record their own revision). Verified: `bun install`
  (2050 packages), `bun run test` (120 files / 1627 tests, all pass), `bun
  run typecheck` (all 11 in-scope packages pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/cards/library` and `/cards/revisions` routes
  present, no new route) all pass. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
- **Research Progress Tracking — feed topic-progress history into Progress Unlocks tier computation.**
  Closes follow-up (c) under the "📈 Research Progress Tracking" bullet in the
  Research Crowdsourcing Organizer Features list ("feeding a contributor's
  topic-progress history back into `progress-unlocks.ts`'s tier
  computation," also called out as the sole "Known gap" in both
  `docs/features/progress-unlocks.md` and
  `docs/features/research-progress-tracking.md`). `lib/progress-unlocks.ts`'s
  `UnlockTierRequirement` gained a `minCompletedTaskCount` threshold, and
  `computeContributorTier` now reaches a tier via the existing
  contribution-count-and-score AND-path **or** by clearing
  `minCompletedTaskCount` alone — a contributor's real, persisted
  completed-research-task count (already folded into a `ContributorStats`
  row by `state/researchProgress.ts`'s existing
  `buildPersistedLeaderboardWithCompletedTasks`) is now a genuine,
  alternate tier-qualifying signal, not just a leaderboard column, so
  completing enough routed research tasks (`research-task-routing.ts`) can
  unlock a tier even without matching scored-contribution volume/quality.
  Backward compatible: every existing fixture's `completedTaskCount`
  defaults to 0, so the new OR-clause is a no-op unless real
  task-completion data is supplied. `ContributorUnlockStatus` now surfaces
  `completedTaskCount` and `NextTierProgress` a `completedTasksNeeded`
  field; `buildUnlockStatusText` mentions the task-completion path.
  `lib/unlock-streak-status.ts`'s
  `buildContributorUnlockStatusWithStreakFromStore`/`buildUnlockStatusRoster`
  now source their `ContributorStats` from
  `buildPersistedLeaderboardWithCompletedTasks` instead of
  `state/contributions.ts` alone, so a contributor who has completed
  research tasks but no scored contribution yet now also appears in the
  Progress Unlocks roster. `panels/ProgressUnlocksPanel.tsx` renders a new
  "Tasks completed" column. Docs updated at
  `docs/features/progress-unlocks.md` and
  `docs/features/research-progress-tracking.md`. Vitest-covered in
  `packages/debate-card-search/test/progress-unlocks.test.ts` (tier reached
  via completed tasks alone, the highest tier across both paths, next-tier
  `completedTasksNeeded`, and backward compatibility for the pre-existing
  AND-path fixtures) and
  `packages/debate-card-search/test/unlock-streak-status.test.ts` (real
  completed-task history feeding a store-backed status, and a task-only
  contributor appearing in the roster). Verified: `bun install` (2050
  packages), `bun run typecheck` (all in-scope packages pass), `bun run
  test` (120 files / 1616 tests, all pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/cards/progress` route present) all pass. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run.
- **Daily Best Card Challenge — banner/widget UI.**
  Closes follow-up (c) — "a challenge banner/widget UI" — under the "🕵️ Daily
  Best Card Challenge" bullet in the Research Crowdsourcing Organizer
  Features list. `state/contributions.ts` gains `buildDailyBestCardsFromStore`/
  `getTodaysBestCardFromStore`, which filter every persisted contribution
  down to `kind: "card"` entries carrying a `submittedAt` timestamp and
  compose them directly with the existing `lib/daily-best-card.ts`'s
  `buildDailyBestCards`/`getBestCardForDay` — no new scoring or day-grouping
  logic was introduced. This also confirms follow-up (a) ("wiring a
  `submittedAt` timestamp into wherever card contributions are eventually
  persisted") was already closed as a side effect of the earlier "Daily
  Quests and Targets" slice, which stamps `submittedAt` on every
  `ContributionsFeedPanel` submission. `panels/DailyBestCardPanel.tsx`
  (mounted at `/cards/best-card`, added to the Settings nav menu) renders
  today's UTC-day winner as a highlighted banner plus every earlier day's
  winner as a history list, so a coach or contributor can see the day's
  top card and past winners without needing a separate ballot UI — a card's
  existing likes/saves in the Contributions Feed already model the
  community "vote". Follow-up (b), a scheduled job to persist/announce a
  day's winner automatically, remains open — not started; this repo has no
  cron/scheduled-task mechanism yet. Docs added at
  `docs/features/daily-best-card.md`. Vitest-covered in
  `packages/debate-card-search/test/contributions.test.ts`
  (`buildDailyBestCardsFromStore`/`getTodaysBestCardFromStore`: picks one
  winner per represented day from persisted card contributions, excludes
  non-card contributions and cards without a `submittedAt` timestamp, and
  returns the correct/`null` result for a given day). Verified: `bun install`
  (2050 packages), `bun run test` (120 files / 1609 tests, all pass),
  `bun run typecheck` (all 11 in-scope packages pass), and `bun run build:web`
  (`debate-ai-web` succeeds, `/cards/best-card` route present) all pass. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run.
- **Research Task Routing — task-routing trigger UI.**
  Closes follow-up (d) under the "🧭 Research Task Routing" bullet in the
  Research Crowdsourcing Organizer Features list — "a task-routing trigger
  UI to actually populate a topic's queue" — and the "No task-routing
  trigger UI yet" known gap noted in `docs/features/task-inbox.md`.
  `packages/debate-card-search/src/state/routedTaskQueues.ts` gains
  `routePersistedTopicTasks`, which composes `state/trackedArguments.ts`'s
  `buildPersistedTopicCoverageReport` (a topic's tracked-argument checklist
  against the shared evidence library) directly with the existing
  `buildAndPersistRoutingResult`, so a caller can route and persist a
  topic's queue from nothing but a topic id — no new routing logic was
  introduced. `panels/TaskInboxPanel.tsx` (mounted at `/cards/inbox`) now
  renders a "Route a topic's tasks" form above the inbox — a topic input
  (with one-click suggestions from every topic that already has a tracked
  checklist, via `listTrackedTopics`) plus a "Route tasks" button that calls
  `routePersistedTopicTasks` and refreshes the inbox view — so a coach or
  contributor can populate a topic's task queue from the inbox itself
  instead of needing a separate trigger. No follow-ups remain open on this
  bullet. Docs updated in `docs/features/task-inbox.md`. Vitest-covered in
  `packages/debate-card-search/test/routedTaskQueues.test.ts`
  (`routePersistedTopicTasks`: routes and persists a topic's live coverage
  gaps end-to-end through the persisted tracked-argument checklist and
  evidence library, and scopes correctly — tracked arguments filed under a
  different topic don't leak into the routed report). Verified: `bun
  install` (2050 packages), `bun run test` (120 files / 1604 tests, all
  pass), `bun run typecheck` (all 11 in-scope packages pass), and `bun run
  build:web` (`debate-ai-web` succeeds, `/cards/inbox` route present, no new
  route) all pass. No repo-wide `lint` script exists (checked root/app/
  package `package.json` scripts) so none was run.
- **Shared Evidence Library — card/block submission form.**
  Closes the "No submission UI yet" gap noted under the "📚 Shared Evidence
  Library" bullet in the Research Crowdsourcing Organizer Features list, and,
  by giving the shared evidence repository a real UI source of
  `argBlock`/`wordCount`-carrying entries, closes follow-up (a) under the
  "📊 Topic Coverage Dashboard" bullet in that same list ("an `argBlock`/
  word-count field wired into a real card-submission flow beyond the
  existing `/cards/library` evidence-library form"). `lib/shared-evidence-library.ts`
  gains `computeWordCount`, a plain whitespace tokenizer that stamps a
  submitted entry's `wordCount` from its body text rather than asking the
  submitter to count it themselves — the exact field
  `lib/topic-coverage.ts`'s `missing`/`thin`/`covered` classification scores
  against. `panels/EvidenceLibraryPanel.tsx` (mounted at `/cards/library`)
  now renders a submission form above the existing search box — kind
  (card/block), topic, case area, argument block, citation, comma-separated
  tags, and a body text area with a live word-count readout — that saves a
  new `EvidenceLibraryEntry` via the already-persisted
  `saveEvidenceLibraryEntry` and refreshes the search results, so a card
  submitted here now flows straight into both the evidence library's own
  search index and the Topic Coverage Dashboard's live report for the same
  topic, with no new composition logic needed on either side. No follow-ups
  remain open on either bullet's submission-flow gap; the "no edit/delete
  affordance" and "no topic/case-area/tag filter controls in the panel"
  gaps noted separately in `docs/features/evidence-library.md` remain open,
  not started. Docs updated in `docs/features/evidence-library.md` and
  `docs/features/topic-coverage-dashboard.md`. Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts`
  (`computeWordCount`: space-separated words, collapsed newline/tab
  whitespace, leading/trailing trim, and an empty/whitespace-only string).
  Verified: `bun install` (2050 packages), `bun run test` (120 files / 1602
  tests, all pass), `bun run typecheck` (all 11 in-scope packages pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/cards/library` route
  present, no new route) all pass. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
- **Expandable Heading Structure — collapsed-heading decoration plugin.**
  Closes follow-up (b) under idea #9 ("Expandable Heading Structure") in
  the Product Feature Ideas list — "a ProseMirror decoration plugin that
  hides collapsed ranges in the actual editor view using
  `getCollapsedRanges`." A new
  `packages/reason-editor/src/engine/outline/collapsed-headings-plugin.ts`
  adds `collapsedHeadingsPlugin`, a ProseMirror plugin whose state (a
  `collapsedIds` list) is set via a `collapsedHeadingsKey`-tagged
  transaction meta — mirroring `comments-plugin.ts`'s meta-driven state
  convention — and whose `decorations` prop (factored out as the
  independently testable `computeCollapsedHeadingsDecorations`) composes
  the existing `buildHeadingOutline`/`getCollapsedRanges` to `display: none`
  every top-level document node inside a collapsed heading's range. Headings
  are flat, doc-level paragraphs (see `engine/schema/nodes.ts`), so a
  `CollapsedRange`'s bounds always line up with top-level node boundaries.
  `reason-core-extension.ts`'s `ReasonCore.addProseMirrorPlugins()` now
  includes the plugin unconditionally (a no-op when nothing is collapsed).
  `OutlineNavPanel.tsx` gains an effect that pushes its persisted
  `collapsedIds` into the plugin via `setCollapsedHeadingIdsMeta` on mount,
  on `documentId` change, and on every toggle, so collapsing a heading in
  the nav panel now also hides its content in the live editor view, not
  just the nav list. No follow-ups remain open on idea #9. Vitest-covered
  in `packages/reason-editor/test/collapsed-headings-plugin.test.ts`
  (plugin-state transitions via tagged/untagged meta, and decoration
  coverage for a mid-document collapse, an outermost collapse, and a
  collapsed heading with nothing to hide).
  PR: [#201](https://github.com/debate/debate-ai.com/pull/201).
- **Team Brainstorm Assist — real AI-generation call.**
  Closes follow-up (a) under the "🧠 Team Brainstorm Assist" bullet in the
  Research Crowdsourcing Organizer Features list — "an actual AI-generation
  call that drafts candidate ideas from `buildBrainstormPrompt`'s output."
  A new `packages/debate-card-search/src/lib/team-brainstorm-ai.ts` adds
  `TEAM_BRAINSTORM_AI_SYSTEM_PROMPT`, `buildTeamBrainstormAiUserPrompt`, and
  the tolerant `parseTeamBrainstormAiResponse`, mirroring
  `lib/llm-card-scoring-ai.ts`'s strict-JSON-with-tolerant-fallback split
  (the model is asked for a `{"ideas": [...]}` array of several distinct
  candidate ideas for a board's argument block/category/seeding prompt).
  `lib/team-brainstorm-client.ts` adds `requestTeamBrainstormAiIdeas`, a
  small self-contained `fetch` client (mirroring
  `lib/llm-card-scoring-client.ts`'s split) that POSTs to the existing
  `/api/reason-ai` Anthropic proxy. `lib/team-brainstorm-assist.ts`'s
  `BrainstormIdea` gains an additive, optional `isAiGenerated` field
  (existing records without one stay valid) so an AI-drafted idea saves and
  renders through the exact same `saveBrainstormIdea`/ranking/upvote path
  as a human-submitted one. `BrainstormBoardPanel.tsx`'s submission form now
  has a "Generate AI ideas" action (next to "Submit idea") that calls
  `requestTeamBrainstormAiIdeas` for the form's current argument
  block/category, saves each returned idea as a normal, AI-attributed
  (`contributorId: "AI"`, `isAiGenerated: true`) board idea, and renders an
  "AI" badge on it — or a form-level error message on failure. Follow-up
  (a) is now closed; the "boards aren't seeded from the coverage-gap
  prompts" and "no reviewer merge action for flagged duplicates" gaps noted
  separately remain open, as documented in
  `docs/features/brainstorm-board.md`. Docs updated in that same file.
  Vitest-covered in
  `packages/debate-card-search/test/team-brainstorm-ai.test.ts` (prompt
  content and response parsing, including a fenced reply, a prose-wrapped
  reply, entries with blank/whitespace-only ideas dropped, and an
  empty/unusable reply) and
  `packages/debate-card-search/test/team-brainstorm-client.test.ts` (the
  `fetch` client, mocked via `vi.stubGlobal`, covering the success path, an
  endpoint override, a server error message, a non-JSON error body, and an
  unparseable reply). Verified: `bun install` (2050 packages), `bun run
  test` (119 files / 1590 tests, all pass), `bun run typecheck` (11 of 12
  in-scope packages have a typecheck script; all pass), and `bun run
  build:web` (`debate-ai-web` succeeds, `/cards/brainstorm` route present,
  no new route) all pass. No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run.
- **AI Drill Generator — real AI-generated drill script.**
  Closes follow-up (b) under the "📚 AI Drill Generator" bullet in the
  Research Crowdsourcing Organizer Features list — "an actual AI-generated
  (rather than templated) script." A new
  `packages/debate-round/src/round/drill-script-ai.ts` adds
  `DRILL_SCRIPT_AI_SYSTEM_PROMPT`, `buildDrillScriptAiUserPrompt`, and the
  tolerant `parseDrillScriptAiResponse`, mirroring `round/coach-feedback-ai.ts`'s
  free-form-text split (a practice script is prose, not structured JSON) —
  the user-turn prompt composes a single `flow/drill-generator.ts` `Drill`'s
  kind and template prompt line for a chosen side, asking the model to turn
  that template line into an actual, ready-to-read practice script rather
  than restate it. `round/drill-script-client.ts` adds `requestDrillScript`,
  a small self-contained `fetch` client (mirroring
  `round/coach-feedback-client.ts`'s split) that POSTs to the existing
  `/api/reason-ai` Anthropic proxy. `state/drillSets.ts`'s `DrillSetRecord`
  gains an additive, optional `aiScripts` field keyed by a drill's index in
  `drills` (existing records without one stay valid) plus a new
  `saveDrillAiScript(roundId, drillIndex, aiScript)` helper that sets one
  entry without touching `drills` or any other drill's script — matching
  this store's existing roundId-only keying (a drill set is unique per
  `roundId`, unlike `coachingSessions.ts`'s roundId+sideKey keying).
  `DrillSetsPanel.tsx`'s drills now each have a "Get AI script" ("Regenerate
  AI script" once one exists) action that calls `requestDrillScript` with
  the drill and its round's side, saves the result, and renders it (or a
  per-drill error message on failure) under the template prompt. No
  follow-ups remain open on this bullet. Docs updated in
  `docs/features/drill-sets.md`. Vitest-covered in
  `packages/debate-round/test/drill-script-ai.test.ts` (prompt content,
  per-kind label rendering, and response parsing, including a fenced reply
  and a whitespace-only/empty reply),
  `packages/debate-round/test/drill-script-client.test.ts` (the `fetch`
  client, mocked via `vi.stubGlobal`, covering the success path, an
  endpoint override, a server error message, a non-JSON error body, and an
  empty/unusable AI reply), and `packages/debate-round/test/drillSets.test.ts`
  (the new `saveDrillAiScript` helper, including overwriting an existing
  script, leaving other drills' and other rounds' records untouched, and a
  no-op on an unstored roundId). Verified: `bun install` (2050 packages),
  `bun run test` (117 files / 1572 tests, all pass), `bun run typecheck`
  (11 of 12 in-scope packages have a typecheck script; all pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/drills` route present,
  no new route) all pass. No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run.
- **AI Coach Mode — real AI coaching-feedback call.**
  Closes follow-up (a) under the "🎙️ AI Coach Mode" bullet in the Research
  Crowdsourcing Organizer Features list — "an actual AI coaching call for
  open-ended feedback beyond this deterministic template layer." A new
  `packages/debate-round/src/round/coach-feedback-ai.ts` adds
  `COACH_FEEDBACK_AI_SYSTEM_PROMPT`, `buildCoachFeedbackAiUserPrompt`, and
  the tolerant `parseCoachFeedbackAiResponse`, mirroring
  `debate-speech-writer`'s `coach/team-coach-ai.ts` free-form-text split
  (open-ended coaching feedback is prose, not structured JSON like
  `round/judge-decision-ai.ts`'s verdict) — the user-turn prompt composes a
  session's side and its already-generated template prompts via the
  existing `flow/coach-mode.ts`'s `buildCoachingSummaryText`, so no new
  coaching-prompt derivation logic was introduced.
  `round/coach-feedback-client.ts` adds `requestCoachFeedback`, a small
  self-contained `fetch` client (mirroring `coach/team-coach-client.ts`'s
  split) that POSTs to the existing `/api/reason-ai` Anthropic proxy.
  `state/coachingSessions.ts`'s `CoachingSessionRecord` gains an additive,
  optional `aiFeedback` field (existing records without one stay valid)
  plus a new `saveCoachingSessionAiFeedback(roundId, sideKey, aiFeedback)`
  helper that sets it without touching a session's `prompts`.
  `CoachingSessionsPanel.tsx`'s session cards now have a "Get AI feedback"
  ("Regenerate AI feedback" once one exists) action that calls
  `requestCoachFeedback` with the session's own prompts, saves the result,
  and renders it (or a per-session error message on failure) under the
  template prompts. No follow-ups remain open on this bullet. Docs updated
  in `docs/features/coaching-sessions.md`. Vitest-covered in
  `packages/debate-round/test/coach-feedback-ai.test.ts` (prompt content and
  response parsing, including a fenced reply and a whitespace-only/empty
  reply), `packages/debate-round/test/coach-feedback-client.test.ts` (the
  `fetch` client, mocked via `vi.stubGlobal`, covering the success path, an
  endpoint override, a server error message, a non-JSON error body, and an
  empty/unusable AI reply), and
  `packages/debate-round/test/coachingSessions.test.ts` (the new
  `saveCoachingSessionAiFeedback` helper, including overwriting existing
  feedback, leaving other sessions untouched, and a no-op on an unstored
  roundId/sideKey pair). Verified: `bun install` (2050 packages),
  `bun run test` (115 files / 1549 tests, all pass), `bun run typecheck`
  (11 of 12 in-scope packages have a typecheck script; all pass), and
  `bun run build:web` (`debate-ai-web` succeeds, `/coaching` route present,
  no new route) all pass. No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run.
- **Contribution Leaderboard — completed-tasks signal.**
  Closes follow-up (b) under the "Contribution Leaderboard" bullet in the
  Research Crowdsourcing Organizer Features list — "a 'completed tasks'
  signal once a research-task system exists" (that system now exists: the
  Research Task Routing idea's persisted `routedTaskQueues.ts`/
  `completeAndRecordResearchTask`). `debate-card-search`'s
  `lib/contribution-leaderboard.ts` gains a `completedTaskCount` field on
  `ContributorStats` and an optional `completedTaskCounts` map parameter on
  `buildContributorStats`/`buildLeaderboard`, defaulting to 0 so every
  existing caller is unaffected; a contributor present only in that map
  (completed tasks, no scored contribution yet) still gets a leaderboard
  row via a new `buildTaskOnlyContributorStats` — mirroring
  `lib/research-progress.ts`'s `buildResearchProgressBoard` "union of both
  signals" convention. `state/researchProgress.ts` (which already reads the
  persisted completed-task history) adds
  `buildPersistedLeaderboardWithCompletedTasks`, grouping that history by
  `contributorId` and composing it with `state/contributions.ts`'s
  persisted contribution list through `buildLeaderboard` — it lives there
  rather than alongside `state/contributions.ts`'s existing
  `buildPersistedLeaderboard` to avoid a circular import between the two
  state modules (`state/contributions.ts` doesn't depend on
  `state/researchProgress.ts`). `ContributionLeaderboardPanel.tsx` now reads
  through `buildPersistedLeaderboardWithCompletedTasks` instead and renders
  a new "Completed tasks" column. `buildPersistedLeaderboard` itself is
  unchanged and still used elsewhere. No follow-ups remain open on this
  bullet. Vitest-covered in `test/contribution-leaderboard.test.ts` (the new
  `completedTaskCount` field, the `completedTaskCounts` map, and a
  task-only contributor row) and `test/researchProgress.test.ts` (the new
  `buildPersistedLeaderboardWithCompletedTasks` store composition, including
  a task-only contributor). Verified: `bun install`, `bun run test` (113
  files / 1528 tests, all pass), `bun run typecheck` (11 of 12 in-scope
  packages have a typecheck script; all pass — also fixed three pre-existing
  `ContributorStats` object literals in `lib/unlock-streak-status.ts` and
  three test files that were missing the new required field), and
  `bun run build:web` (`debate-ai-web` succeeds, `/cards/leaderboard` route
  present, no new route) all pass. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
- **Flow-in-Speech Flow Annotations — video-player annotation UI.**
  Closes follow-up (a) under idea #15 ("Flow-in-Speech Flow Annotations")
  in the Product Feature Ideas list — "a video-player UI (`debate-videos`)
  that lets a viewer drop an annotation at the current playback position,
  persisted through `flowAnnotations.ts`, and jump back to one." A new
  `packages/debate-round/src/panels/FlowAnnotationsPanel.tsx` renders a
  drop-annotation form (flow id, speech id, box path, optional note, and a
  timestamp that defaults to the `debate-videos` persistent player's live
  playback position via `useVideoPlayerStore`, or a manual `m:ss`/`h:mm:ss`
  entry) plus every persisted `FlowAnnotation` newest-first, each with a
  "Jump to" action that calls `sendYouTubeCommand("seekTo", ...)` — a new
  command added to `debate-videos`'s existing
  `playVideo`/`pauseVideo`/`setPlaybackRate` postMessage commands, wrapping
  the YouTube IFrame API's `seekTo(seconds, allowSeekAhead)` — and a
  "Clear" action, mounted at `/annotations` and linked from the global
  dock's Settings menu. `flow/flow-annotations.ts` gains an additive,
  optional `FlowAnnotation.videoId` (existing annotations without one stay
  valid) so "Jump to" can be scoped to the annotation's own recording
  rather than firing blindly at whatever happens to be loaded, plus three
  small pure helpers used by the panel:
  `getAnnotationsForVideo`/`formatAnnotationTimestamp`/
  `parseAnnotationTimestamp`/`parseBoxPathInput`.
  `state/flowAnnotations.ts` gains `listFlowAnnotationsForVideo` and
  `buildFlowAnnotationsPanelView` (a stable newest-first sort), mirroring
  the existing `buildFlowSummariesPanelView` convention. `debate-round` now
  depends on `debate-videos` (previously one-directional the other way —
  no cycle, `debate-videos` still doesn't depend on `debate-round`). "Jump
  to" only works once the annotation's own recording is already the one
  loaded in the player — no video-lookup/auto-open exists — and follow-up
  (b), a `FlowSpreadsheet` affordance surfacing a box's annotations via
  `listFlowAnnotationsForBox`, remains open, not started. Docs added at
  `docs/features/flow-annotations.md`;
  `packages/debate-round/README.md` updated. Vitest-covered in
  `packages/debate-round/test/flow-annotations.test.ts` (the new
  `videoId`/timestamp/box-path helpers) and
  `packages/debate-round/test/flowAnnotations.test.ts` (the new
  `listFlowAnnotationsForVideo`/`buildFlowAnnotationsPanelView` persistence
  helpers). Verified: `bun install`, `bun run test` (113 files / 1519
  tests, all pass), `bun run typecheck` (11 of 12 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`
  succeeds, `/annotations` route present) all pass. No repo-wide `lint`
  script exists (checked root/app/package `package.json` scripts) so none
  was run.
- **Video-Lecture-Training Coach AI — real AI Q&A call.**
  [PR #195](https://github.com/debate/debate-ai.com/pull/195).
  Closes follow-up (b) under idea #8 ("Video-Lecture-Training Coach AI") in
  the Product Feature Ideas list — "an actual AI Q&A call that consumes
  `buildGroundedCoachPrompt`'s output." A new
  `packages/debate-speech-writer/src/coach/team-coach-ai.ts` adds
  `TEAM_COACH_AI_SYSTEM_PROMPT`, which frames the model as the team's
  private coach and instructs it to reply with the answer text only, plus
  the pure, Vitest-testable `parseTeamCoachAiResponse`, which strips a
  wrapping code fence (mirroring `debate-round`'s
  `round/ai-versus-speech-ai.ts`'s tolerant-parsing convention exactly —
  this is free-form answer text, not JSON, so no schema validation is
  needed). The user-turn message sent to the model is exactly the
  already-existing `buildGroundedCoachPrompt`'s output (question +
  ranked grounding-material excerpts + its own "answer strictly from
  these materials" instruction) — no new prompt-composition logic was
  introduced. `coach/team-coach-client.ts` adds `requestTeamCoachAnswer`,
  a small self-contained `fetch` client (mirroring
  `round/ai-versus-speech-client.ts`'s split) that POSTs to the existing
  `/api/reason-ai` Anthropic proxy. `CoachMaterialsPanel.tsx`'s existing
  "Ask the coach" section now has an "Ask the coach" action alongside the
  existing "Preview grounded prompt" preview — it resolves the question's
  top relevant materials via the already-existing
  `findRelevantMaterialsFromStore`, calls `requestTeamCoachAnswer`, and
  renders the model's grounded answer or a plain error message on
  failure. No material-scoring, grouping, or persistence logic changed,
  and no new route was added. Vitest-covered in
  `packages/debate-speech-writer/test/team-coach-ai.test.ts` (system-prompt
  content and response parsing, including a fenced reply and a
  whitespace-only/empty reply) and
  `packages/debate-speech-writer/test/team-coach-client.test.ts` (the
  `fetch` client, with `fetch` mocked via `vi.stubGlobal`, covering the
  success path, an endpoint override, a server error message, a non-JSON
  error body, and an empty/unusable AI reply). Docs updated in
  `docs/features/coach-materials.md` and
  `packages/debate-speech-writer/README.md`. Follow-up (a), transcription/
  parsing that turns an uploaded recording or document into a material's
  text, remains open — not started. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install` (2050 packages), `bun run test` (113 files /
  1504 tests, all pass), `bun run typecheck` (11 of 12 in-scope packages
  have a typecheck script; all pass), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/coach-materials` route present, no new
  route) all pass.
- **AI Response-Outcome Charts — AI counsel-panel call.**
  Closes follow-up (a) under idea #4 ("AI Response-Outcome Charts") in the
  Product Feature Ideas list — "an actual AI-panel call (multiple 'counsel'
  model roles) that evaluates likely response paths and clash points
  beyond this deterministic heuristic." A new
  `packages/debate-round/src/flow/response-outcome-ai.ts` adds the pure,
  Vitest-testable `buildCounselPanelAiUserPrompt`/`parseCounselPanelAiResponse`,
  which compose a round's most-vulnerable already-scored arguments (row
  index, origin speech, unanswered status, heuristic exposure score) into a
  prompt asking the model to role-play three specialized debate "counsel"
  — Policy Counsel, Kritik Counsel, Weighing Counsel — assign whichever
  role best fits each argument, and estimate that argument's likely
  response path and clash point, plus one overall round-level clash
  summary; mirrors `round/judge-decision-ai.ts`'s prompt/parse split
  exactly, including its tolerant-parsing (fenced/prose-wrapped JSON)
  convention. `flow/response-outcome-client.ts` adds
  `requestCounselPanelAssessment`, a small self-contained `fetch` client
  (mirroring `judge-decision-client.ts`'s split) that POSTs to the
  existing `/api/reason-ai` Anthropic proxy. A new
  `state/counselPanelAssessments.ts` persists a round's
  `CounselPanelAiResult` to localStorage keyed by `roundId`, mirroring
  `debate-card-search`'s `state/aiCardAssessments.ts` convention exactly.
  `VulnerabilityChartsPanel.tsx`'s existing round cards now have a "Get AI
  counsel panel" action that requests an assessment against the round's
  top exposed arguments (from `buildVulnerabilityChartDataFromReport`) and
  renders the overall clash summary plus each assessed argument's counsel
  role, likely response path, and clash estimate; clearing a round now
  also clears its persisted counsel-panel assessment. No vulnerability-
  scoring, chart-data, or "what if" hypothetical logic changed, and no new
  route was added. Vitest-covered in
  `packages/debate-round/test/response-outcome-ai.test.ts` (prompt
  composition, well-formed/fenced/prose-wrapped replies, an unrecognized
  `counselRole`, empty `argumentAssessments`, and missing/blank required
  fields), `packages/debate-round/test/response-outcome-client.test.ts`
  (the `fetch` client, with `fetch` mocked via `vi.stubGlobal`, covering
  the success path, an endpoint override, a server error message, a
  non-JSON error body, and an unparseable AI reply), and
  `packages/debate-round/test/counselPanelAssessments.test.ts` (get/save/
  delete, corrupt/missing storage, and per-`roundId` isolation). Docs
  updated in `docs/features/response-outcome-charts.md` — including
  correcting its stale "Known gaps" section, which still listed the
  already-shipped "what if" hypothetical mode (follow-up (c)) as not
  started. No follow-ups remain open on idea #4. No repo-wide `lint`
  script exists (checked root/app/package `package.json` scripts) so none
  was run. Verified: `bun install` (2050 packages), `bun run test` (111
  files / 1491 tests, all pass), `bun run typecheck` (11 of 12 in-scope
  packages have a typecheck script; all pass), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/outcomes` route present, no new route) all
  pass.
- **Practice Round Simulator — AI opponent speech + AI judge-decision calls.**
  [PR #193](https://github.com/debate/debate-ai.com/pull/193).
  Closes follow-up (a) under the "🧪 Practice Round Simulator" bullet in
  Research Crowdsourcing Organizer Features — "an actual AI
  speech-generation call for the AI opponent's speeches and an AI
  judge-decision call under the chosen paradigm." `PracticeRoundSimulatorPanel`
  now has a "Generate AI opponent speech" action per round card, reusing the
  existing `buildAiResponseRequest`/`requestAiVersusSpeech`/
  `requestAiVersusSpeechWithPersona` helpers (idea #3's "Online Debate Versus
  AI" and the "AI Practice Opponent" idea) against the round's own
  `aiVersusRounds.ts` submitted-speech state — available once the round has
  been started at `/versus-ai` under the same `roundId` — sourcing the AI
  opponent's persona directly from the practice round's own saved
  `setup.opponentPersona` rather than a separate `opponentPersonaSelections`
  store lookup, since the practice-round setup already carries that choice
  explicitly. A new `packages/debate-round/src/round/practice-round-judge-decision-wiring.ts`
  adds `buildPracticeRoundJudgeDecisionInput`, a variant of idea #5's
  `judge-decision-store-wiring.ts` that takes the practice round's own saved
  `setup.judgeParadigm` directly as an argument (instead of reading a second
  `judgeParadigmSelections` store), while still resolving the round's flow
  summary from the existing `state/flowSummaries.ts` by the same `roundId`.
  The panel's new "Get AI judge decision" action calls the existing
  `requestJudgeDecision` with that resolved input and saves the verdict onto
  the round's own `PracticeRoundRecord` via a new optional `judgeDecision`
  field, rendering the winner, key voting issues, and rationale. No new
  turn-order, speech-order, judge-paradigm, or setup-composition logic was
  introduced. Vitest-covered in
  `packages/debate-round/test/practice-round-judge-decision-wiring.test.ts`
  (missing/empty flow summary, successful composition from the round's own
  paradigm, roundId scoping, and a custom paradigm). No follow-ups remain
  open on this idea. No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run. Verified:
  `bun install` (2050 packages), `bun run test` (108 files / 1465 tests, all
  pass), `bun run typecheck` (11 of 12 in-scope packages have a typecheck
  script; all pass), and `bun run build:web` (`debate-ai-web`, succeeds,
  `/practice-round` route present, no new route) all pass.
- **AI Practice Opponent — persona-conditioned AI speech-generation call.**
  [PR #191](https://github.com/debate/debate-ai.com/pull/191).
  Closes follow-up (a) under the "🤖 AI Practice Opponent" bullet in Research
  Crowdsourcing Organizer Features — "an actual AI speech-generation call
  that consumes `buildOpponentPersonaPrompt`'s output alongside idea #3's
  `AiSpeechRequest`." A new
  `packages/debate-round/src/round/opponent-persona-speech-ai.ts` adds the
  pure, Vitest-testable `buildPersonaAiVersusSystemPrompt(persona)`, which
  composes the existing "Online Debate Versus AI" `AI_VERSUS_SPEECH_SYSTEM_PROMPT`
  with `debate-speech-writer`'s `buildOpponentPersonaPrompt`, noting that the
  persona's style overrides the generic tone where they conflict; it reuses
  `ai-versus-speech-ai.ts`'s existing `buildAiVersusSpeechUserPrompt` and
  `parseAiVersusSpeechResponse` unchanged, since only the system prompt
  changes once a persona is selected. `round/opponent-persona-speech-client.ts`
  adds `requestAiVersusSpeechWithPersona`, a small self-contained `fetch`
  client (mirroring `ai-versus-speech-client.ts`'s split) that POSTs to the
  existing `/api/reason-ai` Anthropic proxy. A new
  `round/opponent-persona-speech-wiring.ts` adds `getOpponentPersonaForRound`,
  which resolves a round's persona directly from the already-persisted
  `opponentPersonaSelections.ts` store, treating a round's `roundId` as that
  store's `sessionId` key — both are free-text identifiers for the same
  practice session, so no new persistence field was introduced to link them.
  `AiVersusRoundPanel.tsx`'s existing "Generate AI speech" action now looks
  up the active round's saved persona and calls the persona-aware client
  when one is saved (showing which persona is in play via a badge), falling
  back to the existing plain `requestAiVersusSpeech` call otherwise. No
  turn-order, validation, or persona-registry logic changed, and no new
  route was added. Vitest-covered in
  `packages/debate-round/test/opponent-persona-speech-ai.test.ts` (prompt
  composition, including persona name/description/instructions/preferred-
  arguments and the override note),
  `packages/debate-round/test/opponent-persona-speech-client.test.ts` (the
  `fetch` client, with `fetch` mocked via `vi.stubGlobal`, covering the
  success path, an endpoint override, a server error message, a non-JSON
  error body, and an empty/unparseable AI reply), and
  `packages/debate-round/test/opponent-persona-speech-wiring.test.ts`
  (missing/present/scoped-by-roundId/most-recent-wins lookup cases). No
  follow-ups remain open on this idea. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install` (2050 packages), `bun run test` (107 files / 1460
  tests, all pass), `bun run typecheck` (11 of 12 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`,
  succeeds, `/versus-ai` route present, no new route) all pass.
- **AI Judge Decision Modes — real AI judge-decision call.**
  [PR #190](https://github.com/debate/debate-ai.com/pull/190).
  Closes follow-up (a) under idea #5 ("AI Judge Decision Modes") — "an AI
  judge-decision call that uses `buildJudgeParadigmPrompt` output instead of
  (or alongside) the existing static `judgeDecisionPrompt`." A new
  `packages/debate-round/src/round/judge-decision-ai.ts` adds
  `JUDGE_DECISION_AI_SYSTEM_PROMPT` and pure, Vitest-testable
  `buildJudgeDecisionAiUserPrompt`/`parseJudgeDecisionAiResponse` helpers —
  the prompt composes the selected paradigm's existing
  `buildJudgeParadigmPrompt` section with a round's flow summary text
  (`flow/flow-transcript-summary.ts`'s `buildFlowSummaryTextFromRows`), and
  the parser tolerantly extracts a `{winner, keyVotingIssues, rationale}`
  JSON verdict from a fenced or prose-wrapped reply, returning `null` (never
  throwing) on anything unparseable or missing a required field.
  `round/judge-decision-client.ts` adds `requestJudgeDecision`, a small
  self-contained `fetch` client (mirroring `lib/llm-card-scoring-client.ts`'s
  split) that POSTs to the existing `/api/reason-ai` Anthropic proxy. A new
  `round/judge-decision-store-wiring.ts` resolves a round's
  `JudgeDecisionAiInput` directly from two already-persisted, same-keyed
  stores — this package's own `state/flowSummaries.ts` and
  `debate-speech-writer`'s `state/judgeParadigmSelections.ts` — mirroring
  `pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores` convention, and
  reports which source(s) are missing rather than throwing. A new
  `state/judgeDecisions.ts` persists a round's generated
  `JudgeDecisionAiResult` to localStorage, and a new `JudgeDecisionPanel.tsx`
  renders a "Get AI judge decision" form (round ID + side names) plus every
  persisted decision (winner, key voting issues, rationale) at
  `/judge-decision`, linked from the settings dock (`CategoryDock.tsx`, "AI
  Judge Decision"). No follow-ups remain open on this idea. Vitest-covered
  in `packages/debate-round/test/judge-decision-ai.test.ts` (prompt building
  + tolerant parsing, including fenced/prose-wrapped replies and malformed
  shapes), `packages/debate-round/test/judge-decision-client.test.ts` (the
  `fetch` client, with `fetch` mocked via `vi.stubGlobal`, covering the
  success path, an endpoint override, a server error message, a non-JSON
  error body, and an unparseable reply),
  `packages/debate-round/test/judge-decision-store-wiring.test.ts`
  (composing/missing-source cases across both stores), and
  `packages/debate-round/test/judgeDecisions.test.ts` (persistence CRUD +
  corrupt-storage recovery). No repo-wide `lint` script exists (checked
  root/app/package `package.json` scripts) so none was run. Verified: `bun
  install` (2050 packages), `bun run test` (104 files / 1446 tests, all
  pass), `bun run typecheck` (11 of 12 in-scope packages have a typecheck
  script; all pass), and `bun run build:web` (`debate-ai-web`, succeeds,
  `/judge-decision` route present) all pass.
- **Online Debate Versus AI — real AI speech-generation call.**
  [PR #189](https://github.com/debate/debate-ai.com/pull/189).
  Closes follow-up (a) under idea #3 ("Online Debate Versus AI") — "an
  actual AI speech-generation call that consumes `buildAiResponseRequest`'s
  output (prior speeches + slot + cross-ex flag) to produce the AI's next
  speech text." A new
  `packages/debate-round/src/round/ai-versus-speech-ai.ts` adds
  `AI_VERSUS_SPEECH_SYSTEM_PROMPT` and pure, Vitest-testable
  `buildAiVersusSpeechUserPrompt`/`parseAiVersusSpeechResponse` helpers —
  the prompt lists the slot being delivered, its time limit, whether it's
  a cross-examination turn, and every prior speech tagged "you"/"opponent";
  the parser strips a wrapping markdown code fence or a single layer of
  wrapping double quotes and returns `null` (never throws) on an empty
  reply. `round/ai-versus-speech-client.ts` adds `requestAiVersusSpeech`,
  a small self-contained `fetch` client (mirroring
  `lib/llm-card-scoring-client.ts`'s split) that POSTs to the existing
  `/api/reason-ai` Anthropic proxy. `AiVersusRoundPanel.tsx` gained a
  "Generate AI speech" button on the AI's turn, which builds the request
  from the already-existing `buildAiResponseRequest` and saves the
  returned text through the already-persisted `state/aiVersusRounds.ts`,
  replacing the prior "AI turns block further submission" placeholder
  message. No turn-order or persistence logic changed. Vitest-covered in
  `packages/debate-round/test/ai-versus-speech-ai.test.ts` (prompt
  building + tolerant parsing) and
  `packages/debate-round/test/ai-versus-speech-client.test.ts` (the
  `fetch` client, with `fetch` mocked via `vi.stubGlobal`, covering the
  success path, an endpoint override, a server error message, a non-JSON
  error body, and an empty/unparseable AI reply). Documented in
  `docs/features/ai-versus-rounds.md`. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install` (2050 packages), `bun run test` (100 files /
  1415 tests, all pass), `bun run typecheck` (11 of 12 in-scope packages
  have a typecheck script; all pass), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/versus-ai` route present) all pass.
- **Daily Quests and Targets — quest-board widget UI + real contribution wiring.**
  [PR #188](https://github.com/debate/debate-ai.com/pull/188).
  Closes follow-ups (a) and (b) under the "🎯 Daily Quests and Targets"
  bullet — a quest-board widget UI, and wiring real contribution-submission
  events into a persisted daily feed the board can score against. A new
  `packages/debate-card-search/src/state/dailyQuests.ts` persists a
  `QuestTemplate[]` roster (CRUD) and adds
  `seedQuestTemplatesFromTopicCoverage`, which turns a topic's under-covered
  tracked arguments (via the already-persisted `trackedArguments.ts` coverage
  report) directly into saved quest templates, reusing the existing
  `daily-quests.ts` `buildUnderCoveredArgumentQuests` rather than introducing
  a separate seeding rule. `buildPersistedDailyQuestBoard` composes that
  roster against the real, persisted `state/contributions.ts` feed —
  filtered to contributions carrying a `submittedAt`, mirroring
  `dailyMissionResults.ts`'s `hasSubmittedAt` convention — closing follow-up
  (a). Along the way this surfaced a shared, previously undiscovered gap:
  `ContributionsFeedPanel.tsx`'s submission form never stamped a saved
  contribution's `submittedAt`/`argBlock`, so every feature keyed off those
  fields (`daily-quests.ts`, `dailyMissionResults.ts`, `lib/group-challenges.ts`)
  was permanently starved of real data regardless of how "done" its own
  slice was. That panel now stamps `submittedAt: Date.now()` on every
  submission and adds an optional `argBlock` field to the form;
  `AttributedContribution` (in `contribution-leaderboard.ts`) now declares
  both as optional fields instead of leaving them as ad-hoc, untyped casts.
  A third piece, `panels/DailyQuestsPanel.tsx`, renders the live board, a
  custom-quest form, and a "seed from topic coverage" action at
  `/cards/quests`, linked from the settings dock (`CategoryDock.tsx`, "Daily
  Quests"). Follow-up (c), a streak/reward layer once the Gamified Quests
  idea's streak logic is composed in, remains open — not started; existing
  contributions saved before this change also aren't retroactively
  backfilled with `submittedAt`/`argBlock`. Vitest-covered in
  `packages/debate-card-search/test/dailyQuests.test.ts` (template CRUD,
  corrupt-storage recovery, topic-coverage seeding including upsert and the
  "nothing under-covered" case, and board composition against real
  persisted contributions — including same-day scoring, cross-day exclusion,
  target mismatch, and the missing-`submittedAt` exclusion). Documented in
  `docs/features/daily-quests.md`. No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install` (2050 packages), `bun run test` (98 files / 1396
  tests, all pass), `bun run typecheck` (11 of 12 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`,
  succeeds, `/cards/quests` route present) all pass.
- **Gamified Quests — streak/badge widget UI.**
  Closes the remaining follow-up under the "🎮 Gamified Quests" bullet — "a
  streak/badge widget UI that renders `buildContributorQuestStreak`/
  `getEarnedStreakBadges`." `state/dailyMissionResults.ts` adds
  `buildPersistedQuestStreakRoster`, which lists every contributor with at
  least one persisted daily mission result and resolves each one's streak
  status through the already-existing `buildPersistedContributorQuestStreak`,
  mirroring `lib/unlock-streak-status.ts`'s `buildUnlockStatusRoster` "single
  call that renders the whole roster" convention — no new streak/badge logic
  was introduced. A new
  `packages/debate-card-search/src/panels/QuestStreaksPanel.tsx` renders that
  roster as a table (current streak, longest streak, last completed day, and
  every milestone badge earned), mounted at `/cards/streaks` and linked from
  the settings dock (`CategoryDock.tsx`, "Quest Streaks"). Vitest-covered in
  `packages/debate-card-search/test/dailyMissionResults.test.ts` (empty
  roster, multi-contributor roster sorted alphabetically with correct
  per-contributor streak/badges, and de-duplicating a contributor's multiple
  stored days into one roster entry). No repo-wide `lint` script exists
  (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install` (2050 packages), `bun run test` (97 files / 1380
  tests, all pass), `bun run typecheck` (11 of 12 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`,
  succeeds, `/cards/streaks` route present) all pass.
- **Research Progress Tracking — persisted completion history + progress dashboard UI.**
  Closes follow-ups (a) and (b) under the "📈 Research Progress Tracking"
  bullet. `lib/research-progress.ts`'s pure `buildContributorProgress`/
  `buildTopicProgress`/`buildResearchProgressBoard` already existed but had
  no persistence: `completePersistedRoutedTask` (in `routedTaskQueues.ts`)
  only ever removed a finished assignment from its topic's active queue,
  with nothing remembering that it was ever completed. A new
  `packages/debate-card-search/src/state/researchProgress.ts` adds a
  `completedResearchTasks` localStorage store plus
  `completeAndRecordResearchTask`, which wraps `completePersistedRoutedTask`
  and additionally appends a `{topic, assignment, completedAt}` record —
  closing follow-up (a). `TaskInboxPanel.tsx`'s "Mark complete" action now
  calls this instead of `completePersistedRoutedTask` directly, so a real
  completion event is recorded. The same module's
  `buildPersistedResearchProgressBoard` composes every persisted
  contribution (`state/contributions.ts`), every completed-task record, and
  every still-active `state/routedTaskQueues.ts` assignment into
  `lib/research-progress.ts`'s board directly, and a new
  `panels/ResearchProgressPanel.tsx` renders it as a roster (contribution
  history, task-completion rate, per-topic breakdown) at
  `/cards/progress-tracking` — closing follow-up (b). Follow-up (c), feeding
  a contributor's topic-progress history back into `progress-unlocks.ts`'s
  tier computation, remains open — not started. Vitest-covered in
  `packages/debate-card-search/test/researchProgress.test.ts` (completion
  history persistence and corrupt-storage recovery, plus board composition
  for contributors with only contributions, only active tasks, only
  completed tasks, or a mix). Documented in
  `docs/features/research-progress-tracking.md`. No repo-wide `lint` script
  exists (checked root/app/package `package.json` scripts) so none was run.
  Verified: `bun install` (2050 packages), `bun run test` (97 files / 1377
  tests, all pass), `bun run typecheck` (11 of 12 in-scope packages have a
  typecheck script; all pass), and `bun run build:web` (`debate-ai-web`,
  succeeds, `/cards/progress-tracking` route present) all pass.
- **LLM Card Scoring — real AI-scoring call.**
  Closes follow-up (a) under the "🧠 LLM Card Scoring" bullet. A new
  `packages/debate-card-search/src/lib/llm-card-scoring-ai.ts` adds
  `CARD_SCORING_AI_SYSTEM_PROMPT` and pure, Vitest-testable
  `buildCardScoringAiUserPrompt`/`parseCardScoringAiResponse` helpers — the
  latter tolerantly parses a model reply (raw JSON, a ```json-fenced reply,
  or JSON wrapped in prose), clamping/rounding `overallScore` into [0, 100]
  and returning `null` (never throwing) when required fields are
  missing/empty/wrong-typed. `lib/llm-card-scoring-client.ts` adds
  `requestCardScoringAiAssessment`, a small self-contained `fetch` client
  (no new dependency on `reason-editor`) that POSTs to the existing
  `/api/reason-ai` Anthropic proxy — reused rather than duplicated, and its
  file doc-comment was updated to describe it as a general-purpose proxy
  now that a second package calls it. `state/aiCardAssessments.ts` persists
  each card's assessment in localStorage keyed by card id, mirroring
  `state/cardScores.ts`'s convention under a distinct `aiCardAssessments`
  key. `CardScoringPanel.tsx` gained a per-card "Get AI assessment" button
  with a loading state, inline verdict/per-dimension notes on success, and
  a per-card error message (not a panel crash) on failure or a malformed
  response. The heuristic scorer (`lib/llm-card-scoring.ts`) is unchanged.
  Follow-up (b) — wiring real argument-block keywords and a real
  submitted-card corpus — remains open, not started. Vitest-covered in
  `packages/debate-card-search/test/llm-card-scoring-ai.test.ts` (prompt
  building + tolerant parsing, including clamped out-of-range scores and
  several malformed-response cases) and
  `packages/debate-card-search/test/aiCardAssessments.test.ts`
  (save/get round-trip, missing key, corrupt JSON); the thin `fetch`
  passthrough in `lib/llm-card-scoring-client.ts` was left unit-untested
  per its own file comment, since the logic it depends on is covered
  directly. Documented in `docs/features/llm-card-scoring.md`. No
  repo-wide `lint` script exists (checked root/app/package `package.json`
  scripts) so none was run. Verified: `bun install` (2050 packages), `bun
  run --filter=debate-card-search test` (37 files / 576 tests, all pass),
  `bun run typecheck` (11 of 12 in-scope packages have a typecheck script;
  all pass), `bun run test` (96 files / 1367 tests, all pass), and `bun run
  build:web` (`debate-ai-web`, succeeds, `/cards/scoring` route present)
  all pass.
- **LLM Card Scoring — scoring/duplicate-flag panel UI.**
  `packages/debate-card-search/src/state/cardScores.ts` adds a localStorage
  store for submitted `ScoredCard`s (id, text, argument-block keywords,
  quality signals) plus `buildPersistedCardScoreRanking`, composing the
  existing `lib/llm-card-scoring.ts` `rankCardScores` heuristic scorer
  directly against every persisted card so a duplicate submitted at any time
  is still flagged. A new
  `packages/debate-card-search/src/panels/CardScoringPanel.tsx` renders a
  submission form and every persisted card's ranked overall score, per-
  dimension breakdown (relevance/clarity/uniqueness/evidence quality/
  usability), and a "Likely duplicate" flag, mounted at `/cards/scoring` —
  closing follow-up (c) under the "🧠 LLM Card Scoring" bullet. Follow-ups
  (a) an actual LLM-scoring call and (b) wiring real argument-block keywords/
  a real submitted-card corpus remain open — neither started. Vitest-covered
  in `packages/debate-card-search/test/cardScores.test.ts` (13 tests).
  Verified: `bun install` (2050 packages), `bun run test` (94 files / 1345
  tests, all pass), `bun run typecheck` (12 packages, all pass), and `bun
  run build:web` (`debate-ai-web`, succeeds, `/cards/scoring` route present)
  all pass.
- **Collaboration Prep Room — prep-room panel UI.**
  `packages/debate-card-search/src/state/prepRooms.ts` adds
  `buildPersistedPrepRoom`/`listPrepRoomTopics`, composing the already-
  persisted `evidenceLibraryEntries.ts`, `trackedArguments.ts` (via
  `buildPersistedTopicCoverageReport`), and `contributorAvailability.ts`
  stores into a fully store-driven `PrepRoom` (via the existing
  `buildPrepRoomFromStore`) from just a topic name. A new
  `packages/debate-card-search/src/panels/PrepRoomPanel.tsx` renders a topic
  switcher, that topic's evidence/draft-block keyword search (via the
  existing `searchPrepRoomEvidence`), and its routed research assignments,
  mounted at `/cards/prep-room` — closing follow-up (a) under the "🧑‍🤝‍🧑
  Collaboration Prep Room" bullet. Follow-up (b), a live presence/who's-
  active signal, remains open — not started. Vitest-covered in
  `packages/debate-card-search/test/prepRooms.test.ts`. Verified: `bun
  install` (2050 packages), `bun run typecheck` (12 packages, all pass),
  `bun run test` (93 files / 1332 tests, all pass), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/cards/prep-room` route present) all pass.
  Documented in `docs/features/collaboration-prep-room.md`.
- **Expandable Heading Structure — outline nav panel.**
  `packages/reason-editor/src/react/OutlineNavPanel.tsx` renders the live
  document's H1-H4 heading outline (via the existing `buildHeadingOutline`/
  `getVisibleHeadingIds` engine helpers), with a chevron to collapse/expand
  a heading's subtree and a click-to-jump label that moves the TipTap
  editor's selection to that heading. A new pure helper,
  `toggleCollapsedHeadingId` (in `engine/outline/heading-outline.ts`),
  flips a heading id's membership in the collapsed-id list; the panel
  persists the result through the existing `state/collapsedHeadings.ts`
  store, keyed by `documentId`, restoring it on remount — closing follow-up
  (a) under idea #9 ("Expandable Heading Structure"). `ReasonEditor.tsx`
  gains opt-in `showOutline`/`documentId` props (falling back to the
  existing `contentKey`) that render the panel alongside the document; the
  `/reason-editor` route now passes `showOutline`. Follow-up (b), a
  ProseMirror decoration plugin that hides collapsed ranges in the live
  editor view itself, remains open — not started. Vitest-covered in
  `packages/reason-editor/test/heading-outline.test.ts`
  (`toggleCollapsedHeadingId` cases). Verified: `bun install` (2050
  packages), `bun run typecheck` (12 packages, all pass), `bun run test`
  (92 files / 1327 tests, all pass), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/reason-editor` route present) all pass.
  Documented in `docs/features/reason-editor-outline-nav.md`.
- **Scout-to-Strategy Workflow — case-choice/strategy panel UI.**
  `packages/debate-round/src/state/strategyRecommendations.ts` persists a
  matchup's `StrategyRecommendation` to localStorage, and
  `buildStrategyRecommendationFromStores` (in
  `packages/debate-round/src/round/scout-to-strategy.ts`) resolves
  `opponentProfile`/`judgeProfile` from the existing
  `opponentTeamProfiles.ts`/`judgeProfiles.ts` stores by id, mirroring
  `pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores` convention.
  `packages/debate-round/src/panels/StrategyPanel.tsx` renders a
  matchup-id/opponent-id/judge-id/case-options form plus every persisted
  recommendation (recommended case, full case rankings, judge-adaptation
  notes, risk level and factors) at `/strategy`, closing follow-up (a).
  Follow-ups (b) (wiring `ourSide`/likely opponent side into the risk
  heuristic) and (c) (an actual AI-panel evaluation of case choice) remain
  open — not started. Vitest-covered in
  `packages/debate-round/test/strategyRecommendations.test.ts` (CRUD,
  corrupt/empty/non-array storage handling, upsert, deletion, and the
  panel-view sort) and new cases in
  `packages/debate-round/test/scout-to-strategy.test.ts` (store-id
  resolution, no-data fallback, explicit-profile precedence, and parity
  with the pure `buildStrategyRecommendation`). Verified: `bun install`
  (2050 packages), `bun run typecheck` (11 packages, all pass), `bun run
  test` (92 files / 1324 tests, all pass), and `bun run build:web`
  (`debate-ai-web`, succeeds, `/strategy` route present) all pass.
  PR: [#180](https://github.com/debate/debate-ai.com/pull/180).
- **Topic Coverage Dashboard — checklist persistence + dashboard UI.**
  `packages/debate-card-search/src/state/trackedArguments.ts` adds a small
  CRUD store, `TrackedArgumentRecord`/`listTrackedArguments`/
  `listTrackedTopics`/`saveTrackedArgument`/`deleteTrackedArgument`, for a
  topic's tracked-argument checklist — closing follow-up (b), "a
  team-editable tracked-argument checklist per topic" — persisted to
  localStorage, mirroring the existing `evidenceLibraryEntries.ts`
  convention. The same file's `buildPersistedTopicCoverageReport` composes
  that checklist with the already-persisted `evidenceLibraryEntries.ts`
  store against the existing pure `buildTopicCoverageReport` (from the
  first `lib/topic-coverage.ts` slice) — every `EvidenceLibraryEntry` is
  already a `CoverageCardSummary` (it carries `argBlock`/`wordCount`), so no
  new card shape was needed. A second slice,
  `packages/debate-card-search/src/panels/TopicCoverageDashboardPanel.tsx`,
  renders a topic switcher, an "add to checklist" form, and the resulting
  coverage report (missing/thin/covered per tracked argument, an
  under-covered summary via `getUnderCoveredArguments`, and any untracked
  argument blocks with submitted cards) at `/cards/coverage`, closing
  follow-up (c), "a coverage dashboard UI." Follow-up (a), an
  `argBlock`/word-count field wired into a real card-submission flow beyond
  the existing `/cards/library` evidence-library form, remains open — not
  started. Vitest-covered in
  `packages/debate-card-search/test/trackedArguments.test.ts` (CRUD
  corrupt/empty/non-array storage handling, topic scoping, upsert,
  deletion, and `buildPersistedTopicCoverageReport`'s missing/thin/covered
  classification, cross-topic isolation, untracked surfacing, and a
  caller-supplied thresholds override). Documented in
  `docs/features/topic-coverage-dashboard.md`. Verified from a clean
  install: `bun install` (2050 packages), `bun run typecheck` (11 packages,
  all pass), `bun run test` (91 files / 1308 tests, all pass), and `bun run
  build:web` (`debate-ai-web` + `reason-editor`, both succeed) all pass.
  PR: [#179](https://github.com/debate/debate-ai.com/pull/179).
- **AI Response-Outcome Charts — "what if" hypothetical mode.**
  `packages/debate-round/src/flow/response-outcome.ts` adds
  `applyHypotheticalAdjustments`/`HypotheticalAction`/`HypotheticalAdjustment`
  for recomputing a persisted `ArgumentVulnerability[]` report's scores
  against a hypothetical per-row strategic choice — "extend" (another
  same-side extension), "answer" (the opposing side answers it, resolving
  unanswered status), or "concede" (the row's side drops all support,
  resetting both response counts and marking it unanswered again) —
  reusing the existing scoring rule via a newly extracted
  `computeVulnerabilityScore` helper rather than duplicating it, and
  composing directly against an already-derived report (mirroring the
  existing `*FromReport` convention used by
  `summarizeOutcomeBySideFromReport`/`buildVulnerabilityChartDataFromReport`)
  so it needs no raw `Flow`. `VulnerabilityChartsPanel.tsx` wires this in as
  a per-argument "what if" picker (Extend/Answer/Concede buttons) that
  recomputes that round's side-exposure summary and exposure chart live;
  the hypothetical selection is kept in local component state only — it's
  a scratch exploration, not a persisted change to the round's saved
  report. Vitest-covered in
  `packages/debate-round/test/response-outcome.test.ts`
  (`applyHypotheticalAdjustments`'s no-op-when-unnamed, extend/answer/concede
  score effects, row isolation, score-capping parity with the original
  scoring rule, and composability with
  `buildVulnerabilityChartDataFromReport`/`summarizeOutcomeBySideFromReport`).
  See idea #4 ("AI Response-Outcome Charts") in Product Feature Ideas below
  — this closes follow-up (c), "a 'what if' mode that recomputes the score
  against a hypothetical strategic choice rather than only the flow's
  current state." Follow-up (a), an actual AI-panel call (multiple
  "counsel" model roles) that evaluates likely response paths and clash
  points beyond this deterministic heuristic, remains open — not started.
  Verified from a clean install: `bun install` (2050 packages), `bun run
  typecheck` (11 packages, all pass), `bun run test` (90 files / 1293
  tests, all pass), and `bun run build` (`debate-ai-web` + `reason-editor`,
  both succeed) all pass.
  PR: [#178](https://github.com/debate/debate-ai.com/pull/178).
- **Video-Lecture-Training Coach AI — materials-upload/coach panel UI.**
  `packages/debate-speech-writer/src/panels/CoachMaterialsPanel.tsx` renders
  the already-persisted `CoachMaterial` store (`state/coachMaterials.ts`) as
  a real panel: an upload form (kind, title, topic, tags, text) that saves
  through the existing `saveCoachMaterial`/`deleteCoachMaterial`, every
  material grouped by kind via the new `buildCoachMaterialLibraryFromStore`
  (each with a "Delete" action), and an "Ask the coach" preview that runs
  the new `findRelevantMaterialsFromStore` plus the already-existing
  `buildGroundedCoachPrompt` to show the matched materials and composed
  prompt text (no AI call is made — see idea #8's follow-up (b), still
  open). `buildCoachMaterialLibraryFromStore`/`findRelevantMaterialsFromStore`
  compose the existing pure `buildCoachMaterialLibrary`/`findRelevantMaterials`
  directly against the persisted store, mirroring
  `buildTopContributorAwardsFromStore`'s "compose the pure function directly
  against the persisted store" convention — no new scoring/grouping logic.
  It's mounted at `/coach-materials`
  (`apps/debate-ai.com/app/coach-materials/page.tsx`, with a back-link to
  `/debate`) and reachable from the global nav dock's Settings menu ("Coach
  Materials", via a new `BookOpen`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Vitest-covered in
  `packages/debate-speech-writer/test/coachMaterials.test.ts`
  (`buildCoachMaterialLibraryFromStore`'s empty-store and kind-grouping
  behavior, `findRelevantMaterialsFromStore`'s empty-store, relevance
  ranking, and options-passthrough behavior). Documented in
  `docs/features/coach-materials.md`. See idea #8
  ("Video-Lecture-Training Coach AI") in Product Feature Ideas below — this
  closes follow-up (c), "a materials-upload/coach chat panel UI." Follow-ups
  (a) transcription/parsing that turns an uploaded recording or document
  into a material's text, and (b) an actual AI Q&A call that consumes
  `buildGroundedCoachPrompt`'s output, remain open — neither is started.
  PR: [#177](https://github.com/debate/debate-ai.com/pull/177).
- **Group Challenges — challenge-board/creation UI.**
  `packages/debate-card-search/src/panels/GroupChallengesPanel.tsx` adds a
  full-page React panel that lets a coach create a squad-scoped friendly
  challenge — title, a goal (either "reach N matching contributions,"
  optionally filtered by contribution kind/argument block, or "reach N
  recorded wins"), a comma-separated squad roster, and a start/end window —
  and lists every persisted `GroupChallenge` with its goal, window, and
  roster rendered as badges, each with a "Remove" action, mirroring
  `CoachingProgramsPanel`'s create-form-plus-roster convention. It's mounted
  at `/cards/group-challenges`
  (`apps/debate-ai.com/app/cards/group-challenges/page.tsx`, with a
  back-link to `/cards`, following the same panel-page convention as
  `/cards/collaboration`/`/cards/brainstorm`) and reachable from the global
  nav dock's Settings menu ("Group Challenges", via a new `Target`-icon
  `DropdownMenuItem` in `CategoryDock.tsx`) — this is the twenty-seventh
  "wire a persisted slice's UI into the actual web app" follow-up closed in
  this repo. The panel adds one small helper to `state/groupChallenges.ts` —
  `buildGroupChallengesPanelView` (every persisted challenge, title-sorted,
  mirroring `coachingPrograms.ts`'s `buildCoachingProgramsPanelView`
  convention) — reusing the already-persisted `saveGroupChallenge`/
  `deleteGroupChallenge` directly rather than introducing new
  challenge-lifecycle logic. Vitest-covered in
  `packages/debate-card-search/test/groupChallenges.test.ts`
  (`buildGroupChallengesPanelView`'s empty-store, title-sort, and
  non-mutating-of-the-underlying-store behavior). See the "Group Challenge
  Persistence" entry above and idea #13 ("Coaching Programs and Group
  Challenges") in Product Feature Ideas below — this closes follow-up (a),
  "a challenge-board/creation UI in `debate-card-search` that reads/writes
  through this store," named under that persistence slice. This is a
  config-management panel only — it doesn't render
  `computeGroupChallengeProgress`'s live standings, since a challenge's
  progress needs caller-supplied contributions/win events that still aren't
  persisted in a form this panel could read live (follow-up (b) named under
  the same persistence slice). Verified from a clean install: `bun install`
  (2050 packages), `bun run typecheck` (11 packages, all pass), `bun run
  test` (90 files / 1281 tests, all pass), and `bun run build`
  (`debate-ai-web` + `reason-editor`, both succeed) all pass.
- **Contributions Feed — like/save/endorse UI.**
  `packages/debate-card-search/src/panels/ContributionsFeedPanel.tsx` adds a
  full-page React panel with a submission form (contributor ID + kind picker)
  for creating a new `AttributedContribution`, plus every persisted
  contribution rendered as a ranked feed with Like/Save/Endorse buttons wired
  directly to the already-persisted `recordPersistedLike`/
  `recordPersistedSave`/`recordPersistedEndorsement` actions in
  `state/contributions.ts`. A submitted contribution starts with a neutral
  `qualitySignals: [0.5]` placeholder (no automated quality scorer is wired
  into the form yet) and "Endorse" records a full-credibility
  (`reviewerWeight: 1`) endorsement (no reviewer-identity/credibility system
  exists yet) — both follow-ups already tracked below. The panel adds one new
  composing function, `buildPersistedContributionFeed`
  (`packages/debate-card-search/src/state/contributions.ts`), which ranks
  every persisted contribution by helpfulness score via the existing
  `community-rating.ts` `rankContributions`, reusing that scoring directly
  rather than introducing new logic here. It's mounted at
  `/cards/contributions`
  (`apps/debate-ai.com/app/cards/contributions/page.tsx`, with a back-link to
  `/cards`, following the existing panel-page convention) and reachable from
  the global nav dock's Settings menu ("Contributions Feed", via a new
  `ThumbsUp`-icon `DropdownMenuItem` in `CategoryDock.tsx`). Each feed entry
  also surfaces its `isPopularityOnlyOutlier` flag as a badge, closing the
  leaderboard-panel half of idea #11's follow-up (c) ("surfacing
  `isPopularityOnlyOutlier` contributions ... for moderator review") for this
  feed view — the existing `/cards/leaderboard` per-contributor rollup still
  doesn't surface it. This closes follow-up (a) named under both the
  "Contribution Leaderboard" bullet ("a real submitted-contribution flow (and
  a like/save/endorse UI)") and idea #11 "Community-Rated Summaries and
  Highlights" ("a real like/save/endorse UI") in the Product Feature
  Ideas/Research Crowdsourcing Organizer Features sections below.
  Vitest-covered in `packages/debate-card-search/test/contributions.test.ts`
  (`buildPersistedContributionFeed`'s empty-store, ranking-by-helpfulness,
  live-update-after-a-like, and popularity-only-outlier-flagging behavior).
  Verified from a clean install: `bun install` (2050 packages), `bun run
  typecheck` (11 packages, all pass), `bun run test` (90 files / 1274 tests,
  all pass), and `bun run build` (`debate-ai-web` + `reason-editor`, both
  succeed) all pass.
- **Common Argument Library — folder/collection browser UI.**
  `packages/debate-card-search/src/panels/ArgumentLibraryPanel.tsx` adds a
  full-page React panel that renders every persisted `EvidenceLibraryEntry`
  organized into topic folders (each split into case-area subgroups) plus
  cross-cutting tag collections, with a click-to-toggle tag filter that
  narrows the view to cards carrying any of the selected tags — mirroring
  `EvidenceLibraryPanel`'s mount-then-render convention (an SSR-safe loading
  state, then an empty state, then the populated view). It's mounted at
  `/cards/argument-library`
  (`apps/debate-ai.com/app/cards/argument-library/page.tsx`, with a back-link
  to `/cards`, following the same panel-page convention as `/cards/library`/
  `/cards/brainstorm`) and reachable from the global nav dock's Settings menu
  ("Argument Library", via a new `FolderTree`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`) — this is the twenty-sixth "wire a persisted slice's UI
  into the actual web app" follow-up closed in this repo. The panel adds one
  small helper to `state/evidenceLibraryEntries.ts` —
  `buildPersistedArgumentLibrary` (organizes every persisted evidence entry
  via `lib/argument-library.ts`'s existing `buildArgumentLibrary`, since
  `EvidenceLibraryEntry` already extends `LibraryCard` with the `topic`/
  `caseArea`/`tags` fields the library needs) — reusing the already-built
  organizing logic directly rather than introducing new grouping logic here.
  Vitest-covered in `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`
  (`buildPersistedArgumentLibrary`'s empty-store, topic/case-area grouping,
  tag-collection grouping, and non-mutating-of-the-underlying-store
  behavior). See the "📚 Common Argument Library" bullet in Research
  Crowdsourcing Organizer Features below — this closes follow-up (b), "a
  folder/collection browser UI." Follow-ups (a) (wiring a `topic`/
  `caseArea`/`tags` field into wherever submitted cards are eventually
  persisted beyond this evidence-library store) and (c) (a tag-autocomplete/
  tag-management affordance) remain open — neither is started. See
  [PR #173](https://github.com/debate/debate-ai.com/pull/173).
- **Coaching Programs and Group Challenges — coaching-program config UI.**
  `packages/debate-round/src/panels/CoachingProgramsPanel.tsx` adds a
  full-page React panel that lets a coach create a named coaching space
  (name + comma-separated squad-roster member IDs) and lists every
  persisted `CoachingProgramConfig`, each with its roster rendered as
  badges and a "Remove" action, mirroring `PreRoundBriefingsPanel`'s
  list-plus-clear convention. It's mounted at `/coaching-programs`
  (`apps/debate-ai.com/app/coaching-programs/page.tsx`, with a back-link to
  `/debate`, following the same panel-page convention as `/coaching`/
  `/prep-notes`) and reachable from the global nav dock's Settings menu
  ("Coaching Programs", via a new `School`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`) — this is the twenty-fifth "wire a persisted slice's
  UI into the actual web app" follow-up closed in this repo. The panel
  adds one small helper to `state/coachingPrograms.ts` —
  `buildCoachingProgramsPanelView` (every persisted program config,
  name-sorted, mirroring `drillSets.ts`'s `buildDrillSetsPanelView`
  sorting convention) — reusing the already-persisted
  `saveCoachingProgram`/`deleteCoachingProgram` directly rather than
  introducing new config-lifecycle logic. Vitest-covered in
  `packages/debate-round/test/coachingPrograms.test.ts`
  (`buildCoachingProgramsPanelView`'s empty-store, name-sort, and
  non-mutating-of-the-underlying-store behavior). See idea #13
  ("Coaching Programs and Group Challenges") in Product Feature Ideas
  below — this closes the config-management half of follow-up (b), "a
  coaching-space dashboard UI." It does not yet render
  `buildCoachingProgramBoard`'s composed topic-sprint/group-challenge/
  member-drill board, since those inputs (persisted challenges, win
  events, topic-sprint contributions, and a roundId-to-contributor
  mapping for member drills) aren't available in a form this panel could
  read live — group-challenges' own follow-up (c) ("persisting
  challenges...") is still open. See the new follow-up noted under idea
  #13 below.
- **Team Collaboration Mode — collaboration-panel UI.**
  `packages/debate-card-search/src/panels/SprintNotesPanel.tsx` adds a
  full-page React panel that lets a teammate submit a new prep note against a
  shared topic (topic, author ID, note text, optional assignee) and renders
  every persisted `SprintNote` grouped by topic, each with a "cycle status"
  action (open → covered → needs-follow-up → open) and an "assign to" /
  "unassign" control — mirroring the existing `PrepNotesPanel` convention
  directly, since `SprintNoteStatus` shares the exact same three-value cycle
  as `PrepNoteStatus`. It's mounted at `/cards/collaboration`
  (`apps/debate-ai.com/app/cards/collaboration/page.tsx`, with a back-link to
  `/cards`, following the same panel convention as `/cards/reviews`/
  `/cards/brainstorm`) and reachable from the global nav dock's Settings menu
  ("Team Collaboration Mode", via a new `Users2`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (a), "a collaboration-mode panel UI,"
  named under the "🤝 Team Collaboration Mode" bullet in Research
  Crowdsourcing Organizer Features below — this is the twenty-fourth "wire a
  persisted slice's UI into the actual web app" follow-up closed in this
  repo. The panel adds four small helpers to `state/sprintNotes.ts` —
  `buildSprintNotesPanelView` (groups every persisted note by topic, in
  first-seen order across the stored notes, each group oldest first,
  mirroring `prepNotes.ts`'s `buildPrepNotesPanelView` grouping-by-status
  convention), `nextSprintNoteStatus` (the panel's status-cycle order,
  mirroring `prepNotes.ts`'s `nextPrepNoteStatus`), and
  `updatePersistedSprintNoteStatus`/`assignPersistedSprintNote` (apply the
  already-existing pure `updateSprintNoteStatus`/`assignSprintNote`
  transitions from `lib/team-collaboration-mode.ts` against a stored note and
  save the result, mirroring `prepNotes.ts`'s apply-and-save convention) —
  introducing no new note-lifecycle logic. Vitest-covered in
  `packages/debate-card-search/test/sprintNotes.test.ts` (status-cycle and
  assign/unassign apply-and-save behavior including the missing-id no-op
  case, and `buildSprintNotesPanelView`'s topic grouping, ordering, and live
  reflection of a status update). Documented in
  `docs/features/team-collaboration-mode.md` (mirroring
  `docs/features/prep-notes.md`'s format) and in
  `packages/debate-card-search/README.md`'s package-layout note and usage
  example. This panel only renders the `SprintNote` thread itself, not the
  full `buildTopicSprint` composition (quest board + task routing + progress
  board alongside notes) — none of `TopicCoverageReport`,
  `ContributorAvailability`, `TrackedTopicAssignment`, or
  `QuestContribution` are persisted in a form this panel could read live yet,
  so follow-up (b), "persisting a topic sprint's other inputs," remains open,
  as does follow-up (c), a live presence/who's-active signal — neither
  started. Verified from a clean install: `bun install`, `bun run typecheck`
  (11 packages with a typecheck script all pass; `debate-ai-web` has no
  separate typecheck script — types are checked as part of its build), `bun
  run test` (90 files / 1262 tests, all pass), and `bun run build:web`
  (production build, including the new `/cards/collaboration` route) all
  pass. No lint script is configured in this repo. PR: (opened by this run —
  see branch `claude/practical-allen-m9ogfi`). The local dev server was not
  smoke-tested in this sandbox (no reliable local browser workflow available
  here).
- **Legacy Verbatim / Cardmirror Compatibility — text-emphasize command.**
  `packages/debate-card-parser/src/utils/verbatim-shortcuts.ts` adds
  `toggleEmphasisHtml`, a pure, tag-aware function that toggles a
  `<mark>`/`</mark>` emphasis run over `[start, end)` of a card's *visible*
  (tag-stripped) text — closing follow-up (c), "a text-emphasize (toggle
  `<mark>`) command over an editor selection range," named under idea #14
  ("Legacy Verbatim / Cardmirror Compatibility") in Product Feature Ideas
  below. Addressing by visible-text offset (rather than raw HTML index)
  means a selection lands correctly around existing markup like `<u>` runs,
  mirroring `condenseCardHtml`'s tag-aware approach in the same file. A
  collapsed selection is a no-op; a selection that exactly matches an
  existing `<mark>` run's bounds un-emphasizes it; otherwise the selection
  is wrapped in a new `<mark>` pair, absorbing any `<mark>`/`</mark>` tags
  already touching the selection (inside it or immediately adjacent) so
  overlapping emphasis merges into one run instead of nesting.
  Vitest-covered in `packages/debate-card-parser/test/verbatim-shortcuts.test.ts`
  (wrap, un-emphasize, idempotent wrap-then-unwrap, merging a partially
  pre-marked selection, tag-aware offsets around a surrounding `<u>` run,
  collapsed-selection no-op, reversed-selection normalization, and
  out-of-range offset clamping). Exported from the package's public entry
  point alongside `condenseCardHtml`/`formatShortCiteTag`/`moveOutlineNode`.
  Follow-ups (a), wiring these commands into actual keyboard-shortcut
  handlers in `reason-editor`'s toolbar/editor view, and (b), a "send
  selected evidence to a speech document" command (which needs a
  speech-document target that doesn't exist yet), remain open — not
  started; this is a pure command function only, with no editor UI wiring.
  Verified from a clean install: `bun install`, `bun run typecheck` (11
  packages with a typecheck script all pass), `bun run test` (90 files /
  1253 tests, all pass), and `bun run build:web` (production build) all
  pass. No lint script is configured in this repo.
- **AI Response-Outcome Charts — chart/panel UI.**
  `packages/debate-round/src/panels/VulnerabilityChartsPanel.tsx` adds a
  full-page React panel that renders every persisted vulnerability report —
  a per-side exposure summary (argument count, unanswered count, average
  vulnerability score) and a "most exposed arguments" bar chart — reusing
  the already-existing `response-outcome.ts`
  `getArgumentVulnerabilityReport`/`summarizeOutcomeBySide`/
  `buildVulnerabilityChartData` computation directly. It's mounted at
  `/outcomes` (`apps/debate-ai.com/app/outcomes/page.tsx`, with a back-link
  to `/debate`, following the same panel convention as `/summaries`/
  `/outline`) and reachable from the global nav dock's Settings menu ("AI
  Response-Outcome Charts", via a new `BarChart3`-icon `DropdownMenuItem`
  in `CategoryDock.tsx`). Closes follow-up (b), "a chart/panel UI in
  `debate-round` that renders
  `buildVulnerabilityChartData`/`summarizeOutcomeBySide`," named under idea
  #4 ("AI Response-Outcome Charts") in Product Feature Ideas below — this
  is the twenty-third "wire a persisted slice's UI into the actual web
  app" follow-up closed in this repo. The panel is backed by a new
  persistence slice, `packages/debate-round/src/state/vulnerabilityReports.ts`
  (`listVulnerabilityReports`/`getVulnerabilityReport`/
  `saveVulnerabilityReport`/`deleteVulnerabilityReport`), which persists a
  round's derived `ArgumentVulnerability[]` report plus its flow `sideKeys`
  to localStorage, keyed by `roundId`, mirroring the existing
  `flowSummaries.ts` persistence convention. `response-outcome.ts` gains
  two row-based helpers — `summarizeOutcomeBySideFromReport` and
  `buildVulnerabilityChartDataFromReport` — split out of
  `summarizeOutcomeBySide`/`buildVulnerabilityChartData` the same way
  `flow-transcript-summary.ts`'s `buildFlowSummaryTextFromRows` was, so the
  panel can render an already-persisted report without the original raw
  `Flow`; no new vulnerability-scoring logic is introduced. Vitest-covered
  in `packages/debate-round/test/vulnerabilityReports.test.ts` (empty/corrupt
  storage, list/get/save/delete, upsert-on-save, and the sorted panel view)
  and new cases in `packages/debate-round/test/response-outcome.test.ts`
  (the row-based helpers match their `Flow`-based counterparts given the
  same derived report). Documented in
  `docs/features/response-outcome-charts.md` (mirroring
  `docs/features/flow-summaries.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout notes and usage
  examples. Follow-up (a), an actual AI-panel call (multiple "counsel"
  model roles) that evaluates likely response paths and clash points
  beyond this deterministic heuristic, and follow-up (c), a "what if" mode
  that recomputes the score against a hypothetical strategic choice, remain
  open — not started; this panel only renders reports already derived from
  a manually flowed grid, and nothing in this repo yet calls
  `getArgumentVulnerabilityReport`/`saveVulnerabilityReport` to generate one
  from a live round. Verified from a clean install: `bun install`, `bun run
  typecheck` (11 packages with a typecheck script all pass), `bun run test`
  (90 files / 1243 tests, all pass), and `bun run build:web` (production
  build, including the new `/outcomes` route) all pass. No lint script is
  configured in this repo. PR: [#169](https://github.com/debate/debate-ai.com/pull/169).
  The local dev server was not smoke-tested in this sandbox (no reliable
  local browser workflow available here).
- **CX NDCA Standings — standings dashboard UI.**
  `packages/debate-round/src/panels/StandingsPanel.tsx` adds a full-page
  React panel that lets a user record a team's tournament result
  (team ID, tournament name, date, division, bid level, outround finish,
  prelim win/loss record) and renders every persisted result's cumulative,
  ranked season standings — rank, total qualification points, tournaments
  counted vs. attended, cumulative prelim record, and best finish — reusing
  the already-existing `rankings/ndca-standings.ts`
  `computeTournamentPoints`/`buildStandings`/`rankStandings` computation
  directly. It's mounted at `/standings`
  (`apps/debate-ai.com/app/standings/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/opponents`/`/judges`)
  and reachable from the global nav dock's Settings menu ("CX NDCA
  Standings", via a new `TrendingUp`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (c), "a standings dashboard UI
  (likely under `/rank`)," named under idea #1 ("CX NDCA Standings") in
  Product Feature Ideas below — this is the twenty-second "wire a
  persisted slice's UI into the actual web app" follow-up closed in this
  repo. The panel is backed by a new persistence slice,
  `packages/debate-data-sync/src/state/tournamentResults.ts`
  (`listTournamentResults`/`listTournamentResultsForTeam`/
  `saveTournamentResult`/`deleteTournamentResult`), which persists
  `TournamentResult` records (each wrapped with a synthetic `id`, since a
  team can attend many tournaments, mirroring `debate-card-search`'s
  `revisionHistory.ts` wrapped-record convention) to localStorage, plus
  `buildStandingsFromStore`, which groups every persisted result by
  `teamId` and runs it directly through `buildStandings`/`rankStandings` —
  introducing no new points-scoring or ranking logic. Vitest-covered in
  `packages/debate-data-sync/test/tournamentResults.test.ts` (empty/corrupt
  storage, list/save/delete, per-team filtering, and
  `buildStandingsFromStore` grouping + ranking + honoring
  `BuildStandingsOptions` like `countBestN`). Documented in
  `docs/features/standings.md` (mirroring `docs/features/ai-versus-rounds.md`'s
  format) and in `packages/debate-data-sync/README.md`/
  `packages/debate-round/README.md`'s package-layout notes and usage
  examples. Follow-up (a), a real Tabroom/NDCA scraper that produces
  `TournamentResult` records automatically (today's `sync-tournaments.ts`
  only fetches tournament names), and follow-up (b), a real,
  circuit-sourced `QualificationPointsTable` instead of the illustrative
  default, remain open — not started; every result is entered by hand
  through this panel's form, and standings use
  `DEFAULT_QUALIFICATION_POINTS_TABLE`. Verified from a clean install:
  `bun install`, `bun run typecheck` (11 packages with a typecheck script
  all pass — this PR adds `state/tournamentResults.ts` typechecking to
  `debate-data-sync`'s existing script and `StandingsPanel.tsx` to
  `debate-round`'s; `debate-ai-web` has no separate typecheck script —
  types are checked as part of its build), `bun run test` (89 files / 1227
  tests, all pass), and `bun run build:web` (production build, including
  the new `/standings` route) all pass. No lint script is configured in
  this repo. PR: TBD. The local dev server was not smoke-tested in this
  sandbox (no reliable local browser workflow available here).
- **Practice Round Simulator — round-simulator UI.**
  `packages/debate-round/src/panels/PracticeRoundSimulatorPanel.tsx` adds a
  full-page React panel that lets a user configure a practice round (round
  ID, `debate-timer` format, side, an AI judge paradigm — built-in or
  custom via `buildCustomJudgeParadigm` — and an optional AI opponent
  persona), composing them via the already-existing
  `buildPracticeRoundSetup` and saving through `state/practiceRounds.ts`
  (`savePracticeRound`, `deletePracticeRound`), and renders every persisted
  round below with its setup sections, submitted-speech progress (read
  through the existing "Online Debate Versus AI" `aiVersusRounds.ts` store
  via `getPracticeRoundSubmittedSpeeches`, with a link to `/versus-ai` to
  actually submit them), and post-round feedback once one has been
  generated. It's mounted at `/practice-round`
  (`apps/debate-ai.com/app/practice-round/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/versus-ai`/
  `/coaching`) and reachable from the global nav dock's Settings menu
  ("Practice Round Simulator", via a new `PlayCircle`-icon
  `DropdownMenuItem` in `CategoryDock.tsx`). Closes follow-up (b), "a
  round-simulator UI that reads/writes through the persistence store,"
  named under the "🧪 Practice Round Simulator" bullet in Research
  Crowdsourcing Organizer Features below — this is the twenty-first "wire a
  persisted slice's UI into the actual web app" follow-up closed in this
  repo. The panel adds one small helper to `state/practiceRounds.ts` —
  `buildPracticeRoundsPanelView`, which sorts every persisted round by
  `roundId` for a stable display order (mirroring `aiVersusRounds.ts`'s
  `buildAiVersusRoundsPanelView`) — introducing no new setup-composition,
  judge-paradigm, or opponent-persona logic; every other field/action the
  panel uses (`buildPracticeRoundSetup`, `listJudgeParadigms`,
  `buildCustomJudgeParadigm`, `listOpponentPersonas`, `savePracticeRound`,
  `deletePracticeRound`, `getPracticeRoundSubmittedSpeeches`) already
  existed. Vitest-covered in
  `packages/debate-round/test/practiceRounds.test.ts` (empty view when
  nothing is stored, sorted by `roundId`, and that the sort doesn't mutate
  the underlying stored order). Documented in
  `docs/features/practice-round-simulator.md` (mirroring
  `docs/features/ai-versus-rounds.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note and usage
  example. Follow-up (a), an actual AI speech-generation call for the AI
  opponent's speeches and an AI judge-decision call under the chosen
  paradigm, remains open — not started; until it exists, post-round
  feedback is never generated automatically, so the panel always shows "no
  post-round feedback yet." Verified from a clean install: `bun install`,
  `bun run typecheck` (11 packages with a typecheck script all pass;
  `debate-ai-web` has no separate typecheck script — types are checked as
  part of its build), `bun run test` (88 files / 1216 tests, all pass), and
  `bun run build:web` (production build, including the new
  `/practice-round` route) all pass. No lint script is configured in this
  repo. PR: [#166](https://github.com/debate/debate-ai.com/pull/166). The
  local dev server was not smoke-tested in this sandbox (no reliable local
  browser workflow available here).
- **Team Brainstorm Assist — brainstorm-panel UI.**
  `packages/debate-card-search/src/panels/BrainstormBoardPanel.tsx` adds a
  full-page React panel that lets a squad submit a new brainstorm idea
  (argument block, contributor ID, category, idea text) and renders every
  persisted idea grouped into its board (argument block + category), each
  board ranked by popularity with a "possible duplicate" badge and an
  upvote action — reusing `team-brainstorm-assist.ts`'s existing
  `groupIdeasByBoard`/`buildBrainstormBoard`/`rankBrainstormIdeas` directly.
  It's mounted at `/cards/brainstorm`
  (`apps/debate-ai.com/app/cards/brainstorm/page.tsx`, with a back-link to
  `/cards`, following the same panel convention as `/cards/reviews`/
  `/cards/inbox`) and reachable from the global nav dock's Settings menu
  ("Team Brainstorm Assist", via a new `Lightbulb`-icon `DropdownMenuItem`
  in `CategoryDock.tsx`). Closes follow-up (b) named under the "🧠 Team
  Brainstorm Assist" bullet in Research Crowdsourcing Organizer Features
  below — this is the twentieth "wire a persisted slice's UI into the
  actual web app" follow-up closed in this repo. The panel adds two small
  helpers to `state/brainstormIdeas.ts` — `buildBrainstormBoardsPanelView`,
  which groups every persisted `BrainstormIdea` into its board and ranks
  each via `buildBrainstormBoard`, sorted by argument block then category
  for a stable display order (mirroring `routedTaskQueues.ts`'s
  `buildTaskInboxView`), and `upvotePersistedBrainstormIdea`, which reads a
  stored idea, increments its `upvotes` by one, and saves it back
  (mirroring `prepNotes.ts`'s `updatePersistedPrepNoteStatus` apply-and-save
  convention) — introducing no new ranking, duplicate-flagging, or mutation
  logic; every other field/action the panel uses (`groupIdeasByBoard`,
  `buildBrainstormBoard`, `saveBrainstormIdea`) already existed. Follow-up
  (a), seeding boards from the Topic Coverage Dashboard's under-covered
  arguments via `buildBrainstormPromptsForCoverageGaps`, and an actual
  AI-generation call that drafts candidate ideas, remain open — not
  started; the panel only lets a human type an idea in, and a board only
  appears once someone has submitted to it. Vitest-covered in
  `packages/debate-card-search/test/brainstormIdeas.test.ts` (empty board
  list when nothing is stored, ideas grouped into boards sorted by argument
  block then category, and `upvotePersistedBrainstormIdea` incrementing a
  stored idea's upvote count — including the no-op case for a missing id).
  Documented in `docs/features/brainstorm-board.md` (mirroring
  `docs/features/prep-notes.md`'s format) and in
  `packages/debate-card-search/README.md`'s package-layout note and usage
  example. Verified from a clean install: `bun install`, `bun run
  typecheck` (11 packages with a typecheck script all pass; `debate-ai-web`
  has no separate typecheck script — types are checked as part of its
  build), `bun run test` (88 files / 1213 tests, all pass), and `bun run
  build:web` (production build, including the new `/cards/brainstorm`
  route) all pass. No lint script is configured in this repo. PR:
  [#165](https://github.com/debate/debate-ai.com/pull/165). The local dev
  server was not smoke-tested in this sandbox (no reliable local browser
  workflow available here).
- **Online Debate Versus AI — round-setup + submission UI.**
  `packages/debate-round/src/panels/AiVersusRoundPanel.tsx` adds a full-page
  React panel that lets a user start a round (round ID, `debate-timer`
  format, and side — formats with no `secondary` side, like Congress, only
  offer the primary side), renders the round's full turn order derived via
  `buildAiVersusSpeechOrder` (each slot tagged "You"/"AI" and marked
  Delivered/Next/Pending), and — when it's the user's turn — a text area to
  type and submit the next expected speech, validated with
  `validateSpeechSubmission` before saving through the already-persisted
  `state/aiVersusRounds.ts` (`saveAiVersusRound`, `deleteAiVersusRound`). AI
  turns are shown as pending rather than fillable, since no AI
  speech-generation call exists yet. It's mounted at `/versus-ai`
  (`apps/debate-ai.com/app/versus-ai/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/word-count`/
  `/outline`) and reachable from the global nav dock's Settings menu
  ("Online Debate Versus AI", via a new `Bot`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (b) named under idea #3 ("Online
  Debate Versus AI") in Product Feature Ideas below — this is the
  nineteenth "wire a persisted slice's UI into the actual web app"
  follow-up closed in this repo. The panel adds two small helpers to
  `state/aiVersusRounds.ts` — `buildAiVersusRoundsPanelView`, which sorts
  every persisted round by `roundId` for a stable display order (mirroring
  `wordCountRounds.ts`'s `buildWordCountRoundsPanelView`), and
  `getAiVersusRoundStatus`, which rebuilds a round's turn order and
  next-slot status on read from its stored `styleKey`/`userSide` rather
  than storing the order itself (mirroring `wordCountRounds.ts`'s
  `getWordCountRoundStatuses`) — introducing no new turn-order or
  validation logic; every other field/action the panel uses
  (`buildAiVersusSpeechOrder`, `getNextSpeechSlot`, `isUsersTurn`,
  `validateSpeechSubmission`, `saveAiVersusRound`, `deleteAiVersusRound`)
  already existed. Vitest-covered in
  `packages/debate-round/test/aiVersusRounds.test.ts` (empty view when
  nothing is stored, sorted by `roundId`, the underlying stored order left
  untouched, `getAiVersusRoundStatus` returning `undefined` for an
  unpersisted round, its output matching an independently-derived
  `buildAiVersusSpeechOrder`/`getNextSpeechSlot`/`isUsersTurn` computation,
  and the status reflecting a newly submitted speech). Documented in
  `docs/features/ai-versus-rounds.md` (mirroring
  `docs/features/word-count-rounds.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note and usage
  example. Follow-up (a), an actual AI speech-generation call that consumes
  `buildAiResponseRequest`'s output to produce the AI's next speech text,
  remains open — not started; until it exists, a round can only progress as
  far as the user's own turns. Speech submission is also text-only —
  `PriorSpeechRecord` has no audio field and no transcription pipeline
  exists in this repo, so "or record a speech" from the original follow-up
  wording isn't implemented, documented as a known gap in the new doc file
  (the same trade-off the Word-Count panel's own unfinished follow-up (b)
  made). Verified from a clean install: `bun install`, `bun run typecheck`
  (11 packages with a typecheck script all pass; `debate-ai-web` has no
  separate typecheck script — types are checked as part of its build),
  `bun run test` (88 files / 1209 tests, all pass), and `bun run build:web`
  (production build, including the new `/versus-ai` route) all pass. No
  lint script is configured in this repo. PR:
  [#164](https://github.com/debate/debate-ai.com/pull/164). The local dev
  server was not smoke-tested in this sandbox (no reliable local browser
  workflow available here).
- **Outline Filters and Argument Tree View — outline panel UI.**
  `packages/debate-round/src/panels/ArgumentTreePanel.tsx` adds a full-page
  React panel that renders every persisted round's argument tree as a
  filterable outline, with Kind (all/headings-only/arguments-only), Side,
  Speech, and "Unanswered only" controls — each populated from the distinct
  side keys and speech names actually present in that round's tree — that
  re-filter the tree live via the existing `filterArgumentTree`/
  `flattenArgumentTree` and persist the chosen filter per round through the
  already-existing `argumentTreeFilters.ts` store. It's mounted at
  `/outline` (`apps/debate-ai.com/app/outline/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/summaries`/
  `/word-count`) and reachable from the global nav dock's Settings menu
  ("Argument Tree Outline", via a new `ListTree`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (a) named under idea #10 ("Outline
  Filters and Argument Tree View") in Product Feature Ideas below — this is
  the eighteenth "wire a persisted slice's UI into the actual web app"
  follow-up closed in this repo. Since the tree itself is derived from a
  live `Flow` rather than hand-entered, and nothing else in this repo
  persists a round's derived tree yet, this slice also adds
  `state/argumentTrees.ts` — a new `ArgumentTreeRecord` localStorage store
  (`listArgumentTrees`/`getArgumentTree`/`saveArgumentTree`/
  `deleteArgumentTree`/`buildArgumentTreesPanelView`), mirroring the
  existing `flowSummaries.ts`/`drillSets.ts` persistence convention, plus
  `buildAndSaveArgumentTree(flow, roundId)` for deriving and persisting a
  round's tree from an already-flowed `Flow` in one step. No new
  tree-derivation or filtering logic is introduced — `buildArgumentTree`/
  `filterArgumentTree`/`flattenArgumentTree` and the filter-selection store
  already existed. Vitest-covered in
  `packages/debate-round/test/argumentTrees.test.ts` (CRUD + upsert +
  delete semantics, `buildAndSaveArgumentTree` deriving from a small hand-
  built flow, and `buildArgumentTreesPanelView`'s stable `roundId` sort
  without mutating storage order). Documented in
  `docs/features/argument-tree-outline.md` (mirroring
  `docs/features/word-count-rounds.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note and usage
  example. Follow-up (b), finer argument-type tagging (link/impact/turn/
  answer/extension) and contributor/evidence-status fields, none of which
  exist in the `Box`/`Flow` schema today, remains open — not started; nor
  is there yet a real trigger in the live round-flowing page
  (`DebateFlowPage`/`FlowMainContent`) that calls `buildAndSaveArgumentTree`
  — the same "real trigger not wired" gap already noted for several other
  panels. Verified from a clean install: `bun install`, `bun run typecheck`
  (11 packages with a typecheck script all pass; `debate-ai-web` has no
  separate typecheck script — types are checked as part of its build),
  `bun run test` (88 files / 1203 tests, all pass), and `bun run build:web`
  (production build, including the new `/outline` route) all pass. No lint
  script is configured in this repo. PR:
  [#162](https://github.com/debate/debate-ai.com/pull/162). The local dev
  server was not smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **Word-Count-Only Speech Format — submission UI.**
  `packages/debate-round/src/panels/WordCountRoundsPanel.tsx` adds a
  full-page React panel that lets a user pick a round ID and `debate-timer`
  word-count style, then type each speech's text against a live word-count
  badge (current count, limit, and remaining/over) recomputed via
  `getWordCountStatus` on every keystroke, and save the round through
  `state/wordCountRounds.ts`'s `saveWordCountRound`. It's mounted at
  `/word-count` (`apps/debate-ai.com/app/word-count/page.tsx`, with a
  back-link to `/debate`, following the same panel convention as
  `/coaching`/`/drills`) and reachable from the global nav dock's Settings
  menu ("Word-Count Speeches", via a new `Type`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (a) named under idea #2
  ("Word-Count-Only Speech Format") in Product Feature Ideas below — this is
  the seventeenth "wire a persisted slice's UI into the actual web app"
  follow-up closed in this repo. The panel adds one small helper rather than
  new word-count logic: `state/wordCountRounds.ts`'s
  `buildWordCountRoundsPanelView`, which sorts every persisted round by
  `roundId` for a stable display order (mirroring
  `coachingSessions.ts`'s `buildCoachingSessionsPanelView`); every other
  field/action the panel uses (`getWordCountStatus`, `wordCountStyles`,
  `saveWordCountRound`, `deleteWordCountRound`, `getWordCountRoundStatuses`)
  already existed. Vitest-covered in
  `packages/debate-round/test/wordCountRounds.test.ts` (empty view when
  nothing is stored, sorted by `roundId`, and that the underlying stored
  order is left untouched). Documented in
  `docs/features/word-count-rounds.md` (mirroring
  `docs/features/coaching-sessions.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note and usage example.
  Follow-up (b), extending `useTimerState`/`SpeechTimer` to support a
  non-timed, word-limited speech mode in the live round timer itself,
  remains open — not started. Verified from a clean install: `bun install`,
  `bun run typecheck` (11 packages with a typecheck script all pass;
  `debate-ai-web` has no separate typecheck script — types are checked as
  part of its build), `bun run test` (87 files / 1192 tests, all pass), and
  `bun run build:web` (production build, including the new `/word-count`
  route) all pass. No lint script is configured in this repo. PR: (opened by
  this run — see branch `claude/peaceful-cerf-3qp6x7`). The local dev server
  was not smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **Peer Review System — review-queue/comment-thread UI.**
  `packages/debate-card-search/src/panels/ReviewQueuePanel.tsx` adds a
  full-page React panel that lets a user start a card's peer review, move it
  through `lib/peer-review.ts`'s status state machine (submit for review,
  request changes, approve, reject, publish) with buttons scoped to whatever
  transitions are legal from its current status, and leave/resolve comments
  on its thread (reviewer id, severity, body), with an unresolved-blocking-
  comments warning shown until they're resolved. It's mounted at
  `/cards/reviews` (`apps/debate-ai.com/app/cards/reviews/page.tsx`, with a
  back-link to `/cards`, following the same panel convention as
  `/cards/revisions`/`/cards/inbox`) and reachable from the global nav dock's
  Settings menu ("Review Queue", via a new `MessageSquareText`-icon
  `DropdownMenuItem` in `CategoryDock.tsx`). Closes follow-up (a) named
  under the "🗣️ Peer Review System" bullet in the Research Crowdsourcing
  Organizer Features list below — this is the sixteenth "wire a persisted
  slice's UI into the actual web app" follow-up closed in this repo, after
  the Contribution Leaderboard, Task Inbox, Progress Unlocks, Evidence
  Library, Prep Notes, Revision Incentives, Judge Profiles, Opponent Team
  Profiles, Practice Drills, Pre-Round Briefings, AI Coach Mode, Judge
  Paradigm Picker, Speech Transcript Summaries, and Opponent Persona Picker
  panels. The panel adds one small helper rather than new review-lifecycle
  logic: `state/peerReviews.ts`'s `buildReviewQueuePanelView`, which sorts
  every persisted review by `cardId` for a stable display order (mirroring
  `judgeParadigmSelections.ts`'s `buildJudgeParadigmSelectionsPanelView`);
  every other field/action the panel uses (`createCardReview`,
  `submitForReview`, `requestChanges`, `approveReview`, `rejectReview`,
  `publishReview`, `addReviewComment`, `resolveReviewComment`,
  `buildReviewSummary`, `savePeerReview`, `deletePeerReview`) already
  existed. Vitest-covered in
  `packages/debate-card-search/test/peerReviews.test.ts` (empty view when
  nothing is stored, sorted by `cardId`, and that the underlying stored
  order is left untouched). Documented in `docs/features/review-queue.md`
  (mirroring `docs/features/task-inbox.md`'s format) and in
  `packages/debate-card-search/README.md`'s package-layout note and usage
  example. Follow-ups (b) reviewer identity/permission checks and (c)
  wiring a review's lifecycle to whatever eventually persists submitted
  cards remain open — neither started. Verified from a clean install:
  `bun install`, `bun run typecheck`, `bun run test`, and `bun run
  build:web` (production build, including the new `/cards/reviews` route).
  No lint script is configured in this repo. PR: (opened by this run — see
  branch `claude/practical-allen-xcm27w`). The local dev server was not
  smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **AI Practice Opponent — persona-picker UI.**
  `packages/debate-speech-writer/src/panels/OpponentPersonaPickerPanel.tsx`
  adds a full-page React panel that lets a user save a practice session's AI
  opponent persona — one of the four built-in personas
  (`policy-heavy`/`kritik`/`lay`/`fast-flow`) from
  `opponent/opponent-personas.ts` — by entering a session ID and picking a
  persona from a radio group, then lists every session with a saved
  selection, each with a "Clear" action. It's mounted at `/practice-opponent`
  (`apps/debate-ai.com/app/practice-opponent/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/paradigms`/`/coaching`)
  and reachable from the global nav dock's Settings menu ("Opponent Persona
  Picker", via a new `Swords`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (b) named under the "AI Practice
  Opponent" idea in the Research Crowdsourcing Organizer Features list
  below — this is the fourteenth "wire a persisted slice's UI into the
  actual web app" follow-up closed in this repo, after the Contribution
  Leaderboard, Task Inbox, Progress Unlocks, Evidence Library, Prep Notes,
  Revision Incentives, Judge Profiles, Opponent Team Profiles, Practice
  Drills, Pre-Round Briefings, AI Coach Mode, Judge Paradigm Picker, and
  Speech Transcript Summaries panels. The panel adds one small helper
  rather than new persona-selection logic:
  `state/opponentPersonaSelections.ts`'s `buildOpponentPersonaSelectionsPanelView`,
  which sorts every persisted selection by `sessionId` for a stable display
  order (mirroring `judgeParadigmSelections.ts`'s
  `buildJudgeParadigmSelectionsPanelView`); every other field/action the
  panel uses (`listOpponentPersonas`, `saveOpponentPersonaSelection`,
  `deleteOpponentPersonaSelection`) already existed. Vitest-covered in
  `packages/debate-speech-writer/test/opponentPersonaSelections.test.ts`
  (empty view when nothing is stored, sorted by `sessionId`, and that the
  underlying stored order is left untouched). Documented in
  `packages/debate-speech-writer/README.md`'s package-layout note and usage
  example. Verified from a clean install: `bun install`, `bun run
  typecheck` (11 packages with a typecheck script all pass; `debate-ai-web`
  has no separate typecheck script — types are checked as part of its
  build), `bun run test` (87 files / 1186 tests, all pass), and `bun run
  build:web` (production build, including the new `/practice-opponent`
  route) all pass. No lint script is configured in this repo. PR:
  [#156](https://github.com/debate/debate-ai.com/pull/156). The local dev
  server was not smoke-tested in this sandbox (no reliable local browser
  workflow available here).
- **Speech Transcript Summaries and Answers — summary/cross-ex panel UI.**
  `packages/debate-round/src/panels/FlowSummariesPanel.tsx` adds a full-page
  React panel that renders every persisted `FlowSummaryRecord` (from
  `state/flowSummaries.ts`), one card per round, sorted by `roundId` — each
  card shows that round's per-argument summary text and, when any argument
  is currently unanswered, a suggested cross-examination-questions list and
  a suggested extension-ideas list for those unanswered rows, plus a
  "Clear" action. It's mounted at `/summaries`
  (`apps/debate-ai.com/app/summaries/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/coaching`/`/paradigms`)
  and reachable from the global nav dock's Settings menu ("Speech
  Transcript Summaries", via a new `FileText`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (b) named under idea #6 ("Speech
  Transcript Summaries and Answers") in Product Feature Ideas below — this
  is the thirteenth "wire a persisted slice's UI into the actual web app"
  follow-up closed in this repo, after the Contribution Leaderboard, Task
  Inbox, Progress Unlocks, Evidence Library, Prep Notes, Revision
  Incentives, Judge Profiles, Opponent Team Profiles, Practice Drills,
  Pre-Round Briefings, AI Coach Mode, and Judge Paradigm Picker panels. The
  panel adds two small helpers rather than new summary-derivation logic:
  `flow/flow-transcript-summary.ts`'s `buildFlowSummaryTextFromRows` (the
  row-mapping half of the existing `buildFlowSummaryText`, extracted so the
  panel can render already-persisted `FlowRowSummary[]` without the
  original raw `Flow`, with `buildFlowSummaryText` now calling it), and
  `state/flowSummaries.ts`'s `buildFlowSummariesPanelView`, which sorts
  every persisted summary by `roundId` for a stable display order; every
  other field/action the panel uses (`suggestCrossExamQuestions`,
  `suggestExtensionIdeas`, `deleteFlowSummary`) already existed. Vitest-covered
  in `packages/debate-round/test/flowSummaries.test.ts` (empty view when
  nothing is stored, sorted by `roundId`, and that clearing a round's
  summary is reflected) and `packages/debate-round/test/flow-transcript-summary.test.ts`
  (empty-row text, and that the extracted helper's output matches
  `buildFlowSummaryText`'s for the same rows). Documented in
  `docs/features/flow-summaries.md` (mirroring
  `docs/features/coaching-sessions.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note and usage
  example. Follow-up (a), audio/video transcription plus an AI call to
  extract claims/warrants/impacts/evidence from raw speech text instead of
  relying on a manually flowed grid, remains open — not started. Verified
  from a clean install: `bun install`, `bun run typecheck` (11 packages
  with a typecheck script all pass; `debate-ai-web` has no separate
  typecheck script — types are checked as part of its build), `bun run
  test` (87 files / 1183 tests, all pass), and `bun run build:web`
  (production build, including the new `/summaries` route) all pass. No
  lint script is configured in this repo. PR:
  [#154](https://github.com/debate/debate-ai.com/pull/154). The local dev
  server was not smoke-tested in this sandbox (no reliable local browser
  workflow available here).
- **AI Judge Decision Modes — paradigm-picker UI.**
  `packages/debate-speech-writer/src/panels/JudgeParadigmPickerPanel.tsx`
  adds a full-page React panel with a form to save a round's AI judge
  paradigm — one of the six built-in paradigms from `judge/judge-paradigms.ts`
  (Flow, Lay, Policymaker, Kritikal, Educator, Truth Over Tech), each shown
  with its name and description as a radio choice, or a "Custom judge
  paradigm" option that reveals a judge-name + preferences-notes form built
  through the existing `buildCustomJudgeParadigm` — plus a list of every
  round with a saved `JudgeParadigmSelection`, sorted by `roundId`, each with
  a "Clear" action. It's mounted at `/paradigms`
  (`apps/debate-ai.com/app/paradigms/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/judges`/`/coaching`)
  and reachable from the global nav dock's Settings menu ("Judge Paradigm
  Picker", via a new `Scale`-icon `DropdownMenuItem` in `CategoryDock.tsx`).
  Closes follow-up (b), "a paradigm-picker UI for selecting a built-in
  paradigm or entering a custom judge's notes that reads/writes through the
  persistence store," named under idea #5 ("AI Judge Decision Modes") in
  Product Feature Ideas below — this is the twelfth "wire a persisted
  slice's UI into the actual web app" follow-up closed in this repo, after
  the Contribution Leaderboard, Task Inbox, Progress Unlocks, Evidence
  Library, Prep Notes, Revision Incentives, Judge Profiles, Opponent Team
  Profiles, Practice Drills, Pre-Round Briefings, and AI Coach Mode panels.
  The panel adds one small helper to `state/judgeParadigmSelections.ts` —
  `buildJudgeParadigmSelectionsPanelView`, which sorts every persisted
  selection by `roundId` for a stable display order — introducing no new
  paradigm-selection or resolution logic; every field the panel saves
  already existed on `judge-paradigms.ts`'s `listJudgeParadigms`/
  `buildCustomJudgeParadigm` output, and every save/clear action calls the
  already-persisted `saveJudgeParadigmSelection`/`deleteJudgeParadigmSelection`
  directly. Vitest-covered in
  `packages/debate-speech-writer/test/judgeParadigmSelections.test.ts` (empty
  view when nothing is stored, sorted by `roundId`, and that the sort
  doesn't mutate the underlying stored order). Documented in
  `docs/features/judge-paradigm-selections.md` (mirroring
  `docs/features/judge-profiles.md`'s format) and in
  `packages/debate-speech-writer/README.md`'s package-layout note and usage
  example. Follow-up (a), an actual AI judge-decision call that uses
  `buildJudgeParadigmPrompt`'s output instead of (or alongside) the existing
  static `judgeDecisionPrompt`, remains open — not started. Verified from a
  clean install: `bun install`, `bun run typecheck` (11 packages with a
  typecheck script all pass; `debate-ai-web` has no separate typecheck
  script — types are checked as part of its build), `bun run test` (87
  files / 1178 tests, all pass), and `bun run build:web` (production build,
  including the new `/paradigms` route) all pass. No lint script is
  configured in this repo. PR:
  [#152](https://github.com/debate/debate-ai.com/pull/152). The local dev
  server was not smoke-tested in this sandbox (no reliable local browser
  workflow available here).
- **AI Coach Mode — coaching-panel UI.**
  `packages/debate-round/src/panels/CoachingSessionsPanel.tsx` adds a
  full-page React panel that renders every persisted `CoachingSessionRecord`
  (from `coachingSessions.ts`) grouped by round + side — each prompt showing
  a kind badge (Extension/Refutation/Collapse/Weighing) and its text — with
  a "Clear" action per session. It's mounted at `/coaching`
  (`apps/debate-ai.com/app/coaching/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/drills`/`/briefings`)
  and reachable from the global nav dock's Settings menu ("AI Coach Mode",
  via a new `GraduationCap`-icon `DropdownMenuItem` in `CategoryDock.tsx`).
  Closes follow-up (b), "a coaching-panel UI that reads/writes through the
  persistence store," named under the "🎙️ AI Coach Mode" bullet in Research
  Crowdsourcing Organizer Features below — this is the eleventh "wire a
  persisted slice's UI into the actual web app" follow-up closed in this
  repo, after the Contribution Leaderboard, Task Inbox, Progress Unlocks,
  Evidence Library, Prep Notes, Revision Incentives, Judge Profiles,
  Opponent Team Profiles, Practice Drills, and Pre-Round Briefings panels.
  The panel adds one small helper to `state/coachingSessions.ts` —
  `buildCoachingSessionsPanelView`, which sorts every persisted coaching
  session by `roundId` then `sideKey` for a stable display order —
  introducing no new coaching-prompt generation logic; every rendered field
  already existed on `coach-mode.ts`'s `buildCoachingSession` output.
  Vitest-covered in `packages/debate-round/test/coachingSessions.test.ts`
  (empty view when nothing is stored, sorted by `roundId` then `sideKey`,
  and that the view reflects a session removed via the existing
  `deleteCoachingSession`). Documented in
  `docs/features/coaching-sessions.md` (mirroring
  `docs/features/drill-sets.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note. Follow-up (a), an
  actual AI coaching call for open-ended feedback beyond this deterministic
  template layer, remains open — not started. Verified from a clean
  install: `bun install`, `bun run typecheck` (11 packages with a typecheck
  script all pass; `debate-ai-web` has no separate typecheck script — types
  are checked as part of its build), `bun run test` (87 files / 1175 tests,
  all pass), and `bun run build:web` (production build, including the new
  `/coaching` route) all pass. No lint script is configured in this repo.
  PR: [#151](https://github.com/debate/debate-ai.com/pull/151). The local
  dev server was not smoke-tested in this sandbox (no reliable
  local browser workflow available here).
- **Pre-Round Intelligence Panel — briefing-panel UI.**
  `packages/debate-round/src/panels/PreRoundBriefingsPanel.tsx` adds a
  full-page React panel that renders every persisted `PreRoundBriefingRecord`
  (from `preRoundBriefings.ts`) as its own card — an event-line header
  (tournament, division, round label), a badge with the prior head-to-head
  record against that round's opponent, and every briefing section (Event,
  Opponent scouting, Prior meetings, Judge tendencies, Team prep notes) —
  with a "Clear" action per round. It's mounted at `/briefings`
  (`apps/debate-ai.com/app/briefings/page.tsx`, with a back-link to
  `/debate`, following the same panel convention as `/drills`/`/prep-notes`)
  and reachable from the global nav dock's Settings menu ("Pre-Round
  Briefings", via a new `ClipboardList`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (b), "a briefing panel UI that
  renders it on a round-information page," named under idea #12 ("Pre-Round
  Intelligence Panel") in Product Feature Ideas below — this is the tenth
  "wire a persisted slice's UI into the actual web app" follow-up closed in
  this repo, after the Contribution Leaderboard, Task Inbox, Progress
  Unlocks, Evidence Library, Prep Notes, Revision Incentives, Judge
  Profiles, Opponent Team Profiles, and Practice Drills panels. The panel
  adds one small helper to `state/preRoundBriefings.ts` —
  `buildPreRoundBriefingsPanelView`, which sorts every persisted briefing by
  `roundId` for a stable display order — introducing no new
  briefing-composition logic; every rendered field already existed on
  `pre-round-briefing.ts`'s `buildPreRoundBriefing` output. Vitest-covered
  in `packages/debate-round/test/preRoundBriefings.test.ts` (empty view when
  nothing is stored, sorted by `roundId`, and that the sort doesn't mutate
  the underlying stored order). Documented in
  `docs/features/pre-round-briefings.md` (mirroring
  `docs/features/drill-sets.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note. Follow-up (a), a
  real data source for tournament results, pairings, event details, and
  room assignments, remains open — not started. Verified from a clean
  install: `bun install`, `bun run typecheck` (12 packages typecheck;
  `debate-ai-web` has no separate typecheck script — types are checked as
  part of its build), `bun run test` (87 files / 1172 tests, all pass), and
  `bun run build:web` (production build, including the new `/briefings`
  route) all pass. No lint script is configured in this repo. The local dev
  server was not smoke-tested in this sandbox (no reliable local browser
  workflow available here).
- **AI Drill Generator — drill-panel UI.**
  `packages/debate-round/src/panels/DrillSetsPanel.tsx` adds a full-page
  React panel that renders every persisted `DrillSetRecord` (from
  `drillSets.ts`) grouped by round — each drill showing a kind badge
  (Overview/Frontline/Cross-Ex/Collapse) and its prompt — with a "Clear"
  action per round. It's mounted at `/drills`
  (`apps/debate-ai.com/app/drills/page.tsx`, with a back-link to `/debate`,
  following the same panel convention as `/prep-notes`/`/opponents`) and
  reachable from the global nav dock's Settings menu ("Practice Drills",
  via a new `Dumbbell`-icon `DropdownMenuItem` in `CategoryDock.tsx`).
  Closes follow-up (a), "a drill-panel UI that reads/writes through the
  persistence store," named under the "📚 AI Drill Generator" bullet in
  Research Crowdsourcing Organizer Features below — this is the ninth
  "wire a persisted slice's UI into the actual web app" follow-up closed
  in this repo, after the Contribution Leaderboard, Task Inbox, Progress
  Unlocks, Evidence Library, Prep Notes, Revision Incentives, Judge
  Profiles, and Opponent Team Profiles panels. The panel adds one small
  helper to `state/drillSets.ts` — `buildDrillSetsPanelView`, which sorts
  every persisted drill set by `roundId` then `sideKey` for a stable
  display order — introducing no new drill-generation logic; every
  rendered field already existed on `drill-generator.ts`'s `buildDrillSet`
  output. Vitest-covered in `packages/debate-round/test/drillSets.test.ts`
  (empty view when nothing is stored, sorted by `roundId`, and that saving
  a new drill set for an already-stored `roundId` upserts by `roundId`
  alone, matching `saveDrillSet`'s existing upsert semantics). Documented
  in `docs/features/drill-sets.md` (mirroring
  `docs/features/prep-notes.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note. Follow-up (b),
  an actual AI-generated (rather than templated) drill script, remains
  open — not started. Verified from a clean install: `bun install`,
  `bun run typecheck` (12 packages typecheck; `debate-ai-web` has no
  separate typecheck script — types are checked as part of its build),
  `bun run test` (87 files / 1169 tests, all pass), and `bun run build:web`
  (production build, including the new `/drills` route) all pass. No lint
  script is configured in this repo. The local dev server was not
  smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **Opponent Team Profiles — opponent-scouting roster UI panel.**
  `packages/debate-round/src/panels/OpponentTeamProfilesPanel.tsx` adds a
  full-page React panel that renders every persisted `OpponentTeamProfile`
  as a scouting roster table — rounds recorded, overall win-loss record,
  Aff/Neg side record (flagged "stronger on aff/neg" once it clears
  `opponent-team-profile.ts`'s threshold), and the team's top 3 most
  common argument tags and cases — ordered by rounds recorded descending.
  It's mounted at `/opponents` (`apps/debate-ai.com/app/opponents/page.tsx`,
  with a back-link to `/debate`, following the same panel convention as
  `/judges`/`/prep-notes`) and reachable from the global nav dock's
  Settings menu ("Opponent Team Profiles", via a new `Users`-icon
  `DropdownMenuItem` in `CategoryDock.tsx`). Closes follow-up (b), "a
  scouting-card/panel UI," named under the "🕵️ Opponent Team Profiles"
  bullet in Research Crowdsourcing Organizer Features below — this is the
  eighth "wire a persisted slice's UI into the actual web app" follow-up
  closed in this repo, after the Contribution Leaderboard, Task Inbox,
  Progress Unlocks, Evidence Library, Prep Notes, Revision Incentives, and
  Judge Profiles panels, and the first one to live in `debate-round` while
  rendering a `debate-data-sync` store (the profile/panel already crossed
  that package boundary via `pre-round-briefing.ts`, so the panel imports
  `debate-data-sync/src/state/opponentTeamProfiles` directly rather than
  duplicating storage). The panel adds one small helper to
  `debate-data-sync`'s `state/opponentTeamProfiles.ts` —
  `buildOpponentTeamProfilesRoster`, which lists every persisted profile
  ordered by rounds recorded descending (ties broken alphabetically by
  `teamId`) — introducing no new aggregation logic; every rendered field
  already existed on `rankings/opponent-team-profile.ts`'s
  `buildOpponentTeamProfile` output. Vitest-covered in
  `packages/debate-data-sync/test/opponentTeamProfiles.test.ts` (empty
  roster when nothing is stored, ordering by rounds recorded descending,
  and alphabetical tie-breaking when rounds recorded are equal).
  Documented in `docs/features/opponent-team-profiles.md` (mirroring
  `docs/features/judge-profiles.md`'s format) and in
  `packages/debate-round/README.md`'s package-layout note. Follow-up (a),
  a real round-history data source producing `OpponentRoundRecord`s (e.g.
  from Tabroom pairings/ballots) instead of relying on caller-supplied
  data, remains open — not started.

- **Judge Profiles — judge-profile roster UI panel.**
  `packages/debate-speech-writer/src/panels/JudgeProfilesPanel.tsx` adds a
  full-page React panel that renders every persisted `JudgeProfile` as a
  roster table — rounds judged, Aff/Neg side record (flagged "notable bias"
  once it clears `judge-profile.ts`'s threshold), overall average speaker
  points, delivery-speed tolerance, theory receptiveness, and most-tagged
  paradigm — ordered by rounds judged descending. It's mounted at `/judges`
  (`apps/debate-ai.com/app/judges/page.tsx`, with a back-link to `/debate`,
  following the same panel convention as `/prep-notes`) and reachable from
  the global nav dock's Settings menu ("Judge Profiles", via a new
  `Gavel`-icon `DropdownMenuItem` in `CategoryDock.tsx`). Closes follow-up
  (b), "a judge-profile card/panel UI," named under the "⚖️ Judge Profiles"
  bullet in Research Crowdsourcing Organizer Features below — this is the
  seventh "wire a persisted slice's UI into the actual web app" follow-up
  closed in this repo, after the Contribution Leaderboard, Task Inbox,
  Progress Unlocks, Evidence Library, Prep Notes, and Revision Incentives
  panels, and the first one in the `debate-speech-writer` package rather
  than `debate-card-search`/`debate-round`. The panel adds one small helper
  to `state/judgeProfiles.ts` — `buildJudgeProfilesRoster`, which lists
  every persisted profile ordered by rounds judged descending (ties broken
  alphabetically by `judgeId`) — introducing no new aggregation logic; every
  rendered field already existed on `judge/judge-profile.ts`'s
  `buildJudgeProfile` output. `debate-speech-writer`'s `package.json` gained
  a `debate-ui` dependency and `react`/`react-dom` peer dependencies (it had
  none before this, having previously been a pure prompt/analysis/state
  package with no React component), and `apps/debate-ai.com/package.json`
  gained a `debate-speech-writer` workspace dependency to mount the panel.
  Vitest-covered in `packages/debate-speech-writer/test/judgeProfiles.test.ts`
  (empty roster when nothing is stored, ordering by rounds judged
  descending, and alphabetical tie-breaking when rounds judged are equal).
  Documented in `docs/features/judge-profiles.md` (mirroring
  `docs/features/prep-notes.md`'s format) and in
  `packages/debate-speech-writer/README.md`'s package-layout note and import
  example. Follow-up (a), a real ballot-data source producing
  `JudgeRoundRecord`s, remains open — no ballot/`Round` schema in this repo
  captures speaker points, pace, or theory outcomes today, so a profile only
  appears in this panel once a caller has supplied records and called
  `saveJudgeProfile` directly. Verified from a clean install: `bun install`,
  `bun run typecheck` (12 packages typecheck; `debate-ai-web` has no
  separate typecheck script — types are checked as part of its build),
  `bun run test` (87 files / 1163 tests, all pass), and `bun run build:web`
  (production build, including the new `/judges` route) all pass. No lint
  script is configured in this repo. The local dev server was not
  smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **Revision Incentives — incentives-leaderboard UI panel.**
  `packages/debate-card-search/src/panels/RevisionIncentivesPanel.tsx` adds a
  full-page React panel that renders every contributor with at least one
  persisted card revision as a ranked table — revision count, rewarded-
  revision count, total reward points, and weak-cards-improved count — sorted
  by total reward points descending. It's mounted at `/cards/revisions`
  (`apps/debate-ai.com/app/cards/revisions/page.tsx`, mirroring the existing
  `/cards/leaderboard`/`/cards/inbox`/`/cards/progress`/`/cards/library`
  pages' back-link convention) and reachable from the global nav dock's
  Settings menu ("Revision Incentives", via a new `History`-icon
  `DropdownMenuItem` in `CategoryDock.tsx`). Closes follow-up (b), "a
  reward-notification/incentives-leaderboard UI," named under the "🔁
  Revision Incentives" bullet in Research Crowdsourcing Organizer Features
  below — this is the sixth "wire a persisted slice's UI into the actual web
  app" follow-up closed in this repo, after the Contribution Leaderboard,
  Task Inbox, Progress Unlocks, Evidence Library, and Prep Notes panels. The
  panel adds one small helper to `state/revisionHistory.ts` —
  `buildPersistedRevisionIncentiveLeaderboard`, which composes
  `revision-incentives.ts`'s existing pure `buildRevisionIncentiveLeaderboard`
  directly against the persisted revision-history store, mirroring
  `contributions.ts`'s `buildPersistedLeaderboard` convention — introducing
  no new scoring logic. Vitest-covered in
  `packages/debate-card-search/test/revisionHistory.test.ts` (empty
  leaderboard when nothing is stored, a built leaderboard matching the pure
  function's output over the same records, and the leaderboard reflecting a
  newly saved revision without the caller re-fetching the full list).
  Documented in `docs/features/revision-incentives.md` (mirroring
  `docs/features/contribution-leaderboard.md`'s format) and in
  `packages/debate-card-search/README.md`'s `panels/` layout note and import
  example. Follow-up (a), a real card-edit/save flow that calls
  `saveRevisionRecord`, remains open — no card-editing flow exists in this
  repo yet. Verified from a clean install: `bun install`, `bun run
  typecheck` (11 packages with a typecheck script all pass; `debate-ai-web`
  has no separate typecheck script — types are checked as part of its
  build), `bun run test` (87 files / 1160 tests, all pass), and `bun run
  build:web` (production build, including the new `/cards/revisions` route)
  all pass. No lint script is configured in this repo. The local dev server
  was not smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **Strategy Sync Notes — prep-notes panel UI.**
  `packages/debate-round/src/panels/PrepNotesPanel.tsx` adds a full-page
  React panel that renders every persisted `PrepNote` (across all flows)
  grouped by status — needs-follow-up first, then open, then covered — each
  note showing its text, author, current assignee, a "Mark &lt;next
  status&gt;" button that cycles its status (open → covered →
  needs-follow-up → open), and an "assign to" control. It's mounted at
  `/prep-notes` (`apps/debate-ai.com/app/prep-notes/page.tsx`, with a
  back-link to `/debate`, following the same panel convention as the
  `/cards/*` pages) and reachable from the global nav dock's Settings menu
  ("Prep Notes", via a new `NotebookPen`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (a), "a prep-notes panel UI," named
  under the "🔄 Strategy Sync Notes" bullet in Research Crowdsourcing
  Organizer Features below — this is the fifth "wire a persisted slice's UI
  into the actual web app" follow-up closed in this repo, after the
  Contribution Leaderboard, Task Inbox, Progress Unlocks, and Evidence
  Library panels, and the first one in the `debate-round` package rather
  than `debate-card-search`. The panel adds two small helpers to
  `state/prepNotes.ts` — `buildPrepNotesPanelView` (groups the persisted
  notes by status, reusing `strategy-sync-notes.ts`'s existing
  `sortNotesByCreatedAt`) and `nextPrepNoteStatus` (the panel's status-cycle
  order) — and wires the panel's actions straight through to the
  already-persisted `updatePersistedPrepNoteStatus`/`assignPersistedPrepNote`,
  introducing no new mutation logic. Both new helpers are Vitest-covered in
  `packages/debate-round/test/prepNotes.test.ts` (empty groups when nothing
  is stored, status grouping/ordering across multiple notes, and the view
  reflecting a status update made through the existing persisted mutator).
  Documented in `docs/features/prep-notes.md` (mirroring
  `docs/features/progress-unlocks.md`'s format) and in
  `packages/debate-round/README.md`'s `panels/` layout note and import
  example. Follow-up (b), an assignee-notification system, remains open —
  no notification system exists in this repo. A "jump to argument" link
  back into the live flow view and a note-creation UI were both explicit
  non-goals of this slice (the former needs a mounted `Flow`, which this
  cross-flow panel doesn't have; the latter is a separate, flow-view-scoped
  affordance). Verified from a clean install: `bun install`, `bun run
  typecheck` (12 packages typecheck; `debate-ai-web` has no separate
  typecheck script — types are checked as part of its build), `bun run
  test` (87 files / 1157 tests, all pass), and `bun run build:web`
  (production build, including the new `/prep-notes` route) all pass. No
  lint script is configured in this repo. The local dev server was not
  smoke-tested in this sandbox (no reliable local browser workflow
  available here).
- **Shared Evidence Library — evidence library search UI panel.**
  `packages/debate-card-search/src/panels/EvidenceLibraryPanel.tsx` adds a
  full-page React panel with a free-text search box and a card/block kind
  filter over every persisted `EvidenceLibraryEntry`, showing each match's
  argument, topic/case area, body, citation, tags, and (while a text query is
  active) relevance score. It's mounted at `/cards/library`
  (`apps/debate-ai.com/app/cards/library/page.tsx`, mirroring the existing
  `/cards/leaderboard`/`/cards/inbox`/`/cards/progress` pages' back-link
  convention) and reachable from the global nav dock's Settings menu
  ("Evidence Library", via a new `Library`-icon `DropdownMenuItem` in
  `CategoryDock.tsx`). Closes follow-up (a), "a search panel UI," named
  under the "📋 Shared Evidence Library" bullet in Research Crowdsourcing
  Organizer Features below — this is the fourth "wire a persisted slice's UI
  into the actual web app" follow-up closed in this repo, after the
  Contribution Leaderboard, Task Inbox, and Progress Unlocks panels,
  following that same established pattern (persisted store → thin panel
  component → routed page → nav entry). Unlike those three panels, this one
  introduces no new composition function — `state/evidenceLibraryEntries.ts`
  already exposed `searchPersistedEvidenceLibrary`/`listEvidenceLibraryEntries`
  in a shape the panel could call directly (with an explicit, possibly-empty
  `text` field alongside an optional `kind` filter), so the panel wires
  existing, already-tested search/ranking logic straight through rather than
  adding a new one. That exact combined `{ text: "", kind }` call shape (the
  panel's default state before a search is typed) is now explicitly
  Vitest-covered in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`, on top
  of the existing text/kind/combined coverage in that file and in
  `test/shared-evidence-library.test.ts`. The panel component itself is not
  unit-tested, matching the Leaderboard/Inbox/Progress panels' precedent —
  this repo has no `@testing-library/react`/jsdom-based component-render
  convention in any package's `test/` suite. Documented in
  `docs/features/evidence-library.md` (mirroring
  `docs/features/task-inbox.md`'s format) and in
  `packages/debate-card-search/README.md`'s `panels/` layout note and import
  example. Follow-ups: (b) no topic/case-area/tag filter controls in the
  panel itself (only free text and kind are exposed, though
  `searchEvidenceLibrary` already supports all three), (c) a real search
  index (e.g. Typesense) once entries are persisted at scale — the "(b)
  wiring `prep-room.ts` to read through this store" follow-up was already
  closed separately (see "Collaboration Prep Room Store Wiring" below).
  Neither of the two remaining follow-ups is started; a new follow-up, a
  submission UI for adding cards/blocks to the repository (the store's own
  original follow-up (a), unaffected by this panel), also remains open.
  Verified from a clean install: `bun install`, `bun run typecheck` (11
  packages typecheck; `debate-ai-web` has no separate typecheck script —
  types are checked as part of its build), `bun run test` (87 files / 1153
  tests, all pass), and `bun run build:web` (production build, including the
  new `/cards/library` route) all pass. No lint script is configured in this
  repo. The local dev server was not smoke-tested in this sandbox (no
  reliable local browser workflow available here).
- **Progress Unlocks — unlock/progress roster UI panel.**
  `packages/debate-card-search/src/panels/ProgressUnlocksPanel.tsx` adds a
  full-page React panel that renders every contributor with at least one
  persisted contribution as a roster: unlock tier, the research-task skill
  level that tier grants, every badge earned (tier + daily-quest streak
  badges), current streak, and how far they are from the next tier. It's
  mounted at `/cards/progress`
  (`apps/debate-ai.com/app/cards/progress/page.tsx`, mirroring the existing
  `/cards/leaderboard`/`/cards/inbox` pages' back-link convention) and
  reachable from the global nav dock's Settings menu ("Progress", via a new
  `Award`-icon `DropdownMenuItem` in `CategoryDock.tsx`, alongside the
  existing Leaderboard/Task Inbox entries). Closes follow-up (b), "a
  progress/unlock UI", named under the "🔓 Progress Unlocks" bullet in
  Research Crowdsourcing Organizer Features below — this is the third
  "wire a persisted slice's UI into the actual web app" follow-up closed in
  this repo, after the Contribution Leaderboard and Task Inbox panels,
  following that same established pattern (persisted store → thin panel
  component → routed page → nav entry). The panel adds one new composition
  function, `buildUnlockStatusRoster`
  (`packages/debate-card-search/src/lib/unlock-streak-status.ts`), which
  lists every contributor id with a persisted contribution (via
  `state/contributions.ts`'s `listContributions`/`groupContributionsByContributor`)
  and resolves each one's status through the already-existing
  `buildContributorUnlockStatusWithStreakFromStore` — mirroring
  `contributions.ts`'s `buildPersistedLeaderboard` "compose the pure function
  directly against the persisted store" convention; no new tier, badge, or
  streak logic was introduced, and `progress-unlocks.ts`/`gamified-quests.ts`
  themselves are unchanged. The roster is sorted alphabetically by
  `contributorId` rather than by score, since (unlike the Contribution
  Leaderboard) this view isn't meant to be a ranking. Vitest-covered in
  `packages/debate-card-search/test/unlock-streak-status.test.ts` (empty
  roster when nothing is persisted, multiple contributors each resolved with
  their own tier/streak and sorted alphabetically, and that one contributor's
  persisted data doesn't leak into another's roster entry). The panel
  component itself is not unit-tested, matching the Leaderboard/Task Inbox
  panels' precedent — this repo has no `@testing-library/react`/jsdom-based
  component-render convention in any package's `test/` suite; its data
  composition is fully covered via the `lib` test above. Documented in
  `docs/features/progress-unlocks.md` (mirroring
  `docs/features/contribution-leaderboard.md`'s format) and in
  `packages/debate-card-search/README.md`'s `panels/` layout note and import
  example. Follow-ups: (a) contributor identity/auth scoping ("my progress"
  vs. everyone's), the same known gap as the Leaderboard/Inbox panels — not
  started. Verified from a clean install: `bun install`, `bun run typecheck`
  (11 packages typecheck; `debate-ai-web` has no separate typecheck script —
  types are checked as part of its build), `bun run test` (87 files / 1152
  tests, all pass), and `bun run build:web` (production build, including the
  new `/cards/progress` route) all pass. No lint script is configured in
  this repo. The local dev server (`bun run dev:web`) could not be
  smoke-tested in this sandbox for the same pre-existing `self-signed
  certificate in certificate chain` reason noted on the Contribution
  Leaderboard/Task Inbox panel entries below — not a regression introduced
  here. PR: [#143](https://github.com/debate/debate-ai.com/pull/143).
- **Research Task Routing — task-assignment/inbox UI.**
  `packages/debate-card-search/src/panels/TaskInboxPanel.tsx` adds a
  full-page React panel that lists every persisted routed task queue, grouped
  by topic: each assignment shows the under-covered argument, its urgency
  level (`missing`/`thin`), the assignee, and their current skill level, with
  a "Mark complete" button; any tasks nobody was eligible/available for are
  listed separately per topic. It's mounted at `/cards/inbox`
  (`apps/debate-ai.com/app/cards/inbox/page.tsx`, mirroring the existing
  `/cards/leaderboard` page's back-link convention) and reachable from the
  global nav dock's Settings menu ("Task Inbox", via a new `Inbox`-icon
  `DropdownMenuItem` in `CategoryDock.tsx`, alongside the existing
  Leaderboard entry). Closes the "(c) a task-assignment/inbox UI" follow-up
  named under the "Research Task Routing" bullet in Research Crowdsourcing
  Organizer Features below — this is the second "wire a persisted slice's UI
  into the actual web app" follow-up closed in this repo, after the
  Contribution Leaderboard panel, following that same established pattern
  (persisted store → thin panel component → routed page → nav entry). The
  panel adds one new composition function, `buildTaskInboxView`
  (`packages/debate-card-search/src/state/routedTaskQueues.ts`), which
  flattens every persisted `RoutedTaskQueueRecord` (from `routedTaskQueues.ts`)
  into a flat, per-assignment view tagged with its `topicId` and the
  assignee's current persisted `skillLevel` (looked up from
  `contributorAvailability.ts`) — mirroring the leaderboard panel's
  `buildPersistedLeaderboard` "compose the pure function directly against the
  persisted store" convention; no new routing or completion logic was
  introduced. Marking a task complete calls the already-existing, already-
  persisted `completePersistedRoutedTask` directly (removes the assignment
  from the stored queue and decrements the assignee's stored
  `activeTaskCount`), then the panel re-reads `buildTaskInboxView()` to
  refresh. Vitest-covered in
  `packages/debate-card-search/test/routedTaskQueues.test.ts` (empty when
  nothing is routed, flattens multiple persisted queues with each
  assignment's topic and current skill level attached, and omits
  `contributorSkillLevel` when the assignee's profile is no longer
  persisted). The panel component itself is not unit-tested, matching the
  Contribution Leaderboard panel's precedent — this repo has no
  `@testing-library/react`/jsdom-based component-render convention in any
  package's `test/` suite; its data composition is fully covered via the
  `state` test above. Documented in `docs/features/task-inbox.md` (mirroring
  `docs/features/contribution-leaderboard.md`'s format) and in
  `packages/debate-card-search/README.md`'s `panels/` layout note. Follow-ups:
  (a) a task-routing trigger UI (a topic's queue is currently only populated
  by calling `buildAndPersistRoutingResult` some other way, e.g. from a
  future coverage-dashboard action), (b) scoping the inbox to "my tasks"
  once contributor identity/auth exists, (c) a reviewer/verification step
  before a task is marked complete. None of these are started. Verified from
  a clean install: `bun install`, `bun run typecheck` (11 packages
  typecheck; `debate-ai-web` has no separate typecheck script — types are
  checked as part of its build), `bun run test` (87 files / 1149 tests, all
  pass), and `bun run build:web` (production build, including the new
  `/cards/inbox` route) all pass. The local dev server (`bun run dev:web`)
  could not be smoke-tested in this sandbox for the same pre-existing
  `self-signed certificate in certificate chain` reason noted on the
  Contribution Leaderboard panel entry below — not a regression introduced
  here.
- **Contribution Leaderboard — leaderboard UI panel wired to the app.**
  `packages/debate-card-search/src/panels/ContributionLeaderboardPanel.tsx`
  adds a full-page React panel that renders every persisted contributor
  ranked by total helpfulness score, alongside their unlock tier, earned
  badges, and current daily-quest streak — the first UI panel in this
  package (previously `src/` only had `components/`, `hooks/`, `layout/`,
  `lib/`, and `state/`, with every Research Crowdsourcing Organizer Features
  slice below stopping at pure logic plus a persistence store). It's mounted
  at `/cards/leaderboard` (`apps/debate-ai.com/app/cards/leaderboard/page.tsx`,
  mirroring the existing `/rank` page's back-link convention) and reachable
  from the global nav dock's Settings menu ("Leaderboard", via a new
  `Trophy`-icon `DropdownMenuItem` in `CategoryDock.tsx`). Closes the
  "Contribution Leaderboard" bullet's own follow-up (c), "a leaderboard UI
  that reads through the persistence store," and idea #11's ("Community-Rated
  Summaries and Highlights") follow-up (c), "a leaderboard/ranked-feed UI,"
  both under Research Crowdsourcing Organizer Features below. The panel adds
  one new composition function, `buildPersistedLeaderboard`
  (`packages/debate-card-search/src/state/contributions.ts`), which composes
  the existing pure `contribution-leaderboard.ts` `buildLeaderboard` directly
  against the persisted `contributions.ts` store — mirroring this repo's
  established "compose the pure function directly against the persisted
  store" convention — and reuses the existing
  `unlock-streak-status.ts` `buildContributorUnlockStatusWithStreakFromStore`
  for each row's tier/badges/streak; no new scoring, tier, or streak logic
  was introduced. Vitest-covered in
  `packages/debate-card-search/test/contributions.test.ts` (empty store
  yields an empty leaderboard, contributors are ranked by total helpfulness
  score, and a like recorded after a contribution is saved is reflected in a
  later leaderboard build). The panel component itself is not unit-tested —
  this repo has no `@testing-library/react`/jsdom-based component-render
  convention in any package's `test/` suite; its data composition is fully
  covered via the `state`/`lib` tests above. Documented in
  `docs/features/contribution-leaderboard.md` (new `docs/` folder — none
  existed in this repo before) and in `packages/debate-card-search/README.md`
  (updated to describe the current `panels/`/`lib/`/`state/` layout, which
  had drifted out of date across ~40 prior persistence-slice PRs). This is
  the first "wire a persisted slice's UI into the actual web app" follow-up
  closed in this repo — every other UI follow-up named throughout Product
  Feature Ideas and Research Crowdsourcing Organizer Features below (prep-room
  panels, drill panels, coaching panels, task-routing inboxes, etc.) remains
  open and is a natural next task for a future run, following this same
  pattern (persisted store → thin panel component → routed page → nav entry).
  Follow-ups: (a) a real submitted-contribution flow (card/summary/analytic
  submission UI) that calls `saveContribution`, so the leaderboard has data
  to show; today it renders an explicit empty state until something does,
  (b) a like/save/endorse UI on that submission flow wired to
  `recordPersistedLike`/`recordPersistedSave`/`recordPersistedEndorsement`.
  Neither of these is started. Verified from a clean install: `bun install`,
  `bun run typecheck` (11 packages typecheck; `debate-ai-web` has no separate
  typecheck script — types are checked as part of its build), `bun run test`
  (87 files / 1146 tests, all pass), and `bun run build:web` (production
  build, including the new `/cards/leaderboard` route) all pass. The local
  dev server (`bun run dev:web`) could not be smoke-tested in this sandbox —
  it fails during startup on an unrelated `Error: self-signed certificate in
  certificate chain` from a Cloudflare `Request.cf` fetch, a pre-existing
  sandbox/network limitation, not a change introduced here.
- **Contribution Community Signals — persisted like/save/endorse events.**
  `packages/debate-card-search/src/state/contributions.ts` adds
  `recordPersistedLike`/`recordPersistedSave`/`recordPersistedEndorsement`,
  which apply a like/save/endorsement event directly to a stored
  `AttributedContribution` (incrementing `likes`/`saves` by one, or
  appending a `ReviewerEndorsement` carrying a caller-supplied
  `reviewerWeight`) and save the result, rather than requiring a caller to
  read, mutate, and re-save the contribution itself — mirroring
  `contributorAvailability.ts`'s `recordPersistedTaskAssigned`/
  `recordPersistedTaskCompleted` "compose the mutation directly against the
  persisted store" convention. Closes the "wiring real like/save/endorse
  actions and persisting those counts per contribution" follow-up shared by
  the "Contribution Leaderboard" bullet and idea #11 ("Community-Rated
  Summaries and Highlights") under Research Crowdsourcing Organizer
  Features / Product Feature Ideas below. `community-rating.ts`'s pure
  `computeHelpfulnessBreakdown`/`rankContributions` and
  `contribution-leaderboard.ts`'s `buildLeaderboard`/`buildContributorStats`
  are unchanged — a persisted contribution's updated `likes`/`saves`/
  `reviewerEndorsements` feed into their existing scoring the same way any
  other `AttributedContribution` field does. Vitest-covered in
  `packages/debate-card-search/test/contributions.test.ts` (a like/save
  increments and persists, repeated likes accumulate, an endorsement is
  appended and persisted alongside any existing endorsements, and each
  helper returns `undefined` and leaves storage untouched for an id that
  isn't stored). This is a composition slice only — no dedup of repeat
  likes/saves from the same user (no per-user identity is tracked on a
  contribution today), no reviewer identity/permission checks (no auth/roles
  exist yet), and no leaderboard/community-rating UI in this repo yet calls
  these on a real user action. Follow-up: a leaderboard/contribution-card UI
  that reads through `contributions.ts`/`contribution-leaderboard.ts` and
  calls these on a real like/save/endorse action; not started. Verified
  from a clean install: `bun install`, `bun run typecheck` (11 packages,
  all pass), `bun run test` (87 files / 1143 tests, all pass), and
  `bun run build` all pass. PR:
  [#140](https://github.com/debate/debate-ai.com/pull/140).
- **Research Task Routing — persisted activeTaskCount assignment/completion events.**
  `packages/debate-card-search/src/state/contributorAvailability.ts` adds
  `recordPersistedTaskAssigned`/`recordPersistedTaskCompleted`, which apply a
  `+1`/`-1` delta (floored at `0`) to a stored `ContributorAvailability`
  profile's `activeTaskCount` and save the result, rather than requiring a
  caller to read, mutate, and re-save the profile itself. `packages/debate-card-search/src/state/routedTaskQueues.ts`
  adds `buildAndPersistRoutingResult`, which routes a topic's coverage-gap
  tasks against the currently persisted `contributorAvailability.ts` profiles
  (`buildRoutingResult`), calls `recordPersistedTaskAssigned` for every
  resulting assignment, and saves the routed queue via the existing
  `saveRoutedTaskQueue` — and `completePersistedRoutedTask`, which removes a
  topic's persisted assignment by `argBlock`, calls
  `recordPersistedTaskCompleted` for its contributor, and saves the updated
  queue. Closes the "(a) wiring real task-assignment/completion events to
  keep a persisted profile's `activeTaskCount` accurate" follow-up named
  under the "🧭 Research Task Routing" bullet in Research Crowdsourcing
  Organizer Features below, mirroring `dailyMissionResults.ts`'s
  `computeAndSavePersistedDailyMissionResult` "compose the pure function
  directly against the persisted store" convention on the write side.
  `research-task-routing.ts`'s pure `buildRoutingResult`/`routeTasks` are
  unchanged. Vitest-covered in `packages/debate-card-search/test/contributorAvailability.test.ts`
  (activeTaskCount increments/decrements, floors at zero, no-op when no
  profile is stored) and `packages/debate-card-search/test/routedTaskQueues.test.ts`
  (routes against the persisted contributor list, saves the queue, increments
  only the assignee's count, completing a task removes it from the stored
  queue and decrements its contributor's count, and no-ops for an unknown
  topic or `argBlock`). This is a composition slice only — no
  task-assignment/inbox UI in this repo yet calls these on a real assignment/
  completion event. Follow-up: a task-assignment/inbox UI that reads/writes
  through these stores; not started. Verified from a clean install:
  `bun install`, `bun run typecheck` (11 packages, all pass), `bun run test`
  (87 files / 1135 tests, all pass), and `bun run build` all pass. No lint
  script is configured in this repo. PR:
  [#139](https://github.com/debate/debate-ai.com/pull/139).
- **Gamified Quests — persisted end-of-day mission computation.**
  `packages/debate-card-search/src/state/dailyMissionResults.ts` adds
  `computeAndSavePersistedDailyMissionResult`, which computes a contributor's
  daily-mission result directly from their real, persisted contributions
  (`state/contributions.ts`'s `listContributionsByContributor`) — filtering
  to contributions that carry the `submittedAt` timestamp `daily-quests.ts`'s
  `QuestContribution` needs (excluding, rather than throwing on, persisted
  `AttributedContribution`s that don't) — builds that day's quest board via
  the existing `buildDailyQuestBoard`, computes the result via the existing
  `computeDailyMissionResult`, and saves it via this file's own
  `saveDailyMissionResult`, mirroring this same file's
  `buildPersistedContributorQuestStreak` "compose the pure function directly
  against the persisted store" convention, this time on the write side.
  Closes the "(a) wiring a real end-of-day computation (UI action or
  scheduled job) that calls `computeDailyMissionResult` against that day's
  persisted contributions and saves it via `saveDailyMissionResult`"
  follow-up named under the "🎮 Gamified Quests" bullet in Research
  Crowdsourcing Organizer Features below. `gamified-quests.ts`/
  `daily-quests.ts`/`contributions.ts` themselves are unchanged. Vitest-covered
  in `packages/debate-card-search/test/dailyMissionResults.test.ts` (mission
  complete/incomplete from real persisted contributions, contributions
  without `submittedAt` excluded rather than throwing, a contribution
  submitted on a different UTC day not counted, another contributor's
  contributions not counted, upsert-on-recompute, and a contributor with no
  persisted contributions at all). This is a composition slice only —
  nothing in this repo yet calls this on a real end-of-day cadence (UI
  action or scheduled job), and no streak/badge widget UI reads through this
  store. Follow-up: a streak/badge widget UI that renders
  `buildStreakSummaryText`/`buildPersistedContributorQuestStreak`; not
  started. Verified from a clean install: `bun install`, `bun run typecheck`
  (11 packages, all pass), `bun run test` (87 files / 1124 tests, all pass),
  and `bun run build` all pass. No lint script is configured in this repo.
  PR: [#138](https://github.com/debate/debate-ai.com/pull/138).
- **Prep Note Status/Assignment Persistence — wire `updateNoteStatus`/`assignNote`
  back into the persisted store.**
  `packages/debate-round/src/state/prepNotes.ts` adds
  `updatePersistedPrepNoteStatus`/`assignPersistedPrepNote`, thin wrappers
  that look up a persisted `PrepNote` by id, apply
  `strategy-sync-notes.ts`'s existing pure `updateNoteStatus`/`assignNote`
  state transition, save the result via the existing `savePrepNote`, and
  return the updated note (or `undefined`, leaving storage untouched, if no
  note with that id is stored) — mirroring this repo's established
  "compose the pure state transition directly against the persisted store"
  convention (e.g. `buildPersistedContributorQuestStreak`,
  `buildPrepRoomFromStore`). Closes the "(b) wiring `updateNoteStatus`/
  `assignNote`'s returned copies back into `savePrepNote` so status/
  assignment changes persist" follow-up named under the "Prep Note
  Persistence" entry below (itself the "Strategy Sync Notes" idea's
  persistence slice under Research Crowdsourcing Organizer Features).
  Vitest-covered in `packages/debate-round/test/prepNotes.test.ts`
  (status change persists and is returned, assigning and unassigning
  — `assignedToId: null` — both persist and are returned, and both
  helpers return `undefined` and leave storage untouched for an id that
  isn't stored). This is a composition slice only —
  `updateNoteStatus`/`assignNote`/`savePrepNote` themselves are unchanged,
  and no prep-notes panel UI in this repo yet calls these new helpers.
  Verified from a clean install: `bun install`, `bun run typecheck` (12
  packages, all pass), `bun run test` (87 files / 1117 tests, all pass), and
  `bun run build` all pass. PR:
  [#137](https://github.com/debate/debate-ai.com/pull/137).
- **Progress Unlocks — derive unlock status from persisted contributions/mission-results.**
  `packages/debate-card-search/src/lib/unlock-streak-status.ts` adds
  `buildContributorUnlockStatusWithStreakFromStore`, a thin wrapper around the
  existing pure `buildContributorUnlockStatusWithStreak` that reads a
  contributor's persisted contributions (`state/contributions.ts`'s
  `listContributionsByContributor`) and mission-result history
  (`state/dailyMissionResults.ts`'s `listDailyMissionResultsForContributor`)
  instead of requiring a caller-supplied `ContributorStats`/
  `DailyMissionResult[]` list, mirroring the existing
  `buildPersistedContributorQuestStreak`/`buildPrepRoomFromStore`
  "compose the pure function directly against the persisted store"
  convention. A contributor with zero persisted contributions gets an
  all-zero, `novice` status (via a small `buildEmptyContributorStats`
  helper) instead of the `buildContributorStats` empty-contributions error,
  since a brand-new contributor having no unlock status yet is expected, not
  a bug. Closes the "🔓 Progress Unlocks" bullet's own follow-up (a),
  "persisting a contributor's tier/badges", named under Research
  Crowdsourcing Organizer Features below — no separate tier/badge
  persistence is needed since it's now derived live from the existing
  stores. `buildContributorUnlockStatusWithStreak`/`buildContributorStats`/
  `computeContributorTier` themselves are unchanged. Vitest-covered in
  `packages/debate-card-search/test/unlock-streak-status.test.ts` (tier
  derived from persisted contributions, streak folded in from persisted
  mission results, all-zero novice fallback for a contributor with no
  persisted contributions, and that one contributor's persisted data doesn't
  leak into another's status), using the same in-memory `localStorage` mock
  convention as this package's other persistence tests. This is a
  composition slice only — no UI panel in this repo yet reads this status.
  Verified from a clean install: `bun install`, `bun run typecheck` (12
  packages, all pass), `bun run test` (87 files / 1112 tests, all pass), and
  `bun run build` all pass. PR:
  [#136](https://github.com/debate/debate-ai.com/pull/136).
- **Collaboration Prep Room Store Wiring — read entries from the persisted
  evidence library.** `packages/debate-card-search/src/lib/prep-room.ts`
  adds `buildPrepRoomFromStore`, a thin wrapper around the existing pure
  `buildPrepRoom` that reads a topic's `entries` from the persisted
  `evidenceLibraryEntries.ts` store (`listEvidenceLibraryEntries`) whenever
  the caller doesn't already supply an entry list directly — explicitly
  supplied entries still take precedence over the store. Closes the "(a)
  wiring `buildPrepRoom`/`searchPrepRoomEvidence` to read through the
  now-persisted `evidenceLibraryEntries.ts` store instead of caller-supplied
  entries" follow-up named under both the "Collaboration Prep Room" bullet
  in Research Crowdsourcing Organizer Features below and the "Shared
  Evidence Library" bullet's own note that this wiring was still open.
  `buildPrepRoom`/`searchPrepRoomEvidence` themselves are unchanged — this is
  purely an additive, store-aware entry point so a future prep-room panel UI
  only needs to pass a topic, not a pre-fetched entry list. Vitest-covered in
  `packages/debate-card-search/test/prep-room.test.ts` (store-resolved
  entries scoped to the topic, empty room when the store has nothing for
  that topic, explicit-entries precedence, and parity with `buildPrepRoom`
  when entries are supplied), using the same in-memory `localStorage` mock
  convention as this package's other persistence tests. No prep-room panel
  UI and no live presence signal exist yet. Verified from a clean install:
  `bun install`, `bun run typecheck` (12 packages, all pass), `bun run test`
  (87 files / 1108 tests, all pass), and `bun run build` all pass. PR:
  [#135](https://github.com/debate/debate-ai.com/pull/135).
- **Pre-Round Briefing Store Wiring — resolve opponent/judge profiles from
  persisted stores.** `packages/debate-round/src/round/pre-round-briefing.ts`
  adds `buildPreRoundBriefingFromStores`, a thin wrapper around the existing
  pure `buildPreRoundBriefing` that resolves `opponentProfile`/`judgeProfile`
  via `debate-data-sync`'s `opponentTeamProfiles.ts` (`getOpponentTeamProfile`)
  and `debate-speech-writer`'s `judgeProfiles.ts` (`getJudgeProfile`) by
  `opponentTeamId`/`judgeId` whenever the caller doesn't already supply the
  profile object directly — an explicitly supplied profile still takes
  precedence over a store lookup. Closes the "(c) wiring
  `buildPreRoundBriefing` to look up a persisted profile through this store"
  follow-up named under both the "Opponent Team Profiles" and "Judge Profiles"
  bullets in Research Crowdsourcing Organizer Features below, and idea #12's
  ("Pre-Round Intelligence Panel") related follow-up in Product Feature Ideas.
  `buildPreRoundBriefing` itself is unchanged — this is purely an additive,
  store-aware entry point so a future briefing-panel UI only needs to pass
  ids, not pre-fetched profile objects. Vitest-covered in
  `packages/debate-round/test/pre-round-briefing.test.ts` (store-resolved
  profiles, no-data-on-file fallback per id, explicit-profile precedence, and
  parity with `buildPreRoundBriefing` when nothing is supplied), using the
  same in-memory `localStorage` mock convention as this package's other
  persistence tests. No briefing-panel UI and no real tournament/pairing/room
  data source exist yet. Verified from a clean install: `bun install`,
  `bun run typecheck` (12 packages, all pass), `bun run test` (87 files /
  1104 tests, all pass), and `bun run build` all pass. PR:
  [#134](https://github.com/debate/debate-ai.com/pull/134).
- **Gamified Quests — persisted daily mission-result history.**
  `packages/debate-card-search/src/state/dailyMissionResults.ts` adds a
  localStorage-backed CRUD store (`listDailyMissionResults`/
  `listDailyMissionResultsForContributor`/`getDailyMissionResult`/
  `saveDailyMissionResult`/`deleteDailyMissionResult`) for
  `gamified-quests.ts`'s `DailyMissionResult`, keyed by `contributorId` +
  `dayKey` with upsert-on-save semantics (recomputing an already-recorded
  day overwrites rather than duplicating it), mirroring the existing
  `coachingSessions.ts`/`contributorAvailability.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Also adds `buildPersistedContributorQuestStreak`,
  which composes the persisted history directly into the existing
  `buildContributorQuestStreak` rather than requiring the caller to hold an
  in-memory history list, mirroring the existing
  `evidenceLibraryEntries.ts`-style "reuse the pure function directly
  against the persisted store" convention. Closes the "(a) wiring real,
  persisted daily contributions into `computeDailyMissionResult` per
  contributor per day" follow-up named under the "🎮 Gamified Quests" bullet
  in Research Crowdsourcing Organizer Features below — the real, attributed
  contributions that `computeDailyMissionResult` is derived from (via
  `daily-quests.ts`'s `buildDailyQuestBoard`) are already persisted by the
  existing `contributions.ts` store, so this closes the missing half: a
  place to persist each day's computed mission result once, so a
  contributor's streak survives across sessions instead of requiring a
  caller-held in-memory list. Vitest-covered (with an in-memory
  `localStorage` mock, since this package's Vitest environment is `node`
  with no DOM) in
  `packages/debate-card-search/test/dailyMissionResults.test.ts`, including
  an interop test that builds a real streak from persisted history. This is
  a persistence slice only — `gamified-quests.ts`'s pure streak/badge
  computation is unchanged; nothing in this repo yet wires a real
  UI/scheduled-job call to compute and save a contributor's mission result
  at the end of each day, and no streak/badge widget UI in this repo yet
  reads through this store. Follow-ups: (a) wiring a real end-of-day
  computation (UI action or scheduled job) that calls
  `computeDailyMissionResult` against that day's persisted contributions and
  saves it here, (b) a streak/badge widget UI that renders
  `buildStreakSummaryText`/`buildPersistedContributorQuestStreak`. Neither
  of these is started. Verified from a clean install: `bun install`, `bun
  run typecheck` (11 packages, all pass), `bun run test` (87 files / 1100
  tests, all pass), and `bun run build` all pass.
- **Research Task Routing — persisted routed task queue.**
  `packages/debate-card-search/src/state/routedTaskQueues.ts` adds a
  localStorage-backed CRUD store (`listRoutedTaskQueues`/`getRoutedTaskQueue`/
  `saveRoutedTaskQueue`/`deleteRoutedTaskQueue`) for `research-task-routing.ts`'s
  `RoutingResult`, wrapped in a `RoutedTaskQueueRecord` (`topicId` + `result`)
  since a `RoutingResult` has no natural key of its own, keyed by a
  caller-supplied `topicId` with upsert-on-save semantics, mirroring the
  existing `drillSets.ts`/`flowSummaries.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Closes the "persisted task queue" half of the "(a)
  persisted contributor profiles (active task count — skill level is now
  derived) and a persisted task queue" follow-up named under the "Research
  Task Routing" bullet in Research Crowdsourcing Organizer Features below —
  the contributor-profile half was already closed by
  `contributorAvailability.ts`. Vitest-covered (with an in-memory
  `localStorage` mock, since this package's Vitest environment is `node`
  with no DOM) in `packages/debate-card-search/test/routedTaskQueues.test.ts`.
  This is a persistence slice only — it stores whatever `RoutingResult` a
  caller passes in verbatim (`routeTasks`/`buildRoutingResult`/
  `buildTaskQueue` themselves are unchanged); no task-assignment/inbox UI in
  this repo yet reads or writes through this store, and nothing yet wires
  real task-assignment/completion events into a persisted contributor's
  `activeTaskCount`. Follow-ups: (a) wiring real task-assignment/completion
  events to keep a persisted `ContributorAvailability`'s `activeTaskCount`
  accurate, (b) a task-assignment/inbox UI that renders a topic's persisted
  routed queue and reads/writes through this store. Neither of these is
  started. Verified from a clean install: `bun run typecheck` (all packages
  pass), `bun run test` (86 files / 1085 tests, all pass), and `bun run
  build` all pass. PR:
  [#132](https://github.com/debate/debate-ai.com/pull/132).
- **Revision Incentives — persisted revision history.**
  `packages/debate-card-search/src/state/revisionHistory.ts` adds a
  localStorage-backed store for `revision-incentives.ts`'s `CardRevision`
  before/after edit events. Unlike this package's other persistence stores,
  a card can be revised many times, so records aren't keyed by `cardId`/
  `contributorId` alone — each recorded revision is wrapped in a
  `CardRevisionRecord` with its own synthetic `id` and `revisedAt`
  timestamp, and saving appends a new history entry rather than overwriting
  a prior one for the same card, mirroring the existing `debate-round`
  `drillSets.ts` wrapped-record convention (SSR/no-storage-safe, corrupt or
  missing JSON degrades to an empty list rather than throwing).
  `listRevisionHistory`/`listRevisionHistoryForCard`/
  `listRevisionHistoryForContributor` return records oldest-first, and
  because `CardRevisionRecord` is a superset of `CardRevision`, a list of
  records can be passed directly into `revision-incentives.ts`'s
  `buildRevisionIncentiveLeaderboard`/`buildContributorRevisionStats`
  without stripping the extra fields. Closes the "(a) wiring actual
  card-edit events into a persisted revision history" follow-up named under
  the "Revision Incentives" bullet in Research Crowdsourcing Organizer
  Features below. Vitest-covered (with an in-memory `localStorage` mock,
  since this package's Vitest environment is `node` with no DOM) in
  `packages/debate-card-search/test/revisionHistory.test.ts`, including an
  interop test that feeds a persisted history straight into
  `buildRevisionIncentiveLeaderboard`. This is a persistence slice only —
  nothing in this repo yet wires a real card-edit event into
  `saveRevisionRecord`, and the reward points a revision earns still aren't
  surfaced anywhere. Follow-ups: (a) wiring an actual card-edit/save flow to
  call `saveRevisionRecord` with a before/after snapshot, (b) a
  reward-notification/incentives-leaderboard UI that reads through this
  store via `buildRevisionIncentiveLeaderboard`. Neither of these is
  started. Verified from a clean install: `bun run typecheck` (12 packages,
  all pass), `bun run test` (85 files / 1076 tests, all pass), and
  `bun run build` all pass. PR:
  [#131](https://github.com/debate/debate-ai.com/pull/131).
- **Expandable Heading Structure — collapsed-heading persistence.**
  `packages/reason-editor/src/state/collapsedHeadings.ts` adds a
  localStorage-backed CRUD store (`listCollapsedHeadingSelections`/
  `getCollapsedHeadingSelection`/`saveCollapsedHeadingSelection`/
  `deleteCollapsedHeadingSelection`) for a document's collapsed heading ids
  (`CollapsedHeadingSelection`: `documentId` + `collapsedIds: string[]`),
  keyed by `documentId` with upsert-on-save semantics, mirroring the
  existing `debate-round` `argumentTreeFilters.ts`/`debate-speech-writer`
  `judgeParadigmSelections.ts` persistence convention (SSR/no-storage-safe,
  corrupt or missing JSON degrades to an empty list rather than throwing).
  This is the first localStorage-backed persistence store in the
  `reason-editor` package; it's exported from the package's `engine` entry
  point (`reason-editor/engine`) alongside the existing `heading-outline.ts`
  outline exports it complements. Closes the "(c) persisting collapsed-state
  per document" follow-up named under idea #9 ("Expandable Heading
  Structure") in Product Feature Ideas below. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in `packages/reason-editor/test/collapsedHeadings.test.ts`.
  This is a persistence slice only — it stores whatever `collapsedIds` a
  caller passes in verbatim; `heading-outline.ts`'s pure outline/collapse-range
  computation is unchanged, and no nav panel or editor view in this repo yet
  reads or writes through this store. Follow-ups: (a) a React nav/outline
  panel in `reason-editor` that renders the outline and toggles collapsed
  ids, reading/writing through this store, (b) a ProseMirror decoration
  plugin that hides collapsed ranges in the actual editor view using
  `getCollapsedRanges`. Neither of these is started. Verified from a clean
  install: `bun run typecheck` (12 packages, all pass), `bun run test` (84
  files / 1061 tests, all pass), and `bun run build` all pass. PR:
  [#130](https://github.com/debate/debate-ai.com/pull/130).
- **Research Task Routing — persisted contributor-availability profiles.**
  `packages/debate-card-search/src/state/contributorAvailability.ts` adds a
  localStorage-backed CRUD store (`listContributorAvailability`/
  `getContributorAvailability`/`saveContributorAvailability`/
  `deleteContributorAvailability`) for `research-task-routing.ts`'s
  `ContributorAvailability` records, keyed by `contributorId` with
  upsert-on-save semantics, mirroring the existing `judgeProfiles.ts`/
  `brainstormIdeas.ts` persistence convention (SSR/no-storage-safe, corrupt
  or missing JSON degrades to an empty list rather than throwing). Closes
  half of the "(a) persisted contributor profiles (active task count — skill
  level is now derived) and a persisted task queue" follow-up named under
  the "Research Task Routing" bullet under Research Crowdsourcing Organizer
  Features below. Vitest-covered (with an in-memory `localStorage` mock,
  since this package's Vitest environment is `node` with no DOM) in
  `packages/debate-card-search/test/contributorAvailability.test.ts`. This
  is a persistence slice only — it stores whatever `ContributorAvailability`
  a caller passes in verbatim; nothing in this repo yet updates
  `activeTaskCount` from real task-assignment events, and the routed task
  queue (`RoutingResult`) itself still isn't persisted. Follow-ups: (a)
  wiring real task-assignment/completion events to keep a persisted
  profile's `activeTaskCount` accurate, (b) persisting a routed
  `RoutingResult`/task queue, (c) a task-assignment/inbox UI that reads/
  writes through this store. None of these are started.
- **Word-Count-Only Speech Format — persisted word-count round results.**
  `packages/debate-round/src/state/wordCountRounds.ts` adds a
  localStorage-backed CRUD store (`listWordCountRounds`/`getWordCountRound`/
  `saveWordCountRound`/`deleteWordCountRound`) for a round's chosen
  `debate-timer` word-count style key and its submitted speech text, keyed by
  `roundId` with upsert-on-save semantics, mirroring the existing
  `aiVersusRounds.ts`/`practiceRounds.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Closes the "(c) persisting word-count-mode round
  results alongside timed rounds" follow-up named under idea #2
  ("Word-Count-Only Speech Format") below. Also adds
  `getWordCountRoundStatuses`, which computes each submitted speech's
  `WordCountStatus` on read (via the existing `getWordCountStatus`) by
  matching each submission's `name` against the round's style, rather than
  storing a status snapshot that could go stale if a format's word limits
  ever change; a submission whose name no longer matches any speech in the
  style is skipped rather than throwing. Vitest-covered (with an in-memory
  `localStorage` mock, since this package's Vitest environment is `node`
  with no DOM) in `packages/debate-round/test/wordCountRounds.test.ts`. This
  is a persistence slice only — no submission UI in this repo yet reads or
  writes through this store, and `useTimerState`/`SpeechTimer` still has no
  non-timed, word-limited speech mode. Follow-ups: (a) a submission UI in
  `debate-round`/`reason-editor` that calls `getWordCountStatus` while a
  debater types and reads/writes through this store, (b) extending
  `useTimerState`/`SpeechTimer` to support a non-timed, word-limited speech
  mode. Neither of these is started.
- **Practice Round Simulator — persisted practice-round store.**
  `packages/debate-round/src/state/practiceRounds.ts` adds a
  localStorage-backed CRUD store (`listPracticeRounds`/`getPracticeRound`/
  `savePracticeRound`/`deletePracticeRound`) for `practice-round-simulator.ts`'s
  derived `PracticeRoundSetup` and (once generated) `PracticeRoundFeedback`,
  keyed by `roundId` with upsert-on-save semantics, mirroring the existing
  `aiVersusRounds.ts`/`drillSets.ts` persistence convention (SSR/no-storage-safe,
  corrupt or missing JSON degrades to an empty list rather than throwing).
  Closes the "(c) persisting a simulated practice round (setup, submitted
  speeches, and feedback) once round-state persistence exists" follow-up
  named under the "Practice Round Simulator" bullet in Research
  Crowdsourcing Organizer Features below — round-state persistence now
  exists via idea #3's `aiVersusRounds.ts` store, so rather than duplicating
  a round's submitted speeches in a second place, this store also adds
  `getPracticeRoundSubmittedSpeeches`, which looks them up through the
  existing `aiVersusRounds.ts` store directly. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in `packages/debate-round/test/practiceRounds.test.ts`.
  This is a persistence slice only — it stores whatever `PracticeRoundSetup`/
  `PracticeRoundFeedback` a caller passes in verbatim
  (`buildPracticeRoundSetup`/`buildPracticeRoundFeedback` themselves are
  unchanged); no round-simulator UI in this repo yet reads or writes through
  this store. Follow-ups: (a) an actual AI speech-generation call for the AI
  opponent's speeches and an AI judge-decision call under the chosen
  paradigm, (b) a round-simulator UI in `debate-round` that renders
  `buildPracticeRoundSetupText`/`buildPracticeRoundFeedbackText` and
  reads/writes through this store. Neither of these are started. PR:
  [#127](https://github.com/debate/debate-ai.com/pull/127) (`bun run
  typecheck`/`bun run test`/`bun run build` all pass).
- **Shared Evidence Library — persisted evidence repository.**
  `packages/debate-card-search/src/state/evidenceLibraryEntries.ts` adds a
  localStorage-backed CRUD store (`listEvidenceLibraryEntries`/
  `getEvidenceLibraryEntry`/`saveEvidenceLibraryEntry`/
  `deleteEvidenceLibraryEntry`) for `shared-evidence-library.ts`'s
  `EvidenceLibraryEntry`, keyed by `id` with upsert-on-save semantics, plus
  `searchPersistedEvidenceLibrary`, which reuses `searchEvidenceLibrary`
  directly against the persisted list rather than reimplementing search,
  mirroring the existing `contributions.ts`/`groupChallenges.ts` persistence
  convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
  empty list rather than throwing). Closes the "(a) wiring real submitted
  cards and team-drafted blocks into a persisted repository instead of
  caller-supplied entries" follow-up named under the "Shared Evidence
  Library" bullet in Research Crowdsourcing Organizer Features below, and
  unblocks the "Collaboration Prep Room" idea's own follow-up (a), which
  named a persisted evidence store as its prerequisite. Vitest-covered (with
  an in-memory `localStorage` mock, since this package's Vitest environment
  is `node` with no DOM) in
  `packages/debate-card-search/test/evidenceLibraryEntries.test.ts`. This is
  a persistence slice only — it stores whatever `EvidenceLibraryEntry` a
  caller passes in verbatim (`searchEvidenceLibrary`/`buildEvidenceLibraryIndex`
  themselves are unchanged); no search-panel UI in this repo yet reads or
  writes through this store, and `prep-room.ts`'s `buildPrepRoom` still
  takes a caller-supplied entry list rather than reading through this store.
  Follow-ups: (a) a search panel UI in `debate-card-search` that renders
  `searchPersistedEvidenceLibrary`/`buildEvidenceSearchSummaryText` results
  and `buildEvidenceLibraryIndex`'s folders/collections, (b) wiring
  `prep-room.ts`'s `buildPrepRoom`/`searchPrepRoomEvidence` to read through
  this store instead of a caller-supplied entry list, (c) a real search
  index (e.g. Typesense, mirroring the existing `search-query.ts` CARDS
  search) once entries are persisted, for relevance/typo-tolerance beyond
  the current keyword-overlap heuristic. None of these are started. PR:
  [#126](https://github.com/debate/debate-ai.com/pull/126) (`bun run
  typecheck`/`bun run test`/`bun run build` all pass).
- **AI Coach Mode — coaching-session persistence.**
  `packages/debate-round/src/state/coachingSessions.ts` adds a
  localStorage-backed CRUD store (`listCoachingSessions`/`getCoachingSession`/
  `getCoachingSessionsForRound`/`saveCoachingSession`/`deleteCoachingSession`)
  for `coach-mode.ts`'s derived `CoachingPrompt[]` coaching session, keyed by
  `roundId` + `sideKey` (a round can have a separately-generated session per
  side represented in its flow) with upsert-on-save semantics, mirroring the
  existing `flowSummaries.ts`/`drillSets.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Closes the "(c) persisting a generated coaching
  session per round" follow-up named under "AI Coach Mode" in the Research
  Crowdsourcing Organizer Features list below. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in `packages/debate-round/test/coachingSessions.test.ts`.
  This is a persistence slice only — it stores whatever `CoachingPrompt[]` a
  caller passes in verbatim (`buildCoachingSession` itself is unchanged); no
  coaching-panel UI in this repo yet reads or writes through this store. PR:
  TBD (`bun run test`/`bun run typecheck`/`bun run build:web` all pass).
  Follow-ups: (a) an actual AI coaching call for open-ended feedback beyond
  the existing template layer, (b) a coaching-panel UI in `debate-round` that
  reads/writes through this store. Neither of these is started.
- **Speech Transcript Summaries and Answers — flow-summary persistence.**
  `packages/debate-round/src/state/flowSummaries.ts` adds a
  localStorage-backed CRUD store (`listFlowSummaries`/`getFlowSummary`/
  `saveFlowSummary`/`deleteFlowSummary`) for `flow-transcript-summary.ts`'s
  derived `FlowRowSummary[]` (as produced by `getFlowRowSummaries`), keyed by
  `roundId` with upsert-on-save semantics, mirroring the existing
  `preRoundBriefings.ts`/`drillSets.ts` persistence convention (SSR/no-storage-safe,
  corrupt or missing JSON degrades to an empty list rather than throwing).
  Closes the "(c) persisting generated summaries per round" follow-up named
  under idea #6 ("Speech Transcript Summaries and Answers") in Product
  Feature Ideas below. Vitest-covered (with an in-memory `localStorage` mock,
  since this package's Vitest environment is `node` with no DOM) in
  `packages/debate-round/test/flowSummaries.test.ts`. This is a persistence
  slice only — it stores whatever `FlowRowSummary[]` a caller passes in
  verbatim (`getFlowRowSummaries`/`buildFlowSummaryText` themselves are
  unchanged); no summary/cross-ex panel UI in this repo yet reads or writes
  through this store. Follow-ups: (a) audio/video transcription plus an AI
  call to extract claims/warrants/impacts/evidence from raw speech text
  rather than relying on a manually flowed grid, (b) a summary/cross-ex panel
  UI in `debate-round` that renders `buildFlowSummaryText`/
  `suggestCrossExamQuestions`/`suggestExtensionIdeas` for the selected speech
  and reads/writes through this store. Neither of these is started. PR:
  [#123](https://github.com/debate/debate-ai.com/pull/123) (`bun run
  test`/`bun run typecheck`/`bun run build:web` all pass).
- **Online Debate Versus AI — submitted-round persistence.**
  `packages/debate-round/src/state/aiVersusRounds.ts` adds a
  localStorage-backed CRUD store (`listAiVersusRounds`/`getAiVersusRound`/
  `saveAiVersusRound`/`deleteAiVersusRound`) for an `AiVersusRoundRecord`
  (`roundId`, `styleKey`, `userSide`, `submittedSpeeches:
  PriorSpeechRecord[]`) built on `ai-versus-speech-order.ts`'s existing
  `AiVersusSide`/`PriorSpeechRecord` types, keyed by `roundId` with
  upsert-on-save semantics, mirroring the existing
  `preRoundBriefings.ts`/`coachingPrograms.ts` persistence convention
  (SSR-safe, corrupt/missing JSON degrades to an empty list rather than
  throwing). `submittedSpeeches.length` doubles as the `submittedCount`
  that `getNextSpeechSlot`/`isUsersTurn`/`validateSpeechSubmission`/
  `buildAiResponseRequest` already expect, so no separate counter field is
  stored. Closes the "(c) persisting an online-versus-AI round's submitted
  speeches" follow-up named under idea #3 ("Online Debate Versus AI") in
  Product Feature Ideas below. Vitest-covered (with an in-memory
  `localStorage` mock, since this package's Vitest environment is `node`
  with no DOM) in `packages/debate-round/test/aiVersusRounds.test.ts`. This
  is a persistence slice only — `ai-versus-speech-order.ts`'s pure
  turn-order logic is unchanged. PR:
  [#122](https://github.com/debate/debate-ai.com/pull/122) (`bun run
  typecheck`/`bun run test`/`bun run build:web` all pass). Follow-ups: (a)
  an actual AI speech-generation call that consumes
  `buildAiResponseRequest`'s output, (b) a round-setup + submission UI in
  `debate-round` that reads/writes
  through this store and calls `validateSpeechSubmission`. Neither of these
  are started.
- **Outline Filters and Argument Tree View — filter-selection persistence.**
  `packages/debate-round/src/state/argumentTreeFilters.ts` adds a
  localStorage-backed CRUD store (`listArgumentTreeFilterSelections`/
  `getArgumentTreeFilterSelection`/`saveArgumentTreeFilterSelection`/
  `deleteArgumentTreeFilterSelection`) for `argument-tree.ts`'s
  `ArgumentTreeFilter`, keyed by `roundId` with upsert-on-save semantics,
  mirroring the existing `judgeParadigmSelections.ts`/
  `opponentPersonaSelections.ts` persistence convention (SSR-safe,
  corrupt/missing JSON degrades to an empty list rather than throwing).
  Closes the "(c) persisting the user's chosen filter state per round"
  follow-up named under idea #10 below. Vitest-covered in
  `packages/debate-round/test/argumentTreeFilters.test.ts`. This is a
  persistence slice only — `argument-tree.ts`'s pure tree-building/filtering
  logic is unchanged and still takes a caller-supplied `ArgumentTreeFilter`.
  Follow-ups: (a) a React tree/outline panel in `debate-round` that renders
  the filtered tree and reads/writes through this store, (b) finer
  argument-type tagging and contributor/evidence-status fields. Neither of
  these are started.
- **Fix `packageManager` field so local installs use Bun instead of npm.**
  `package.json`'s `"packageManager"` field said `"npm@10.0.0"`, but this repo's
  actual lockfile is `bun.lock` (committed since the original monorepo setup),
  `.github/workflows/test.yml` installs and verifies with `bun install` /
  `bun run typecheck` / `bun run coverage`, and `README.md`'s documented
  workflow is `bun install` / `bun run …`. That mismatch meant every prior
  autonomous run's `npm install` failed with `Cannot read properties of null
  (reading 'edgesOut')` (a pre-existing `@npmcli/arborist` bug on this
  workspace layout), which blocked real `typecheck`/`test`/`build`
  verification and forced isolated-sandbox workarounds — see PRs
  [#119](https://github.com/debate/debate-ai.com/pull/119) and earlier entries
  below for repeated instances of this same blocker. Changed the field to
  `"bun@1.3.11"` to match the tool this repo actually uses. Verified from a
  clean checkout: `bun install` (2050 packages, ~9s), `bun run typecheck` (11
  packages, all pass), `bun run test` (75 files / 969 tests, all pass), and
  `bun run build` (`debate-ai-web` + `reason-editor`, both succeed) all pass
  cleanly with no code changes needed. No test changes were needed since this
  is a tooling-config fix, not a behavior change.
- **Brainstorm Idea Persistence.** `packages/debate-card-search/src/state/brainstormIdeas.ts`
  adds a localStorage-backed CRUD store (`listBrainstormIdeas`/`getBrainstormIdea`/
  `saveBrainstormIdea`/`deleteBrainstormIdea`) for `team-brainstorm-assist.ts`'s
  `BrainstormIdea`, keyed by `id` with upsert-on-save semantics, mirroring the
  existing `groupChallenges.ts`/`peerReviews.ts`/`contributions.ts` persistence
  convention (SSR-safe, corrupt/missing JSON degrades to an empty list rather
  than throwing). Closes the "(c) persisting submitted ideas and votes"
  follow-up named under the "Team Brainstorm Assist" bullet below.
  Vitest-covered in `packages/debate-card-search/test/brainstormIdeas.test.ts`.
  This is a persistence slice only — `team-brainstorm-assist.ts`'s pure
  ranking/board logic is unchanged and still takes a caller-supplied
  `BrainstormIdea[]`. Follow-ups: (a) an actual AI-generation call that drafts
  candidate ideas, (b) a brainstorm-panel UI for live squad submission/upvoting.
  Neither of these are started. PR: [#119](https://github.com/debate/debate-ai.com/pull/119)
  (merged; full `bun run typecheck`/`bun run test`/`bun run build` verification
  completed after merge — see the `packageManager` fix entry above for why the
  original PR could only verify in an isolated sandbox).
- **Collaboration Prep Room — evidence + draft blocks + task-routing composition slice.**
  `packages/debate-card-search/src/lib/prep-room.ts` adds
  `buildPrepRoom`/`searchPrepRoomEvidence`/`buildPrepRoomSummaryText`,
  composing the existing "Shared Evidence Library"
  (`shared-evidence-library.ts`'s `buildEvidenceLibraryIndex`/
  `searchEvidenceLibrary`) and "Research Task Routing"
  (`research-task-routing.ts`'s `buildRoutingResult`) slices into one
  topic-scoped `PrepRoom`: the topic's evidence organized into folders/tag
  collections, its `kind: "block"` entries surfaced as draft blocks (the
  existing evidence-library model already distinguishes a team-drafted
  reusable analytic block from a cut evidence card, so no separate block
  model was needed), and its coverage-gap tasks routed to available
  contributors — mirroring the existing `team-collaboration-mode.ts`
  composition precedent (Daily Quests + Research Task Routing + Research
  Progress Tracking composed into one `TopicSprint`). Reuses
  `shared-evidence-library.ts` and `research-task-routing.ts` directly
  rather than introducing a separate evidence or assignment model.
  Vitest-covered in `packages/debate-card-search/test/prep-room.test.ts`.
  This is the first slice only — it works entirely off a caller-supplied
  entry list, coverage report, and contributor-availability list; it
  doesn't render a prep-room panel UI. A second slice,
  `buildPrepRoomFromStore` (see the "Collaboration Prep Room Store Wiring"
  entry in Tracker Status above), now reads a topic's entries from the
  `evidenceLibraryEntries.ts` store instead of requiring a caller-supplied
  entry list, closing follow-up (a) below. Follow-ups: (a) a prep-room panel
  UI that renders `buildPrepRoomFromStore`'s evidence index/draft
  blocks/routing and lets a teammate call `searchPrepRoomEvidence`, (b) a
  live presence/who's-active signal, mirroring the "Team Collaboration Mode"
  idea's own still-open follow-up. Neither of these are started.
  PR: [#118](https://github.com/debate/debate-ai.com/pull/118) (first slice),
  [#135](https://github.com/debate/debate-ai.com/pull/135) (store-wiring
  slice).
- **Unlock Status Streak Badges — Progress Unlocks/Gamified Quests composition slice.**
  `packages/debate-card-search/src/lib/unlock-streak-status.ts` adds
  `buildContributorUnlockStatusWithStreak`/`buildUnlockStatusWithStreakText`,
  composing the existing "Progress Unlocks" tier/badge logic
  (`progress-unlocks.ts`'s `buildContributorUnlockStatus`) with the existing
  "Gamified Quests" streak logic (`gamified-quests.ts`'s
  `buildContributorQuestStreak`) into one `ContributorUnlockStatusWithStreak`
  that merges tier-earned badges with streak-earned badges (tier badges
  first) and carries the full `StreakStatus` alongside the unlocked skill
  level and next-tier progress. The "🎮 Gamified Quests" bullet's own
  follow-up (c) named this exact gap — see Research Crowdsourcing Organizer
  Features below — mirroring the existing
  `tiered-task-routing.ts` composition precedent (Progress Unlocks composed
  into Research Task Routing). Reuses `progress-unlocks.ts` and
  `gamified-quests.ts` directly rather than introducing a separate tier or
  streak signal. Vitest-covered in
  `packages/debate-card-search/test/unlock-streak-status.test.ts`. This is
  the first slice only — it works entirely off caller-supplied
  `ContributorStats`/`DailyMissionResult`s (neither a contributor's tier nor
  their streak is persisted anywhere in this repo yet); no progress/unlock UI
  in this repo reads it. Follow-ups: (a) persisting a contributor's tier and
  daily mission-completion history so this can be computed from real data
  instead of caller-supplied input, (b) a progress/unlock panel UI that
  renders `buildUnlockStatusWithStreakText`/`ContributorUnlockStatusWithStreak`.
  PR: [#117](https://github.com/debate/debate-ai.com/pull/117).
- **Generated Drill Set Persistence — localStorage drill-set-per-round store.**
  `packages/debate-round/src/state/drillSets.ts` adds
  `listDrillSets`/`getDrillSet`/`saveDrillSet`/`deleteDrillSet`, a
  localStorage-backed CRUD store for `drill-generator.ts`'s generated
  `Drill[]` set (plus the `sideKey` it was generated for), keyed by
  `roundId` with upsert-on-save semantics, mirroring the existing
  `preRoundBriefings.ts`/`judgeParadigmSelections.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). See the "AI Drill Generator" bullet under Research
  Crowdsourcing Organizer Features below — this is the "(c) persisting
  generated drills per round" follow-up named in that slice. This is a
  persistence slice only — it stores whatever `Drill[]` a caller passes in
  verbatim (`buildDrillSet` itself is unchanged); no drill-panel UI in this
  repo yet reads or writes through this store. Vitest-covered in
  `packages/debate-round/test/drillSets.test.ts`. Follow-ups: (a) a
  drill-panel UI that calls `buildDrillSet` and reads/writes through this
  store, (b) an actual AI-generated (rather than templated) drill script.
  PR: [#116](https://github.com/debate/debate-ai.com/pull/116).
- **Pre-Round Briefing Persistence — localStorage briefing store.**
  `packages/debate-round/src/state/preRoundBriefings.ts` adds
  `listPreRoundBriefings`/`getPreRoundBriefing`/`savePreRoundBriefing`/
  `deletePreRoundBriefing`, a localStorage-backed CRUD store for
  `pre-round-briefing.ts`'s `PreRoundBriefing`, keyed by a caller-supplied
  `roundId` with upsert-on-save semantics, mirroring the existing
  `judgeParadigmSelections.ts`/`coachingPrograms.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). See idea #12 ("Pre-Round Intelligence Panel") in
  Product Feature Ideas below — this is the "(c) persisting a generated
  briefing per round" follow-up named in that slice. This is a persistence
  slice only — it stores whatever `PreRoundBriefing` a caller passes in
  verbatim (`buildPreRoundBriefing`/`buildPreRoundBriefingText` themselves
  are unchanged); no round-information-page UI in this repo yet reads or
  writes through this store. Vitest-covered in
  `packages/debate-round/test/preRoundBriefings.test.ts`. Follow-ups: (a) a
  briefing-panel UI that renders a persisted briefing on a round-information
  page, (b) real data sources for tournament results, pairings, event
  details, and room assignments (none exist in this repo today) feeding
  `buildPreRoundBriefing` before it's persisted, (c) wiring
  `savePreRoundBriefing` into whatever eventually calls
  `buildPreRoundBriefing` for a real round.
  PR: [#115](https://github.com/debate/debate-ai.com/pull/115).
- **Opponent Persona Selection Persistence — localStorage persona-per-session store.**
  `packages/debate-speech-writer/src/state/opponentPersonaSelections.ts` adds
  `listOpponentPersonaSelections`/`getOpponentPersonaSelection`/
  `saveOpponentPersonaSelection`/`deleteOpponentPersonaSelection`, a
  localStorage-backed CRUD store for a practice session's selected
  `OpponentPersona` (`opponent/opponent-personas.ts`), keyed by `sessionId`
  with upsert-on-save semantics, mirroring the existing
  `judgeParadigmSelections.ts`/`coachMaterials.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Stores the full `OpponentPersona` object rather
  than just a builtin id, so a future custom persona would persist too. See
  the "AI Practice Opponent" idea in Research Crowdsourcing Organizer
  Features below — this is the "(c) persisting the selected persona per
  practice session" follow-up named in that slice. Vitest-covered in
  `packages/debate-speech-writer/test/opponentPersonaSelections.test.ts`.
  This is a persistence slice only — no persona-picker UI in this repo yet
  reads or writes through this store, and it isn't wired into an actual
  AI speech-generation call. Follow-ups: (a) an actual AI speech-generation
  call that consumes `buildOpponentPersonaPrompt`'s output alongside idea
  #3's `AiSpeechRequest`, (b) a persona-picker UI that reads/writes through
  this store before starting an AI-versus practice round.
  PR: [#114](https://github.com/debate/debate-ai.com/pull/114).
- **Group Challenge Persistence — localStorage challenge-config store.**
  `packages/debate-card-search/src/state/groupChallenges.ts` adds
  `listGroupChallenges`/`getGroupChallenge`/`saveGroupChallenge`/
  `deleteGroupChallenge`, a localStorage-backed CRUD store for
  `group-challenges.ts`'s `GroupChallenge` (id, title, goal, member roster,
  challenge window), keyed by `id` with upsert-on-save semantics, mirroring
  the existing `sprintNotes.ts`/`coachingPrograms.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Reuses `GroupChallenge` from `group-challenges.ts`
  directly rather than redefining it. Vitest-covered (with an in-memory
  `localStorage` mock, since this package's Vitest environment is `node`
  with no DOM) in
  `packages/debate-card-search/test/groupChallenges.test.ts`. See the
  "Group Challenges" bullet under Research Crowdsourcing Organizer Features
  below (PR #97) — this is the "(c) persisting challenges" follow-up named
  in that slice. This is a config-persistence slice only — it stores a
  challenge's static config verbatim; a challenge's computed progress
  (`computeGroupChallengeProgress`, `GroupChallengeProgress`) stays
  session-derived from caller-supplied contributions/win events rather than
  being persisted, and no challenge-board/creation UI in this repo yet reads
  or writes through this store. Follow-ups: (a) a challenge-board/creation
  UI in `debate-card-search` that reads/writes through this store, (b)
  wiring real contribution-submission/practice-round-result events into
  `computeGroupChallengeProgress` instead of caller-supplied data, (c)
  notifying the squad when a persisted challenge completes.
  PR: [#113](https://github.com/debate/debate-ai.com/pull/113).
- **Judge Paradigm Selection Persistence — localStorage paradigm-per-round store.**
  `packages/debate-speech-writer/src/state/judgeParadigmSelections.ts` adds
  `listJudgeParadigmSelections`/`getJudgeParadigmSelection`/
  `saveJudgeParadigmSelection`/`deleteJudgeParadigmSelection`, a
  localStorage-backed CRUD store for a round's selected `JudgeParadigm`
  (`judge-paradigms.ts`), keyed by `roundId` with upsert-on-save semantics,
  mirroring the existing `opponentTeamProfiles.ts`/`coachMaterials.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). Stores the full
  `JudgeParadigm` object rather than just a builtin id, so a "custom"
  paradigm built with `buildCustomJudgeParadigm` persists too. See idea #5
  ("AI Judge Decision Modes") in Product Feature Ideas below — this is the
  "(c) persisting the selected paradigm per round" follow-up named in that
  slice. This is a persistence slice only — no paradigm-picker UI in this
  repo yet reads or writes through this store, and no AI judge-decision call
  looks up a round's persisted selection to build its prompt. Follow-ups:
  (a) a paradigm-picker UI that reads/writes through this store, (b) wiring
  a round's persisted selection into an actual AI judge-decision call via
  `buildJudgeParadigmPrompt`.
  PR: [#112](https://github.com/debate/debate-ai.com/pull/112).
- **Contribution Leaderboard Persistence — localStorage contribution store.**
  `packages/debate-card-search/src/state/contributions.ts` adds
  `listContributions`/`listContributionsByContributor`/`getContribution`/
  `saveContribution`/`deleteContribution`, a localStorage-backed CRUD store
  for `contribution-leaderboard.ts`'s `AttributedContribution` (a
  `community-rating.ts` `CommunityContribution` attributed to a
  `contributorId`), keyed by `id` with upsert-on-save semantics, mirroring
  the existing `sprintNotes.ts`/`peerReviews.ts`/`opponentTeamProfiles.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing).
  `listContributionsByContributor` reuses `contribution-leaderboard.ts`'s
  existing `groupContributionsByContributor` helper directly rather than
  reimplementing contributor-scoped filtering. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in
  `packages/debate-card-search/test/contributions.test.ts`. See the
  "Contribution Leaderboard" bullet under Research Crowdsourcing Organizer
  Features below — this is the "(a) wiring a `contributorId` into wherever
  contributions are eventually persisted" follow-up named in that slice.
  This is a persistence slice only — it stores whatever
  `AttributedContribution` a caller passes in verbatim (still built from
  caller-supplied like/save/quality/reviewer-endorsement signals, not wired
  to any real contribution-submission flow); no leaderboard UI in this repo
  yet reads or writes through this store, and `buildLeaderboard`/
  `buildContributorStats` still take a caller-supplied contribution list
  rather than reading through this store directly. Follow-ups: (a) wiring
  real like/save/endorse actions and a real submitted-contribution flow into
  `saveContribution`, (b) a leaderboard/ranked-feed UI that reads through
  this store and renders `buildLeaderboard`, (c) composing this store's
  reads directly into `buildLeaderboard`/`buildContributorStats` call sites
  once one exists, instead of requiring a caller-supplied list.
  PR: [#111](https://github.com/debate/debate-ai.com/pull/111).
- **Peer Review Persistence — localStorage review store.**
  `packages/debate-card-search/src/state/peerReviews.ts` adds
  `listPeerReviews`/`getPeerReview`/`savePeerReview`/`deletePeerReview`, a
  localStorage-backed CRUD store for `peer-review.ts`'s `CardReview`
  (status plus its full `ReviewComment` thread), keyed by `cardId` with
  upsert-on-save semantics, mirroring the existing
  `sprintNotes.ts`/`opponentTeamProfiles.ts`/`coachMaterials.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). Reuses `CardReview` from
  `peer-review.ts` directly rather than redefining it. Vitest-covered (with
  an in-memory `localStorage` mock, since this package's Vitest environment
  is `node` with no DOM) in
  `packages/debate-card-search/test/peerReviews.test.ts`. See the "Peer
  Review System" bullet under Research Crowdsourcing Organizer Features
  below — this is the "(a) persisting `CardReview`/`ReviewComment`
  alongside submitted cards" follow-up named in that slice. This is a
  persistence slice only — it stores whatever `CardReview` a caller passes
  in verbatim (still built from caller-supplied state-machine transitions,
  not wired to any real card-submission flow); no review-queue/comment-
  thread UI in this repo yet reads or writes through this store.
  Follow-ups: (a) a review-queue/comment-thread UI that reads/writes
  through this store, (b) reviewer identity/permission checks once
  auth/roles exist, (c) wiring a review's lifecycle to whatever eventually
  persists submitted cards, so `publishReview` can gate a card actually
  going live.
  PR: TBD.
- **Judge Profile Persistence — localStorage profile store.**
  `packages/debate-speech-writer/src/state/judgeProfiles.ts` adds
  `listJudgeProfiles`/`getJudgeProfile`/`saveJudgeProfile`/
  `deleteJudgeProfile`, a localStorage-backed CRUD store for
  `judge-profile.ts`'s `JudgeProfile`, keyed by `judgeId` with
  upsert-on-save semantics, mirroring the existing
  `coachMaterials.ts`/`opponentTeamProfiles.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). See the "Judge Profiles" bullet under Research
  Crowdsourcing Organizer Features below — this is the "(c)
  persisting/looking up profiles by judge across tournaments" follow-up
  named in that slice, mirroring the same follow-up already closed for
  Opponent Team Profiles (PR #108). This is a persistence slice only — it
  stores whatever `JudgeProfile` a caller passes in verbatim (still built
  from caller-supplied `JudgeRoundRecord`s, not a real ballot data source);
  no judge-profile card/panel UI in this repo yet reads or writes through
  this store. Vitest-covered (with an in-memory `localStorage` mock, since
  this package's Vitest environment is `node` with no DOM) in
  `packages/debate-speech-writer/test/judgeProfiles.test.ts`. Follow-ups:
  (a) a real ballot data source producing `JudgeRoundRecord`s so profiles
  reflect real ballots instead of caller-supplied data, (b) a
  judge-profile card/panel UI that renders `buildJudgeTendencySummary` for
  a profile read through this store, (c) wiring `buildPreRoundBriefing`
  (in `debate-round`) to look up a persisted profile here instead of
  requiring the caller to supply one.
  PR: [#109](https://github.com/debate/debate-ai.com/pull/109).
- **Opponent Team Profile Persistence — localStorage profile store.**
  `packages/debate-data-sync/src/state/opponentTeamProfiles.ts` adds
  `listOpponentTeamProfiles`/`getOpponentTeamProfile`/
  `saveOpponentTeamProfile`/`deleteOpponentTeamProfile`, a
  localStorage-backed CRUD store for `opponent-team-profile.ts`'s
  `OpponentTeamProfile`, keyed by `teamId` with upsert-on-save semantics,
  mirroring the existing `coachMaterials.ts`/`sprintNotes.ts` persistence
  convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
  empty list rather than throwing). This is the first localStorage-backed
  persistence store in the `debate-data-sync` package. Vitest-covered
  (with an in-memory `localStorage` mock, since this package's Vitest
  environment is `node` with no DOM) in
  `packages/debate-data-sync/test/opponentTeamProfiles.test.ts`. See the
  "Opponent Team Profiles" bullet under Research Crowdsourcing Organizer
  Features below — this is the "(c) persisting/looking up profiles by team
  across tournaments" follow-up named in that slice. This is a persistence
  slice only — it stores whatever `OpponentTeamProfile` a caller passes in
  verbatim (still built from caller-supplied `OpponentRoundRecord`s, not a
  real Tabroom/tab-service data source); no scouting-card or
  pre-round-briefing UI in this repo yet reads or writes through this
  store. Follow-ups: (a) a real round-history data source producing
  `OpponentRoundRecord`s so profiles reflect real pairings/ballots instead
  of caller-supplied data, (b) a scouting-card/panel UI that renders
  `buildOpponentScoutingSummary` for a profile read through this store,
  (c) wiring `buildPreRoundBriefing` (in `debate-round`) to look up a
  persisted profile here instead of requiring the caller to supply one.
  PR: [#108](https://github.com/debate/debate-ai.com/pull/108).
- **Coach Material Persistence — localStorage config store.**
  `packages/debate-speech-writer/src/state/coachMaterials.ts` adds
  `listCoachMaterials`/`getCoachMaterial`/`saveCoachMaterial`/
  `deleteCoachMaterial`, a localStorage-backed CRUD store for
  `team-coach-materials.ts`'s `CoachMaterial` (id, kind, title, topic, tags,
  text), keyed by `id` with upsert-on-save semantics, mirroring the existing
  `coachingPrograms.ts`/`prepNotes.ts`/`flowAnnotations.ts`/`sprintNotes.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). Reuses `CoachMaterial`
  from `team-coach-materials.ts` directly rather than redefining it.
  Vitest-covered (with an in-memory `localStorage` mock, since this
  package's Vitest environment is `node` with no DOM) in
  `packages/debate-speech-writer/test/coachMaterials.test.ts`. See the
  "Video-Lecture-Training Coach AI" idea (#8) in Product Feature Ideas
  below — this is the "(d) persisting a team's `CoachMaterial`s" follow-up
  named in that slice (PR #98). This is the first slice only — it persists
  whatever `CoachMaterial` a caller passes in verbatim; no UI in this repo
  yet uploads a material and threads it through `saveCoachMaterial`/
  `deleteCoachMaterial`, and it still doesn't transcribe recordings, parse
  uploaded documents, or call any AI model. Follow-ups: (a)
  transcription/parsing that turns an uploaded recording or document into a
  `CoachMaterial`'s `text`, (b) an actual AI Q&A call that consumes
  `buildGroundedCoachPrompt`'s output, (c) a materials-upload/coach chat
  panel UI that reads/writes through this store.
  PR: TBD.
- **Shared Evidence Library — fast keyword/tag/cite/topic search slice.**
  `packages/debate-card-search/src/lib/shared-evidence-library.ts` adds an
  `EvidenceLibraryEntry` model (extends the existing "Common Argument
  Library" slice's `LibraryCard` with a searchable full-text `text` body, a
  `cite`, and a `kind: "card" | "block"` distinguishing a cut/tagged
  evidence card from a team-drafted reusable analytic block) plus
  `searchEvidenceLibrary` (narrows by topic/case-area/kind/tags — reusing
  `argument-library.ts`'s `filterCardsByTags` directly — then, when a text
  query is given, ranks the remaining entries by keyword-overlap relevance
  against their combined text/argBlock/cite via the existing "LLM Card
  Scoring" slice's `scoreRelevance`, dropping zero-relevance entries rather
  than returning noise), `findEntriesByCite` (citation lookup),
  `buildEvidenceLibraryIndex` (a thin alias of `buildArgumentLibrary`, since
  an `EvidenceLibraryEntry` is already a `LibraryCard`), and
  `buildEvidenceSearchSummaryText`. Reuses `argument-library.ts` and
  `llm-card-scoring.ts` directly rather than introducing a separate
  grouping or relevance-scoring path. Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts`. See
  the "Shared Evidence Library" bullet under Research Crowdsourcing
  Organizer Features below. This is the first slice only — it works
  entirely off a caller-supplied entry list; it doesn't read real submitted
  cards or blocks, persist the repository, or render a search UI, and its
  keyword search is a deterministic overlap heuristic rather than a real
  full-text/fuzzy search index. Follow-ups: (a) wiring real submitted cards
  and team-drafted blocks into a persisted repository instead of
  caller-supplied entries, (b) a search panel UI in `debate-card-search`
  that renders `searchEvidenceLibrary`/`buildEvidenceSearchSummaryText`
  results and `buildEvidenceLibraryIndex`'s folders/collections, (c) a real
  search index (e.g. Typesense, mirroring the existing `search-query.ts`
  CARDS search) once entries are persisted, for relevance/typo-tolerance
  beyond the current keyword-overlap heuristic.
  PR: [#106](https://github.com/debate/debate-ai.com/pull/106).
- **Sprint Note Persistence — localStorage note store.**
  `packages/debate-card-search/src/state/sprintNotes.ts` adds
  `listSprintNotes`/`listSprintNotesForTopic`/`getSprintNote`/
  `saveSprintNote`/`deleteSprintNote`, a localStorage-backed CRUD store for
  `team-collaboration-mode.ts`'s `SprintNote` (id, topic, author, text,
  status, optional assignee), keyed by `id` with upsert-on-save semantics,
  mirroring the existing `debate-round` `prepNotes.ts`/`coachingPrograms.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). This is the first
  localStorage-backed persistence store in the `debate-card-search`
  package. `listSprintNotesForTopic` reuses `team-collaboration-mode.ts`'s
  existing `getNotesForTopic` query helper directly rather than
  reimplementing topic-scoped filtering/sorting. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in
  `packages/debate-card-search/test/sprintNotes.test.ts`. See the "Team
  Collaboration Mode" bullet under Research Crowdsourcing Organizer Features
  below — this is the "(a) persisting `SprintNote`s and a topic sprint's
  inputs somewhere" follow-up named in that slice. This is the first slice
  only — it persists whatever `SprintNote` a caller passes in verbatim; no
  UI in this repo yet calls `createSprintNote`/`updateSprintNoteStatus`/
  `assignSprintNote` and threads the result through
  `saveSprintNote`/`deleteSprintNote`, and a topic sprint's other inputs
  (quest templates, contributor availability) still aren't persisted.
  Follow-ups: (a) a collaboration-mode panel UI in `debate-card-search` that
  reads/writes through this store, (b) persisting a topic sprint's other
  inputs once they have a natural persisted shape, (c) a presence/live-status
  signal for who's currently active in the sprint.
  PR: [#105](https://github.com/debate/debate-ai.com/pull/105).
- **Flow Annotation Persistence — localStorage annotation store.**
  `packages/debate-round/src/state/flowAnnotations.ts` adds
  `listFlowAnnotations`/`listFlowAnnotationsForFlow`/
  `listFlowAnnotationsForSpeech`/`listFlowAnnotationsForBox`/
  `getFlowAnnotation`/`saveFlowAnnotation`/`deleteFlowAnnotation`, a
  localStorage-backed CRUD store for `flow-annotations.ts`'s
  `FlowAnnotation` (id, flow/box address, speech, playback timestamp,
  optional note), keyed by `id` with upsert-on-save semantics, mirroring
  the existing `prepNotes.ts`/`coachingPrograms.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). `listFlowAnnotationsForSpeech`/
  `listFlowAnnotationsForBox` reuse `flow-annotations.ts`'s existing
  `getAnnotationsForSpeech`/`getAnnotationsForBox` query helpers directly
  rather than reimplementing filtering/sorting. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in `packages/debate-round/test/flowAnnotations.test.ts`.
  See idea #15 below ("Flow-in-Speech Flow Annotations") — this is the "(c)
  persisting annotations alongside a `Round`/`Flow`" follow-up named in
  that slice. This is the first slice only — it persists whatever
  `FlowAnnotation` a caller passes in verbatim; no UI in this repo yet
  calls `createFlowAnnotation` and threads the result through
  `saveFlowAnnotation`/`deleteFlowAnnotation`. Follow-ups: (a) a
  video-player UI (`debate-videos`) that lets a viewer drop an annotation
  at the current playback position, persisted through this store, and jump
  back to one, (b) a flow-grid affordance (`FlowSpreadsheet`) that surfaces
  annotations on their box via `listFlowAnnotationsForBox` and links back
  to the timestamp.
  PR: [#104](https://github.com/debate/debate-ai.com/pull/104).
- **Shared Flow Sync — concurrent-edit merge and conflict-detection slice.**
  `packages/debate-round/src/flow/shared-flow-sync.ts` adds a `FlowEdit`
  model (one contributor's proposed edit to a single flow `Box`'s content,
  addressed via `boxPath` the same way `flow-annotations.ts`/
  `strategy-sync-notes.ts` already address boxes) plus `mergeFlowEdits`
  (reconciles every box's edits into one canonical value — last write wins,
  tie-broken by `id` — except when a box's latest edit and some other,
  different-author edit with different content land within a configurable
  `conflictWindowMs` of each other, in which case that box is left out of
  `merged` and reported in `conflicts` instead, so a teammate's genuinely
  concurrent work is surfaced for a human to resolve rather than silently
  overwritten), `applyMergedEditsToFlow` (immutably applies merged edits to
  a `Flow`'s boxes, skipping an edit whose `boxPath` no longer resolves
  rather than throwing, mirroring `resolveAnnotationBox`'s handling), and
  `buildSharedFlowSyncSummaryText`. See idea #16 below ("Shared,
  Ai-Generated Debate Flow"). This is the first slice only — it's pure
  merge logic over caller-supplied edits; there's no live transport (e.g.
  WebSocket) wiring contributors' edits together in real time, it isn't
  wired into `FlowSpreadsheet`, and it doesn't preload evidence cards into
  flow notes (the idea's "optionally preloading evidence cards" half).
  Vitest-covered (100% statement/branch/function/line coverage) in
  `packages/debate-round/test/shared-flow-sync.test.ts`. Follow-ups: (a) a
  live transport (WebSocket or similar) that turns local `FlowEdit`s into a
  shared stream across a room/team, (b) a `FlowSpreadsheet` affordance that
  applies `mergeFlowEdits`/`applyMergedEditsToFlow` and surfaces
  `conflicts` for a teammate to pick a winner, (c) composing
  `argument-library.ts`'s tagged card corpus to suggest a pre-filled flow
  note from matching evidence, keeping the human in control of whether to
  accept it.
  PR: [#103](https://github.com/debate/debate-ai.com/pull/103).
- **Prep Note Persistence — localStorage note store.**
  `packages/debate-round/src/state/prepNotes.ts` adds
  `listPrepNotes`/`listPrepNotesForFlow`/`getPrepNote`/`savePrepNote`/
  `deletePrepNote`, a localStorage-backed CRUD store for
  `strategy-sync-notes.ts`'s `PrepNote` (id, flow/box address, author, text,
  status, optional assignee), keyed by `id` with upsert-on-save semantics,
  mirroring the existing `coachingPrograms.ts`/`myTeamProfile.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). `listPrepNotesForFlow`
  reuses `strategy-sync-notes.ts`'s existing `getNotesForFlow` query helper
  directly rather than reimplementing flow-scoped filtering/sorting.
  Vitest-covered (with an in-memory `localStorage` mock, since this
  package's Vitest environment is `node` with no DOM) in
  `packages/debate-round/test/prepNotes.test.ts`. See the "Strategy Sync
  Notes" bullet under Research Crowdsourcing Organizer Features below — this
  is the "(a) wiring `PrepNote` into wherever round/flow state is eventually
  persisted" follow-up named in that slice. This is the first slice
  only — it persists whatever `PrepNote` a caller passes in verbatim; no UI
  in this repo yet calls `createPrepNote`/`updateNoteStatus`/`assignNote`
  and threads the result through `savePrepNote`/`deletePrepNote`. Follow-up
  (b), wiring `updateNoteStatus`/`assignNote`'s returned copies back into
  `savePrepNote`, is now done — see the "Prep Note Status/Assignment
  Persistence" entry above. Follow-ups: (a) a prep-notes panel UI in
  `debate-round` that reads/writes through this store, (b) an assignee
  notification once a notification system exists.
  PR: [#102](https://github.com/debate/debate-ai.com/pull/102).
- **Coaching Program Persistence — localStorage config store.**
  `packages/debate-round/src/state/coachingPrograms.ts` adds
  `listCoachingPrograms`/`getCoachingProgram`/`saveCoachingProgram`/
  `deleteCoachingProgram`, a localStorage-backed CRUD store for
  `coaching-program.ts`'s `CoachingProgramConfig` (id, name, squad roster),
  keyed by `id` with upsert-on-save semantics, mirroring the existing
  `myTeamProfile.ts` persistence convention (SSR/no-storage-safe, corrupt or
  missing JSON degrades to an empty list rather than throwing). Reuses
  `CoachingProgramConfig` from `coaching-program.ts` directly rather than
  redefining it. Vitest-covered (with an in-memory `localStorage` mock, since
  this package's Vitest environment is `node` with no DOM) in
  `packages/debate-round/test/coachingPrograms.test.ts`. See the "Coaching
  Programs and Group Challenges" idea (#13) in Product Feature Ideas below —
  this is the "(a) persisting a coaching program's config" half of the
  follow-up named in the `coaching-program.ts` slice (PR #99). This is the
  first slice only — it persists a program's *config* only, not its board's
  session-derived inputs (topic-sprint contributions, member flows,
  challenges, win events), and there's no UI reading or writing this store
  yet. Follow-ups: (a) a coaching-space dashboard UI that lists/creates/edits
  programs through this store, (b) wiring `buildCoachingProgramBoard`'s other
  inputs into their own persistence once those have a natural persisted
  shape (most are session-derived rather than static config).
  PR: [#101](https://github.com/debate/debate-ai.com/pull/101).
- **Tiered Task Routing — stats-derived skill-level composition slice.**
  `packages/debate-card-search/src/lib/tiered-task-routing.ts` adds
  `deriveContributorAvailability`/`deriveContributorAvailabilityList` (builds
  a `research-task-routing.ts` `ContributorAvailability` by deriving its
  `skillLevel` from a contributor's `contribution-leaderboard.ts`
  `ContributorStats` via `progress-unlocks.ts`'s
  `buildContributorUnlockStatus`/`getUnlockedSkillLevel`, instead of
  requiring a caller-supplied skill level — throwing if the supplied stats
  and task-load entries don't share a `contributorId`, and skipping a
  contributor with stats but no matching load entry rather than guessing a
  `maxConcurrentTasks` default) and `buildRoutingResultFromContributorStats`
  (composes that straight into the existing `buildTaskQueue`/`routeTasks`).
  This closes the exact gap both the "Progress Unlocks" and "Research Task
  Routing" ideas' own follow-ups named — `progress-unlocks.ts` could derive
  an unlocked skill level but nothing fed it into
  `research-task-routing.ts`'s `ContributorAvailability`. Reuses
  `progress-unlocks.ts` and `research-task-routing.ts` directly rather than
  introducing a separate skill-derivation or routing path. Vitest-covered in
  `packages/debate-card-search/test/tiered-task-routing.test.ts`. See the
  "Research Task Routing" and "Progress Unlocks" bullets under Research
  Crowdsourcing Organizer Features below. This is the first slice only — a
  contributor's `activeTaskCount`/`maxConcurrentTasks` still isn't tracked
  anywhere in this repo, so it remains caller-supplied; this only removes
  the need for a caller-supplied `skillLevel`. Follow-ups: (a) persisting a
  contributor's active-task count so `activeTaskCount` no longer needs to be
  caller-supplied either, (b) wiring `buildRoutingResultFromContributorStats`
  into a task-assignment/inbox UI once one exists, (c) reusing the same
  derive-then-route pattern once `research-task-routing.ts`'s task queue
  gains other skill-gated categories beyond coverage-gap tasks.
  PR: [#100](https://github.com/debate/debate-ai.com/pull/100).
- **Coaching Program Space — topic-sprint/group-challenge/member-drill composition slice.**
  `packages/debate-round/src/round/coaching-program.ts` adds a
  `CoachingProgramConfig` (id, name, squad roster) and
  `buildCoachingProgramBoard`, which composes `debate-card-search`'s
  `team-collaboration-mode.ts` `buildTopicSprint` (shared research sprint),
  `debate-card-search`'s `group-challenges.ts` `buildGroupChallengeBoard`
  (friendly-challenge standings), and this package's own
  `flow/drill-generator.ts` `buildDrillSet` (one practice-drill set per
  roster member who has a flowed practice round, ignoring flows for
  contributors outside the roster) into one renderable coaching-space board,
  plus `buildCoachingProgramSummaryText` and `buildMemberDrillSummaryText`.
  `debate-round` now depends on `debate-card-search` to make this
  composition possible, mirroring the existing precedent of
  `pre-round-briefing.ts` adding new cross-package dependencies. Reuses
  `buildTopicSprint`/`buildGroupChallengeBoard`/`buildDrillSet` directly
  rather than reimplementing any of their quest/challenge/drill logic.
  Vitest-covered in `packages/debate-round/test/coaching-program.test.ts`.
  See the "Coaching Programs and Group Challenges" idea (#13) in Product
  Feature Ideas below — this is the "coaching-program/space model" follow-up
  named in the Group Challenges slice (PR #97). This is the first slice
  only — it works entirely off caller-supplied topic-sprint/challenge/flow
  inputs; it doesn't persist a program, its roster, or its board anywhere,
  doesn't compose `practice-round-simulator.ts`'s
  `buildPracticeRoundSetup`/`buildPracticeRoundFeedback` (a practice round is
  per-member/per-session rather than a fixed part of a program's board), and
  doesn't render a coaching-space UI. Follow-ups: (a) persisting a
  `CoachingProgramConfig` and its board's inputs, (b) a coaching-space
  dashboard UI that renders `buildCoachingProgramBoard`/
  `buildCoachingProgramSummaryText`, (c) letting a coach start (and later
  review feedback from) a member's practice round from within the space by
  wiring in `buildPracticeRoundSetup`/`buildPracticeRoundFeedback`.
  PR: [#99](https://github.com/debate/debate-ai.com/pull/99).
- **Video-Lecture-Training Coach AI — grounding-materials library and
  grounded-prompt slice.**
  `packages/debate-speech-writer/src/coach/team-coach-materials.ts` adds a
  kind-grouped `CoachMaterial` library (`buildCoachMaterialLibrary` — lecture
  transcripts, camp materials, instructional documents, and practice-round
  recordings, in a stable, most-consulted-first order), a deterministic
  keyword-overlap relevance scorer (`scoreMaterialRelevance`/
  `findRelevantMaterials`, matching against a material's title, tags, and
  body text, optionally scoped by topic and capped by limit/threshold), and
  `buildGroundedCoachPrompt` — a self-contained prompt built from the most
  relevant materials that instructs a future AI Q&A call to answer only from
  the supplied grounding materials, mirroring the existing
  `opponent-personas.ts`/`judge-paradigms.ts` structured-prompt convention —
  plus `buildCoachMaterialLibrarySummaryText`. Vitest-covered (100%
  statement/branch coverage) in
  `packages/debate-speech-writer/test/team-coach-materials.test.ts`. See the
  "Video-Lecture-Training Coach AI" idea (#8) in Product Feature Ideas below.
  This is the first slice only — it doesn't transcribe recordings, parse
  uploaded documents, call any AI model, or persist a team's materials.
  Follow-ups: (a) transcription/parsing that turns an uploaded recording or
  document into a `CoachMaterial`'s `text`, (b) an actual AI Q&A call that
  consumes `buildGroundedCoachPrompt`'s output, (c) a materials-upload/coach
  chat panel UI, (d) persisting a team's `CoachMaterial`s.
  PR: [#98](https://github.com/debate/debate-ai.com/pull/98).
- **Group Challenges — squad-scoped friendly-challenge progress-tracking slice.**
  `packages/debate-card-search/src/lib/group-challenges.ts` adds a
  `GroupChallenge` model supporting two goal kinds — `contribution_target`
  (e.g. "the squad finds 20 solvency cards this week", reusing
  `daily-quests.ts`'s `QuestTarget` matching, exported as
  `matchesQuestTarget` for this reuse) and `win_target` (e.g. "the squad wins
  5 rebuttal exercises", from caller-supplied win events) — plus
  `computeGroupChallengeProgress` (scopes progress to the challenge's
  `[startsAt, endsAt)` window and `memberIds` roster, and ranks per-member
  standings by blended helpfulness score for contribution challenges via the
  existing `contribution-leaderboard.ts` `buildLeaderboard` — not raw count,
  so a member with fewer but higher-quality contributions can still lead —
  or by raw win count for win challenges), `buildGroupChallengeBoard`
  (incomplete challenges first, mirroring `buildDailyQuestBoard`'s
  ordering), and `buildGroupChallengeSummaryText`. Reuses
  `daily-quests.ts`/`contribution-leaderboard.ts` directly rather than
  introducing a separate matching or scoring path. Vitest-covered in
  `packages/debate-card-search/test/group-challenges.test.ts`. See the
  "Coaching Programs and Group Challenges" idea (#13) in Product Feature
  Ideas below. This is the first slice only — it's the "friendly challenges"
  half of idea #13 only; it doesn't model coaching "spaces"/rosters,
  assigned drills, research-sprint wiring, or a practice-round composition
  (the rest of idea #13), persist a challenge or its progress, notify the
  squad when a challenge completes, or render a challenge UI. Follow-ups:
  (a) a coaching-program/space model that composes this with
  `drill-generator.ts`'s `buildDrillSet`, `team-collaboration-mode.ts`'s
  `buildTopicSprint`, and `practice-round-simulator.ts`'s
  `buildPracticeRoundSetup`/`buildPracticeRoundFeedback`, (b) a
  challenge-board/creation UI in `debate-card-search`, (c) persisting
  challenges and wiring real contribution-submission/practice-round-result
  events into `computeGroupChallengeProgress` instead of caller-supplied
  data.
  PR: [#97](https://github.com/debate/debate-ai.com/pull/97).
- **Team Collaboration Mode — topic-sprint composition slice.**
  `packages/debate-card-search/src/lib/team-collaboration-mode.ts` adds
  `buildTopicSprint`/`buildTopicSprintSummaryText`, composing the existing
  "Daily Quests and Targets" board (`daily-quests.ts`'s
  `buildDailyQuestBoard`), "Research Task Routing" result
  (`research-task-routing.ts`'s `buildRoutingResult`), and "Research
  Progress Tracking" board (`research-progress.ts`'s
  `buildResearchProgressBoard`) into one shared, topic-scoped session (a
  "Topic Sprint"), plus a topic-addressed `SprintNote` model
  (`createSprintNote`/`updateSprintNoteStatus`/`assignSprintNote`/
  `getNotesForTopic`/`getNotesAssignedTo`/`getOpenFollowUps`) mirroring
  `debate-round`'s `strategy-sync-notes.ts` `PrepNote` lifecycle
  (open/covered/needs-follow-up, assignable as a task) — this package has no
  dependency on `debate-round`, so the box-addressed convention is mirrored
  locally with a topic in place of a flow box rather than introducing a
  separate note-status scheme. Reuses `daily-quests.ts`,
  `research-task-routing.ts`, and `research-progress.ts` directly rather
  than introducing a separate quest/assignment/progress signal.
  Vitest-covered (100% statement/branch/function/line coverage) in
  `packages/debate-card-search/test/team-collaboration-mode.test.ts`. See
  the "Team Collaboration Mode" bullet under Research Crowdsourcing
  Organizer Features below. This is the first slice only — it works
  entirely off caller-supplied quests/contributions/coverage
  reports/contributor availability/assignments/notes; it doesn't persist a
  sprint or its notes, track live/presence status for who's currently
  online, or render a collaboration-mode UI. Follow-ups: (a) persisting
  `SprintNote`s and a topic sprint's inputs (quest templates, contributor
  availability) somewhere, (b) a collaboration-mode panel UI that renders
  `buildTopicSprint`/`buildTopicSprintSummaryText` and calls
  `createSprintNote`/`updateSprintNoteStatus`/`assignSprintNote`, (c) a
  presence/live-status signal for who's currently active in the sprint.
  PR: [#96](https://github.com/debate/debate-ai.com/pull/96).
- **Team Brainstorm Assist — squad brainstorm prompt/board slice.**
  `packages/debate-card-search/src/lib/team-brainstorm-assist.ts` adds
  `buildBrainstormPrompt` (a structured, non-AI-calling brainstorm prompt for
  one argument block across four categories — `argument`, `impact_framing`,
  `frontline`, `response`), `buildBrainstormPromptsForCoverageGaps` (seeds
  prompts straight from the existing Topic Coverage Dashboard's
  `getUnderCoveredArguments`, worst-covered argument first), a squad idea
  board model (`groupIdeasByBoard`, `rankBrainstormIdeas` — reusing the
  existing `community-rating.ts` `scorePopularitySignal` for ranking and the
  existing `llm-card-scoring.ts` `scoreUniqueness` heuristic to flag
  near-duplicate submissions, `buildBrainstormBoard`,
  `buildBrainstormBoardsForCoverageGaps`), and `buildBrainstormSummaryText`.
  Reuses `topic-coverage.ts`, `community-rating.ts`, and `llm-card-scoring.ts`
  directly rather than introducing a separate coverage, popularity, or
  duplicate-detection signal. Vitest-covered (100% statement/branch/
  function/line coverage) in
  `packages/debate-card-search/test/team-brainstorm-assist.test.ts`. See the
  "Team Brainstorm Assist" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it doesn't call any AI
  model to actually generate ideas, persist a board or its submitted ideas,
  or render a brainstorm panel UI. Follow-ups: (a) an actual AI-generation
  call that consumes `buildBrainstormPrompt`'s output to draft candidate
  ideas for the squad to react to instead of starting from a blank board,
  (b) a brainstorm-panel UI in `debate-card-search` that renders
  `buildBrainstormBoard`/`buildBrainstormSummaryText` and lets teammates
  submit/upvote ideas live, (c) persisting submitted ideas and their votes.
  PR: [#95](https://github.com/debate/debate-ai.com/pull/95).
- **Practice Round Simulator — setup/post-round-feedback composition slice.**
  `packages/debate-round/src/round/practice-round-simulator.ts` adds
  `buildPracticeRoundSetup`/`buildPracticeRoundSetupText` (combines idea #3's
  `buildAiVersusSpeechOrder` speech order, `debate-speech-writer`'s
  `judgeParadigms` registry, and its `opponentPersonas` registry into one
  renderable practice-round setup document — accepting either a built-in
  paradigm/persona id or a pre-built one, e.g. from
  `buildCustomJudgeParadigm`) and `buildPracticeRoundFeedback`/
  `buildPracticeRoundFeedbackText` (frames post-round feedback around the
  selected judge paradigm's voting priorities — or its description when it
  has none, as with a custom paradigm — followed by the existing AI Coach
  Mode `buildCoachingSession`/`buildCoachingSummaryText`). Reuses
  `ai-versus-speech-order.ts`, `judge-paradigms.ts`, `opponent-personas.ts`,
  and `coach-mode.ts` directly rather than reimplementing any of that
  speech-order/paradigm/persona/coaching logic. Vitest-covered in
  `packages/debate-round/test/practice-round-simulator.test.ts`. See the
  "Practice Round Simulator" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it doesn't call any AI
  model to actually generate the AI opponent's speeches or a judge decision,
  isn't wired into any round-simulator UI, and doesn't persist a practice
  round anywhere. This repo has no `lint` script configured (only
  `typecheck`/`test`/`build` via turbo), so there was no lint step to run.
  Follow-ups: (a) an actual AI speech-generation call for the AI opponent's
  speeches (consuming idea #3's `buildAiResponseRequest` alongside the
  chosen `opponentPersona`) and an AI judge-decision call under the chosen
  paradigm, (b) a round-simulator UI in `debate-round` that renders
  `buildPracticeRoundSetupText` for setup and `buildPracticeRoundFeedbackText`
  after the round, (c) persisting a simulated practice round (setup,
  submitted speeches, and feedback) once round-state persistence exists.
  PR: [#94](https://github.com/debate/debate-ai.com/pull/94).
- **AI Coach Mode — extension/refutation/collapse/weighing coaching-prompt slice.**
  `packages/debate-round/src/flow/coach-mode.ts` adds
  `buildExtensionPrompts` (unanswered rows whose last flowed entry is on the
  caller's own side — their last word stands, so extend it as
  dropped/conceded), `buildRefutationPrompts` (unanswered rows whose last
  flowed entry is on the opposing side — must be answered before it's
  extended against the caller), `buildCollapsePrompts` (a thin remap of the
  existing `drill-generator.ts` `buildCollapseDrills`), `buildWeighingGuidance`
  (a whole-round weighing prompt comparing the caller's side against every
  other side via `response-outcome.ts`'s `summarizeOutcomeBySide` — ahead on
  both unanswered count and average vulnerability is framed as "weigh on your
  uncontested offense", behind on either is framed as a warning to shore up
  the case first), `buildCoachingSession` (combines all four, refutation
  first since live threats need an answer before anything else), and
  `buildCoachingSummaryText`. Reuses `flow-transcript-summary.ts`,
  `response-outcome.ts`, `argument-tree.ts`'s `getSpeechSideKey`, and
  `drill-generator.ts`'s `buildCollapseDrills` directly rather than
  reimplementing any of that vulnerability/side-classification logic.
  Vitest-covered in `packages/debate-round/test/coach-mode.test.ts`. See the
  "AI Coach Mode" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it's a deterministic template layer
  over the flow's existing clash/vulnerability signals (the same heuristic
  `response-outcome.ts` and `drill-generator.ts` already use), not an actual
  AI-generated coaching call; it isn't wired into any coaching-panel UI, and
  generated sessions aren't persisted anywhere. This repo has no `lint`
  script configured (only `typecheck`/`test`/`build` via turbo), so there was
  no lint step to run. Follow-ups: (a) an actual AI coaching call (live or
  post-round) that consumes the same flow signals for open-ended feedback
  beyond this template layer, (b) a coaching-panel UI in `debate-round` that
  renders `buildCoachingSession`/`buildCoachingSummaryText`, (c) persisting a
  generated coaching session per round.
  PR: [#92](https://github.com/debate/debate-ai.com/pull/92).
- **Strategy Sync Notes — box-addressed prep-note/task-assignment/status slice.**
  `packages/debate-round/src/flow/strategy-sync-notes.ts` adds a `PrepNote`
  data model addressed to a specific flow `Box` the same way
  `flow-annotations.ts` already addresses boxes (`boxPath`/`boxFromPath`):
  `createPrepNote` (validates a non-empty `boxPath`, an `authorId`, and
  non-blank, length-clamped `text`, starting in the `open` status),
  `updateNoteStatus` (moves a note between `open`/`covered`/
  `needs-follow-up`), `assignNote` (assigns — or unassigns, passing `null`
  — a note to a teammate as a task), `getNotesForBox`/`getNotesForFlow`/
  `getNotesAssignedTo`/`getOpenFollowUps` (oldest-first query helpers, so
  the longest-open follow-up surfaces first), `resolvePrepNoteBox` (mirrors
  `resolveAnnotationBox` for a "jump to argument" link), and
  `buildPrepNoteSummaryText` (a status-count line plus one line per open
  follow-up, with its assignee if any). Mirrors `flow-annotations.ts`'s
  box-addressing convention exactly rather than introducing a separate
  argument-addressing scheme. Vitest-covered in
  `packages/debate-round/test/strategy-sync-notes.test.ts`. See the
  "Strategy Sync Notes" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it's pure data-model/query
  logic over caller-supplied notes; nothing in this repo persists a
  `PrepNote`, notifies an assignee when a task is assigned, or renders a
  prep-notes panel UI yet. Follow-ups: (a) wiring `PrepNote` into wherever
  round/flow state is eventually persisted, (b) a prep-notes panel UI in
  `debate-round` (likely alongside `FlowSpreadsheet`) that renders
  `getNotesForFlow`/`buildPrepNoteSummaryText` and calls
  `createPrepNote`/`updateNoteStatus`/`assignNote`, (c) an assignee
  notification once a notification system exists in this repo.
  PR: TBD.
- **Scout-to-Strategy Workflow — case-choice/judge-adaptation/risk-level recommendation slice.**
  `packages/debate-round/src/round/scout-to-strategy.ts` adds
  `computeCaseOverlapScore`/`rankCaseOptions` (ranks caller-supplied case
  options by tag overlap against the opponent's existing `OpponentTeamProfile`
  `topArgumentTags` — a heuristic proxy for "the opponent likely has blocks
  prepped against this" — safest/lowest-overlap first, tie-broken
  alphabetically), `buildJudgeAdaptationNotes` (turns an existing
  `JudgeProfile`'s speed tolerance, theory receptiveness, side bias, and
  most-tagged paradigm into concrete adaptation notes, with explicit
  fallback text when there's no judge data or no notable tendencies),
  `assessMatchupRisk` (combines opponent win rate/side preference and judge
  side bias into a `low`/`medium`/`high` risk level plus the specific
  factors behind it — one risk factor is `medium`, two or more is `high`),
  and `buildStrategyRecommendation`/`buildStrategyRecommendationText`
  (compose all of the above into one renderable recommendation). Mirrors the
  existing `pre-round-briefing.ts` pattern in the same package and reuses
  the existing `OpponentTeamProfile` (`debate-data-sync`)/`JudgeProfile`
  (`debate-speech-writer`) types directly rather than introducing new ones.
  Vitest-covered (100% statement/branch/function/line coverage) in
  `packages/debate-round/test/scout-to-strategy.test.ts`. See the
  "Scout-to-Strategy Workflow" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — the risk/case-overlap
  heuristics are illustrative, not a validated strategic model; it doesn't
  know which side the opponent will be on this round (no `ourSide`/opponent
  side input is wired into the risk heuristic yet), it doesn't call any AI
  model to evaluate case choice, and it isn't wired into any strategy-panel
  UI yet. This repo has no `lint` script configured (only
  `typecheck`/`test`/`build` via turbo), so there was no lint step to run.
  Follow-ups: (a) a case-choice/strategy panel UI in `debate-round` that
  renders `buildStrategyRecommendation`/`buildStrategyRecommendationText`,
  (b) wiring `ourSide`/likely opponent side into the risk heuristic once
  round-setup state exposes it, (c) an actual AI-panel evaluation of case
  choice instead of the tag-overlap heuristic.
  PR: [#90](https://github.com/debate/debate-ai.com/pull/90).
- **AI Practice Opponent — policy-heavy/kritik/lay/fast-flow persona registry slice.**
  `packages/debate-speech-writer/src/opponent/opponent-personas.ts` adds a
  `opponentPersonas` registry of four built-in styles (`policy-heavy`,
  `kritik`, `lay`, `fast-flow`), each with a name/description, pace, ordered
  `preferredArguments`, and imperative `instructions`, plus
  `getOpponentPersona`/`listOpponentPersonas` lookups and
  `buildOpponentPersonaPrompt` for composing a self-contained prompt section.
  Mirrors the existing `judge-paradigms.ts` registry shape exactly rather
  than introducing a separate persona-definition pattern. Vitest-covered
  (100% statement/branch/function/line coverage) in
  `packages/debate-speech-writer/test/opponent-personas.test.ts`. See the "AI
  Practice Opponent" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it doesn't call any AI model, isn't
  wired into idea #3's `buildAiResponseRequest`/`AiSpeechRequest` (which
  lives in `debate-round` and can't import from `debate-speech-writer`
  without inverting the existing dependency direction), and isn't rendered
  in any persona-picker UI. Follow-ups: (a) an actual AI speech-generation
  call that consumes `buildOpponentPersonaPrompt`'s output alongside idea
  #3's `AiSpeechRequest` to produce a persona-styled opponent speech, (b) a
  persona-picker UI for selecting an opponent style before starting an
  AI-versus practice round. (c), persisting the selected persona per
  practice session, is now done — see "Opponent Persona Selection
  Persistence" above.
  PR: TBD.
- **AI Drill Generator — overview/frontline/cross-ex/collapse drill slice.**
  `packages/debate-round/src/flow/drill-generator.ts` adds `buildOverviewDrill`
  (a whole-round overview prompt weighing every side's unanswered-argument
  count and average vulnerability), `buildFrontlineDrills` (a
  frontline-practice prompt per still-live opposing argument), `buildCrossExamDrills`
  (wraps the existing `flow-transcript-summary.ts` `suggestCrossExamQuestions`
  as tagged drills), `buildCollapseDrills` (recommends the opposing side's
  top-N most vulnerable arguments, via the existing `response-outcome.ts`
  `getArgumentVulnerabilityReport`, as collapse-scenario candidates),
  `buildDrillSet` (combines all four in order for a chosen side), and
  `buildDrillSummaryText`. Reuses the existing `flow-transcript-summary.ts`
  and `response-outcome.ts` slices directly rather than introducing a
  separate scoring or template path. Vitest-covered (100% statement/branch/
  function/line coverage) in
  `packages/debate-round/test/drill-generator.test.ts`. See the "AI Drill
  Generator" bullet under Research Crowdsourcing Organizer Features below.
  This is the first slice only — it's a deterministic template layer over
  the flow's existing clash/vulnerability signals, not an actual AI-generated
  drill script; it isn't wired into any drill-panel UI, and generated drills
  aren't persisted anywhere. Follow-ups: (a) an actual drill-panel UI in
  `debate-round` that renders `buildDrillSet`/`buildDrillSummaryText`, (b) an
  AI-generated (rather than templated) overview/frontline script once an LLM
  call is wired in, (c) persisting generated drills per round/practice
  session.
  PR: [#88](https://github.com/debate/debate-ai.com/pull/88).
- **Common Argument Library — topic-folder/case-area/tag-collection organizing slice.**
  `packages/debate-card-search/src/lib/argument-library.ts` adds
  `groupCardsByTopic`, `groupCardsByCaseArea`, `buildTopicFolder` (splits one
  topic's cards into case-area subgroups), `buildTopicFolders` (a folder for
  every topic represented), `buildTagCollections` (a cross-cutting
  collection for every distinct tag, with multi-tag cards appearing under
  each of their tags), `filterCardsByTags` (any/all tag matching),
  `buildArgumentLibrary`, and `buildLibrarySummaryText`. Extends the
  existing "Topic Coverage Dashboard" slice's `argBlock`-tagged
  `CoverageCardSummary` card model with `topic`/`caseArea`/`tags` rather than
  introducing a separate card shape. Vitest-covered in
  `packages/debate-card-search/test/argument-library.test.ts`. See the
  "Common Argument Library" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off a
  caller-supplied, already-tagged card list; it doesn't read real submitted
  cards, persist a library's structure, or render a folder/collection
  browser UI. Follow-ups: (a) wiring a `topic`/`caseArea`/`tags` field into
  wherever submitted cards are eventually persisted, (b) a folder/collection
  browser UI in `debate-card-search` that renders `buildArgumentLibrary`'s
  topic folders and tag collections, (c) a tag-autocomplete/tag-management
  affordance so contributors pick from existing tags instead of free typing.
  PR: TBD.

- **Gamified Quests — streak tracking and milestone-badge slice.**
  `packages/debate-card-search/src/lib/gamified-quests.ts` adds
  `computeDailyMissionResult` (derives whether a day's `daily-quests.ts`
  `QuestProgress` board was fully completed), `computeStreakStatus`
  (current streak walking backward from a caller-supplied "as of" UTC day
  key, plus the longest streak found anywhere in the supplied history),
  `getEarnedStreakBadges` (milestone badges — 3/7/14/30-day streaks by
  default — earned at a given streak length), `buildContributorQuestStreak`,
  and `buildStreakSummaryText`. Reuses `daily-quests.ts`'s `QuestProgress`
  board directly as the per-day completion signal rather than introducing a
  separate mission-tracking data model. Vitest-covered in
  `packages/debate-card-search/test/gamified-quests.test.ts`. See the
  "Gamified Quests" bullet under Research Crowdsourcing Organizer Features
  below — the "Daily Quests and Targets", "Progress Unlocks", and "Revision
  Incentives" slices all named this as a follow-up. This is the first slice
  only — it works entirely off caller-supplied daily mission-completion
  history; it doesn't wire in real contribution-submission events, persist a
  contributor's streak/badges anywhere, or render a streak/badge UI.
  Follow-ups: (a) wiring the existing `daily-quests.ts` board (fed by real
  persisted daily contributions) into `computeDailyMissionResult` per
  contributor per day instead of caller-supplied results, (b) a streak/badge
  widget UI that renders `buildContributorQuestStreak`/
  `buildStreakSummaryText` alongside the quest board, (c) surfacing earned
  streak badges on a contributor's `progress-unlocks.ts` unlock status
  alongside their tier badges.
  PR: TBD.

- **Daily Quests and Targets — per-day quest progress tracking slice.**
  `packages/debate-card-search/src/lib/daily-quests.ts` adds
  `computeQuestProgress` (tallies a day's contributions matching a quest's
  kind/argument-block target against its target count),
  `buildDailyQuestBoard` (progress for every quest on the UTC calendar day
  of a caller-supplied `now`, incomplete quests first), `buildQuestBoardSummaryText`,
  and `buildUnderCoveredArgumentQuests` (turns the existing "Topic Coverage
  Dashboard" slice's `getUnderCoveredArguments` output into a ready-made
  "find N more cards for X" quest per under-covered tracked argument).
  Reuses `topic-coverage.ts`'s coverage classification and
  `daily-best-card.ts`'s `getUtcDayKey` directly rather than introducing a
  separate under-coverage or day-scoping signal. Vitest-covered in
  `packages/debate-card-search/test/daily-quests.test.ts`. See the "Daily
  Quests and Targets" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off
  caller-supplied quest templates and contributions; it doesn't track
  streaks (a separate "Gamified Quests" idea), persist quest completion
  anywhere, or render a quest board UI. Follow-ups: (a) wiring real
  contribution-submission events into a persisted daily contribution feed
  instead of caller-supplied data, (b) a quest-board widget UI that renders
  `buildDailyQuestBoard`/`buildQuestBoardSummaryText`, (c) a streak/reward
  layer on top of quest completion once the "Gamified Quests" idea's own
  first slice exists.
  PR: [#84](https://github.com/debate/debate-ai.com/pull/84).

- **LLM Card Scoring — deterministic heuristic scoring slice.**
  `packages/debate-card-search/src/lib/llm-card-scoring.ts` adds
  `scoreRelevance` (keyword/phrase overlap against a card's argument
  block), `scoreClarity` (average-sentence-length balance), `scoreUniqueness`
  (Jaccard token similarity against the rest of the corpus), `scoreEvidenceQuality`
  (a direct alias of the existing idea #11 `community-rating.ts`
  `scoreQualitySignal`), `scoreUsability` (word-count target band),
  `computeCardScoreBreakdown` (blends all five into a weighted overall
  score and flags likely duplicates), `rankCardScores`, and
  `buildCardScoreSummaryText`. Reuses `scoreQualitySignal` directly rather
  than introducing a separate quality-scoring path. Vitest-covered in
  `packages/debate-card-search/test/llm-card-scoring.test.ts`. See the "LLM
  Card Scoring" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it's a deterministic heuristic
  stand-in for an eventual LLM call, not the LLM call itself; it doesn't
  call any model, persist scores, or render a scoring UI. Follow-ups: (a)
  an actual LLM-scoring call for the more subjective dimensions (clarity,
  usability) that a heuristic can only roughly proxy, (b) wiring real
  argument-block keywords and a real submitted-card corpus into the
  scorer instead of caller-supplied data, (c) a scoring/duplicate-flag
  panel UI in `debate-card-search` that renders `rankCardScores` and
  surfaces `isLikelyDuplicate` cards for moderator review.

- **Research Progress Tracking — per-contributor topic/task/contribution progress slice.**
  `packages/debate-card-search/src/lib/research-progress.ts` adds
  `buildContributorProgress` (combines a contributor's existing
  `contribution-leaderboard.ts` `ContributorStats` with per-topic task
  completion derived from a caller-supplied, topic-tagged
  `research-task-routing.ts` `RoutedAssignment` list), `buildTopicProgress`
  (assigned/completed counts and a completion rate for one topic),
  `groupAssignmentsByContributor`, `buildResearchProgressBoard` (a full,
  roster-sorted board across every contributor found in either the
  contribution or assignment lists), and `buildProgressSummaryText`. Reuses
  the existing `ContributorStats`/`RoutedAssignment` types directly rather
  than introducing a separate scoring or assignment path. Vitest-covered in
  `packages/debate-card-search/test/research-progress.test.ts`. See the
  "Research Progress Tracking" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off
  caller-supplied contributions and a caller-supplied, topic-tagged
  assignment list with a caller-supplied completion timestamp; it doesn't
  track task completion itself (no task system exists in this repo today),
  persist a contributor's progress, or render a progress-tracking UI.
  Follow-ups: (a) wiring real `completedAt` events into a persisted
  assignment/completion history, (b) a progress dashboard/roster UI that
  renders `buildResearchProgressBoard`/`buildProgressSummaryText`, (c)
  feeding a contributor's actual topic-progress history back into
  `progress-unlocks.ts`'s tier computation instead of raw leaderboard stats
  alone.

- **Progress Unlocks — contributor tier/skill/badge scoring slice.**
  `packages/debate-card-search/src/lib/progress-unlocks.ts` adds
  `computeContributorTier` (maps the existing `contribution-leaderboard.ts`
  `ContributorStats` — contribution count and total helpfulness score — to
  an unlock tier: `novice` → `apprentice` → `veteran` → `expert`, gated on
  clearing both a volume and a quality threshold per tier),
  `getUnlockedSkillLevel` (maps a tier to the `research-task-routing.ts`
  `SkillLevel` it grants for taking on routed research tasks — `novice`
  through `veteran` unlock `novice`/`intermediate`, `expert` unlocks
  `advanced`), `getUnlockedBadges` (every badge earned on the way to a
  tier, cumulative), and `buildContributorUnlockStatus`/
  `buildUnlockStatusText` (combine tier, unlocked skill level, badges, and
  progress toward the next tier into a renderable status). Reuses the
  existing `ContributorStats`/`SkillLevel` types directly rather than
  introducing a separate scoring or skill-tagging path. Vitest-covered in
  `packages/debate-card-search/test/progress-unlocks.test.ts`. See the
  "Progress Unlocks" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it works entirely off a
  caller-supplied `ContributorStats`; it doesn't persist a contributor's
  tier/badges, gate any actual UI or task list, or feed the derived
  `SkillLevel` into `research-task-routing.ts`'s `ContributorAvailability`
  itself. Follow-ups: (a) persisting a contributor's tier/badges, (b) a
  progress/unlock UI that renders `buildUnlockStatusText`/
  `buildContributorUnlockStatus`, (c) feeding `getUnlockedSkillLevel` into
  `research-task-routing.ts`'s `ContributorAvailability.skillLevel` instead
  of a caller-supplied value.
  PR: [#80](https://github.com/debate/debate-ai.com/pull/80).
- **Revision Incentives — card-revision reward scoring slice.**
  `packages/debate-card-search/src/lib/revision-incentives.ts` adds
  `evaluateRevision` (scores a before/after card snapshot pair — reusing the
  existing idea #11 `community-rating.ts` `scoreQualitySignal` to measure
  quality gain, doubling the quality-point reward when the card was weak
  beforehand, plus flat bonuses for a meaningful citation-completeness gain
  or citing newer evidence than the prior snapshot), `groupRevisionsByContributor`,
  `buildContributorRevisionStats` (per-contributor revision count, rewarded
  count, total reward points, and weak-cards-improved count), `buildRevisionIncentiveLeaderboard`
  (ranks contributors by total reward points, tie-broken by `contributorId`),
  and `buildRevisionRewardText` (renders a one-line reward notification, or a
  no-reward line when nothing meaningful improved). Reuses the existing idea
  #11 quality scoring directly rather than introducing a separate quality
  metric. Vitest-covered in
  `packages/debate-card-search/test/revision-incentives.test.ts`. See the
  "Revision Incentives" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off
  caller-supplied before/after card snapshots; it doesn't track card
  revision history itself (no such history exists in this repo today),
  persist reward points, or render an incentives UI. Follow-ups: (a) wiring
  actual card-edit events into a persisted `CardRevision` history, (b) a
  reward-notification/incentives-leaderboard UI in `debate-card-search`
  that renders `buildRevisionRewardText`/`buildRevisionIncentiveLeaderboard`,
  (c) an actual "outdated evidence" staleness signal (e.g. flagging cards
  whose `evidenceYear` has fallen behind a topic's current cycle) instead of
  only rewarding a refresh after the fact.
  PR: [#79](https://github.com/debate/debate-ai.com/pull/79).
- **Research Task Routing — coverage-gap-to-contributor routing slice.**
  `packages/debate-card-search/src/lib/research-task-routing.ts` adds
  `buildTaskQueue` (turns a topic-coverage report's under-covered arguments
  — via the existing `topic-coverage.ts` `getUnderCoveredArguments` — into a
  queue of research tasks, most urgent first, each tagged with a required
  skill level: `missing` arguments need at least `intermediate` skill to
  build coverage from scratch, `thin` arguments are open to any skill
  level), `routeTasks` (assigns the queue to caller-supplied contributors,
  gating each task by required skill and remaining capacity, and routing to
  whichever eligible contributor currently has the fewest active tasks —
  updated as assignments happen within the same call — tie-broken by
  `contributorId`, leaving a task in `unassignedTasks` rather than dropping
  it when nobody qualifies or has capacity), `buildRoutingResult` (a
  build-then-route convenience wrapper), and `buildRoutingSummaryText`
  (renders one line per assignment plus an unassigned-count line for a
  task-assignment view). Reuses the existing "Topic Coverage Dashboard"
  slice directly rather than introducing a separate gap-detection path.
  Vitest-covered in
  `packages/debate-card-search/test/research-task-routing.test.ts`. A third
  slice, `contributorAvailability.ts` (see Tracker Status above, "Research
  Task Routing — persisted contributor-availability profiles"), now
  persists a contributor's `ContributorAvailability` to localStorage. See
  the "Research Task Routing" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off a
  caller-supplied `TopicCoverageReport` and a caller-supplied contributor
  list; it doesn't track contributors' skill levels or active task counts
  itself (neither exists in this repo today), and it isn't wired into any
  task-assignment UI yet. Follow-ups: (a) a persisted contributor profile
  (skill level, active task count) and a persisted task queue, neither of
  which exist in this repo today, (b) a task-assignment/inbox UI in
  `debate-card-search` that renders `buildRoutingSummaryText`/assignments
  and lets a contributor accept or complete a routed task, (c) an
  actual-skill-level signal (e.g. derived from the `Contribution
  Leaderboard`/`community-rating.ts` history) instead of a caller-supplied
  `skillLevel`.
  PR: [#78](https://github.com/debate/debate-ai.com/pull/78).
- **Top Contributor Awards — per-category award selection slice.**
  `packages/debate-card-search/src/lib/contributor-awards.ts` adds
  `groupContributionsByKind` (groups caller-supplied, contributor-attributed
  contributions by their `ContributionKind`), `buildCategoryLeaderboard` (a
  thin wrapper over the existing `contribution-leaderboard.ts`
  `buildLeaderboard` for one kind's contributions), `buildTopContributorAwards`
  (selects one category winner per `ContributionKind` present in the input —
  the contributor with the highest total helpfulness score for that kind,
  tie-broken by `contributorId` — in a stable `card`/`summary`/`highlight`/
  `annotation` order, omitting kinds with no contributions), and
  `buildAwardsAnnouncementText` (renders one human-readable announcement
  line per award for a banner or notification). Reuses the existing idea
  #11 `community-rating.ts` helpfulness scoring via `contribution-leaderboard.ts`
  rather than introducing a separate scoring path. Vitest-covered in
  `packages/debate-card-search/test/contributor-awards.test.ts`. See the
  "Top Contributor Awards" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — the only award categories
  it can produce today are the ones `ContributionKind` already distinguishes
  ("card" → Best Evidence Finder, "summary" → Best Explainer, plus
  "highlight" and "annotation"); it doesn't have a distinct kind for
  "original argument" or "refutation" contributions (neither exists in this
  repo today), and it doesn't persist, schedule, or render an awards
  announcement. Follow-ups: (a) a finer-grained `ContributionKind` (or
  separate tag) for "original argument"/"refutation" contributions, (b) a
  scheduled job that periodically calls `buildTopContributorAwards` and
  persists/announces the winners, (c) an awards UI in `debate-card-search`
  that renders `buildAwardsAnnouncementText`.
  PR: [#77](https://github.com/debate/debate-ai.com/pull/77).
- **Top Contributor Awards — awards UI panel.**
  `packages/debate-card-search/src/panels/ContributorAwardsPanel.tsx` adds a
  full-page React panel rendering one card per `ContributionKind` category
  present among persisted contributions — the winning contributor, their
  contribution count, and their total helpfulness score for that category —
  reusing `buildTopContributorAwards` directly (no new scoring/grouping
  logic). It's mounted at `/cards/awards`
  (`apps/debate-ai.com/app/cards/awards/page.tsx`, with a back-link to
  `/cards`, following the existing panel-page convention) and reachable from
  the global nav dock's Settings menu ("Contributor Awards", via a new
  `Medal`-icon `DropdownMenuItem` in `CategoryDock.tsx`). Adds one new
  composing function, `buildTopContributorAwardsFromStore`
  (`packages/debate-card-search/src/state/contributions.ts`), which runs
  `buildTopContributorAwards` directly against every persisted contribution
  in `state/contributions.ts` rather than requiring a caller-supplied
  contribution list, mirroring that file's existing
  `buildPersistedLeaderboard`/`buildPersistedContributionFeed` "compose the
  pure function directly against the persisted store" convention. This
  closes follow-up (c) named under the "Top Contributor Awards" bullet in
  Research Crowdsourcing Organizer Features below. Follow-ups (a) a
  finer-grained kind/tag for "original argument"/"refutation" contributions
  and (b) a scheduled announce job remain open — neither is started.
  Vitest-covered in `packages/debate-card-search/test/contributions.test.ts`.
  Documented in `docs/features/contributor-awards.md`.
- **Topic Coverage Dashboard — per-argument coverage aggregation slice.**
  `packages/debate-card-search/src/lib/topic-coverage.ts` adds
  `groupCardsByArgument` (groups caller-supplied cards by their `argBlock`),
  `computeArgumentCoverage` (classifies one argument block as `missing`
  (zero cards), `thin` (below configurable card-count/word-count
  thresholds), or `covered`), `buildTopicCoverageReport` (builds coverage
  for every argument in a caller-supplied tracked list — even ones with
  zero submitted cards — plus a separate `untracked` list for any argument
  block cards were filed under that isn't on the tracked list, so an
  unplanned-but-covered argument or a typo'd block name isn't silently
  dropped), `getUnderCoveredArguments` (the tracked arguments still needing
  work, worst-covered first), and `buildTopicCoverageSummaryText` (a short
  dashboard-header summary line). Vitest-covered in
  `packages/debate-card-search/test/topic-coverage.test.ts`. See the "Topic
  Coverage Dashboard" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off a
  caller-supplied card list and a caller-supplied tracked-argument list; it
  doesn't read real submitted cards or a topic's argument checklist from
  anywhere (neither exists in this repo today), and it isn't wired into any
  dashboard UI yet. Follow-ups: (a) an `argBlock`/word-count field wired
  into wherever submitted cards are eventually persisted, (b) a
  team-editable tracked-argument checklist per topic (no topic/checklist
  schema exists in this repo today), (c) a coverage dashboard UI in
  `debate-card-search` that renders `buildTopicCoverageReport`/
  `getUnderCoveredArguments`. None of these are started.
  PR: [#76](https://github.com/debate/debate-ai.com/pull/76).
- **Daily Best Card Challenge — daily-winner selection slice.**
  `packages/debate-card-search/src/lib/daily-best-card.ts` adds
  `groupCardsByDay` (groups caller-supplied, timestamped card contributions
  by their UTC calendar day of submission), `pickBestCardOfDay` (scores a
  single day's cards via the existing `community-rating.ts`
  `computeHelpfulnessBreakdown` and returns the single highest-helpfulness
  card, tie-broken by id), `buildDailyBestCards` (batch-builds one winner
  per represented day, sorted ascending), `getBestCardForDay` (a
  caller-supplied-`now` convenience wrapper for "today's" winner, or `null`
  if nothing was submitted that day), and `buildDailyBestCardHighlight`
  (renders a short highlight line for a challenge banner/widget). A card's
  community "vote" reuses the existing likes/saves signal already scored by
  `computeHelpfulnessBreakdown` rather than introducing a separate voting
  mechanism. Vitest-covered in
  `packages/debate-card-search/test/daily-best-card.test.ts`. See the
  "Daily Best Card Challenge" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off
  already-collected, caller-supplied contributions; it doesn't track
  submission timestamps itself, persist a day's winner, or render a
  challenge banner/widget UI. Follow-ups: (a) wiring a `submittedAt`
  timestamp into wherever card contributions are eventually persisted, (b)
  a scheduled job or view that calls `getBestCardForDay`/`buildDailyBestCards`
  and persists/announces the day's winner, (c) a challenge banner/widget UI
  in `debate-card-search` that renders `buildDailyBestCardHighlight`. None
  of these are started.
  PR: [#74](https://github.com/debate/debate-ai.com/pull/74).
- **Peer Review System — card review lifecycle slice.**
  `packages/debate-card-search/src/lib/peer-review.ts` adds a `CardReview`
  state machine (`draft` → `in_review` → `changes_requested`/`approved`/
  `rejected` → `published`) plus a reviewer-comment thread on top of it:
  `createCardReview`, `submitForReview`, `requestChanges`, `approveReview`,
  `rejectReview`, and `publishReview` enforce only the documented legal
  transitions (throwing `InvalidReviewTransitionError` otherwise), while
  `addReviewComment` (auto-moves an in-review card to `changes_requested`
  when a `blocking`-severity comment is posted), `resolveReviewComment`,
  `getUnresolvedBlockingComments`, and `isReadyToPublish` model the
  comment thread — `approveReview` throws `UnresolvedBlockingCommentsError`
  if any blocking comment is still unresolved, so approval can't skip past
  requested changes. `buildReviewSummary` renders a short status/comment-count
  string for a review-queue or card-detail panel. Vitest-covered in
  `packages/debate-card-search/test/peer-review.test.ts`. See the "Peer
  Review System" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it's pure state-transition logic
  over a caller-supplied `CardReview`; nothing in this repo persists a
  review, notifies reviewers, or renders a review-queue/comment-thread UI
  yet. Follow-ups: (a) wiring `CardReview`/`ReviewComment` into wherever
  submitted cards are eventually persisted, (b) a review-queue and
  comment-thread UI in `debate-card-search` that calls
  `submitForReview`/`addReviewComment`/`approveReview`/etc., (c) reviewer
  identity/permission checks (e.g. only assigned reviewers can approve)
  once an auth/roles system exists.
  PR: [#73](https://github.com/debate/debate-ai.com/pull/73).
- **Contribution Leaderboard — per-contributor ranking slice.**
  `packages/debate-card-search/src/lib/contribution-leaderboard.ts` adds
  `groupContributionsByContributor` (groups a flat list of
  contributor-attributed contributions by `contributorId`, preserving
  order), `buildContributorStats` (aggregates one contributor's scored
  contributions into a contribution count, total/average helpfulness
  score, their single best contribution, and a count of their
  popularity-only-outlier contributions), and `buildLeaderboard` (groups,
  scores, and ranks every contributor by total helpfulness score
  descending — so a contributor with several well-received contributions
  outranks a single viral hit — tie-broken by `contributorId`). This
  builds directly on the existing idea #11 `community-rating.ts`
  helpfulness-scoring slice (`computeHelpfulnessBreakdown`) rather than
  duplicating its scoring logic. Vitest-covered in
  `packages/debate-card-search/test/contribution-leaderboard.test.ts`. See
  the "Contribution Leaderboard" bullet under Research Crowdsourcing
  Organizer Features below. This is the first slice only — it aggregates
  whatever contributor-attributed contributions the caller passes in; it
  doesn't track "most completed tasks" (no task system exists in this
  repo today), persist standings, or render a leaderboard UI. Follow-ups:
  (a) a `contributorId` field and query wired into wherever
  `CommunityContribution`s are eventually persisted, (b) a "completed
  tasks" signal once a research-task system (see the "Research Task
  Routing"/"Daily Quests and Targets" ideas below) exists to feed it, (c)
  a leaderboard UI in `debate-card-search` that renders `buildLeaderboard`.
  PR: [#72](https://github.com/debate/debate-ai.com/pull/72).
- **Pre-Round Intelligence Panel — briefing composition slice.**
  `packages/debate-round/src/round/pre-round-briefing.ts` adds
  `buildPreRoundBriefing` (combines an already-built `OpponentTeamProfile`
  scouting summary, a `JudgeProfile` tendency summary, a head-to-head
  prior-meetings record derived from caller-supplied `OpponentRoundRecord`s,
  and free-text team prep notes into one structured briefing with a
  labeled section per signal — each missing piece renders an explicit "no
  data on file" line rather than being silently omitted),
  `summarizePriorMeetings` (tallies wins/losses from a head-to-head record
  list), and `buildPreRoundBriefingText` (renders the structured briefing
  as a single markdown-ish document). This reuses the existing
  `buildOpponentScoutingSummary` (`debate-data-sync`) and
  `buildJudgeTendencySummary` (`debate-speech-writer`) slices directly, so
  `debate-round` now depends on both packages. Vitest-covered in
  `packages/debate-round/test/pre-round-briefing.test.ts`. See idea #12
  below. This is the first slice only — it doesn't fetch live tournament
  results, prior pairings, event details, or room assignments from any
  real data source (none exist in this repo today; the caller supplies
  whichever profiles/records/notes they already have), and it isn't wired
  into any round-information page UI yet. Follow-ups: (a) real data
  sources for tournament results, pairings, event details, and room
  assignments to populate `RoundEventInfo` and the head-to-head record
  list automatically instead of relying entirely on caller-supplied data,
  (b) a briefing panel UI in `debate-round` that renders
  `buildPreRoundBriefing`/`buildPreRoundBriefingText` on a round-information
  page, (c) persisting a generated briefing (or its inputs) per round.
  PR: TBD.
- **Opponent Team Profiles — scouting-profile aggregation slice.**
  `packages/debate-data-sync/src/rankings/opponent-team-profile.ts` adds
  `buildOpponentTeamProfile` (aggregates an opposing team's caller-supplied
  round history — `OpponentRoundRecord`s — into an overall win/loss record,
  a per-side win/loss split with a `hasNotableSidePreference` flag once
  there's enough of a sample on both sides, and frequency-ranked
  `topArgumentTags`/`topCases` reflecting the arguments and case names they
  run most often), `groupRecordsByTeam` / `buildOpponentTeamProfiles`
  (batch-build profiles for every team in a flat record list),
  `getHeadToHeadRecords` (filters a record list down to rounds recorded
  specifically against a given opponent, for head-to-head lookups), and
  `buildOpponentScoutingSummary` (renders a profile as short bullet lines
  for a pre-round scouting card, explicitly reporting "unknown" rather than
  fabricating a value when tags/cases were never tracked). Vitest-covered
  in `packages/debate-data-sync/test/opponent-team-profile.test.ts`. See
  the "Opponent Team Profiles" item under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it's pure aggregation
  logic over caller-supplied round records; no scraper in this repo
  reconstructs real head-to-head/round history from Tabroom or tab-service
  ballots, and it isn't wired into any scouting-card or pre-round-briefing
  UI yet. Follow-ups: (a) a real round-history data source (e.g.
  reconstructed from Tabroom pairings/ballots) that produces
  `OpponentRoundRecord`s instead of relying entirely on caller-supplied
  data, (b) a scouting-card/panel UI that renders
  `buildOpponentScoutingSummary`, (c) persisting/looking up profiles by
  team across tournaments rather than recomputing from a full history each
  time.
  PR: TBD.
- **Judge Profiles — tendency-profile aggregation slice.**
  `packages/debate-speech-writer/src/judge/judge-profile.ts` adds
  `buildJudgeProfile` (aggregates a judge's caller-supplied ballot history —
  `JudgeRoundRecord`s — into side-vote win rates with a `hasNotableSideBias`
  flag once there's enough of a sample, average speaker points awarded per
  side, a rough `classifySpeedTolerance` pace-based delivery-speed estimate,
  a `classifyTheoryReceptiveness` theory-argument win-rate estimate, and the
  judge-paradigms.ts paradigm they were most often tagged with),
  `groupRecordsByJudge` / `buildJudgeProfiles` (batch-build profiles for
  every judge in a flat record list), and `buildJudgeTendencySummary`
  (renders a profile as short bullet lines for a pre-round briefing or
  profile card, explicitly reporting "unknown" rather than fabricating a
  value when a signal was never tracked). Vitest-covered in
  `packages/debate-speech-writer/test/judge-profile.test.ts`. See the
  "Judge Profiles" item under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it's pure aggregation logic over
  caller-supplied ballot records; no `Round`/ballot schema in this repo
  captures speaker points, delivery pace, or theory outcomes today, so it
  doesn't read or persist real ballot data, and it isn't wired into any
  judge-profile or pre-round-briefing UI yet. Follow-ups: (a) a real ballot
  data source (e.g. reconstructed from Tabroom ballots) that produces
  `JudgeRoundRecord`s instead of relying entirely on caller-supplied data,
  (b) a judge-profile card/panel UI that renders `buildJudgeTendencySummary`,
  (c) persisting/looking up profiles by judge across tournaments rather than
  recomputing from a full history each time.
  PR: [#69](https://github.com/debate/debate-ai.com/pull/69).
- **Online Debate Versus AI — turn-order and speech-validation slice.**
  `packages/debate-round/src/round/ai-versus-speech-order.ts` adds
  `buildAiVersusSpeechOrder` (flattens a `debate-timer` format's
  `timerSpeeches` into an ordered turn list tagged `speaker: "user" | "ai"`
  from the user's chosen `primary`/`secondary` side), `getNextSpeechSlot` /
  `isUsersTurn` (whose turn is next given how many speeches have already
  been submitted), `validateSpeechSubmission` (checks a submitted speech
  name against the next expected slot, rejecting it when the round is
  already complete, it's the AI's turn, or the name doesn't match), and
  `buildAiResponseRequest` (a structured, non-AI-calling request object —
  the next AI slot, prior speeches to condition on, and whether it's a
  cross-examination turn — for a future prompt-builder to consume).
  Vitest-covered in
  `packages/debate-round/test/ai-versus-speech-order.test.ts`. See idea #3
  below. This is the first slice only — it's pure turn-order/state logic
  over the existing `debateStyles` format registry; it doesn't call any AI
  model, accept text/audio speech submissions, or persist round state, and
  it isn't wired into any online-versus-AI round UI yet; see follow-ups
  noted under idea #3.
  PR: TBD.
- **CX NDCA Standings — qualification points and standings computation slice.**
  `packages/debate-data-sync/src/rankings/ndca-standings.ts` adds
  `computeTournamentPoints` (scores a single tournament result from its
  outround finish, prelim-win record, and a bid-level bonus, against a
  configurable `QualificationPointsTable`), `buildTeamStanding` /
  `buildStandings` (aggregate a team's — or every team's — tournament
  results into a cumulative standing: total qualification points from its
  best N tournaments if capped, overall prelim record and best finish
  across every tournament attended), `rankStandings` (sorts standings by
  total points, tie-broken by team id), and `getQualifiedTeams` (filters
  ranked standings by a minimum-points threshold and/or a qualifier cap).
  The exported `DEFAULT_QUALIFICATION_POINTS_TABLE` is explicitly an
  illustrative default, not the real NDCA point table (which varies by
  circuit/season and isn't public data this repo has) — callers who need
  accurate qualification points should supply their own table.
  Vitest-covered in
  `packages/debate-data-sync/test/ndca-standings.test.ts`. See idea #1
  below. This is the first slice only — it's pure aggregation/ranking logic
  over caller-supplied `TournamentResult` records; it doesn't scrape or
  parse real Tabroom/NDCA results into that shape (the existing
  `sync-tournaments.ts` only fetches tournament *names*, not per-team
  results), and it isn't wired into any standings dashboard UI yet; see
  follow-ups noted under idea #1.
  PR: TBD.
- **Community-Rated Summaries and Highlights — helpfulness scoring and ranking slice.**
  `packages/debate-card-search/src/lib/community-rating.ts` adds
  `scorePopularitySignal` (logarithmically dampens raw likes/saves so votes
  alone can't dominate), `scoreQualitySignal` (averages popularity-independent
  quality signals), `scoreReviewerSignal` (dampens summed reviewer-credibility
  weight the same way), `computeHelpfulnessBreakdown` (blends the three into
  a 0-100 `helpfulnessScore` under a default 30/40/30 popularity/quality/reviewer
  weighting, and flags a heavily-voted-but-substance-poor contribution as an
  `isPopularityOnlyOutlier`), and `rankContributions` (sorts a contribution
  list by that blended score, tie-broken by id). Vitest-covered in
  `packages/debate-card-search/test/community-rating.test.ts`. See idea #11
  below. This is the first slice only — it scores whatever like/save/quality/
  endorsement counts the caller passes in; it doesn't track those signals
  itself (no like/save/endorse actions, no persistence), compute per-reviewer
  credibility, or render a leaderboard/moderation UI; see follow-ups noted
  under idea #11.
  PR: TBD.
- **AI Response-Outcome Charts — flow-derived vulnerability scoring slice.**
  `packages/debate-round/src/flow/response-outcome.ts` adds
  `scoreArgumentVulnerability` (a deterministic 0-100 heuristic over an
  already-flowed argument thread — unanswered arguments score highest,
  repeated direct opposing responses raise it further, same-side
  extensions/defense lower it), `getArgumentVulnerabilityReport` (every
  argument row scored and sorted by vulnerability), `summarizeOutcomeBySide`
  (rolls the report up per side into argument/unanswered counts and an
  average vulnerability), and `buildVulnerabilityChartData` (top-N
  label/value points ready for a bar chart). Vitest-covered in
  `packages/debate-round/test/response-outcome.test.ts`. See idea #4 below.
  This is the first slice only — it's a deterministic heuristic over the
  flow's existing clash signals, not an actual AI panel evaluating response
  paths or estimating win probabilities, and it isn't wired into any
  chart/panel UI yet; see follow-ups noted under idea #4.
  PR: TBD.
- **Legacy Verbatim / Cardmirror Compatibility — condense/cite/reorder logic slice.**
  `packages/debate-card-parser/src/utils/verbatim-shortcuts.ts` adds
  `condenseCardHtml` (collapses a card's HTML down to its underlined "read"
  runs, preserving nested `<mark>` emphasis and joining non-adjacent runs
  with an ellipsis, mirroring Verbatim's condense command), `formatShortCiteTag`
  (builds a Verbatim-style short cite tag like `"Smith 24"` or `"Smith ND"`
  from a card's author/year), and `moveOutlineNode` (swaps an outline node
  with its previous/next sibling, backing a heading/card reorder shortcut).
  Vitest-covered in
  `packages/debate-card-parser/test/verbatim-shortcuts.test.ts`. See idea #14
  below. This is the first slice only — it covers 3 of the 5 shortcuts idea
  #14 describes (condensing cards, formatting citations, moving headings);
  "sending selected evidence to a speech document" and "emphasizing text"
  are not implemented since they need editor-selection/document-target state
  that doesn't exist yet. None of these functions are wired to an actual
  keyboard-shortcut handler or UI; see follow-ups noted under idea #14.
  PR: [#64](https://github.com/debate/debate-ai.com/pull/64).
- **Outline Filters and Argument Tree View — heading-grouped argument tree slice.**
  `packages/debate-round/src/flow/argument-tree.ts` adds `buildArgumentTree`
  (groups a flow's rows into a tree keyed by its `isHeading` rows, nesting
  each argument under the most recent heading above it),
  `filterArgumentTree` (filters by speech, by a `sideKey` derived from each
  argument's origin speech via `getSpeechSideKey`, by unanswered/dropped
  status, and by heading-vs-argument `kind` — including a pure `kind:
  "heading"` outline view), `flattenArgumentTree`, and `getFlowSideKeys`.
  Vitest-covered in `packages/debate-round/test/argument-tree.test.ts`. See
  idea #10 below. This is the first slice only — it doesn't distinguish
  finer argument types (link, impact, turn, answer, extension) or track
  contributor/evidence-status, since neither exists in the flow schema
  today, and it isn't wired into any tree/outline UI yet; see follow-ups
  noted under idea #10.
  PR: [#63](https://github.com/debate/debate-ai.com/pull/63).
- **Speech Transcript Summaries and Answers — flow-derived unanswered-argument slice.**
  `packages/debate-round/src/flow/flow-transcript-summary.ts` adds
  `summarizeFlowRow`, `getFlowRowSummaries`, `getUnansweredFlowRows`,
  `buildFlowSummaryText`, `suggestCrossExamQuestions`, and
  `suggestExtensionIdeas` so a viewer can turn an already-flowed `Flow` (the
  existing `Box`/column grid) into a concise per-argument summary, flag
  which arguments currently stand unanswered as of the flow's latest
  state, and get template cross-examination questions and extension ideas
  built from those drops. Vitest-covered in
  `packages/debate-round/test/flow-transcript-summary.test.ts`. See idea #6
  below. This is the first slice only — it doesn't transcribe audio or use
  an AI model to extract claims/warrants/impacts from raw speech text (it
  works off the flow grid a debater has already flowed), and it isn't wired
  into any summary/cross-ex UI yet; see follow-ups noted under idea #6.
  PR: TBD.
- **Flow-in-Speech Flow Annotations — timestamped annotation data model slice.**
  `packages/debate-round/src/flow/flow-annotations.ts` adds a `FlowAnnotation`
  type plus `createFlowAnnotation`, `sortAnnotationsByTimestamp`,
  `getAnnotationsForSpeech`, `getAnnotationsForBox`,
  `findAnnotationAtPlaybackPosition`, and `resolveAnnotationBox` so a viewer
  scrubbing a streamed/recorded speech can drop a timestamped note on a
  specific flow `Box` (addressed via the existing `boxFromPath` path
  convention) and later jump straight back to it. Vitest-covered in
  `packages/debate-round/test/flow-annotations.test.ts`. See idea #15 below.
  This is the first slice only — it is not wired into the video player
  (`debate-videos`) or the `FlowSpreadsheet`/flow grid UI, and annotations
  aren't persisted anywhere yet; see follow-ups noted under idea #15.
  PR: [#61](https://github.com/debate/debate-ai.com/pull/61).
- **AI Judge Decision Modes — judge-paradigm registry slice.**
  `packages/debate-speech-writer/src/judge/judge-paradigms.ts` adds a registry
  of configurable judge personas (flow, lay, policymaker, critic, educator,
  truth-tester) plus `buildJudgeParadigmPrompt` (composes a paradigm-specific
  prompt section) and `buildCustomJudgeParadigm` (builds a "custom" paradigm
  from a real judge's own publicly stated preferences). Vitest-covered in
  `packages/debate-speech-writer/test/judge-paradigms.test.ts`. See idea #5
  below. This is the first slice only — it is not wired into the existing
  `judgeDecisionPrompt` AI call or into any paradigm-picker UI; see
  follow-ups noted under idea #5.
  PR: [#60](https://github.com/debate/debate-ai.com/pull/60).
- **Expandable Heading Structure — outline/collapse logic slice.**
  `packages/reason-editor/src/engine/outline/heading-outline.ts` adds
  `buildHeadingOutline`, `getVisibleHeadingIds`, `getCollapsedRanges`, and
  `isPositionCollapsed` so a nav panel or editor view can implement
  collapsible H1-H4 sections (pocket/hat/block/tag+analytic) over the
  existing flat heading schema, without any schema change. Vitest-covered
  in `packages/reason-editor/test/heading-outline.test.ts`. See idea #9
  below. This is the first slice only — it is not wired into any React
  nav panel/outline UI yet (no such component exists in `reason-editor`
  today); see follow-ups noted under idea #9.
  PR: [#58](https://github.com/debate/debate-ai.com/pull/58).
- **Word-Count-Only Speech Format — pure logic slice.** `packages/debate-timer/src/formats/word-count-format.ts`
  adds `countWords`, `getWordCountStatus`, `estimateWordLimit`, and a `wordCountStyles` registry
  (mirrors Public Forum's speech order with word limits instead of timers). Vitest-covered in
  `packages/debate-timer/test/word-count-format.test.ts`. See idea #2 below. This is the first
  slice only — it is not wired into `SpeechTimer`/`debate-round`'s timer state (built around
  elapsed milliseconds) or exposed in any submission UI; see follow-ups noted under idea #2.
  PR: [#57](https://github.com/debate/debate-ai.com/pull/57).

## Product Feature Ideas

1. **CX NDCA Standings** — Add a standings dashboard modeled around NDCA-style results, allowing users to browse qualification points, rankings, cumulative records, and tournament performance history across the season. Tabroom already supports tournament results and NDCA-points configuration, so this could expose those data in a more searchable, user-friendly analytics view. [tabroom](https://www.tabroom.com/index/tourn/index.mhtml?tourn_id=26597) _Status: first slice done (see Tracker Status above) — `debate-data-sync` now has `computeTournamentPoints`/`buildTeamStanding`/`buildStandings`/`rankStandings`/`getQualifiedTeams` for turning per-team tournament results into ranked, cumulative season standings against a configurable (not authoritative) points table. A second slice, `tournamentResults.ts` (see Tracker Status above), now persists recorded `TournamentResult`s to localStorage. A third slice, `StandingsPanel` (see Tracker Status above, "CX NDCA Standings — standings dashboard UI"), now lets a user record a result and renders every persisted result's ranked standings at `/standings`, closing follow-up (c). Follow-ups: (a) a Tabroom/NDCA scraper that produces real `TournamentResult` records per team (today's `sync-tournaments.ts` only fetches tournament names), (b) a real, circuit-sourced `QualificationPointsTable` instead of the illustrative default. Neither of these is started._

2. **Word-Count-Only Speech Format** — Support a practice and online-debate format where speeches are constrained by a maximum word count rather than a time limit, helping students practice concise writing, efficient argument construction, and comparable asynchronous submissions. _Status: first slices done (see Tracker Status above) — `debate-timer` now has word-count/limit-status utilities and a `wordCountStyles` registry. A second slice, `wordCountRounds.ts` (see Tracker Status above, "Word-Count-Only Speech Format — persisted word-count round results"), now persists a round's chosen style and submitted speech text to localStorage. A third slice, `WordCountRoundsPanel` (see Tracker Status above, "Word-Count-Only Speech Format — submission UI"), now renders a submission form at `/word-count` with a live per-speech word-count readout, closing follow-up (a). A fourth slice (see Tracker Status above, "Word-Count-Only Speech Format — live-round word-limited speech mode") added `round/word-count-speech-mode.ts`, `hooks/useWordCountSpeechMode.ts`, and `debate-timer`'s `SpeechWordCounter`, wiring a word-limit toggle into `SpeechHeaderBar` that replaces the live countdown with a `words / limit` meter whose text persists through the same `wordCountRounds` store as `/word-count`, closing follow-up (b). A speech with no authored `wordCountStyles` limit falls back to `estimateWordLimit` applied to the live timed style's speech length, so the mode works for every debate style. No follow-ups remain open on this idea; the mobile `FlowPageHeader` countdown is unchanged, as noted in `docs/features/word-count-rounds.md`._

3. **Online Debate Versus AI** — Allow a debater or team to enter an online practice debate against an AI opponent, select the debate format and side, submit speeches in text or audio, and receive structured responses that follow the expected speech order. _Status: first slices done (see Tracker Status above) — `debate-round` now has `buildAiVersusSpeechOrder`/`getNextSpeechSlot`/`isUsersTurn`/`validateSpeechSubmission`/`buildAiResponseRequest` for turning a `debate-timer` format + chosen side into an ordered, speaker-tagged turn sequence, validating a submitted speech against whose turn it is, and building a structured (non-AI-calling) request describing the AI's next speech. A second slice, `aiVersusRounds.ts` (see Tracker Status above, "Online Debate Versus AI — submitted-round persistence"), now persists a round's format, side, and submitted speeches to localStorage. A third slice, `AiVersusRoundPanel` (see Tracker Status above, "Online Debate Versus AI — round-setup + submission UI"), now renders a round-setup + submission UI at `/versus-ai`, closing follow-up (b). A fourth slice (see Tracker Status above, "Online Debate Versus AI — real AI speech-generation call") added `round/ai-versus-speech-ai.ts` and `round/ai-versus-speech-client.ts`, wiring a "Generate AI speech" action into `AiVersusRoundPanel` that calls the existing `/api/reason-ai` Anthropic proxy to produce the AI's next speech text, closing follow-up (a). A fifth slice (see Tracker Status above, "Online Debate Versus AI — 'Regenerate last AI speech' affordance") added `canRegenerateLastAiSpeech`/`replaceLastAiSpeech` to `aiVersusRounds.ts` and a "Regenerate last AI speech" button to `AiVersusRoundPanel`, letting an unsatisfactory AI speech be redone in place instead of clearing the whole round. No follow-ups remain open on this idea; speech submission stays text-only, and only the most recently submitted AI speech (not an earlier one mid-round) can be regenerated, as noted in `docs/features/ai-versus-rounds.md`._

4. **AI Response-Outcome Charts** — Use a panel of specialized models or “AI counsel” roles to evaluate likely response paths, map which arguments are most vulnerable, estimate where clash will occur, and visualize how different strategic choices may change likely round outcomes. _Status: first slices done (see Tracker Status above) — `debate-round` now has `scoreArgumentVulnerability`/`getArgumentVulnerabilityReport`/`summarizeOutcomeBySide`/`buildVulnerabilityChartData` for deriving a per-argument exposure score and chart-ready datasets directly from an already-flowed grid's existing clash signals (unanswered status, opposing responses, same-side extensions). A second slice, `vulnerabilityReports.ts` plus `VulnerabilityChartsPanel` (see Tracker Status above, "AI Response-Outcome Charts — chart/panel UI"), now persists a round's derived report and renders it as a per-side exposure summary and exposure chart at `/outcomes`, closing follow-up (b). A third slice, `applyHypotheticalAdjustments` plus the panel's "what if" picker (see Tracker Status above, "AI Response-Outcome Charts — 'what if' hypothetical mode"), now recomputes a chosen argument's score against a hypothetical extend/answer/concede choice, closing follow-up (c). A fourth slice (see Tracker Status above, "AI Response-Outcome Charts — AI counsel-panel call") added `flow/response-outcome-ai.ts`, `flow/response-outcome-client.ts`, and `state/counselPanelAssessments.ts`, wiring a "Get AI counsel panel" action into the panel that calls the existing `/api/reason-ai` Anthropic proxy for a real three-role ("Policy Counsel"/"Kritik Counsel"/"Weighing Counsel") assessment of each exposed argument's likely response path and clash point plus an overall clash summary, closing follow-up (a). No follow-ups remain open on this idea._

5. **AI Judge Decision Modes** — Provide configurable AI judge personas that evaluate a completed practice round through different paradigms, such as flow judge, lay judge, policymaker, critic, educator, truth tester, or a user-created paradigm based on a real judge’s publicly provided preferences. _Status: first slices done (see Tracker Status above) — `debate-speech-writer` now has a `judgeParadigms` registry, `buildJudgeParadigmPrompt`, and `buildCustomJudgeParadigm`. A second slice, `judgeParadigmSelections.ts` (see Tracker Status above), now persists a round's selected `JudgeParadigm` to localStorage. A third slice, `JudgeParadigmPickerPanel` (see Tracker Status above, "AI Judge Decision Modes — paradigm-picker UI"), now renders a picker UI at `/paradigms` for saving a round's built-in or custom paradigm, closing follow-up (b). A fourth slice (see Tracker Status above, "AI Judge Decision Modes — real AI judge-decision call") added `debate-round`'s `round/judge-decision-ai.ts`, `round/judge-decision-client.ts`, `round/judge-decision-store-wiring.ts`, and `state/judgeDecisions.ts`, wiring an AI judge-decision call — composing `buildJudgeParadigmPrompt` with a round's flow summary and calling the existing `/api/reason-ai` Anthropic proxy — into a new `JudgeDecisionPanel` at `/judge-decision`, closing follow-up (a). No follow-ups remain open on this idea._

6. **Speech Transcript Summaries and Answers** — Transcribe a speech, identify its claims, warrants, impacts, evidence, and unanswered arguments, then produce a concise flow-oriented summary along with possible responses, cross-examination questions, and extension ideas. _Status: first slices done (see Tracker Status above) — `debate-round` now has `getFlowRowSummaries`/`getUnansweredFlowRows`/`buildFlowSummaryText`/`suggestCrossExamQuestions`/`suggestExtensionIdeas` for deriving a per-argument summary and drop/answer status directly from an already-flowed grid. A second slice, `flowSummaries.ts` (see Tracker Status above, "Speech Transcript Summaries and Answers — flow-summary persistence"), now persists a round's derived `FlowRowSummary[]` to localStorage. A third slice, `FlowSummariesPanel` (see Tracker Status above, "Speech Transcript Summaries and Answers — summary/cross-ex panel UI"), now renders every persisted flow summary, with suggested cross-exam questions and extension ideas for unanswered arguments, at `/summaries`, closing follow-up (b). A fourth slice (see Tracker Status above, "Speech Transcript Summaries and Answers — AI extraction from raw speech text") added `round/transcript-extraction-ai.ts` and `round/transcript-extraction-client.ts`, wiring a "Generate from raw speech text" form into `FlowSummariesPanel` that calls the existing `/api/reason-ai` Anthropic proxy to extract claim/warrant/impact/evidence arguments from a pasted transcript and appends them to that round's saved flow summary as synthetic `FlowRowSummary` rows, closing the AI-call half of follow-up (a). Follow-up (a)'s remaining half, audio/video transcription (the extraction form above requires an already-transcribed speech text, not a recording), remains open — not started._

7. **On Page Card Reuse Search** — See if any one has cut this article in the chrome ext. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `EvidenceLibraryEntry.sourceUrl` (optional) plus `normalizeSourceUrl`/`findEntriesBySourceUrl`/`checkPageForExistingCards`/`buildPageReuseCheckSummaryText` for checking whether a given page URL has already been cut into the shared repository, and `state/evidenceLibraryEntries.ts`'s `checkPersistedPageForExistingCards` composes that against the persisted, peer-review-gated repository. A "Check this page" box plus a new Source URL submission field in `EvidenceLibraryPanel` (`/cards/library`) let a contributor paste a URL and see whether it's already been cut, standing in for the eventual browser extension's automatic per-tab check — no chrome extension exists in this repo, so this reuse-check logic is the extension-callable first slice. Follow-up: (a) an actual browser extension that calls this same check automatically against the current tab's URL. Not started._

8. **Video-Lecture-Training Coach AI** — Let coaches upload practice-round recordings, lecture transcripts, camp materials, and approved instructional documents to create a private team coach AI that explains concepts and gives advice grounded in that team’s own teaching materials. _Status: first slices done (see Tracker Status above) — `debate-speech-writer` now has `buildCoachMaterialLibrary`/`findRelevantMaterials`/`buildGroundedCoachPrompt` for organizing a team's caller-supplied materials (lecture transcripts, camp materials, instructional documents, practice-round recordings) into a kind-grouped library, scoring each material's relevance to a question with a deterministic keyword-overlap heuristic, and composing a self-contained, grounded prompt from the most relevant materials, mirroring the existing `opponent-personas.ts`/`judge-paradigms.ts` structured-prompt convention. A second slice, `coachMaterials.ts` (see Tracker Status above), now persists `CoachMaterial` records to localStorage. A third slice, `CoachMaterialsPanel` (see Tracker Status above, "Video-Lecture-Training Coach AI — materials-upload/coach panel UI"), now renders an upload form, a kind-grouped material list, and an "ask the coach" grounded-prompt preview at `/coach-materials`, closing follow-up (c). A fourth slice (see Tracker Status above, "Video-Lecture-Training Coach AI — real AI Q&A call") added `coach/team-coach-ai.ts` and `coach/team-coach-client.ts`, wiring an "Ask the coach" action into the panel that calls the existing `/api/reason-ai` Anthropic proxy with `buildGroundedCoachPrompt`'s output for a real, materials-grounded answer, closing follow-up (b). A fifth slice (see Tracker Status above, "Video-Lecture-Training Coach AI — document-upload text extraction") added `coach/document-material-extraction.ts`, wiring an "Upload a document" action into the panel that fills a material's text field from an uploaded `.docx`/`.txt`/`.md` file (via `debate-card-parser`'s existing `convertDocxToHTML` for `.docx`), closing the "document" half of follow-up (a). The "recording" half of follow-up (a), audio/video transcription, remains open — not started; no transcription service exists in this repo._

9. **Expandable Heading Structure** — Make research documents and outlines collapsible by heading level, allowing users to expand or collapse H1, H2, and H3 sections so they can move quickly between a high-level argument map and detailed evidence. _Status: first slices done (see Tracker Status above) — `reason-editor`'s engine now has `buildHeadingOutline`/`getVisibleHeadingIds`/`getCollapsedRanges`/`isPositionCollapsed` for deriving H1-H4 structure and collapse ranges from the existing flat heading schema. A second slice, `collapsedHeadings.ts` (see Tracker Status above, "Expandable Heading Structure — collapsed-heading persistence"), now persists a document's collapsed heading ids to localStorage. A third slice, `OutlineNavPanel` (see Tracker Status above, "Expandable Heading Structure — outline nav panel"), now renders the outline alongside the document at `/reason-editor` (behind an opt-in `showOutline` prop) with click-to-jump and collapse/expand, reading/writing through the persistence store, closing follow-up (a). A fourth slice, `collapsedHeadingsPlugin` (see Tracker Status above, "Expandable Heading Structure — collapsed-heading decoration plugin"), now hides a collapsed heading's content in the live ProseMirror view itself (driven by `OutlineNavPanel`'s toggle), closing follow-up (b). No follow-ups remain open on this idea._

10. **Outline Filters and Argument Tree View** — Provide a filterable outline and visual tree that shows the relationship between contentions, links, internal links, impacts, turns, answers, and extensions, with filters for side, speech, contributor, evidence status, and argument type. _Status: first slices done (see Tracker Status above) — `debate-round` now has `buildArgumentTree`/`filterArgumentTree`/`flattenArgumentTree`/`getFlowSideKeys` for deriving a heading-grouped argument tree from an already-flowed grid and filtering it by speech, side, unanswered status, and heading-vs-argument kind. A second slice, `argumentTreeFilters.ts` (see Tracker Status above, "Outline Filters and Argument Tree View — filter-selection persistence"), now persists a round's chosen `ArgumentTreeFilter` to localStorage. A third slice, `argumentTrees.ts` plus `ArgumentTreePanel` (see Tracker Status above, "Outline Filters and Argument Tree View — outline panel UI"), now persists a round's derived tree and renders it as a filterable outline at `/outline`, closing follow-up (a). A fourth slice (see Tracker Status above, "Outline Filters and Argument Tree View — argument-type/contributor/evidence-status tagging") added `debate-core`'s `ArgumentType`/`EvidenceStatus` unions and `Box.argumentType`/`Box.authorId`/`Box.evidenceStatus` optional fields, threaded them through `flow-transcript-summary.ts`'s `FlowRowSummary` and `argument-tree.ts`'s `ArgumentTreeNode`/`ArgumentTreeFilter`, and wired matching filter selects plus per-row badges into `ArgumentTreePanel`, closing follow-up (b). No follow-ups remain open on this idea._

11. **Community-Rated Summaries and Highlights** — Let users like, save, and endorse the most useful research summaries, analytic explanations, evidence highlights, and annotations, then rank contributions by helpfulness while guarding against popularity-only scoring through quality and reviewer-weight signals. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `scorePopularitySignal`/`scoreQualitySignal`/`scoreReviewerSignal`/`computeHelpfulnessBreakdown`/`rankContributions` for blending logarithmically-dampened popularity with quality and reviewer-credibility signals into a ranked, popularity-resistant helpfulness score. A second slice, `contributions.ts`'s `recordPersistedLike`/`recordPersistedSave`/`recordPersistedEndorsement` (see Tracker Status above), now persists a like/save/endorse action's counts per contribution, closing half of follow-up (a) — no UI action fires them yet. A third slice, `ContributionLeaderboardPanel` (see Tracker Status above, "Contribution Leaderboard — leaderboard UI panel wired to the app"), now renders a ranked leaderboard at `/cards/leaderboard`, closing follow-up (c)'s leaderboard half (it does not yet surface `isPopularityOnlyOutlier` contributions separately for moderator review). A fourth slice, `ContributionsFeedPanel` (see Tracker Status above, "Contributions Feed — like/save/endorse UI"), now renders a submission form and every persisted contribution as a ranked, per-contribution feed with Like/Save/Endorse buttons at `/cards/contributions`, closing follow-up (a) and the rest of follow-up (c) (this feed does surface each entry's `isPopularityOnlyOutlier` flag). A fifth slice (see Tracker Status above, "Community-Rated Summaries and Highlights — real reviewer-credibility system") added `community-rating.ts`'s `computeReviewerCredibility` and `state/contributions.ts`'s `recordPersistedEndorsementFromReviewer`, deriving an endorsement's weight from the endorsing reviewer's own persisted contribution history instead of a fixed placeholder, and wired a "Reviewer ID" field into the Contributions Feed panel's Endorse action, closing follow-up (b). No follow-ups remain open on this idea._

12. **Pre-Round Intelligence Panel** — On every round-information page, combine live tournament results, prior pairings, opponent records, judge paradigms, event details, room assignments, and relevant team prep notes into one focused pre-round briefing. _Status: first slice done (see Tracker Status above) — `debate-round` now has `buildPreRoundBriefing`/`summarizePriorMeetings`/`buildPreRoundBriefingText` for composing an opponent-scouting summary, a judge-tendency summary, a head-to-head prior-meetings record, and team prep notes into one structured, renderable briefing, reusing the existing `debate-data-sync`/`debate-speech-writer` profile slices. A second slice, `preRoundBriefings.ts` (see Tracker Status above), now persists a round's generated `PreRoundBriefing` to localStorage, closing follow-up (c). A third slice, `buildPreRoundBriefingFromStores` (see Tracker Status above, "Pre-Round Briefing Store Wiring"), now resolves the opponent/judge profiles themselves from the persisted `opponentTeamProfiles.ts`/`judgeProfiles.ts` stores by id instead of requiring the caller to supply pre-fetched profile objects. A fourth slice, `PreRoundBriefingsPanel` (see Tracker Status above, "Pre-Round Intelligence Panel — briefing-panel UI"), now renders every persisted briefing at `/briefings`, closing follow-up (b). Follow-up (a), real data sources for tournament results, pairings, event details, and room assignments (none exist in this repo today), remains open — not started._

13. **Coaching Programs and Group Challenges** — Enable coaches to create group coaching spaces with assigned drills, research sprints, practice rounds, shared feedback, progress tracking, and friendly challenges such as completing a set of blocks or winning a rebuttal exercise. _Status: first slices done (see Tracker Status above) — the "friendly challenges" half has `debate-card-search`'s `group-challenges.ts` (`buildGroupChallengeBoard`), and the coaching-space model tying it together has `debate-round`'s `coaching-program.ts` (`buildCoachingProgramBoard`), composing that group-challenge board with the existing Team Collaboration Mode topic sprint and AI Drill Generator drill sets per roster member. A second slice, `coachingPrograms.ts` (see Tracker Status above, "Coaching Program Persistence — localStorage config store"), now persists a `CoachingProgramConfig` to localStorage, closing follow-up (a). A third slice, `CoachingProgramsPanel` (see Tracker Status above, "Coaching Programs and Group Challenges — coaching-program config UI"), now renders a create-program form and every persisted program's roster at `/coaching-programs`, closing the config-management half of follow-up (b). A fourth slice, `GroupChallengesPanel` (see Tracker Status above, "Group Challenges — challenge-board/creation UI"), now renders a create-challenge form and every persisted `GroupChallenge` at `/cards/group-challenges`, closing the "Group Challenge Persistence" entry's follow-up (a). A fifth slice, `state/challengeWinEvents.ts` (see Tracker Status above, "Coaching Programs and Group Challenges — persisted challenge win events + live standings in the Group Challenges panel"), now persists `ChallengeWinEvent`s and composes them with the persisted challenge roster and real contribution feed into a live board, rendered as per-challenge standings (plus a "Record a win" action) in `GroupChallengesPanel`, closing the "persisted challenge win events" half of follow-up (b-continued). A sixth slice, `state/persistedCoachingProgramBoard.ts` plus `CoachingProgramsPanel`'s new "View board" action (see Tracker Status above, "Coaching Programs and Group Challenges — coaching-program board UI"), now composes a program's full `buildCoachingProgramBoard` — topic sprint, challenge standings, and (empty until a roundId-to-contributor mapping exists) member drills — entirely from persisted state for a chosen topic, closing the dashboard-view half of follow-up (b-continued). A seventh slice, `state/roundContributorFlows.ts` (see Tracker Status above, "Coaching Programs and Group Challenges — roundId-to-contributor mapping for member drill sets"), now persists each roster member's currently recorded, already-flowed practice round and feeds it into `buildPersistedCoachingProgramBoard`'s `memberFlows` by default, with a "Member flows" roster in `CoachingProgramsPanel` (a side-key input plus "Save current flow" action per member, reading the live round workspace's selected flow) to record it, closing the remaining "(b-continued, remaining)" follow-up. An eighth slice (see Tracker Status above, "Coaching Programs and Group Challenges — member practice-round setup/feedback wiring") added `round/coaching-program.ts`'s `CoachingProgramMemberPracticeRound`/`memberPracticeRounds` and `state/roundContributorFlows.ts`'s `buildCoachingProgramMemberPracticeRounds`, joining each roster member's already-recorded `roundId` against `state/practiceRounds.ts`'s existing `PracticeRoundRecord` store (no new contributorId-keyed store was needed) and surfacing a "Practice round recorded"/"Practice round + feedback" badge per member in `CoachingProgramsPanel`, closing follow-up (c). No follow-ups remain open on this idea._

14. **Legacy Verbatim / Cardmirror Compatibility** — Offer optional keyboard shortcuts that mirror familiar Verbatim and paperless-debate workflows, including sending selected evidence to a speech document, formatting citations, condensing cards, emphasizing text, and moving headings. _Status: first slices done (see Tracker Status above) — `debate-card-parser` now has `condenseCardHtml`, `formatShortCiteTag`, and `moveOutlineNode` for condensing a card to its underlined "read" text, formatting a short cite tag, and reordering outline nodes. A second slice, `toggleEmphasisHtml` (see Tracker Status above, "Legacy Verbatim / Cardmirror Compatibility — text-emphasize command"), now toggles `<mark>` emphasis over a visible-text selection range, closing follow-up (c). A third slice (see Tracker Status above, "Legacy Verbatim / Cardmirror Compatibility — editor keyboard-shortcut wiring") wired real keyboard shortcuts into the live `reason-editor` document — `Mod-Shift-K` insert short cite, `Mod-Shift-D` condense to read text, `Alt-ArrowUp`/`Alt-ArrowDown` move a heading's section, `Mod-Shift-E` toggle emphasis (via the schema's own mark rather than the raw-HTML helper) — plus matching "+Cite"/"Condense" toolbar buttons and a Move ↑/↓ button pair per heading in the outline nav panel, closing follow-up (a). A fourth slice (see Tracker Status above, "Legacy Verbatim / Cardmirror Compatibility — send-to-speech-document command") added `reason-editor`'s `engine/speech-document.ts` and `state/speechDocuments.ts`, wiring a `Mod-Shift-S` keyboard shortcut and "→Speech" toolbar button that send the live selection to a named, persisted `SpeechDocument` (find-or-create by title), plus a `SpeechDocumentsPanel` at `/speech-documents`, closing follow-up (b). No follow-ups remain open on this idea._

15. **Flow-in-Speech Flow Annotations** — While viewing a streamed or recorded round, let users create timestamped flow entries for each speech and attach an entry directly to a particular argument or response bubble, making it easy to revisit exactly where an answer was made. _Status: first slices done (see Tracker Status above) — `debate-round` now has a `FlowAnnotation` data model and query helpers (`createFlowAnnotation`, `getAnnotationsForSpeech`, `getAnnotationsForBox`, `findAnnotationAtPlaybackPosition`, `resolveAnnotationBox`) for tying a playback timestamp to a specific flow box. A second slice, `flowAnnotations.ts` (see Tracker Status above), now persists `FlowAnnotation` records to localStorage. A third slice, `FlowAnnotationsPanel` (see Tracker Status above, "Flow-in-Speech Flow Annotations — video-player annotation UI"), now renders a drop-annotation form wired to the `debate-videos` persistent player's live playback position plus every persisted annotation with a "Jump to" action back into the player, at `/annotations`, closing follow-up (a). A fourth slice (see Tracker Status above, "Flow-in-Speech Flow Annotations — `FlowSpreadsheet` annotation affordance") added `flow/annotation-cells.ts` and `flow/AnnotationBadge.tsx`, wiring a per-cell annotation badge (with the same "Jump to" mechanism) into `FlowSpreadsheet` via a new `flow/AnnotationCellRenderer.tsx` and the existing `FirstColumnCellRenderer.tsx`, closing follow-up (b). No follow-ups remain open on this idea._

16. **Shared, Ai-Generated Debate Flow** — Synchronize a live flow across a team or room so collaborators can follow the same argument map, while optionally preloading evidence cards with structured flow notes to reduce manual flowing. Existing debate-flow products show the feasibility of live transcription, argument tracking, shared notes, saved flows, and structured ballot assistance; this feature should keep humans in control of the actual flow and strategic interpretation. [github](https://github.com/saranchockan/DebateFlow) _Status: first slices done (see Tracker Status above) — `debate-round` now has `mergeFlowEdits`/`applyMergedEditsToFlow`/`buildSharedFlowSyncSummaryText` for reconciling multiple teammates' concurrent box-level flow edits into one canonical flow (last write wins), flagging genuinely concurrent, diverging edits from different authors as conflicts for a human to resolve instead of silently overwriting them. A second slice, `SharedFlowSyncPanel` (see "Feature panels", PR #214), renders that merge preview in the Coach hub's Flow section, driven entirely by props. A third slice (see Tracker Status above, "Shared, Ai-Generated Debate Flow — Flow Edit Log + real merge-preview data source") added `createFlowEdit` plus `state/flowEdits.ts` and `FlowEditLogPanel`, giving a contributor a way to actually log a `FlowEdit` and wiring `CoachHub` to feed `SharedFlowSyncPanel` real, persisted edits (and apply an accepted merge back into the round workspace) instead of a hardcoded empty array. A fourth slice (see Tracker Status above, "Shared, Ai-Generated Debate Flow — FlowSpreadsheet edit-review/log affordance") added `flow/edit-cells.ts`, `flow/EditBadge.tsx`, and `flow/EditReviewPopover.tsx`, wiring a per-cell badge into `AnnotationCellRenderer`/`FirstColumnCellRenderer` that shows a box's pending `FlowEdit`s and opens a click-positioned popover to log a new one, closing follow-up (b). A fifth slice (see Tracker Status above, "Shared, Ai-Generated Debate Flow — Common Argument Library flow-note suggestions") added `flow/flow-note-suggestions.ts` and wired a "Suggested from Common Argument Library" list into `FlowEditLogPanel`'s Content field, scoring the in-progress note against the persisted Common Argument Library corpus and offering a matched card's formatted note as an insertable (never auto-applied) starting point, closing follow-up (c). A sixth slice (see Tracker Status above, "Shared, Ai-Generated Debate Flow — server-backed live sync transport") added `apps/debate-ai.com`'s `lib/database/schema.ts` `flowSyncEdits` D1 table and `app/api/flow-sync/route.ts` (GET pull-since-cursor, POST upsert), plus `debate-round`'s `flow/flow-sync-client.ts`, `flow/flow-sync-cursor.ts`, and `hooks/useFlowSyncPolling.ts`, wiring an opt-in "Live sync" toggle into `FlowEditLogPanel` that short-polls the server for other contributors' edits to the form's current Flow ID and folds them into the existing local `state/flowEdits.ts` store, and best-effort pushes newly logged edits to the server — a short-poll transport rather than a WebSocket/Durable Object push channel, matching the follow-up's "WebSocket or similar" wording. No follow-ups remain open on this idea._



## Research Crowdsourcing Organizer Features

> The note above about UI follow-ups applies to this section too.

* 🧩 Community Research Hub - A shared space where debaters contribute cards, evidence, and summaries to a common argument pool. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `lib/community-research-hub.ts`'s `COMMUNITY_RESEARCH_HUB_ENTRIES`/`buildCommunityResearchHubSections`/`searchCommunityResearchHubEntries`/`buildCommunityResearchHubSummaryText` for a categorized, searchable directory of every sibling bullet's space (plus the round/practice-side spaces `/research`'s `ResearchHub` doesn't tab across). `CommunityResearchHubPanel` renders it at `/community-hub`, added to the global dock's Settings menu. No follow-ups remain open on this bullet._
* 🏅 Contribution Leaderboard - Track who has submitted the most useful research, highest-rated cards, and most completed tasks. _Status: first slices done (see Tracker Status above) — `debate-card-search` now has `buildLeaderboard`/`buildContributorStats`/`groupContributionsByContributor` for aggregating contributor-attributed contributions (scored via the idea #11 `community-rating.ts` helpfulness scoring) into a ranked, per-contributor leaderboard. A second slice, `contributions.ts` (see Tracker Status above), now persists `AttributedContribution` records to localStorage, and its `recordPersistedLike`/`recordPersistedSave`/`recordPersistedEndorsement` close half of follow-up (a) — persisting like/save/endorse counts once an action fires — though no submission/like UI calls them yet. A third slice, `ContributionLeaderboardPanel` (see Tracker Status above, "Contribution Leaderboard — leaderboard UI panel wired to the app"), now renders the leaderboard at `/cards/leaderboard`, closing follow-up (c). A fourth slice, `ContributionsFeedPanel` (see Tracker Status above, "Contributions Feed — like/save/endorse UI"), now renders a submission form and a like/save/endorse feed at `/cards/contributions`, closing follow-up (a). A fifth slice (see Tracker Status above, "Contribution Leaderboard — completed-tasks signal") added `completedTaskCount` to each leaderboard row, sourced from the persisted completed-task history and rendered as a new column, closing follow-up (b). No follow-ups remain open on this bullet._
* 🎮 Gamified Quests - Turn research work into missions, challenges, and streaks that reward consistent contribution. _Status: first slices done (see Tracker Status above) — `debate-card-search` now has `computeDailyMissionResult`/`computeStreakStatus`/`getEarnedStreakBadges`/`buildContributorQuestStreak`/`buildStreakSummaryText` for turning a contributor's daily `daily-quests.ts` mission-completion history into a current/longest streak and the milestone badges (3/7/14/30-day streaks by default) that streak has earned. A second slice, `dailyMissionResults.ts` (see Tracker Status above, "Gamified Quests — persisted daily mission-result history"), now persists a contributor's per-day `DailyMissionResult` to localStorage, keyed by `contributorId` + `dayKey`, and composes it directly into `buildPersistedContributorQuestStreak`. A third follow-up, surfacing earned streak badges on a contributor's `progress-unlocks.ts` unlock status, is now done — see the "Unlock Status Streak Badges" entry above (`unlock-streak-status.ts`). A fourth slice, `computeAndSavePersistedDailyMissionResult` (see Tracker Status above, "Gamified Quests — persisted end-of-day mission computation"), now computes and saves a contributor's mission result directly from their real persisted contributions. A fifth slice, `buildPersistedQuestStreakRoster` plus `QuestStreaksPanel` (see Tracker Status above, "Gamified Quests — streak/badge widget UI"), now renders every contributor's streak and earned badges at `/cards/streaks`, closing follow-up (b). A sixth slice (see Tracker Status above, "Gamified Quests — daily mission-check trigger UI") added a "Run today's mission check" action to `QuestStreaksPanel`, wiring `computeAndSavePersistedDailyMissionResult` to a UI trigger (there is no scheduled-job infrastructure in this repo), closing follow-up (a). No follow-ups remain open on this bullet._
* 🔓 Progress Unlocks - Unlock harder research tasks, advanced topics, and special badges as users contribute more. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `computeContributorTier`/`getUnlockedSkillLevel`/`getUnlockedBadges`/`buildContributorUnlockStatus`/`buildUnlockStatusText` for mapping a contributor's existing leaderboard stats to an unlock tier, the `research-task-routing.ts` skill level that tier grants, and the badges earned along the way, reusing the existing `ContributorStats`/`SkillLevel` types directly. A second slice, `tiered-task-routing.ts` (see Tracker Status above), now feeds the derived skill level into `research-task-routing.ts`'s `ContributorAvailability`. A third slice, `unlock-streak-status.ts` (see Tracker Status above, "Unlock Status Streak Badges"), now merges the Gamified Quests streak badges into this unlock status, and its `buildContributorUnlockStatusWithStreakFromStore` closes follow-up (a) — it derives a contributor's tier/badges live from the already-persisted `contributions.ts`/`dailyMissionResults.ts` stores rather than needing a separate tier/badge store. A fourth slice, `ProgressUnlocksPanel` (see Tracker Status above, "Progress Unlocks — unlock/progress roster UI panel"), now renders every contributor's tier, unlocked skill level, badges, streak, and next-tier progress at `/cards/progress`, closing follow-up (b). Neither follow-up remains open._
* 🧠 LLM Card Scoring - Use an LLM to score cards for relevance, clarity, uniqueness, evidence quality, and usability. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `scoreRelevance`/`scoreClarity`/`scoreUniqueness`/`scoreEvidenceQuality`/`scoreUsability`/`computeCardScoreBreakdown`/`rankCardScores`/`buildCardScoreSummaryText` for scoring a card across all five dimensions with deterministic heuristics and flagging likely duplicates, reusing the existing idea #11 `community-rating.ts` quality-signal scoring for evidence quality. A second slice, `cardScores.ts` plus `CardScoringPanel` (see Tracker Status above, "LLM Card Scoring — scoring/duplicate-flag panel UI"), now persists submitted `ScoredCard`s and renders a submission form plus every card's ranked score breakdown at `/cards/scoring`, closing follow-up (c). A third slice (see Tracker Status above, "LLM Card Scoring — real AI-scoring call") added `lib/llm-card-scoring-ai.ts`, `lib/llm-card-scoring-client.ts`, and `state/aiCardAssessments.ts`, wiring a "Get AI assessment" action into `CardScoringPanel` that calls the existing `/api/reason-ai` Anthropic proxy for a real qualitative verdict + per-dimension notes, closing follow-up (a). A fourth slice (see Tracker Status above, "LLM Card Scoring — real argument-block keywords and a real submitted-card corpus") added `deriveArgBlockKeywords`/`deriveArgBlockKeywordsForTopic`/`buildRealCorpusTexts`, wiring a topic's tracked-argument checklist into a "Use tracked keywords" panel action and the persisted Shared Evidence Library into the ranking's uniqueness comparison corpus, closing follow-up (b). No follow-ups remain open on this bullet._
* 📈 Research Progress Tracking - Show each debater’s progress across topics, task completion, and contribution history. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildContributorProgress`/`buildTopicProgress`/`buildResearchProgressBoard`/`buildProgressSummaryText` for combining a contributor's existing leaderboard contribution stats with per-topic task-completion counts derived from a topic-tagged research-task-routing assignment list, reusing the existing `ContributorStats`/`RoutedAssignment` types directly. A second slice, `state/researchProgress.ts` plus `ResearchProgressPanel` (see Tracker Status above, "Research Progress Tracking — persisted completion history + progress dashboard UI"), now records real task-completion events (via `completeAndRecordResearchTask`, wired into the Task Inbox panel's "Mark complete" action) and renders every contributor's contribution history, task-completion rate, and per-topic breakdown at `/cards/progress-tracking`, closing follow-ups (a) and (b). A third slice (see Tracker Status above, "Research Progress Tracking — feed topic-progress history into Progress Unlocks tier computation") added a `minCompletedTaskCount` threshold to `progress-unlocks.ts`'s `UnlockTierRequirement`/`computeContributorTier`, so a contributor's real, persisted completed-task count is now an alternate tier-qualifying signal alongside contribution volume/quality, closing follow-up (c). No follow-ups remain open on this bullet._
* 📚 Common Argument Library - Organize all shared research into topic folders, case areas, and tag-based collections. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `groupCardsByTopic`/`groupCardsByCaseArea`/`buildTopicFolder`/`buildTopicFolders`/`buildTagCollections`/`filterCardsByTags`/`buildArgumentLibrary`/`buildLibrarySummaryText` for organizing a caller-supplied, tagged card list into topic folders (each split into case-area subgroups) and cross-cutting tag-based collections, extending the existing Topic Coverage Dashboard's `argBlock`-tagged card model with `topic`/`caseArea`/`tags`. A second slice, `ArgumentLibraryPanel` (see Tracker Status above, "Common Argument Library — folder/collection browser UI"), now renders every persisted evidence-library entry as a topic-folder/case-area/tag-collection browser at `/cards/argument-library`, closing follow-up (b). A third slice (see Tracker Status above, "Common Argument Library — tag-autocomplete affordance") added `suggestTags`/`parseTagsInput`/`applyTagSuggestion` plus a live suggestion row wired into `EvidenceLibraryPanel`'s Tags field, closing follow-up (c). A fourth slice (see Tracker Status above, "Common Argument Library — Contributions Feed topic/caseArea/tags wiring") added `argument-library.ts`'s `contributionToLibraryCard`/`buildLibraryCardsFromContributions` and `evidenceLibraryEntries.ts`'s `buildCombinedPersistedArgumentLibrary`, wiring optional Topic/Case area/Tags fields into `ContributionsFeedPanel`'s submission form and folding a tagged contribution into `ArgumentLibraryPanel`'s browser alongside evidence-library entries, closing follow-up (a). No follow-ups remain open on this bullet._
* 🕵️ Daily Best Card Challenge - Highlight the highest-scoring card of the day and let the community vote on it. _Status: first slices done (see Tracker Status above) — `debate-card-search` now has `groupCardsByDay`/`pickBestCardOfDay`/`buildDailyBestCards`/`getBestCardForDay`/`buildDailyBestCardHighlight` for grouping timestamped card contributions by UTC submission day and picking each day's single highest-helpfulness card, reusing the existing `community-rating.ts` helpfulness scoring (a card's likes/saves already model the community "vote"). A second slice, `state/contributions.ts`'s `buildDailyBestCardsFromStore`/`getTodaysBestCardFromStore` plus `DailyBestCardPanel` (see Tracker Status above, "Daily Best Card Challenge — banner/widget UI"), now composes those helpers directly against the persisted Contributions Feed store and renders today's winner banner plus a winner history at `/cards/best-card`, closing follow-up (c) — and, since the composed store already carries the `submittedAt` timestamp stamped by `ContributionsFeedPanel.tsx`'s submission flow, follow-up (a) as well. A third slice, `state/dailyBestCardAnnouncements.ts` (see Tracker Status above, "Daily Best Card Challenge — persisted announcements"), layers an idempotent "announce" action over those same store helpers that freezes a day's winner under its own localStorage key, and the panel now shows the announced winner and announced history alongside the live leader, closing follow-up (b). No follow-ups remain open on this idea._
* 🗣️ Peer Review System - Allow teammates to review, comment on, and refine submitted cards before they go live. _Status: first slices done (see Tracker Status above) — `debate-card-search` now has a `CardReview` status state machine (`createCardReview`/`submitForReview`/`requestChanges`/`approveReview`/`rejectReview`/`publishReview`) plus a blocking-aware comment thread (`addReviewComment`/`resolveReviewComment`/`getUnresolvedBlockingComments`/`isReadyToPublish`/`buildReviewSummary`) that blocks approval until every blocking comment is resolved. A second slice, `peerReviews.ts` (see Tracker Status above), now persists `CardReview` records (including their `ReviewComment` thread) to localStorage, keyed by `cardId`. A third slice, `ReviewQueuePanel` (see Tracker Status above, "Peer Review System — review-queue/comment-thread UI"), now renders every persisted review at `/cards/reviews` with lifecycle actions and a comment thread, closing follow-up (a). A fourth slice (see Tracker Status above, "Peer Review System — gate a card's Shared Evidence Library visibility on its review lifecycle") added `lib/peer-review.ts`'s `isCardLive` plus `state/evidenceLibraryEntries.ts`'s `isEntryLive`/`listPendingReviewEntries`, gating `searchPersistedEvidenceLibrary`'s results on a matching `CardReview`'s lifecycle (no review at all stays live; anything short of `published` is held back) and surfacing held-back entries in a new `EvidenceLibraryPanel` "Pending review" section, closing follow-up (c). A fifth slice (see Tracker Status above, "Peer Review System — reviewer permission gating for approve/reject/publish") added `lib/reviewer-permissions.ts`'s `hasReviewerPermission`/`deriveReviewerTier`/`approveReviewAsReviewer`/`rejectReviewAsReviewer`/`publishReviewAsReviewer` plus `state/peerReviews.ts`'s `derivePersistedReviewerTier`/`approvePersistedReviewAsReviewer`/`rejectPersistedReviewAsReviewer`/`publishPersistedReviewAsReviewer`, gating the three lifecycle transitions that move a card toward or away from going live on the acting reviewer's own `progress-unlocks.ts` `UnlockTier` (derived live from the persisted Contribution Leaderboard, the same way `tiered-task-routing.ts` already derives a contributor's `SkillLevel`) rather than a fabricated role model, with a "Your reviewer ID" field wired into `ReviewQueuePanel`, closing follow-up (b). Reviewer identity is still a free-form typed id rather than an authenticated user — a real identity check needs the auth system this repo doesn't have; that gap is recorded in `docs/features/review-queue.md`'s "Known gaps". No follow-ups remain open on this bullet._
* 🏆 Top Contributor Awards - Give recognition for best evidence finder, best explainers, best original argument, and best refutations. _Status: first slices done (see Tracker Status above) — `debate-card-search` now has `buildTopContributorAwards`/`buildCategoryLeaderboard`/`groupContributionsByKind`/`buildAwardsAnnouncementText` for grouping contributor-attributed contributions by `ContributionKind` and selecting a per-kind category winner by helpfulness score, reusing the existing idea #11/Contribution Leaderboard scoring. A second slice, `ContributorAwardsPanel` (see Tracker Status above, "Top Contributor Awards — awards UI panel"), now renders every category's current winner at `/cards/awards`, closing follow-up (c). A third slice, `state/contributorAwardAnnouncements.ts` (see Tracker Status above, "Top Contributor Awards — announce/freeze action"), now lets the current day's standings be frozen via an "Announce today's awards" action (mirroring the Daily Best Card Challenge's identical announce pattern) and renders the announced history, closing follow-up (b). A fourth slice (see Tracker Status above, "Top Contributor Awards — finer-grained `ContributionKind` for original arguments and refutations") added `"original-argument"`/`"refutation"` as distinct `ContributionKind`s with their own "Best Original Argument"/"Best Refutation" award categories, wired into every existing kind picker, closing follow-up (a). No follow-ups remain open on this bullet._
* 🧭 Research Task Routing - Assign specific research jobs to debaters based on topic gaps, skill level, and current needs. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildTaskQueue`/`routeTasks`/`buildRoutingResult`/`buildRoutingSummaryText` for turning a topic-coverage report's under-covered arguments into a skill-gated task queue and routing it to whichever eligible, caller-supplied contributor currently has the fewest active tasks. A second slice, `tiered-task-routing.ts` (see Tracker Status above), now derives each contributor's skill level from their contribution history (via the Progress Unlocks tier logic) instead of requiring a caller-supplied value. A third slice, `contributorAvailability.ts` (see Tracker Status above, "Research Task Routing — persisted contributor-availability profiles"), now persists a contributor's `ContributorAvailability` to localStorage. A fourth slice (see Tracker Status above, "Research Task Routing — persisted routed task queue"), now persists a routed `RoutingResult`/task queue to localStorage, closing follow-up (b). A fifth slice (see Tracker Status above, "Research Task Routing — persisted activeTaskCount assignment/completion events") now wires real task-assignment/completion events (`buildAndPersistRoutingResult`/`completePersistedRoutedTask`) into a persisted profile's `activeTaskCount`, closing follow-up (a). A sixth slice, `TaskInboxPanel` (see Tracker Status above, "Research Task Routing — task-assignment/inbox UI"), now renders every persisted routed task queue at `/cards/inbox` with a "mark complete" action, closing follow-up (c). A seventh slice, `routePersistedTopicTasks` plus the panel's "Route a topic's tasks" form (see Tracker Status above, "Research Task Routing — task-routing trigger UI"), now lets a coach or contributor populate a topic's queue directly from the inbox, closing follow-up (d). An eighth slice, `filterTaskInboxViewByContributor` plus the panel's "My tasks" field (see Tracker Status above, "Research Task Routing — 'my tasks' inbox filter"), now scopes the inbox to a free-form contributor id (no auth/identity system exists to scope it to a real logged-in user), closing follow-up (e). No follow-ups remain open on this bullet._
* 🔁 Revision Incentives - Reward users for improving weak cards, updating outdated evidence, and strengthening citations. _Status: first slices done (see Tracker Status above) — `debate-card-search` now has `evaluateRevision`/`buildContributorRevisionStats`/`buildRevisionIncentiveLeaderboard`/`buildRevisionRewardText` for scoring a before/after card revision's quality gain (doubled when the card was weak beforehand), citation-strengthening, and evidence-refresh bonuses, reusing the existing idea #11 `community-rating.ts` quality scoring. A second slice, `revisionHistory.ts` (see Tracker Status above, "Revision Incentives — persisted revision history"), now persists `CardRevision` edit events (as many-per-card `CardRevisionRecord`s) to localStorage. A third slice, `RevisionIncentivesPanel` (see Tracker Status above, "Revision Incentives — incentives-leaderboard UI panel"), now renders a ranked reward-points leaderboard at `/cards/revisions`, closing follow-up (b). A fourth slice, `deriveCardSnapshotFromEntry`/`buildEvidenceEntryRevision` plus `EvidenceLibraryPanel`'s Edit action (see Tracker Status above, "Shared Evidence Library — edit/delete affordance wired to Revision Incentives"), now wires a real card-edit/save flow — editing an evidence-library entry derives a before/after `CardSnapshot` from the entry's own text/citation and records it via `saveEvidenceLibraryEntryRevision`, closing follow-up (a). A fifth slice, `computeEvidenceStaleness`/`getEvidenceStaleness`/`getStaleEvidenceEntries` plus `EvidenceLibraryPanel`'s "Stale evidence" badge (see Tracker Status above, "Revision Incentives — evidence-staleness signal"), now flags a card's cited evidence stale (no parseable citation year, or 3+ years old) independently of any revision, closing follow-up (c). No follow-ups remain open on this bullet._
* 📊 Topic Coverage Dashboard - Show which arguments are well-covered, which are missing, and where the team needs more work. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildTopicCoverageReport`/`getUnderCoveredArguments`/`buildTopicCoverageSummaryText` for classifying a topic's tracked argument blocks as missing, thin, or covered from caller-supplied cards and card-count/word-count thresholds, and surfacing cards filed under an untracked argument block separately. A second slice, `trackedArguments.ts` (see Tracker Status above, "Topic Coverage Dashboard — checklist persistence + dashboard UI"), now persists a topic's tracked-argument checklist to localStorage and composes it with the already-persisted evidence library to build a live report, closing follow-up (b). A third slice, `TopicCoverageDashboardPanel` (see Tracker Status above, same entry), now renders a topic switcher, checklist form, and coverage report at `/cards/coverage`, closing follow-up (c). A fourth slice (see Tracker Status above, "Topic Coverage Dashboard — Contributions Feed as a second real argBlock/word-count source") added an optional "Content" body-text field to `ContributionsFeedPanel`'s submission form, stamping `AttributedContribution.wordCount` via the existing `computeWordCount` helper, and wired topic-scoped Contributions Feed entries carrying both `argBlock` and `wordCount` into `buildPersistedTopicCoverageReport` alongside the evidence library, closing follow-up (a). No follow-ups remain open on this bullet._
* 🎯 Daily Quests and Targets - Set team goals like “find 5 solvency cards” or “add 3 frontline answers today.” _Status: first slices done (see Tracker Status above) — `debate-card-search` now has `computeQuestProgress`/`buildDailyQuestBoard`/`buildQuestBoardSummaryText`/`buildUnderCoveredArgumentQuests` for tracking a day's progress toward caller-supplied kind/argument-block quest targets, including a ready-made quest set derived directly from the existing Topic Coverage Dashboard's under-covered arguments. A second slice, `state/dailyQuests.ts` plus `DailyQuestsPanel` (see Tracker Status above, "Daily Quests and Targets — quest-board widget UI + real contribution wiring"), now persists a quest-template roster, seeds it from a topic's coverage gaps, and composes it against the real, persisted Contributions Feed at `/cards/quests`, closing follow-up (b) and — by wiring `submittedAt`/`argBlock` into the Contributions Feed's submission flow for the first time — follow-up (a). A third slice (see Tracker Status above, "Daily Quests and Targets — streak/reward layer on the quest board") added `buildStreakRewardText` and a "Your streak"/"Record today's mission" section to the panel, composing the existing Gamified Quests streak logic directly, closing follow-up (c). No follow-ups remain open on this bullet._
* 🤝 Team Collaboration Mode - Let multiple debaters work on the same topic sprint with shared notes, assignments, and live status. _Status: first slices done (see Tracker Status above) — `debate-card-search` now has `buildTopicSprint`/`buildTopicSprintSummaryText` for composing the existing Daily Quests board, Research Task Routing result, and Research Progress Tracking board into one shared topic-scoped session, plus a topic-addressed `SprintNote` model (`createSprintNote`/`updateSprintNoteStatus`/`assignSprintNote`) for shared prep notes, mirroring `debate-round`'s `strategy-sync-notes.ts` `PrepNote` lifecycle. A second slice, `sprintNotes.ts` (see Tracker Status above), now persists `SprintNote` records to localStorage. A third slice, `SprintNotesPanel` (see Tracker Status above, "Team Collaboration Mode — collaboration-panel UI"), now renders a submission form and every persisted note grouped by topic at `/cards/collaboration`, closing follow-up (a). A fourth slice (see Tracker Status above, "Team Collaboration Mode / Collaboration Prep Room — shared 'active now' presence signal") added `lib/topic-presence.ts`/`state/topicPresence.ts` and wired a live "active now" roster plus an "I'm active here" heartbeat control into the panel per topic, closing follow-up (c). A fifth slice (see Tracker Status above, "Team Collaboration Mode — persisted topic-sprint composition") added `state/topicSprints.ts`'s `readPersistedTopicSprintInputs`/`buildPersistedTopicSprint`, composing every `buildTopicSprint` input (quests, timestamped contributions, the topic's live coverage report, contributor availability, this topic's tracked assignments, and notes) from its own already-persisted store, and wired `panels/TopicSprintPanel.tsx` to fall back to that composition for any prop its caller doesn't override — `apps/debate-ai.com/components/research/ResearchHub.tsx`'s Sprint tab now just passes a `topic` instead of hand-deriving a coverage report and always passing an empty contribution list, closing follow-up (b). No follow-ups remain open on this bullet._
* 
* 🕵️ Opponent Team Profiles - Build tournament-scoped profiles for opposing teams, including likely cases, preferred strategies, past results, and habit notes. _Status: first slices done (see Tracker Status above) — `debate-data-sync` now has `buildOpponentTeamProfile`/`buildOpponentTeamProfiles`/`groupRecordsByTeam`/`getHeadToHeadRecords`/`buildOpponentScoutingSummary` for aggregating a team's round history into an overall and per-side win/loss record, a side-preference signal, frequency-ranked common arguments/cases, and head-to-head lookups. A second slice, `opponentTeamProfiles.ts` (see Tracker Status above), now persists `OpponentTeamProfile` records to localStorage, keyed by `teamId`. A third slice, `buildPreRoundBriefingFromStores` (see Tracker Status above, "Pre-Round Briefing Store Wiring"), now closes follow-up (c) — it wires `buildPreRoundBriefing` to look up a persisted profile through this store by `opponentTeamId`. A fourth slice, `OpponentTeamProfilesPanel` (see Tracker Status above, "Opponent Team Profiles — opponent-scouting roster UI panel"), now renders every persisted profile as a scouting roster at `/opponents`, closing follow-up (b). Follow-up (a), a real round-history data source producing `OpponentRoundRecord`s (e.g. from Tabroom pairings/ballots) instead of relying on caller-supplied data, remains open — not started._
* 
* ⚖️ Judge Profiles - Show judge tendencies, paradigm summaries, decision patterns, speed tolerance, theory preferences, and speaker-point habits. _Status: first slice done (see Tracker Status above) — `debate-speech-writer` now has `buildJudgeProfile`/`buildJudgeProfiles`/`groupRecordsByJudge`/`buildJudgeTendencySummary` for aggregating a judge's ballot history into side-vote bias, average speaker points, a pace-based speed-tolerance estimate, theory receptiveness, and their most-tagged paradigm. A second slice, `judgeProfiles.ts` (see Tracker Status above, "Judge Profile Persistence"), now persists `JudgeProfile` records to localStorage, keyed by `judgeId`, closing follow-up (c)'s persistence half. A third slice, `buildPreRoundBriefingFromStores` (see Tracker Status above, "Pre-Round Briefing Store Wiring"), now closes follow-up (c)'s lookup half — it wires `buildPreRoundBriefing` to look up a persisted profile through this store by `judgeId`. A fourth slice, `JudgeProfilesPanel` (see Tracker Status above, "Judge Profiles — judge-profile roster UI panel"), now renders every persisted profile as a roster at `/judges`, closing follow-up (b). Follow-up (a), a real ballot data source producing `JudgeRoundRecord`s instead of relying on caller-supplied data, remains open — not started._
* 
* 🤖 AI Practice Opponent - Let debaters spar against an AI that simulates common styles like policy heavy, kritik, lay, or fast-flowing opponents. _Status: first slices done (see Tracker Status above) — `debate-speech-writer` now has an `opponentPersonas` registry (`policy-heavy`/`kritik`/`lay`/`fast-flow`) plus `getOpponentPersona`/`listOpponentPersonas`/`buildOpponentPersonaPrompt` for composing a self-contained, style-specific prompt section. A second slice, `opponentPersonaSelections.ts` (see Tracker Status above), now persists a practice session's selected `OpponentPersona` to localStorage. A third slice, `OpponentPersonaPickerPanel` (see Tracker Status above, "AI Practice Opponent — persona-picker UI"), now renders a picker UI at `/practice-opponent` for saving a session's opponent persona, closing follow-up (b). A fourth slice (see Tracker Status above, "AI Practice Opponent — persona-conditioned AI speech-generation call") added `debate-round`'s `round/opponent-persona-speech-ai.ts`, `round/opponent-persona-speech-client.ts`, and `round/opponent-persona-speech-wiring.ts`, wiring `AiVersusRoundPanel`'s "Generate AI speech" action to argue in a round's saved persona (looked up by treating `roundId` as `opponentPersonaSelections.ts`'s `sessionId` key) via a persona-conditioned `/api/reason-ai` call, closing follow-up (a). No follow-ups remain open on this idea._
* 
* 🎙️ AI Coach Mode - Provide live or post-round coaching with prompts for extensions, refutation ideas, strategic collapse, and weighing guidance. _Status: first slices done (see Tracker Status above) — `debate-round` now has `buildExtensionPrompts`/`buildRefutationPrompts`/`buildCollapsePrompts`/`buildWeighingGuidance`/`buildCoachingSession`/`buildCoachingSummaryText` for turning an already-flowed `Flow` into extension/refutation/collapse/weighing coaching prompts for a chosen side, reusing the existing `flow-transcript-summary.ts`/`response-outcome.ts`/`argument-tree.ts`/`drill-generator.ts` slices directly. A second slice, `coachingSessions.ts` (see Tracker Status above, "AI Coach Mode — coaching-session persistence"), now persists a round+side's generated `CoachingPrompt[]` session to localStorage. A third slice, `CoachingSessionsPanel` (see Tracker Status above, "AI Coach Mode — coaching-panel UI"), now renders every persisted coaching session grouped by round + side at `/coaching`, closing follow-up (b). A fourth slice (see Tracker Status above, "AI Coach Mode — real AI coaching-feedback call") added `round/coach-feedback-ai.ts` and `round/coach-feedback-client.ts`, wiring a "Get AI feedback" action into the panel that calls the existing `/api/reason-ai` Anthropic proxy with the session's own template prompts for real, open-ended AI coaching feedback, saved on `CoachingSessionRecord.aiFeedback`, closing follow-up (a). No follow-ups remain open on this bullet._
* 
* 🧑‍🤝‍🧑 Collaboration Prep Room - Create a shared prep space for teammates to research, draft blocks, organize evidence, and coordinate assignments. _Status: first slices done (see Tracker Status above) — `debate-card-search` now has `buildPrepRoom`/`searchPrepRoomEvidence`/`buildPrepRoomSummaryText` for composing the existing Shared Evidence Library and Research Task Routing slices into one topic-scoped prep room: organized evidence, draft blocks, and routed research assignments. A second slice, `buildPrepRoomFromStore` (see Tracker Status above, "Collaboration Prep Room Store Wiring"), now reads a topic's entries from the persisted `evidenceLibraryEntries.ts` store instead of requiring a caller-supplied entry list. A third slice, `state/prepRooms.ts`'s `buildPersistedPrepRoom`/`listPrepRoomTopics` plus `PrepRoomPanel` (see Tracker Status above, "Collaboration Prep Room — prep-room panel UI"), now composes a topic's coverage report and contributor list from their own persisted stores and renders a topic switcher, evidence/draft-block search, and routed-task view at `/cards/prep-room`, closing follow-up (a). A fourth slice (see Tracker Status above, "Team Collaboration Mode / Collaboration Prep Room — shared 'active now' presence signal") reused the same `lib/topic-presence.ts`/`state/topicPresence.ts` heartbeat primitive added for the Team Collaboration Mode idea's identical follow-up, wiring a live "active now" roster plus an "I'm active here" heartbeat control into the panel for its open topic, closing follow-up (b). No follow-ups remain open on this idea._
* 
* 🧠 Team Brainstorm Assist - Use AI to help the whole squad generate arguments, impact framing, frontlines, and responses during prep sessions. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildBrainstormPrompt`/`buildBrainstormPromptsForCoverageGaps` for structured, category-tagged brainstorm prompts (seedable straight from the existing Topic Coverage Dashboard's under-covered arguments) plus a squad idea board (`groupIdeasByBoard`/`rankBrainstormIdeas`/`buildBrainstormBoard`/`buildBrainstormBoardsForCoverageGaps`/`buildBrainstormSummaryText`) that ranks submitted ideas by the existing `community-rating.ts` popularity scoring and flags near-duplicates via the existing `llm-card-scoring.ts` uniqueness heuristic. A second follow-up, persisting submitted ideas and votes, is done — see the "Brainstorm Idea Persistence" entry above (`brainstormIdeas.ts`). A third slice, `BrainstormBoardPanel` (see Tracker Status above, "Team Brainstorm Assist — brainstorm-panel UI"), now renders a submission form and every board at `/cards/brainstorm`, closing follow-up (b). A fourth slice (see Tracker Status above, "Team Brainstorm Assist — real AI-generation call") added `lib/team-brainstorm-ai.ts` and `lib/team-brainstorm-client.ts`, wiring a "Generate AI ideas" action into the panel's submission form that calls the existing `/api/reason-ai` Anthropic proxy to draft several candidate ideas for the form's argument block/category, saved as normal, AI-attributed board ideas via the existing `saveBrainstormIdea`, closing follow-up (a). A fifth slice (see Tracker Status above, "Team Brainstorm Assist — seed boards from coverage gaps") added `state/brainstormIdeas.ts`'s `buildBrainstormBoardsPanelViewForTopic` and a topic switcher in `BrainstormBoardPanel`, wiring the existing `buildBrainstormBoardsForCoverageGaps` into the panel so choosing a tracked topic shows one board per under-covered tracked argument/category pair (with its prompt visible even before an idea is submitted) merged with every other board that already has a submitted idea, closing the "boards aren't seeded from the coverage-gap prompts" gap. No follow-ups remain open on this bullet._
* 
* 📋 Shared Evidence Library - Keep a team-wide repository of cards, tags, cites, analytics, and reusable blocks with fast search. _Status: first slices done (see Tracker Status above) — `debate-card-search` now has `searchEvidenceLibrary`/`findEntriesByCite`/`buildEvidenceLibraryIndex`/`buildEvidenceSearchSummaryText` for a fast-search `EvidenceLibraryEntry` repository (extending the existing Common Argument Library's `LibraryCard` with a full-text body, citation, and card-vs-reusable-block kind) — filterable by topic/case area/kind/tags and rankable by keyword-overlap relevance, reusing `argument-library.ts`'s tag filtering and the LLM Card Scoring slice's `scoreRelevance` directly. A second slice, `evidenceLibraryEntries.ts` (see Tracker Status above, "Shared Evidence Library — persisted evidence repository"), now persists `EvidenceLibraryEntry` records to localStorage. A third slice, `EvidenceLibraryPanel` (see Tracker Status above, "Shared Evidence Library — evidence library search UI panel"), now renders a free-text/kind search panel at `/cards/library`, closing follow-up (a). Follow-up (b), wiring `prep-room.ts` to read through this store, was also already closed separately by "Collaboration Prep Room Store Wiring"'s `buildPrepRoomFromStore` (see Tracker Status above). A fourth slice (see Tracker Status above, "Shared Evidence Library — topic/case-area/tag filter controls") added `lib/shared-evidence-library.ts`'s `buildEvidenceSearchFormQuery`, wiring Topic/Case area/Tags filter inputs into `EvidenceLibraryPanel`'s search box alongside the existing free-text/kind filters. A fifth slice (see Tracker Status above, "Shared Evidence Library — real search index") added `lib/evidence-search-index.ts`'s `buildEvidenceSearchIndex`/`searchEvidenceLibraryWithIndex` — a real token → postings-list inverted index ranked by TF-IDF instead of `searchEvidenceLibrary`'s full keyword-overlap re-scan — plus `state/evidenceLibraryEntries.ts`'s `searchPersistedEvidenceLibraryWithIndex`, added alongside (not replacing) the existing persisted search. A sixth slice (see Tracker Status above, "Shared Evidence Library — wire EvidenceLibraryPanel to the real search index") switched `EvidenceLibraryPanel`'s two search call sites from `searchPersistedEvidenceLibrary` to `searchPersistedEvidenceLibraryWithIndex`, closing follow-up (c) in full. A seventh slice (see Tracker Status above, "Shared Evidence Library — cache the search index across calls") added `state/evidenceLibraryEntries.ts`'s `getCachedEvidenceSearchIndex`, reusing the built index across calls instead of rebuilding it on every search, invalidated via a raw-JSON-string fingerprint comparison against both this store and `state/peerReviews.ts`'s persisted data (the new `getPeerReviewsRawSnapshot`), closing the remaining follow-up. An eighth slice (see Tracker Status above, "Shared Evidence Library — true incremental search-index updates instead of a full rebuild on every cache invalidation") added `lib/evidence-search-index.ts`'s `addEntryToIndex`/`removeEntryFromIndex`/`updateEntryInIndex`, and wired `getCachedEvidenceSearchIndex` to diff the live-entry set by id/content and apply them only to entries actually added, removed, or changed instead of calling `buildEvidenceSearchIndex` again on every invalidation, closing the "Known gaps" entry recorded in `docs/features/evidence-library.md`. A ninth slice (see Tracker Status above, "Shared Evidence Library — tag rename/merge tool") added `lib/argument-library.ts`'s `renameTagInList`/`renameTagAcrossCards` and `state/evidenceLibraryEntries.ts`'s `renameTagAcrossPersistedEntries`, wiring a "Rename/merge tag" form into `ArgumentLibraryPanel` (`/cards/argument-library`) that rewrites (or merges) a tag across every persisted entry that carries it, closing the "No tag rename/merge tool" Known gap recorded in `docs/features/evidence-library.md`. No follow-ups remain open on this bullet._
* 
* 🔄 Strategy Sync Notes - Let teammates leave live prep notes, assign tasks, and mark which arguments have been covered or need follow-up. _Status: first slices done (see Tracker Status above) — `debate-round` now has a box-addressed `PrepNote` model (`createPrepNote`/`updateNoteStatus`/`assignNote`) plus `getNotesForBox`/`getNotesForFlow`/`getNotesAssignedTo`/`getOpenFollowUps`/`resolvePrepNoteBox`/`buildPrepNoteSummaryText` for attaching a note to a specific flow argument, assigning it to a teammate as a task, and tracking whether it's still open, covered, or needs follow-up, reusing the existing `flow-annotations.ts` box-addressing convention directly. A second slice, `prepNotes.ts` (see Tracker Status above, "Prep Note Persistence"), now persists `PrepNote` records to localStorage, closing follow-up (a). A third slice, `updatePersistedPrepNoteStatus`/`assignPersistedPrepNote` (see Tracker Status above, "Prep Note Status/Assignment Persistence"), now applies `updateNoteStatus`/`assignNote`'s pure state transitions directly against a stored note and saves the result, closing that same persistence slice's own follow-up (b). A fourth slice, `PrepNotesPanel` (see Tracker Status above, "Strategy Sync Notes — prep-notes panel UI"), now renders every persisted prep note grouped by status at `/prep-notes` with status-cycle and assign actions, closing follow-up (a). A fifth slice (see Tracker Status above, "Strategy Sync Notes — assignee notification") added `flow/prep-note-notifications.ts` and `state/prepNoteNotifications.ts`, wiring `assignPersistedPrepNote` to record a notification for a note's new assignee on every real assignment, plus a `PrepNoteNotificationsPanel` at `/notifications` for a recipient to view and mark them read, closing follow-up (b). No follow-ups remain open on this bullet._
* 
* 📊 Matchup Prep Dashboard - Combine opponent profiles, judge profiles, and topic-specific prep into a single pre-round view. _Status: first slice done (see Tracker Status above, "Pre-Round Intelligence Panel") — `debate-round` now has `buildPreRoundBriefing`/`buildPreRoundBriefingText` for combining an opponent-scouting summary, judge-tendency summary, head-to-head record, and prep notes into one structured briefing. See idea #12 in Product Feature Ideas above for the full status and follow-ups._
* 
* 🧪 Practice Round Simulator - Recreate a tournament round with timer, speeches, judge persona, and post-round feedback. _Status: first slices done (see Tracker Status above) — `debate-round` now has `buildPracticeRoundSetup`/`buildPracticeRoundSetupText` for composing a format's speech order with a selected judge paradigm and AI opponent persona into a renderable round setup, and `buildPracticeRoundFeedback`/`buildPracticeRoundFeedbackText` for framing post-round feedback around the selected paradigm plus the existing AI Coach Mode coaching session, reusing the existing `ai-versus-speech-order.ts`/`judge-paradigms.ts`/`opponent-personas.ts`/`coach-mode.ts` slices directly. A second slice, `practiceRounds.ts` (see Tracker Status above), now persists a round's `PracticeRoundSetup`/`PracticeRoundFeedback` to localStorage. A third slice, `PracticeRoundSimulatorPanel` (see Tracker Status above, "Practice Round Simulator — round-simulator UI"), now renders a setup form and every persisted round at `/practice-round`, closing follow-up (b). A fourth slice (see Tracker Status above, "Practice Round Simulator — AI opponent speech + AI judge-decision calls") wires a "Generate AI opponent speech" action (reusing the existing AI-versus speech-generation calls against the round's own `aiVersusRounds.ts` state and saved persona) and a "Get AI judge decision" action (via a new `round/practice-round-judge-decision-wiring.ts`, composing the round's own saved judge paradigm with a saved flow summary) into the panel, closing follow-up (a). No follow-ups remain open on this idea._
* 
* 📚 AI Drill Generator - Generate quick drills for overviews, frontline practice, cross-ex responses, and collapse scenarios. _Status: first slices done (see Tracker Status above) — `debate-round` now has `buildOverviewDrill`/`buildFrontlineDrills`/`buildCrossExamDrills`/`buildCollapseDrills`/`buildDrillSet`/`buildDrillSummaryText` for turning an already-flowed `Flow` into a whole-round overview prompt, per-argument frontline/cross-ex prompts, and top-N collapse-scenario recommendations, reusing the existing `flow-transcript-summary.ts`/`response-outcome.ts` slices directly. A second slice, `drillSets.ts` (see Tracker Status above), now persists a round's generated `Drill[]` set to localStorage. A third slice, `DrillSetsPanel` (see Tracker Status above, "AI Drill Generator — drill-panel UI"), now renders every persisted drill set grouped by round at `/drills`, closing follow-up (a). A fourth slice (see Tracker Status above, "AI Drill Generator — real AI-generated drill script") added `round/drill-script-ai.ts` and `round/drill-script-client.ts`, wiring a "Get AI script" action into the panel per drill that calls the existing `/api/reason-ai` Anthropic proxy for an actual, ready-to-read practice script (rather than the template prompt line alone), saved on the drill set's new `aiScripts` map via `saveDrillAiScript`, closing follow-up (b). No follow-ups remain open on this bullet._
* 
* 🧭 Scout-to-Strategy Workflow - Turn scouting data into recommended game plans, case choices, judge adaptation, and risk levels. _Status: first slice done (see Tracker Status above) — `debate-round` now has `rankCaseOptions`/`computeCaseOverlapScore`/`buildJudgeAdaptationNotes`/`assessMatchupRisk`/`buildStrategyRecommendation`/`buildStrategyRecommendationText` for ranking caller-supplied case options by opponent-tag overlap, turning judge tendencies into adaptation notes, and combining opponent/judge signals into a risk level with its contributing factors, reusing the existing `OpponentTeamProfile`/`JudgeProfile` types directly. A second slice (see Tracker Status above, "Scout-to-Strategy Workflow — case-choice/strategy panel UI"), now persists a matchup's generated `StrategyRecommendation` to localStorage and renders a case-choice/strategy panel at `/strategy`, closing follow-up (a). A third slice (see Tracker Status above, "Scout-to-Strategy Workflow — side-aware risk heuristic") threaded an optional `ourSide` through the strategy-recommendation pipeline so `assessMatchupRisk` scopes its opponent-strength/judge-side-bias checks to the side the opponent will likely run against us, closing follow-up (b). A fourth slice (see Tracker Status above, "Scout-to-Strategy Workflow — AI-panel case-choice evaluation") added `round/case-choice-ai.ts` and `round/case-choice-client.ts`, wiring a "Get AI case-choice evaluation" action into `StrategyPanel.tsx` that calls the existing `/api/reason-ai` Anthropic proxy with a recommendation's own case rankings, judge-adaptation notes, and risk factors for a real strategic case-choice evaluation (not just the tag-overlap heuristic), saved on `StrategyRecommendationRecord.aiCaseChoice`, closing follow-up (c). No follow-ups remain open on this bullet._