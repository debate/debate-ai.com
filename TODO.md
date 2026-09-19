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

- `docs/features/argument-tree-outline.md`'s Known gaps: applying a saved
  outline filter preset only sets the filter — it doesn't select or scroll
  to the round it was saved from, so a preset saved while looking at one
  round still needs that round's card to already be visible to see the
  effect (`packages/debate-practice-drills/src/panels/ArgumentTreePanel.tsx`'s
  `applyPreset`, ~line 257). Small, concretely-scoped, not picked up this
  run only because one slice per run is the standing rule.
- `docs/internals/quest-streaks.md`'s Known gaps: a day's mission result is
  still computed by a manual button click rather than the existing weekly
  cron (`apps/debate-ai.com/wrangler.jsonc`'s `triggers.crons` /
  `worker/index.ts`'s `scheduled` export). Larger than the item above —
  needs iterating every synced account inside the scheduled handler — so
  left as a follow-up rather than this run's slice.

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
