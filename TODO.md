
improve the ui's and have demo mock data samples for t4sting these out with ui's

Done (first slice): `/tools`' "My Saved Items" widget rendered nothing at
all for a signed-in user with no cloud-saved data yet — indistinguishable
from broken, and no demo of what the widget (or the tools it links) does.
It now shows a small "Try These Tools" preview of sample cards, each
badged "Sample" and linking to a real tool page, in that case. See
`getSampleCloudLibraryItems` in `packages/debate-round/src/state/cloudLibrary.ts`
and its use in `packages/debate-webview/src/routes/tools/MySavedItems.tsx`.
Only this one widget got sample data — every other tool page that shows an
empty state for a new user (the editor's file tree, Practice Drills history,
the Evidence Library, etc.) is the same gap and a good follow-up, one PR per
tool rather than a single sweeping change.

Done (second slice, Evidence Library): `/cards/library`'s Shared Evidence
Library showed a bare "No entries match this search." for a brand-new user
with zero submitted cards/blocks, indistinguishable from the same message a
real search-with-no-matches produces. It now shows a sample card and a
sample block, each badged "Sample", whenever the persisted repository is
genuinely empty (`hasEntries === false`) — a real "no matches" search on a
non-empty repository still gets the plain message. See
`getSampleEvidenceLibraryEntries` in
`packages/debate-search-evidence/src/lib/shared-evidence-library.ts` and its
use in `packages/debate-search-evidence/src/panels/EvidenceLibraryPanel.tsx`.
Practice Drills history and the REASON editor's file tree remain open
follow-ups, one PR each.

Done (third slice, Practice Drills history): `/drills`' Practice Drills
panel showed a bare "No practice drills yet." for a user with no persisted
drill sets, with no demo of what a generated drill set looks like. It now
shows a read-only sample drill set — one drill per kind (overview,
frontline, cross-ex, collapse), badged "Sample" — under that message
whenever `drillSets.length === 0` (past the loading state), never mixed
into a real, possibly-empty result. See `getSampleDrillSets` in
`packages/debate-practice-drills/src/state/drillSets.ts` and its use in
`packages/debate-practice-drills/src/panels/DrillSetsPanel.tsx`. The REASON
editor's file tree remains the last open follow-up from this ask.

Done (fourth slice, REASON editor file tree): `/reason-editor`'s file-tree
sidebar showed a bare "No documents yet." for a signed-in user with no
documents yet, with no demo of what an organized file tree looks like. It now
shows a small read-only "Example file tree" preview (one folder, two files),
badged "Sample", under that message whenever the caller's `documents` array
is empty — a user with any real document (even zero after that) never sees
it, since the gate is on the real `documents` prop, not the derived tree.
Sample rows are not interactive (no click/drag/rename/delete) since they
don't back a real row. See `getSampleReasonDocuments` in
`packages/debate-webview/src/lib/reason-docs/sample-documents.ts` and its use
in `packages/debate-webview/src/components/reason-docs/FileTree.tsx`. This
closes the last open follow-up from the "sample mock data for empty states"
ask — every other tool page flagged in earlier slices now has this
treatment.

Known blocker (unrelated to the above): a full monorepo `bun run test` run
currently fails ~89 tests across 22 files, all with
`ENOENT: .../apps/debate-ai.com/drizzle/0003_dark_zarek.sql` or similar —
commit `39076f1` (".") added `drizzle/` to `.gitignore` and removed every
tracked migration file under `apps/debate-ai.com/drizzle/`, which every
test that spins up an in-memory D1/libSQL db by replaying those migrations
depends on. This same directory was accidentally deleted and restored once
already (`2566e0d` / `d58d57f`), so this looks like a repeat of that
accident rather than an intentional change — worth a maintainer decision
(restore the tracked migrations, or migrate every affected test to a
different fixture strategy) rather than a silent restore from an
autonomous run. Unrelated to `debate-search-evidence`, whose own suite
(1298 tests) and typecheck are unaffected and pass in full.



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


11. abiltiy to challenge legends - and speculators bet
12. 

---

## Contribution Guidelines

1. **Pick an issue** or propose your own - comment on the issue to claim it
2. **Start small** - break large features into PR-sized chunks
3. **Write tests** - aim for >80% coverage on new code
4. **Follow code style** - run linting/formatting before submitting
5. **Update docs** - README, API docs, and in-code comments

6. do order aiutoamativlly for roo and sync timer
