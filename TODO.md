## Tracker Status

_Note: this section (In progress / Completed) previously tracked a long
history of small slices picked up by the standing autonomous-routine prompt
("integrate all the tools into the UI... create user settings and link user
db SQL with the ability to save flows/docs/debates in SQL and link to
users... add tools into where needed in the UI... develop better tool UI").
That history was lost when `4aa1c03` ("Prod (#863)") reset this file to the
generic contributor-ideas stub below, most likely by a merge that resolved
this file to a stale branch state rather than the tip. It is not being
reconstructed from memory — only what's confirmed against the current
codebase is recorded from here on._

### In progress

_No task currently in progress._

### Completed

- **📇 Quick Cards full-library "clear" now issues one bulk delete instead of
  one per card.** Another repeat of the standing autonomous-routine prompt
  above — as with every prior repeat (reconfirmed fresh this run: 19
  `saved_*` D1 tables link to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), all 65
  `TOOL_RECORD_COLLECTIONS` entries sync through `saved_tool_records`, and
  every tool is reachable from `/tools`, CardMirror's `MenuBar`/command
  palette, and the feature catalog), that prompt's own asks are already
  fully built. There were no open PRs to build on. This run first
  investigated this file's own flagged follow-up —
  `docs/internals/quest-streaks.mdx`'s "wire mission-result computation to
  the weekly cron" gap — and confirmed it's more blocked than previously
  framed: `computeAndSavePersistedDailyMissionResult`
  (`packages/debate-contributor-progress/src/state/dailyMissionResults.ts`)
  derives a day's result from `state/contributions.ts`, which is pure
  browser `localStorage` with no D1 table or server API at all, so the
  Worker's `scheduled` export (`apps/debate-ai.com/worker/index.ts`) has
  nothing server-side to iterate — this needs a new D1 table and sync layer
  (a real backend-architecture decision, including how to migrate existing
  localStorage data), not a single-PR wiring fix, so it stays a follow-up,
  reframed below. Re-scanned other `packages/debate-help-docs` "Known gaps"
  sections instead and picked `quick-cards-cloud-save.mdx`'s: a full-library
  "clear" issued one `DELETE /api/quick-cards/[cardId]` call per card
  instead of a single bulk request, unlike `/api/tool-records/[collection]`'s
  existing bulk-clear route for the sidebar's other localStorage-backed
  tools.

  `apps/debate-ai.com/app/api/quick-cards/route.ts` gets a new `DELETE`
  handler (mirroring `/api/tool-records/[collection]`'s) that deletes every
  `saved_quick_cards` row for the signed-in user in one query.
  `packages/debate-editor/src/editor/quick-cards-client.ts` gets a matching
  `clearSavedQuickCardsFromAccount()`. `quick-cards-store.ts`'s `clear()`
  now calls it once instead of looping `deleteSavedQuickCardFromAccount`
  per id.

  Vitest-covered: `packages/debate-editor/test/quick-cards-client.test.ts`
  gets a new `describe` block for `clearSavedQuickCardsFromAccount` (the
  right endpoint/method, and the server-error-message passthrough).
  `packages/debate-editor/test/quick-cards-store.test.ts`'s existing clear
  test now asserts a single bulk-clear call instead of one delete per card
  (its shared `stubFetch` helper learned to route a DELETE to the bare
  `/api/quick-cards` endpoint to a new `onClear` callback). The API route's
  `DELETE` handler itself isn't independently tested — no route handler in
  `apps/debate-ai.com/app/api` has a test file in this repo (0 found), so
  this doesn't add the first one.

  Ran the full verification gate: `bun install`, the two updated test files
  (34 passing) plus `packages/debate-editor`'s own `bunx vitest run` (37
  files, 794 tests), `bun run test` (477 files, 8980 tests passing,
  repo-wide), `bunx turbo run typecheck` (17/17 packages green,
  `debate-ai-web` included), and `bun run build:web` (production build,
  succeeded — the pre-existing `no output files found for task
  debate-editor#build` warning is unrelated `turbo.json` `outputs` config,
  not a build failure). No `lint`/`format:check` script exists anywhere in
  this repo, so that step was skipped as not applicable. Docs updated:
  `quick-cards-cloud-save.mdx`'s feature description and Known gaps (entry
  removed).

- **🖨️ Print/Export the shortcuts reference scoped to an active search,
  instead of always the full list.** Another repeat of the standing
  autonomous-routine prompt above — as with every prior repeat (reconfirmed
  fresh this run: 19 `saved_*` D1 tables link to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), all 65
  `TOOL_RECORD_COLLECTIONS` entries sync through `saved_tool_records`, and
  every tool is reachable from `/tools`, CardMirror's `MenuBar`/command
  palette, and the feature catalog), that prompt's own asks are already
  fully built. There were no open PRs to build on. The prior run's two
  fresh candidates (outline-preset jump, CardMirror download) are both
  already fixed, so this run re-scanned every `packages/debate-help-docs`
  doc's "Known gaps" section for a still-open, small, concretely-scoped
  item (two more turned out stale — already fixed in code, not flagged
  here) and picked `legacy-verbatim-shortcuts.mdx`'s: "Print/Export always
  render the full reference, ignoring an active search filter."

  `packages/debate-editor/src/editor/reference-export.ts` gets a new pure
  `filterShortcutsReferenceGroups(groups, query)` — same case-insensitive
  label-or-keybinding substring predicate the on-screen modal's
  `applyFilter` already used for DOM show/hide, now reusable off the DOM.
  `reference-ui.ts`'s Print/Export/Download-PDF button handlers in
  `render()` now call it with the live `this.searchQuery` at click time
  (via a `filteredGroups()` closure) instead of passing the unfiltered
  `groups` straight through to `print()`/`exportAsText()`/`exportAsPdf()`;
  their button `title`s dropped the now-inaccurate "full" wording.

  Vitest-covered: `packages/debate-editor/test/reference-export.test.ts`
  gets a new `describe` block (5 cases — empty/whitespace query is a
  no-op, matches by label, matches by keybinding text, a group with every
  row filtered out is dropped entirely, no match returns `[]`).
  `reference-ui.ts`'s click-handler wiring itself isn't independently
  tested, matching this file's existing convention (no test in this
  package renders `ReferenceModal` — `applyFilter`'s own DOM behavior next
  to it isn't unit-tested either).

  Ran the full verification gate: `bun install`, the new/updated test file
  (10 passing) plus `packages/debate-editor`'s own `bunx vitest run` (37
  files, 792 tests), `bunx tsc --noEmit` (clean), `bun run test` (477
  files, 8978 tests passing, repo-wide), `bunx turbo run typecheck` (17/17
  packages green, `debate-ai-web` included), and `bun run build:web`
  (production build, succeeded — the pre-existing `no output files found
  for task debate-editor#build` warning is unrelated `turbo.json`
  `outputs` config, not a build failure). No `lint`/`format:check` script
  exists anywhere in this repo, so that step was skipped as not
  applicable. Docs updated: `legacy-verbatim-shortcuts.mdx`'s Known gaps
  entry (fixed, folded into the feature description).

- **🔖 Jump to a saved Outline filter preset's origin round when applying
  it.** Another repeat of the standing autonomous-routine prompt above — as
  with every prior repeat (per the lost history noted above, and
  reconfirmed fresh this run), that prompt's own asks are already fully
  built: 19 `saved_*` D1 tables (`user_settings`/`documents`/`saved_flows`/
  `saved_rounds` among them) all link to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), all 65 entries of
  `TOOL_RECORD_COLLECTIONS` (`packages/debate-data-sync`) sync their
  localStorage-backed tool to the account through the generic
  `saved_tool_records` table, and every tool is already reachable from the
  `/tools` page, CardMirror's own `MenuBar`/command palette, and the feature
  catalog. There were no open PRs to build on, so this slice picked up the
  first item already named in this file's own Follow-ups below:
  `argument-tree-outline.mdx`'s Known gap that applying a saved outline
  filter preset only ever changed the filter of whichever round card was
  already on screen — it never selected or scrolled to a particular round.

  `packages/debate-round/src/state/outlineFilterPresets.ts`'s
  `OutlineFilterPreset` gets an optional `roundId` field recording which
  round's outline a preset was saved from (validated in `isValidPreset`,
  round-trips through the existing `serializeOutlineFilterPresets`/
  `parseOutlineFilterPresets` JSON column unchanged). `handleSavePreset` in
  `packages/debate-practice-drills/src/panels/ArgumentTreePanel.tsx` now
  passes that round's id through `useOutlineFilterPresets`' `addPreset`.
  The panel's global "Saved filter presets" list (previously just a
  removable badge per preset) now also makes each preset's name clickable:
  clicking it applies the preset to its origin round and
  `scrollIntoView`s that round's card, via a new pure
  `state/outlineFilterPresetJump.ts#resolvePresetJumpRoundId` (preset +
  round-card refs in a `useRef` map) that decides whether there's a round
  left to jump to — `null` for a preset saved before this field existed, or
  whose origin round's outline was since cleared, in which case the name
  stays inert and the preset remains usable from any round's own
  pre-existing "Filter presets" dropdown exactly as before.

  Vitest-covered: `packages/debate-round/test/outlineFilterPresets.test.ts`
  (new cases — a preset list with/without `roundId` validates, a
  non-string `roundId` is rejected, `roundId` round-trips through
  serialize/parse) and a new
  `packages/debate-practice-drills/test/outlineFilterPresetJump.test.ts`
  covering `resolvePresetJumpRoundId`'s four cases (round still exists,
  preset predates tracking, origin round deleted, empty round list). The
  DOM-touching half (`scrollIntoView`, the `useRef` map, the button's
  disabled/title state) isn't independently tested, mirroring this
  package's existing convention for its other localStorage/DOM-bound hooks
  (e.g. `useOutlineFilterPresets`/`useWordLimitPresets` each only unit-test
  their pure `storage`-event predicate, not `addPreset`/`removePreset`
  themselves) — no test in this package renders `ArgumentTreePanel` or any
  other panel component today.

  Ran the full verification gate: `bun install`, the new/updated test files
  (32 passing) plus `bun run test` (477 files, 8973 tests passing,
  repo-wide), `bunx turbo run typecheck` (17/17 packages green,
  `debate-ai-web` included), and `bun run build:web` (production build,
  succeeded — the pre-existing `no output files found for task
  debate-editor#build` warning is unrelated `turbo.json` `outputs` config,
  not a build failure). No `lint`/`format:check` script exists anywhere in
  this repo, so that step was skipped as not applicable. Docs updated:
  `argument-tree-outline.mdx`'s Filter presets section (describes the new
  jump behavior) and Known gaps (entry removed).

- **📎 Offer a download of unreadable CardMirror content instead of just
  discarding it.** Another repeat of the standing autonomous-routine prompt
  above — as with every prior repeat (per the lost history noted above, and
  reconfirmed fresh this run), that prompt's own asks are already fully
  built: `user_settings`/`documents`/`saved_flows`/`saved_rounds` and 25+
  other `saved_*` D1 tables all link to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), every one of the 13
  localStorage-backed tool stores syncs to the account through the generic
  `saved_tool_records` table (`TOOL_RECORD_COLLECTIONS` in
  `packages/debate-data-sync`), and every tool is already reachable from the
  `/tools` page, CardMirror's own `MenuBar`/command palette
  (`Mod-Shift-Space`), and the feature catalog. There were no open PRs to
  build on, so this slice picked a fresh, still-open,
  concretely-scoped item: `docs/features/cardmirror-embed-persistence.md`'s
  Known gaps named that the CardMirror singleton refuses to load a document
  whose stored HTML fails to parse, and — because nothing typed into that
  pane is ever saved once it's marked unreadable — whatever a user then
  types is silently discarded with no way to recover it, only a notice
  saying so.

  `packages/debate-editor/src/editor/status-notices.ts`'s `NoticeInput` gets
  an optional `download?: { filename, content }` field; `renderPanel()` adds
  a "Download" button (next to the existing Copy/Dismiss) that Blob+anchor
  downloads it, mirroring the anchor+Blob pattern already used throughout
  `debate-round`/`debate-practice-drills`/`debate-team-collaboration`'s
  panels (e.g. `ArgumentTreePanel.tsx`'s `handleDownload`). A repeat
  `postNotice` under the same coalescing key keeps a previously-attached
  download rather than dropping it if the repeat doesn't re-attach one.
  `packages/debate-editor/src/react/singleton.ts`'s `markUnreadable` (both
  call sites, in `claim()`) now passes the raw `html` that failed
  `parseHtml` through as that download's content, named
  `unreadable-<key>.html` — `<key>` run through a new `sanitizeForFilename`
  (collapses anything outside `[A-Za-z0-9._-]` to `-`) since `key` is
  `contentKey ?? title ?? "default"` (`CardMirrorEditor.tsx`), a free-form
  document title, not already filename-safe.

  Vitest-covered: `packages/debate-editor/test/status-notices.test.ts` (new
  — no Download button without a payload, button renders and downloads the
  right Blob/filename on click with `URL.createObjectURL`/`revokeObjectURL`
  stubbed, a coalesced repeat keeps the earlier download, dismissing still
  hides the chip) and `packages/debate-editor/test/singleton.test.ts` (new —
  `sanitizeForFilename`'s handling of path separators, punctuation runs,
  leading/trailing dashes, and the empty/all-unsafe fallback to
  `"document"`). `singleton.ts`'s `markUnreadable`/`claim()` themselves
  aren't independently tested here or anywhere else in this package — they
  need a full engine boot (`../editor/index.js`, ~10k lines) and a live
  `EditorView`, which no existing test in this package sets up; the new
  coverage stops at the two pure/testable boundaries (the notice model,
  the filename sanitizer) rather than adding that scaffolding for one field.

  Ran the full verification gate: `bun install`, the two new test files (9
  passing) plus `packages/debate-editor`'s own `bunx vitest run` (37 files,
  787 tests) and `bunx tsc --noEmit` (clean), `bun run test` (476 files,
  8966 tests passing, repo-wide), `bunx turbo run typecheck` (17/17 packages
  green, `debate-ai-web` included), and `bun run build:web` (production
  build, succeeded). No `lint`/`format:check` script exists anywhere in this
  repo, so that step was skipped as not applicable. Docs updated:
  `docs/features/cardmirror-embed-persistence.md`'s Known gaps entry (marked
  fixed) and Tests list.

## Follow-ups

- `docs/internals/quest-streaks.mdx`'s Known gaps: a day's mission result is
  still computed by a manual button click rather than the existing weekly
  cron (`apps/debate-ai.com/wrangler.jsonc`'s `triggers.crons` /
  `worker/index.ts`'s `scheduled` export). Investigated this run and it's
  blocked on more than just wiring: `computeAndSavePersistedDailyMissionResult`
  derives a result from `state/contributions.ts`, which is pure browser
  `localStorage` with no D1 table or server API — the Worker's `scheduled`
  export has no server-side data to iterate at all. Closing this for real
  needs a new D1 table plus a sync layer for contributions (what to persist,
  how to migrate a device's existing localStorage history), which is a
  backend-architecture decision this routine defers rather than one small
  PR's worth of wiring. Left as a follow-up, not picked up this run.

---

# Ideas for New Contributors

_The list below predates this file's numbered-idea tracking convention and
is generic starter material, not audited against the current codebase —
treat entries here as inspiration to investigate, not confirmed gaps. See
"Tracker Status" above for the actual, current state of similarly-themed
work in this repo._

### 1. **Real-time Debate Rooms with WebSockets**
- **Description**: Implement live debate rooms where multiple users can join and debate in real-time with typing indicators, presence, and instant message delivery
- **Tech Stack**: WebSockets (Socket.io or native WS), Redis for pub/sub, React/Vue frontend
- **Difficulty**: Medium-High
- **Good First Issue**: Start with basic room creation/joining, then add real-time messaging

### 2. **AI-Powered Argument Analysis & Feedback**
- **Description**: Build a feature that analyzes debate arguments for logical fallacies, evidence quality, and rhetorical strength, providing constructive feedback
- **Tech Stack**: NLP (spaCy, transformers), OpenAI/Anthropic API or local LLMs, Python/FastAPI backend
- **Difficulty**: High
- **Good First Issue**: Implement fallacy detection for common fallacies (ad hominem, straw man, false dichotomy)

### 3. **Debate Tournament & Bracket System**
- **Description**: Create a tournament mode with brackets, seeding, elimination rounds, and leaderboards for competitive debating
- **Tech Stack**: Database (PostgreSQL/MongoDB), bracket generation algorithms, real-time updates
- **Difficulty**: Medium
- **Good First Issue**: Design the data model for tournaments, matches, and participants

### 4. **Multi-language Debate Support with Translation**
- **Description**: Enable debates across languages with real-time translation, allowing global participation
- **Tech Stack**: Translation APIs (Google Translate, DeepL, or LibreTranslate), i18n framework, language detection
- **Difficulty**: Medium
- **Good First Issue**: Add language selection to user profiles and basic UI translation

### 5. **Argument Visualization & Mind Mapping**
- **Description**: Visual representation of debate structure - claim trees, evidence links, rebuttal chains, and argument maps
- **Tech Stack**: D3.js, Cytoscape.js, or React Flow for interactive graphs, export to image/PDF
- **Difficulty**: Medium-High
- **Good First Issue**: Build a simple claim-evidence tree component with expand/collapse

---

## Additional Ideas (Bonus)

### 6. **Mobile-Responsive PWA with Offline Support**
- Service workers, IndexedDB for offline drafting, push notifications for debate updates

### 7. **Voice Debate Mode**
- Speech-to-text for arguments, text-to-speech for reading opponent arguments, voice activity detection

### 8. **Debate Coaching AI Persona**
- Configurable AI personas (Socratic, Devil's Advocate, Fact-Checker) for practice sessions

### 9. **Evidence Library & Citation Manager**
- Shared evidence database, auto-citation formatting, source credibility scoring

### 10. **Analytics Dashboard for Debaters**
- Personal stats: win rate, fallacy frequency, argument length, topic expertise, improvement trends

---

## Contribution Guidelines

1. **Pick an issue** or propose your own - comment on the issue to claim it
2. **Start small** - break large features into PR-sized chunks
3. **Write tests** - aim for >80% coverage on new code
4. **Follow code style** - run linting/formatting before submitting
5. **Update docs** - README, API docs, and in-code comments

## Getting Started

```bash
# Clone and setup
git clone https://github.com/debate/debate-ai.com
cd debate-ai.com
bun install

# Run dev server
bun run dev

# Run tests
bun run test

# Typecheck
bun run typecheck
```

## Resources

- [Documentation site](packages/debate-help-docs) — `docs/features/*` and
  `docs/internals/*` cover almost every shipped feature and its known gaps
- [Architecture overview](.claude/architecture/overview.md)
- [Web app architecture](.claude/architecture/web-app.md)
- [Conventions](.claude/architecture/conventions.md)

---

*Last updated: 2026-09-19*
