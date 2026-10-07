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

## Account sync of tools (Completed)

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

## Completed

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

## In Progress

### Tool UI pass: tool page header

- Remaining items are environment-only (missing `debate-rankings` submodule / no `@testing-library/react`); no product work is left.

- Branch: `agent/tool-header-single-sync-badge`
- [x] `ToolPageHeader` rendered `ToolSyncBadge` twice (merge damage); now once, with a regression test
- [x] "Save now" / "Retry save" button beside the sync badge (`lib/tools/tool-save-now.ts`, `ToolSyncBadge`; branch `agent/tool-header-save-now`); the favorite star already sits in the same header row
- [x] `/debate` start screen shows the badge/Save now (`DebateStartPanel.headerActions`, `DebateFlowPage.startScreenActions`; branch `claude/gifted-babbage-1lcyd6`)
- [x] Shared-cards sub-pages (`/research/cards/library`, `/argument-library`, `/revisions`) show the badge/Save now: their collections are filed under the `/research/cards` hub, so `ToolPageHeader` takes `syncCollections` (resolved by `resolveToolSyncKeys`, tested); branch `claude/gifted-babbage-vqktca`
- [x] `/videos` library shows the badge/Save now beside its search bar (`LecturesPage.headerActionsSlot` -> `LecturesVideoGridView`, test `debate-videos/test/lectures-grid-header-actions.test.tsx`; branch `claude/gifted-babbage-68vx57`)
- [x] `/research/cards` search workspace shows the badge/Save now in a strip above the workspace (`routes/cards/page.tsx`, test `test/routes/cards/page.test.tsx`; branch `claude/gifted-babbage-or9nw5`)
- [x] Open round/flow workspace shows the badge in the speech controls bar (`DebateFlowPage.roundActions` -> `SpeechControlsTopBar.leadingActions`, test `debate-round/test/SpeechControlsTopBar.test.tsx`; branch `claude/gifted-babbage-fca6h1`); `/doc` already done
- [x] Open-flow bar Save now: `DebateFlowPage.roundActions` mounts the same `ToolSyncBadge` as the other headers, which already renders "Save now" / "Retry save" while changes are unsaved, so no extra wiring is needed (verified by reading `routes/debate/page.tsx`, `ToolSyncBadge.tsx`, `SpeechControlsTopBar.tsx`; tests not run, dependencies not installed in this session)
- [ ] Follow-up: `ToolPageHeader.test.tsx` (incl. the new `syncCollections` case) cannot load in a checkout without the `debate-rankings` submodule; verify in CI
- [x] Button visibility/label logic extracted to `describeSaveNowButton` (`lib/tools/tool-save-state.ts`) and unit tested; branch `claude/gifted-babbage-bee65u`
- [ ] Follow-up: DOM-level click test for `ToolSyncBadge` (no `@testing-library/react` in webview tests)

## Completed (earlier)

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
