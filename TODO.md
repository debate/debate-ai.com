## Tracker Status

_Note: this section (In progress / Completed) previously tracked a long
history of small slices picked up by the standing autonomous-routine prompt
("integrate all the tools into the UI... create user settings and link user
db SQL with the ability to save flows/docs/debates in SQL and link to
users... add tools into where needed in the UI... develop better tool UI").
That history was rebuilt once already after being lost to a bad merge
(`4aa1c03`, "Prod (#863)"), then lost a second time when `2dbb655` ("Update
fmt.Println message from 'Hello' to 'Goodbye'") deleted this whole section
(2,666 lines) under a commit message unrelated to the diff it actually made —
worth a human looking at, since neither the message nor any linked issue
explains the deletion. It is not being reconstructed from memory a second
time — only what's confirmed against the current codebase is recorded from
here on._

### In progress

_No task currently in progress._

### Completed

- **📝 `Flow Annotations`' "no cloud sync" Known gap was stale — the sync
  already shipped.** `features/flow-annotations.mdx` said "No
  collaborative/live sync — annotations are local `localStorage` only."
  Confirmed false against the current code:
  `packages/debate-practice-drills/src/state/flowAnnotations.ts`'s
  `saveFlowAnnotation`/`deleteFlowAnnotation` already call
  `mirrorToolRecordSave`/`mirrorToolRecordDelete`, `flowAnnotations` is
  already a `TOOL_RECORD_COLLECTIONS` entry (added the same week as this doc
  went stale), and `internals/tool-data-sync.mdx` already lists Flow
  Annotations among the tools that Known gap was closed for. The one thing
  actually missing was `features/flow-annotations.mdx` itself never being
  updated to say so — confirmed by
  `packages/debate-practice-drills/test/tool-record-sync-wiring.test.ts`'s
  pre-existing "flow annotations" suite, which already pins the save+delete
  requests, the still-writes-locally-on-a-500 fallback, and the
  no-request-while-signed-out case; nothing there needed changing.

  Rewrote the doc's Known gaps to describe the real, already-tested
  behavior (with a `~~struck~~` **Fixed:** note, matching this file's own
  convention elsewhere) and linked out to `internals/tool-data-sync.mdx` for
  the gaps that genuinely still apply to every synced tool-record collection
  (per-user, not per-team; next-reload rather than live). Also added the
  mirror hop to the "Data flow" diagram.

  Docs-only change — no source behavior changed, so no new test was needed;
  the existing wiring test already covers the behavior the doc now
  describes. Ran the verification gate: `bun install`; the two affected test
  files directly (21/21); `bun run typecheck` (17/17 packages, including
  `debate-help-docs`' `fumadocs-mdx` MDX compile); `bun run test` (503
  files, 9394 tests, repo-wide, all passing); and `bun run build:web`
  (production build succeeded). Docs updated:
  `packages/debate-help-docs/content/docs/features/flow-annotations.mdx`.

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
