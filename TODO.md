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

### Account-synced user data across all tools (user settings + SQL)

- Branch: `claude/gifted-babbage-c11oc8`
- [x] Audit local-only tool stores vs. the `saved_tool_records` catalog (SQL layer for settings, flows, rounds and 64+ tool collections already exists)
- [x] Sync pinned debates to the account (`pinnedDebates` catalog entry, legacy `pinned-debates` migration, tests, docs in `round-cloud-save.mdx`)
- [x] Sync speech-doc links (`speech-doc-links`; keyed by scope + speech, points at `documents.id`)
- [x] Sync flow-editor display/keymap settings (`ebb-display-settings`, `ebb-keymap-settings`) through `user_settings` (`flowEditorSettings` column; `debate-flow/src/lib/sync`)
- [ ] Tool UI pass: surface pin/save controls in each tool's header (sync badge already shipped; remaining: per-tool pin control) - kept In Progress

---

## Contribution Guidelines

1. **Pick an issue** or propose your own - comment on the issue to claim it
2. **Start small** - break large features into PR-sized chunks
3. **Write tests** - aim for &gt;80% coverage on new code
4. **Follow code style** - run linting/formatting before submitting
5. **Update docs** - README, API docs, and in-code comments
---

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
- [ ] Follow-up: persist baselines / auto-save flows so the marker survives a reload
- [ ] Follow-up: `ebb-dev-*` and `REASON-*` stores are still browser-only

### Tool UI pass: tool page header

- Branch: `agent/tool-header-single-sync-badge`
- [x] `ToolPageHeader` rendered `ToolSyncBadge` twice (merge damage); now once, with a regression test
- [ ] Follow-up: pin/save controls (not just sync status) in each tool's header

## Completed

### Fix duplicated tool-record catalog entries (merge damage)

- Branch: `claude/gifted-babbage-rvmkc4`
- `pinnedDebates` (4 entries) and `speechDocLinks` (2 entries) were each registered more than once in `TOOL_RECORD_COLLECTIONS`, failing "gives every collection a unique key" on master. Each now has one entry matching what the tools write (`pinnedDebates` -> `{ roundId, pinnedAt }`, `speechDocLinks` -> id-keyed record array).
- `togglePinnedDebate` passed an undefined `now` to `writePinnedDebateIds` (ReferenceError on every toggle); fixed.
- Added a unique-`storageKey` regression test; the speech-doc-links codec test now uses its own fixture collection.
- Known unrelated env failures: suites needing `debate-rankings` / `@debate/editor/engine` sources do not load in this checkout.

### Account-linked pinned debates

- PR #1095 (merged) — pins stored as `{ roundId, pinnedAt }` and added to the tool-record sync catalog; documented in `features/user-settings.mdx`.
