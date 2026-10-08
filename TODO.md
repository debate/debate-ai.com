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

## Account sync of tools (In Progress)

- [x] Speech-doc links (editor document <-> round/flow speech) sync via the `speechDocLinks` tool-record collection
- [x] Pinned debates - synced via the `pinnedDebates` tool-record collection
- [x] Surface the Tool data sync status where each tool is used (tool page header badge)

---

## In Progress

_(moved to Completed — see "Account-synced user data across all tools")_

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

- **[CardMirror](https://github.com/debate/cardmirror)** ProseMirror engine, packing
roughly 500 editing commands into ~30 thematic groups. Highlights (full 50+ feature list in the
[package README](./packages/debate-editor/README.md#cardmirror-features)):
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

## Crowdsourced Research 

- [Evidence Library](https://debate-ai.com/cards/library) — Search shared cut cards and reusable analytics by keyword, citation, argument, topic, or tag.
- [Argument Library](https://debate-ai.com/cards/argument-library) — Browse shared research through topic folders, case areas, and tag-based collections.
- [Contributions Feed](https://debate-ai.com/cards/contributions) — Submit, like, save, and endorse community cards, summaries, highlights, and annotations.
- [LLM Card Scoring](https://debate-ai.com/cards/scoring) — Score cards for relevance, clarity, uniqueness, evidence quality, and usability.
- [Revision Incentives](https://debate-ai.com/cards/revisions) — Reward and rank improvements to weak cards, citations, and stale evidence.
- [Review Queue](https://debate-ai.com/cards/reviews) — Move cards through draft, review, requested changes, approval, and publication.
- [Topic Coverage Dashboard](https://debate-ai.com/cards/coverage) — Identify missing, thin, covered, and untracked arguments by card and word count.
- [Task Inbox](https://debate-ai.com/cards/inbox) — Review research tasks routed to contributors and organized by topic.
- [Collaboration Prep Room](https://debate-ai.com/cards/prep-room) — Share a topic-specific prep space for evidence, draft blocks, tasks, and active teammates.
- [Team Collaboration Mode](https://debate-ai.com/cards/collaboration) — Leave, assign, and track live prep notes during shared topic sprints.
- [Prep Notes](https://debate-ai.com/prep-notes) — Maintain live prep notes grouped into needs-follow-up, open, and covered status.
- [Contacts](https://debate-ai.com/contacts) — Keep an account-linked contacts list (requests, blocking, who's online) and share the document you're editing as a live co-editing card straight to a contact's account.
- [Notifications](https://debate-ai.com/notifications) — See and mark read notifications for prep-note assignments and activity.
- [Team Brainstorm Assist](https://debate-ai.com/cards/brainstorm) — Submit, seed, organize, and upvote ideas for arguments, impacts, frontlines, and turns.
- [Group Challenges](https://debate-ai.com/cards/group-challenges) — Create squad challenges based on contributions or recorded rebuttal wins.
- [Research Progress](https://debate-ai.com/cards/progress-tracking) — Review contribution history, task-completion rates, and per-topic work progress.

## Community & Contributor Progress

- [Leaderboard](https://debate-ai.com/cards/leaderboard) — Rank contributors by helpfulness score, tier, badges, and quest streak.
- [News Stream](https://debate-ai.com/news) — View product updates, community announcements, Daily Best Card winners, and Contributor Award standings.
- [Contributor Awards](https://debate-ai.com/cards/awards) — See helpfulness-ranked category winners, such as best evidence finder and best explainer.
- [Daily Best Card](https://debate-ai.com/cards/best-card) — View the current highest-helpfulness card and prior daily winners.
- [Progress](https://debate-ai.com/cards/progress) — Track contributor tiers, badges, unlocked task levels, and daily-quest streaks.
- [Quest Streaks](https://debate-ai.com/cards/streaks) — View current and longest daily-quest streaks plus milestone badges.
- [Daily Quests](https://debate-ai.com/cards/quests) — Track team goals, such as finding solvency cards, against live same-day contributions.

## Practice & AI Rounds

- [Practice Drills](https://debate-ai.com/drills) — Run flow-derived overview, frontline, cross-examination, and collapse drills.
- [AI Coach Mode](https://debate-ai.com/coaching) — Generate extension, refutation, collapse, and weighing prompts from a round’s flow.
- [AI Judge Decision](https://debate-ai.com/judge-decision) — Generate an AI decision grounded in the selected judge paradigm and flow summary.
- [Word-Count Speeches](https://debate-ai.com/word-count) — Practice speeches under a maximum word count instead of a time limit.
- [Online Debate Versus AI](https://debate-ai.com/versus-ai) — Debate an AI opponent in real turn order using a chosen format and side.
- [Practice Round Simulator](https://debate-ai.com/practice-round) — Simulate a tournament round with a timer, AI judge paradigm, and AI opponent persona.
- [Speech Transcript Summaries](https://debate-ai.com/summaries) — Create per-argument flow summaries with cross-examination questions and extension ideas.
- [Argument Tree Outline](https://debate-ai.com/outline) — Browse and filter a structured outline of every argument in a round’s flow.
- [Flow Annotations](https://debate-ai.com/annotations) — Add timestamped annotations to individual flowed arguments while reviewing recordings.
- [AI Response-Outcome Charts](https://debate-ai.com/outcomes) — Analyze side exposure, vulnerable arguments, and hypothetical response paths in a flow.

## Scouting & Round Strategy

- [Judge Profiles](https://debate-ai.com/judges) — Review saved judges’ side-vote bias, speaker points, speed tolerance, and theory receptiveness.
- [Opponent Team Profiles](https://debate-ai.com/opponents) — Scout teams using records, side tendencies, common cases, and frequently used arguments.
- [Pre-Round Briefings](https://debate-ai.com/briefings) — Combine judge and opponent scouting, head-to-head records, and team prep notes for an upcoming round.
- [Scout-to-Strategy](https://debate-ai.com/strategy) — Convert scouting and judge tendencies into ranked case options and matchup-risk assessments.
- [Team Rankings](https://debate-ai.com/rank) — Browse debate-team rankings, leaderboards, and Elo ratings.
- [Coaching Programs](https://debate-ai.com/coaching-programs) — Run roster-scoped group coaching spaces with topic sprints, challenges, and drills.
- [Coach Materials](https://debate-ai.com/coach-materials) — Upload or dictate grounding material for the team coach AI and preview relevant sources.


## In Progress

### Saved-to-account indicator on flow tabs (slice of "integrate tools + user settings + SQL-linked flows/docs/debates")

- **Branch**: `claude/gifted-babbage-4ax563`
- **Status**: Settings, flows (`saved_flows`), rounds, documents, AI debates, ~60 tool stores and pinned debates already persist to D1 per user. Flow tabs now show whether each flow's current content has reached the account.
- [x] `state/flowAccountStatus.ts` — in-memory per-flow baseline (`hashFlowContent`) with a subscribe API
- [x] `FlowHistoryDialog` records successful single and bulk saves
- [x] `FlowTab` shows saved / changed-since-save icons
- [x] Vitest coverage (`flowAccountStatus.test.ts`, `FlowTab.test.tsx`)
- [x] Document in `features/user-settings.mdx`
- [x] Same marker for whole rounds on the `/debate` start screen cards (`recordRoundSavedToAccount`, `RoundAccountMarker`; branch `claude/gifted-babbage-a9pbpd`)
- [x] Persist baselines so the marker survives a reload: saves store `{ hash, updatedAt }` in localStorage and `restoreFlowAccountBaselines` adopts one only when the account's list reports the same `updatedAt` (never wrongly "saved" for another user); wired to the Flow History cloud-tab load (branch `claude/gifted-babbage-o37mws`)
- [x] Restore baselines on mount: `restoreAccountBaselinesOnce` (`state/restoreAccountBaselines.ts`, once per session, silent when signed out) via `useRestoreAccountBaselines` in `DebateStartPanel` and `OpenTabsGroup`; test `debate-round/test/restoreAccountBaselines.test.ts`; branch `claude/gifted-babbage-89z8b3`
- [x] Auto-save flows already saved to the account (`state/flowAutoSave.ts`, `useFlowAutoSave` in `OpenTabsGroup`, `getFlowAccountUpdatedAt`; debounced, never forces, conflicts left for Flow History; test `debate-round/test/flowAutoSave.test.ts`; branch `claude/gifted-babbage-31ofma`)
- [x] Opt-in setting to auto-save flows never saved before, plus an auto-save on/off toggle: `state/flowAutoSaveSettings.ts` (`off | saved | all`, device-local), `getMode` in `createFlowAutoSaver`, "Flow auto-save" select in `UserSettingsPanel`; tests `flowAutoSave.test.ts`, `flowAutoSaveSettings.test.ts`; docs in `user-settings.mdx` (branch `claude/gifted-babbage-eeg5we`)
- [x] Sync the auto-save mode to the account: `user_settings.flow_auto_save` column, `flowAutoSave` on `/api/settings` (`normalizeFlowAutoSavePatch`/`parseFlowAutoSave`), `UserSettingsPanel` adopts the account value on load and pushes changes; tests `flowAutoSaveSettings.test.ts`, route test in `settings-flow-editor-route.test.ts` (needs `debate-rankings` submodule); branch `claude/gifted-babbage-r2apft`
- [x] Deploy column: `ensureTableColumns(db, userSettings)` (`lib/database/ensure-columns.ts`, called by GET/PUT `/api/settings`) adds the nullable `flow_auto_save` column on first request; covered by `ensure-columns.test.ts`
- [x] `ebb-dev-flow-files` / `ebb-dev-recents` stay browser-only on purpose: `flowFsMemory.ts` documents them as a dev/test stand-in, not a product surface (real flows sync through `saved_flows`). `REASON-file-sources` already syncs (`toolRecordCollections.ts`)
- [x] `REASON-documents` needs no catalog entry (verified 2026-10-07): the `localStorage` key is only a read cache for the editor. Every edit already reaches the D1 `documents` table per user through `save-queue.ts` -> `PUT /api/doc/documents/:id` (`apps/debate-ai.com/app/api/doc/documents`, `ReasonDocsProvider`). Ids are server-assigned numbers, and a second copy under `saved_tool_records` would duplicate content and race the save queue. No redaction/size review is needed because nothing new leaves the browser

### Tool UI pass: tool page header

- Branch: `agent/tool-header-single-sync-badge`
- [x] `ToolPageHeader` rendered `ToolSyncBadge` twice (merge damage); now once, with a regression test
- [x] "Save now" / "Retry save" button beside the sync badge (`lib/tools/tool-save-now.ts`, `ToolSyncBadge`; branch `agent/tool-header-save-now`); the favorite star already sits in the same header row
- [x] `/debate` start screen shows the badge/Save now (`DebateStartPanel.headerActions`, `DebateFlowPage.startScreenActions`; branch `claude/gifted-babbage-1lcyd6`)
- [x] Shared-cards sub-pages (`/research/cards/library`, `/argument-library`, `/revisions`) show the badge/Save now: their collections are filed under the `/research/cards` hub, so `ToolPageHeader` takes `syncCollections` (resolved by `resolveToolSyncKeys`, tested); branch `claude/gifted-babbage-vqktca`
- [x] `/videos` library shows the badge/Save now beside its search bar (`LecturesPage.headerActionsSlot` -> `LecturesVideoGridView`, test `debate-videos/test/lectures-grid-header-actions.test.tsx`; branch `claude/gifted-babbage-68vx57`)
- [x] `/research/cards` search workspace shows the badge/Save now in a strip above the workspace (`routes/cards/page.tsx`, test `test/routes/cards/page.test.tsx`; branch `claude/gifted-babbage-or9nw5`)
- [x] Open round/flow workspace shows the badge in the speech controls bar (`DebateFlowPage.roundActions` -> `SpeechControlsTopBar.leadingActions`, test `debate-round/test/SpeechControlsTopBar.test.tsx`; branch `claude/gifted-babbage-fca6h1`); `/doc` already done
- [x] Open-flow bar Save now: `DebateFlowPage.roundActions` mounts the same `ToolSyncBadge` as the other headers, which already renders "Save now" / "Retry save" while changes are unsaved, so no extra wiring is needed (verified by reading `routes/debate/page.tsx`, `ToolSyncBadge.tsx`, `SpeechControlsTopBar.tsx`; tests not run, dependencies not installed in this session)
- [x] `ToolPageHeader.test.tsx` (incl. the `syncCollections` case) verified 2026-10-07 with the `debate-rankings` and `debate-editor-cm` submodules checked out and `sync-upstream.mjs` run: `bunx vitest run` on `debate-webview/test/components/tools` + `test/lib/tools` -> 9 files, 53 tests pass; `settings-flow-editor-route` + `ensure-columns` tests also pass (11 tests)
- [x] Button visibility/label logic extracted to `describeSaveNowButton` (`lib/tools/tool-save-state.ts`) and unit tested; branch `claude/gifted-babbage-bee65u`
- [x] DOM-level click test for `ToolSyncBadge` using jsdom + `react-dom/client` + `act` (no testing-library needed): `packages/debate-webview/test/components/tools/ToolSyncBadge.test.tsx` covers Save now -> flush -> saved, and Retry save with the error (branch `claude/gifted-babbage-zxyxfh`)

## Completed

### Account-synced user data across all tools (user settings + SQL)

- Branch: `claude/gifted-babbage-c11oc8`
- [x] Audit local-only tool stores vs. the `saved_tool_records` catalog (SQL layer for settings, flows, rounds and 64+ tool collections already exists)
- [x] Sync pinned debates to the account (`pinnedDebates` catalog entry, legacy `pinned-debates` migration, tests, docs in `round-cloud-save.mdx`)
- [x] Sync speech-doc links (`speech-doc-links`; keyed by scope + speech, points at `documents.id`)
- [x] Sync flow-editor display/keymap settings (`ebb-display-settings`, `ebb-keymap-settings`) through `user_settings` (`flow_editor_settings` column, `@debate/flow-ebb/account-settings`, `useAccountFlowSettingsSync`; docs in `user-settings.mdx`)
- [x] Tool UI pass: surface sync status and pin/save controls in each tool's header. Audit (2026-10-07): every route with a synced collection mounts `ToolSyncBadge` (via `ToolPageHeader` or its own bar; `/reason-editor` via `ReasonEditorStatusLine`, `/doc` and the open round via their own bars). The routes without one (`/tournaments`, `/tabroom`, `/settings/*`, `/coaching/laptopless`, `/features`, `/legal`, `/auth/*`, `/login`) have no `TOOL_RECORD_COLLECTIONS` entry, so there is nothing to badge. Only the test-environment follow-ups under "Tool UI pass: tool page header" remain
- Verified 2026-10-07 (`bun install --frozen-lockfile`; `bunx vitest run --config apps/debate-ai.com/vitest.config.ts` over `packages/debate-webview/test/components/tools`, `test/routes/cards`, `test/routes/videos-routes-sync-badge.test.tsx`): 16 tests pass in 5 suites; `ToolPageHeader.test.tsx` and `videos-routes-sync-badge.test.tsx` cannot load without the `debate-rankings` submodule (env, tracked under "Tool UI pass: tool page header")


### Sync flow-editor display/keymap settings to the account

- **Branch**: `agent/flow-settings-account-sync`
- Remaining slice of "Account-synced user data across all tools" (IDEAS.md). `ebb-display-settings` and `ebb-keymap-settings` now sync through a new `flow_editor_settings` column on `user_settings` (`PUT /api/settings { flowEditorSettings }`).
- [x] Pure validation/serialization `debate-flow/src/lib/store/flow-editor-settings-sync.ts` (device-bound `flowsDir`, `contacts`, collab connection toggles excluded)
- [x] Client + `startFlowSettingsAccountSync` (adopt account copy, seed empty account, debounced push, signed-out no-op) mounted in `EbbFlowEmbed`
- [x] Route + schema wiring in `apps/debate-ai.com`
- [x] Vitest `packages/debate-flow/test/flow-editor-settings-sync.test.ts`; documented in `features/user-settings.mdx`
- [x] Route-level test for `flowEditorSettings` GET/PUT: `apps/debate-ai.com/lib/database/__tests__/settings-flow-editor-route.test.ts` (real SQLite via `freshSchemaClient`, mocked auth; covers 401, save, merge, validation, bad JSON, per-user isolation; branch `claude/gifted-babbage-uhzbcl`). Needs the `debate-rankings` and `debate-editor-cm` submodules plus `node packages/debate-editor/scripts/sync-upstream.mjs`
- [ ] Follow-up: tool UI pass - sync status and pin/save controls in each tool's header (still In Progress in IDEAS.md)
- [x] Deploy column: `flow_editor_settings` is added the same way by `ensureTableColumns` on `/api/settings`, so no migration is needed


### Known base breakage found while verifying (resolved)

- `packages/debate-tournaments/src/ui/client.ts` was a half-resolved merge that stopped `tsc` for every importing package. It no longer reproduces: `bunx tsc --noEmit` in `packages/debate-tournaments` passes on this branch (2026-10-06).
- [x] Follow-up: reconstruct `createTournamentsClient`'s returned object against the new `get(root, path)` signature (already fixed on master).

### Fix duplicated tool-record catalog entries (merge damage)

- Branch: `claude/gifted-babbage-rvmkc4`
- `pinnedDebates` (4 entries) and `speechDocLinks` (2 entries) were each registered more than once in `TOOL_RECORD_COLLECTIONS`, failing "gives every collection a unique key" on master. Each now has one entry matching what the tools write (`pinnedDebates` -> `{ roundId, pinnedAt }`, `speechDocLinks` -> id-keyed record array).
- `togglePinnedDebate` passed an undefined `now` to `writePinnedDebateIds` (ReferenceError on every toggle); fixed.
- Added a unique-`storageKey` regression test; the speech-doc-links codec test now uses its own fixture collection.
- Known unrelated env failures: suites needing `debate-rankings` / `@debate/editor/engine` sources do not load in this checkout.

### Account-linked pinned debates

- PR #1095 (merged) — pins stored as `{ roundId, pinnedAt }` and added to the tool-record sync catalog; documented in `features/user-settings.mdx`.
