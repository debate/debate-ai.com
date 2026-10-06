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
- [x] Sync flow-editor display/keymap settings (`ebb-display-settings`, `ebb-keymap-settings`) through `user_settings` (`flow_editor_settings` column, `@debate/flow-ebb/account-settings`, `useAccountFlowSettingsSync`; docs in `user-settings.mdx`)
- [ ] Tool UI pass: surface sync status and pin/save controls in each tool's header (header badge, Save now, favorite star and the shared-cards sub-pages done; remaining custom headers tracked under "Tool UI pass: tool page header")

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
- [x] Persist baselines so the marker survives a reload: saves store `{ hash, updatedAt }` in localStorage and `restoreFlowAccountBaselines` adopts one only when the account's list reports the same `updatedAt` (never wrongly "saved" for another user); wired to the Flow History cloud-tab load (branch `claude/gifted-babbage-o37mws`)
- [ ] Follow-up: restore baselines on app/round mount (today it happens when the Flow History "Saved to account" tab loads) and auto-save flows
- [ ] Follow-up: `ebb-dev-*` and `REASON-*` stores are still browser-only

### Tool UI pass: tool page header

- Branch: `agent/tool-header-single-sync-badge`
- [x] `ToolPageHeader` rendered `ToolSyncBadge` twice (merge damage); now once, with a regression test
- [x] "Save now" / "Retry save" button beside the sync badge (`lib/tools/tool-save-now.ts`, `ToolSyncBadge`; branch `agent/tool-header-save-now`); the favorite star already sits in the same header row
- [x] `/debate` start screen shows the badge/Save now (`DebateStartPanel.headerActions`, `DebateFlowPage.startScreenActions`; branch `claude/gifted-babbage-1lcyd6`)
- [x] Shared-cards sub-pages (`/research/cards/library`, `/argument-library`, `/revisions`) show the badge/Save now: their collections are filed under the `/research/cards` hub, so `ToolPageHeader` takes `syncCollections` (resolved by `resolveToolSyncKeys`, tested); branch `claude/gifted-babbage-vqktca`
- [x] `/videos` library shows the badge/Save now beside its search bar (`LecturesPage.headerActionsSlot` -> `LecturesVideoGridView`, test `debate-videos/test/lectures-grid-header-actions.test.tsx`; branch `claude/gifted-babbage-68vx57`)
- [x] `/research/cards` search workspace shows the badge/Save now in a strip above `SearchInterface` (`routes/cards/page.tsx`, test `test/routes/cards/search-page-sync-badge.test.tsx`; branch `claude/gifted-babbage-ejpopv`)
- [ ] Follow-up: other custom headers (open-flow tabs, `/doc`) still lack the badge/Save now
- [ ] Follow-up: `ToolPageHeader.test.tsx` (incl. the new `syncCollections` case) cannot load in a checkout without the `debate-rankings` submodule; verify in CI
- [ ] Follow-up: component test for `ToolSyncBadge` click path (no `@testing-library/react` in webview tests)

## Completed

### Sync flow-editor display/keymap settings to the account

- **Branch**: `agent/flow-settings-account-sync`
- Remaining slice of "Account-synced user data across all tools" (IDEAS.md). `ebb-display-settings` and `ebb-keymap-settings` now sync through a new `flow_editor_settings` column on `user_settings` (`PUT /api/settings { flowEditorSettings }`).
- [x] Pure validation/serialization `debate-flow/src/lib/store/flow-editor-settings-sync.ts` (device-bound `flowsDir`, `contacts`, collab connection toggles excluded)
- [x] Client + `startFlowSettingsAccountSync` (adopt account copy, seed empty account, debounced push, signed-out no-op) mounted in `EbbFlowEmbed`
- [x] Route + schema wiring in `apps/debate-ai.com`
- [x] Vitest `packages/debate-flow/test/flow-editor-settings-sync.test.ts`; documented in `features/user-settings.mdx`
- [ ] Follow-up: route-level test for `flowEditorSettings` GET/PUT (no existing route test harness for `/api/settings`)
- [ ] Follow-up: tool UI pass - sync status and pin/save controls in each tool's header (still In Progress in IDEAS.md)
- [ ] Follow-up: deploy must apply the new column (schema.ts is the only source now that `drizzle/` is gone)


### Known base breakage found while verifying (not fixed here)

- `packages/debate-tournaments/src/ui/client.ts` is a half-resolved merge (`return     upcoming: ...` at ~line 323, no object opening; `get` now takes a root), so `tsc` stops at syntax errors for every package that imports it and `bun run typecheck` fails.
- [ ] Follow-up: reconstruct `createTournamentsClient`'s returned object against the new `get(root, path)` signature.

### Fix duplicated tool-record catalog entries (merge damage)

- Branch: `claude/gifted-babbage-rvmkc4`
- `pinnedDebates` (4 entries) and `speechDocLinks` (2 entries) were each registered more than once in `TOOL_RECORD_COLLECTIONS`, failing "gives every collection a unique key" on master. Each now has one entry matching what the tools write (`pinnedDebates` -> `{ roundId, pinnedAt }`, `speechDocLinks` -> id-keyed record array).
- `togglePinnedDebate` passed an undefined `now` to `writePinnedDebateIds` (ReferenceError on every toggle); fixed.
- Added a unique-`storageKey` regression test; the speech-doc-links codec test now uses its own fixture collection.
- Known unrelated env failures: suites needing `debate-rankings` / `@debate/editor/engine` sources do not load in this checkout.

### Account-linked pinned debates

- PR #1095 (merged) — pins stored as `{ roundId, pinnedAt }` and added to the tool-record sync catalog; documented in `features/user-settings.mdx`.
