# Ideas for New Contributors


###  **Real-time Debate Rooms with WebSockets**

- **Description**: Implement live debate rooms where multiple users can join and debate in real-time with typing indicators, presence, and instant message delivery
- **Tech Stack**: WebSockets (Socket.io or native WS), Redis for pub/sub, React/Vue frontend
- **Difficulty**: Medium-High
- **Good First Issue**: Start with basic room creation/joining, then add real-time messaging

### **AI-Powered Argument Analysis & Feedback**

- **Description**: Build a feature that analyzes debate arguments for logical fallacies, evidence quality, and rhetorical strength, providing constructive feedback
- **use the llm in debate-speech-writer**
- **Difficulty**: High
- **Good First Issue**: Implement fallacy detection for common fallacies (ad hominem, straw man, false dichotomy)

### **Argument Visualization & Mind Mapping**

- **Description**: Visual representation of debate structure - claim trees, evidence links, rebuttal chains, and argument maps
- **Tech Stack**: D3.js, Cytoscape.js, or React Flow for interactive graphs, export to image/PDF
- **Difficulty**: Medium-High
- **Good First Issue**: Build a simple claim-evidence tree component with expand/collapse

---

## Additional Ideas (Bonus)

### 6\.  **Offline Support**

- Service workers, IndexedDB for offline drafting, push notifications for debate updates

### 7\. **Voice Debate Mode**

- Speech-to-text for arguments, text-to-speech for reading opponent arguments, voice activity detection

### 8\. **Debate Coaching AI Persona**

- Configurable AI personas (Socratic, Devil's Advocate, Fact-Checker) for practice sessions

### 9\. **Evidence Library & Citation Manager**

- Shared evidence database, auto-citation formatting, source credibility scoring

### 10\. **Analytics Dashboard for Debaters**

- Personal stats: win rate, fallacy frequency, argument length, topic expertise, improvement trends

1. ability to challenge legends - and speculators bet
2. random pair webcam debate matching on mutual pref topics

## Tool storage map + header note (Completed 2026-10-21, branch `claude/gifted-babbage-l06qxh`)

- [x] `resolveToolStorage` maps every `/tools` entry to synced collections, its own SQL table, or derived/none; guarded by `tool-storage.test.ts`
- [x] `ToolPageHeader` shows where the tool's data is saved (Vitest)
- [x] Follow-up withdrawn: per-tool "Save to account" buttons contradict `7428594` (Save now buttons removed on purpose); auto-sync is the model
- [ ] Follow-up (pre-existing): `apps/debate-web/lib/__tests__/tool-catalog-consistency.test.ts` imports a missing `packages/debate-editor/src/editor/workspace-links`; `bun run typecheck` in `debate-webview` reports unresolved `@debate-ai/editor/*` modules

## Account sync of tools (Completed)

- [x] Speech-doc links (editor document <-> round/flow speech) sync via the `speechDocLinks` tool-record collection
- [x] Pinned debates - synced via the `pinnedDebates` tool-record collection
- [x] Surface the Tool data sync status where each tool is used (tool page header badge)

- **In Progress 2026-10-21** (branch `claude/gifted-babbage-2agbmy`) — "Saved to your account" summary: `GET /api/settings/saved-data` + `SavedDataSection` in Settings → General (counts of docs, flows, rounds, debates saved in SQL per user), with Vitest.
  - [x] `loadOwnSavedData` + route, Vitest against in-memory SQLite
  - [x] `SavedDataSection` mounted in Settings → General, with Vitest
  - [x] Documented in `user-settings.mdx`
  - [x] List / open (docs) / delete individual saved docs, flows, rounds and practice debates from this section (2026-10-22, branch `claude/gifted-babbage-uf5f12`): `saved-data-items.ts`, `/api/settings/saved-data/[kind]`, **Manage** in `SavedDataSection`, with Vitest
  - [x] Export an individual saved item as JSON (2026-10-24, branch `agent/todo-saved-item-export`): `exportOwnSavedItem`, `GET /api/settings/saved-data/[kind]?id=`, **Export** link in `SavedDataSection`, with Vitest
  - [x] Bulk export (2026-10-24, branch `agent/todo-saved-data-bulk-export`): `exportAllOwnSavedData`, `GET /api/settings/saved-data?export=all`, **Export all as JSON** link in `SavedDataSection`, with Vitest; removed two stale duplicate export tests that failed on `master`
  - [x] Bulk export no longer capped at 100 per kind (2026-10-25, branch `claude/gifted-babbage-frrxt0`): pages through every row, `EXPORT_PAGE_SIZE`, with Vitest across page boundaries
  - [x] Paginate the **Manage** list (2026-10-26, branch `claude/gifted-babbage-c0kevh`): `listOwnSavedItemsPage`, `?offset=&limit=` + `hasMore` on `/api/settings/saved-data/[kind]`, **Load more** in `SavedDataSection`, with Vitest
  - [x] Stable open link for saved rounds restored (2026-10-26, branch `agent/todo-saved-rounds-open-link`): `/debate?roundId=<id>` (`buildRoundOpenHref`, `useOpenRoundFromLink`) was reverted to `href: null` by the pagination merge; `listOwnSavedItems` links it again, with a regression test and the docs line
  - [x] Tool Data Sync collections (`saved_tool_records`) included in the summary (branch `agent/todo-saved-data-tool-records`, Vitest in `saved-data.test.ts` + `saved-data-section.test.tsx`)
  - [ ] Follow-up: add the sync badge to open-flow tabs and the `/doc` header (existing known gap)

---

---

## Contribution Guidelines

1. **Pick an issue** or propose your own - comment on the issue to claim it
2. **Start small** - break large features into PR-sized chunks
3. **Write tests** - aim for &gt;80% coverage on new code
4. **Follow code style** - run linting/formatting before submitting
5. **Update docs** - README, API docs, and in-code comments
---




### 📚 CARDS: Crowdsourced Annotated Research for Debating Solutions

- **Auto-Highlight Agents:** agents highlight and underline as many words as needed on a slider, multiple options
- **Full-text search:** across thousands of tagged, annotated evidence cards spanning policy, LD, PF, and college formats
- **AI-powered annotation:** one-click summaries, warrant extensions, and logic-flaw detection per card
- **Three reading modes**: plain text, highlighted tags, and underline-only for fast cutting
- **Citation auto-formatter:** and one-click flow integration — paste directly into your speech doc
- **Mobile-responsive:** with full-screen card overlays for reading on the go
- **Auto-Research Outlines**: agents outline the topic to keyphrases and monitor for new quotes

<p align="center">
    <img src="https://i.imgur.com/1NBeQij.png" width="300" >
</p>

### ⚖️ FIAT: Forum for Issue Analysis on Topic

- **Recommendation Agents**: AI assists with research, summarization, flaw detection, and comparative quote analysis
- **Judge Decision**: agents prompts recommend multiple judge decision options, speech to flow, quote to response options
- **Multi-column flow spreadsheet**: format-specific speech columns for PF, LD, Policy, and NDT with inline editing
- **Shareable round URLs**: every round gets a permanent link; share with judges or teammates instantly
- **Round management**: tournament setup, team pairing, judge assignments, and round notes in one place
- **Speech docs**: full markdown editor per speech with email sharing to judges and coaches
-  **Smart timers**: format-aware prep and speech timers with audio/visual alerts and auto-advance
- **Collaboration**: invite judges and spectators by email; view-only and edit roles supported
- **Archive system**: save, browse, and restore any past round with full flow history
- **Mobile-optimized**: responsive design with swipe navigation between speech columns

<p align="center">
    <img src="https://i.imgur.com/eIQB4Sp.png" width="300"  >
</p>

### 🎥 LEARN: Lectures from Educators, Archive of Rounds & Notes

- **~1,400 college NDT rounds**: dating back to 1995, averaging 50+ new rounds per year, including recent TOC and NDT eliminations
- **~350 Public Forum rounds**: (2015–present), **~125 Policy rounds**: (2003–present), **~100 LD rounds** (2019–present)
- **~1000 instructional videos**: across 20 categories: topic lectures, camp coaching, kritik theory, counterplans, impact calc, novice intro, speaking & delivery, and more
- **~150 hand-curated top picks**: the highest-value rounds and lectures selected for study
- Searchable grid with filter by title, channel, year, or view count; inline YouTube playback with thumbnails
- **200-term Debate Dictionary**: with plain-English definitions for theory, kritik, and procedural jargon
- **26 years of national champion records**: (2000–2025) across NDT, Policy, LD, and PF
- **Team Rankings**: TOC bid list + DebateDrills Elo dual ranking system

<p align="center">
    <img width="300" src="https://i.imgur.com//LJ5hBjh.png" /> 
</p>

### 🔎 STREAM: Search with Top Result Extraction & Answer Model

- **Web Search**: 70+ popular sites search across 10 categories: Web Search, Academic, Videos, Images, Files, News, etc
- **Article Preview**: Extract, format with APA cite, and summarize articles, PDFs, Youtube, and URLs before reading them
- **User Choice of LLM**: OpenAI, Claude, Gemini, Groq, Ollama, Anthropic, etc
- **File Upload Support**: Ask questions about PDFs, URLs, DOCX, Google Docs, and Youtube
- **Search History**: All searches saved with memories, except for privacy mode
- **Follow-up Questions**: Generate follow-up questions to ask language models

<p align="center">
    <img width="300" src="https://i.imgur.com/pDvMC1Q.png" />
</p>

### 📝 REASON: Research Editor for Annotated Summaries in Outline Notation

- **[Debate Editor](https://github.com/debate/debate-editor)** ProseMirror engine, packing
roughly 500 editing commands into ~30 thematic groups. Highlights (full 50+ feature list in the
[package README](./packages/debate-editor/README.md#debate-editor-features)):
- **Structured outline**: pockets, hats, blocks, tags, cards, analytics, and undertags as first-class node types, with footnotes, tables, and live/transcluded zones
- **Lossless `.docx` and `.cmir` round-trip**: Verbatim Word interop plus a native gzip save format, including encrypted-`.docx` decryption and damaged-file salvage
- **Bulk conversion & compression**, automatic style cleanup on import, and a headless `cardmirror-read` CLI/MCP tool for AI-assistant access to files outside the app
- **One-click structural styles**: Pocket, Hat, Block, Tag, Analytic, Undertag, plus citation/underline/emphasis marks and acronym-aware variants
- **Highlight, shading, and font-color pickers** with standardization commands, a paintbrush mode, and highlight locking
- **Card numbering**, multiple **condense modes**, and a full editing-utilities set (shrink/regrow, short cites, live-zone refresh, heading move/copy/delete)
- **Real-time collaboration** (CRDT-backed via Loro) with share codes, invite links, and version recovery — plus an account-linked **contacts list** (requests, blocking, presence) to share a live card straight to a contact's account
- **Speech-doc targeting**: mark a doc as the live send target and send content at cursor or at end, with a persistent send history
- **Flow integration**: send cards or headings straight to a Flow column or cell, or pull content back
- **Dropzone card exchange**, **Quick Cards**, and a unified command-bar search across cards, commands, settings, and ~50 other site tools
- **AI tools**: ask-about-selection, AI-generated citations, translation, and AI-assisted text/formatting repair
- **Flashcards** with spaced-repetition review, a **card cutter** panel, voice dictation, and a reading-marker mode
- **Runtime plugin registry**, a 12-category menu bar, customizable keybindings, and per-user preferences synced to account settings
- **Native desktop/mobile wrapper**  running the identical editor with no browser chrome

## Crowdsourced Research, Community & Practice features

The live feature list lives in [`README.md`](./README.md#features) — one entry per tool, every link checked against the running app. Keep it in sync with the catalogs that decide what the app actually ships:

- `packages/debate-webview/src/routes/tools/tool-groups.ts` — `ALL_TOOLS` (the `/tools` catalog, the command palette and favorites)
- `packages/debate-webview/src/lib/feature-catalog.ts` — `APP_FEATURES` (the `/practice/features` page)
- `packages/debate-webview/src/routes/index.ts` — `PAGE_ROUTES` / `CLIENT_ROUTES` (the route table both catalogs point at)


