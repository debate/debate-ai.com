# Ideas for New Contributors


> **Scheduled run 2026-11-10, second run** (branch `claude/gifted-babbage-ehnuoa`): the tools / user settings / SQL-saved flows, docs and debates request is still shipped (re-verified `tool-storage.ts`, `SavedDataSection`, `ToolSyncStatusPanel`). Picked the next unblocked deferred slice of Argument Visualization: PNG export of the argument map. PDF stays deferred.
>
> **Scheduled run 2026-11-10** (branch `claude/gifted-babbage-0o1b2q`): the tools / user settings / SQL-saved flows, docs and debates request stays shipped (`tool-storage.ts`, `SavedDataSection`, Tool Data Sync). Rather than another no-op review, picked the unblocked deferred slice of Argument Visualization: image export of the argument map as SVG (see that section below). PNG/PDF stays deferred.
>
> **Tracker review 2026-11-09** (scheduled run, branch `claude/gifted-babbage-3qya2y`): no change. Re-verified `tool-storage.ts`, `SavedDataSection` (mounted in `EditorSettingsPanel`) and `saved-data-section.test.tsx` exist; branch is level with `master`. The tools / user settings / SQL-saved flows, docs and debates request stays shipped. The only open slice (fallacy hints on speech docs / flow cells, TODO.md) needs a product decision: speech docs are ProseMirror rich text and flow cells are grid cells, so where the scan runs and how text is extracted is undecided. No code change made.

> **Tracker review 2026-11-08, third run** (scheduled run, branch `claude/gifted-babbage-yjheea`): no change. Re-verified `tool-storage.ts`, `SavedDataSection` (mounted in `EditorSettingsPanel`) and `saved-data-section.test.tsx` exist; branch is level with `master`. The tools / user settings / SQL-saved flows, docs and debates request stays shipped; remaining Ideas are still decision-blocked (round-id schema, fallacy storage, flaw-finder UI placement, WebSocket/Redis infra), so no code was written.

> **Tracker review 2026-11-08, second run** (scheduled run, branch `claude/gifted-babbage-jm6o8v`): no change. Re-verified `tool-storage.ts`, `SavedDataSection` (mounted in `EditorSettingsPanel`) and `saved-data-section.test.tsx` exist; branch is level with `master`. The tools / user settings / SQL-saved flows, docs and debates request stays shipped; the only unchecked items (round-id schema, fallacy storage, flaw-finder UI placement) still need schema/product decisions, so no code was written.

> **Tracker review 2026-11-08** (scheduled run, branch `claude/gifted-babbage-y4y29m`): no change. Re-verified `tool-storage.ts`, `SavedDataSection` (mounted in `EditorSettingsPanel`) and `saved-data-section.test.tsx` exist; branch is level with `master`. The tools / user settings / SQL-saved flows, docs and debates request stays shipped; remaining Ideas are still decision-blocked (round-id schema, fallacy storage, flaw-finder UI placement, WebSocket/Redis infra), so no code was written.

> **Tracker review 2026-11-06, second run** (scheduled run, branch `claude/gifted-babbage-ypqm75`): no change. Re-verified `tool-storage.ts`, `SavedDataSection` (mounted in `EditorSettingsPanel`) and `saved-data-section.test.tsx` still exist; branch is level with `master`. The tools / user settings / SQL-saved flows, docs and debates request stays shipped; remaining Ideas are still decision-blocked (round-id schema, fallacy storage, flaw-finder UI placement, WebSocket/Redis infra), so no code was written.

> **Tracker review 2026-11-06** (scheduled run, branch `claude/gifted-babbage-56rcnl`): no change. Re-verified `tool-storage.ts`, `SavedDataSection` (mounted in `EditorSettingsPanel`) and `saved-data-section.test.tsx` still exist. The tools / user settings / SQL-saved flows, docs and debates request stays shipped; remaining Ideas are still decision-blocked (round-id schema, fallacy storage, flaw-finder UI placement, WebSocket/Redis infra), so no code was written.

> **Tracker review 2026-11-05** (scheduled run, branch `claude/gifted-babbage-txe85c`): no change. Re-verified `tool-storage.ts`, `SavedDataSection` (mounted in `EditorSettingsPanel`) and `saved-data-section.test.tsx` still exist. The tools / user settings / SQL-saved flows, docs and debates request stays shipped. Open PRs #1579-#1585 (search/D1, OpenRouter key, TTS, video player, docs) don't overlap it. Remaining Ideas are still decision-blocked (round-id schema, fallacy storage, flaw-finder UI placement, WebSocket/Redis infra), so no code was written.

> **Tracker review 2026-11-04** (scheduled run, branch `claude/gifted-babbage-dwlygl`): no change. Re-verified `tool-storage.ts`, `SavedDataSection` (mounted in `EditorSettingsPanel`) and `saved-data-section.test.tsx` on a branch level with `master`; the tools / user settings / SQL-saved flows, docs and debates request stays shipped. Remaining Ideas are still decision-blocked, so no code was written.

> **Tracker review 2026-11-03, second run** (scheduled run, branch `claude/gifted-babbage-blfcnl`): no change. Re-verified `tool-storage.ts`, `SavedDataSection` (mounted in `EditorSettingsPanel`) and `saved-data-section.test.tsx` on the branch, which is level with `master`. The tools / user settings / SQL-saved flows, docs and debates request stays shipped; the remaining Ideas are still decision-blocked, so no code was written.

> **Tracker review 2026-11-03** (scheduled run, branch `claude/gifted-babbage-965295`): no change. Re-verified `tool-storage.ts`, `SavedDataSection` (Settings) and its Vitest still exist on `master`, so the tools / user settings / SQL-saved flows, docs and debates request stays shipped. Remaining Ideas are still decision-blocked (round-id schema, fallacy storage, flaw-finder UI placement, WebSocket/Redis infra); no code written.

> **Tracker review 2026-11-02, second run** (branch `claude/gifted-babbage-tuwj8l`): same finding. The tools / user settings / SQL-saved flows, docs and debates request is shipped; open PRs #1552–#1554 (caselist, R2 card text, research sidebar) don't overlap it. The remaining Ideas stay decision-blocked, so no code was written.

> **Tracker review 2026-11-02** (scheduled run, branch `claude/gifted-babbage-lpe1h4`): no change since the 2026-11-01 review. Tools / user settings / SQL-saved flows, docs and debates remain shipped (`resolveToolStorage`, `SavedDataSection`, Tool Data Sync). Open PRs #1549 and #1550 are video-only and unrelated. The three unchecked items (fallacy storage, flaw-finder UI placement, round-id schema) plus real-time rooms still need product/infra decisions, so no code was written.

> **Tracker review 2026-11-01** (scheduled run, branch `claude/gifted-babbage-a5a5k2`): re-verified that the tool-integration / user-settings / SQL-saved flows, docs and debates request is already shipped (`resolveToolStorage` in `packages/debate-webview/src/lib/tools/tool-storage.ts`, `SavedDataSection` in Settings, Tool Data Sync). Every remaining unchecked item is still decision-blocked (round-id schema, fallacy data storage, flaw-finder UI placement, WebSocket/Redis infra), so no code change was made.

> **Tracker review 2026-10-28** (branch `claude/gifted-babbage-hphjre`): the request to integrate tools, user settings and SQL-backed saving of flows/docs/debates is already shipped (see TODO.md: tool storage map, Tool Data Sync, Settings → General "Saved to your account"). Argument maps (`debate-practice-drills`), AI personas (`debate-round-practice-ai/backend/personalities.ts`) and voice input (`speech-recognition.ts`) also exist. No unblocked Ideas item remains: real-time rooms (needs Redis/WebSocket infra on Cloudflare Workers), offline support and the fallacy/round-id items (need schema/product decisions) are all decision-blocked.


###  **Real-time Debate Rooms with WebSockets**

- **Description**: Implement live debate rooms where multiple users can join and debate in real-time with typing indicators, presence, and instant message delivery
- **Tech Stack**: WebSockets (Socket.io or native WS), Redis for pub/sub, React/Vue frontend
- **Difficulty**: Medium-High
- **Good First Issue**: Start with basic room creation/joining, then add real-time messaging

### **AI-Powered Argument Analysis & Feedback**

- **Description**: Build a feature that analyzes debate arguments for logical fallacies, evidence quality, and rhetorical strength, providing constructive feedback
- **use the llm in debate-speech-writer**
- **Slice 1 done 2026-10-28** (branch `claude/gifted-babbage-6h4sj0`): `detectFallacies` / `countFallaciesByKind` in `packages/debate-speech-writer/src/analysis/detect-fallacies.ts` (heuristic ad hominem, straw man, false dichotomy), with Vitest.
  - [ ] Follow-up (deferred): surface findings in the flaw-finder UI; LLM-backed fallacy analysis; feed counts into `buildDebaterStats` fallacy-frequency
  - Blocked/needs decision (2026-10-28 tracker review): there is no flaw-finder UI to mount findings in. `analyzeQuotes` is a batch outline utility over evidence-card HTML (not debater speech) and nothing in `apps/` or `packages/` calls it. Next slice needs a product decision on where the check runs (speech doc, flow cell or practice transcript) and where fallacy data is stored
- **Difficulty**: High
- **Good First Issue**: Implement fallacy detection for common fallacies (ad hominem, straw man, false dichotomy)

### **Argument Visualization & Mind Mapping**

- **Description**: Visual representation of debate structure - claim trees, evidence links, rebuttal chains, and argument maps
- **Tech Stack**: D3.js, Cytoscape.js, or React Flow for interactive graphs, export to image/PDF
- **Difficulty**: Medium-High
- **Good First Issue**: Build a simple claim-evidence tree component with expand/collapse
- **Completed (tracker review 2026-10-29, branch `claude/gifted-babbage-e155hc`)**: already shipped — `ArgumentTreePanel` and `ArgumentMapView` (`packages/debate-practice-drills/src/panels/`), `argument-map.ts` / `argument-tree-export.ts`, mounted in Coach Hub and `/outline`, documented in `argument-tree-outline.mdx`; `bunx vitest run --config apps/debate-web/vitest.config.ts` on `ArgumentTreePanel`, `ArgumentMapView`, `argument-map` tests → 23 pass
  - [x] Map image export, SVG slice (2026-11-10, branch `claude/gifted-babbage-0o1b2q`, PR #1630): **Download SVG** button on every map view (`ArgumentMapChart`), `buildArgumentMapSvg` / `argumentMapSvgFilename` in `packages/debate-practice-drills/src/panels/argument-map/export-svg.ts` inline the theme classes into a standalone light-palette SVG, with Vitest in `argument-map-export-svg.test.tsx`; documented in `argument-tree-outline.mdx` (features + internals)
  - [x] Map image export, PNG slice (2026-11-10, branch `claude/gifted-babbage-ehnuoa`, PR #1631): **Download PNG** button next to Download SVG in `ArgumentMapChart`; `argumentMapPngSize` (2x, clamped to 4096 px per side), `rasterizeSvgToPng` (injectable image/canvas, rejects on decode / context / encode failure) and `argumentMapPngFilename` in `packages/debate-practice-drills/src/panels/argument-map/export-png.ts`; busy state and a `role="alert"` fallback message; Vitest in `argument-map-export-png.test.tsx`; documented in `argument-tree-outline.mdx` (features + internals)
  - [ ] Follow-up (deferred, low priority): PDF export (print-to-PDF of the SVG covers it today); embedding the site web font in exported images
  - Remaining Bonus ideas 6–9 and Real-time Rooms are large or need product/infra decisions (WebSockets/Redis, speech APIs, persona design); none has a small independent slice yet

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
- **Completed 2026-10-21** (branch `agent/todo-debater-analytics-stats-gate`): `buildDebaterStats` in `packages/debate-round/src/round/debater-stats.ts` computes win rate, side/division/argument splits and recent-form trend from `ownRoundHistory` (account-synced via the `ownRoundHistory` tool-record collection).
  - [x] Pure stats model + Vitest
  - [x] `DebaterStatsPanel` mounted in the Prep Workspace ("Debater Stats" tab) and the Coach Hub Prep section, with Vitest
  - [x] Base blocker cleared: no merge-conflict markers remain on `master`; `bun run typecheck` (29/29 tasks) and `bun run build:web` pass
  - [x] Argument length (2026-10-22, branch `claude/gifted-babbage-r8x5vc`): optional `speechWordCount` on logged rounds, "Words spoken" input in the Log-a-round form, `speechLength` stat (average, wins vs losses) in `buildDebaterStats` and `DebaterStatsPanel`, with Vitest
  - [ ] Follow-up (deferred): record fallacy data so a fallacy-frequency stat can be added
  - [x] Word count can be derived from a saved flow (2026-10-27, branch `agent/todo-round-log-words-from-flow`)
  - [x] Logged rounds suggest/link a saved flow (2026-10-28 tracker review; `suggestFlowsForRound` + `flowClientId`, see TODO.md). Exact linking by round id stays deferred in TODO.md
  - [x] Argument-tag input added to the log form (2026-10-27, branch `claude/gifted-babbage-da9l0a`)
  - [x] Follow-up (pre-existing, unrelated): the sidebar tests asserting the old four-section nav were updated to Research / Coaching / Insights in `f09ee1c` and `a394e02` (verified 2026-10-21: `debate-videos` sidebar tests, `debate-webview` `judge-link.test.ts` and `dock-menu-sections.test.ts` pass). Remaining local failures in `debate-videos` / `site-footer` tests only occur when the `packages/debate-rankings` git submodule is not checked out (`git submodule update --init`)

1. ability to challenge legends - and speculators bet
2. random pair webcam debate matching on mutual pref topics
3. human feedback on redos and badges and practicle drills against 

## Account sync of tools (Completed 2026-10-07 — see TODO.md "Account-synced user data across all tools")

- [x] Speech-doc links (editor document <-> round/flow speech) sync via the `speechDocLinks` tool-record collection
- [x] Pinned debates - synced via the `pinnedDebates` tool-record collection (`{ roundId, pinnedAt }`; PR #1095)
- [x] Flow tabs and `/debate` round cards show a saved-to-account marker; flow auto-save mode syncs via `user_settings`
- [x] ~~Tool pages show the sync badge / Save now (`ToolPageHeader`, `ToolSyncBadge`)~~ — since removed on purpose (no badge or Save now in `ToolPageHeader`; auto-sync is the model). Sync status now lives in Settings → General (`ToolSyncStatusPanel`; corrected 2026-11-10, see TODO.md)
- [x] Tool UI pass finished; no open follow-ups (2026-10-08 tracker review)
- [x] Debater XP/level syncs via the `debaterLevel` tool-record collection (higher `totalXp` wins; 2026-10-20)
- [x] Signed-in tabs re-merge the account's tool records on refocus once the 10-minute TTL lapses, so other-device changes appear without a reload (2026-10-21; `useToolRecordSync`)
- [x] Font family preference syncs via `user_settings.font_family` (`PUT /api/settings { fontFamily }`; 2026-10-20)
- [x] Debater XP merges field by field across devices (`mergeDebaterLevel`, `merge` hook on tool-record collections; 2026-10-20)
- [x] Per-device XP ledger so lifetime XP/counts earned on two devices in the same window add (`DebaterXpLedger`, `ledger` in the `debaterLevel` record; 2026-10-20)
- [x] Repaired the bad merge `3c43976` (undefined `asSide`/`withUnseenEvents`/`eventId` broke typecheck and 36 tests): kept the per-device ledger design and dropped the overlapping per-event-id one (2026-10-21)
- [x] Today's per-activity counts add across devices via a per-day tally on each ledger entry (`DebaterDeviceTally.daily`; 2026-10-21)
- [x] A daily challenge that a merge alone pushes past its target is paid on load/focus (`settleDailyChallenges`, `settleDebaterChallenges`; 2026-10-21)
- [x] Coverage guard: `storage-key-coverage.test.ts` fails when a `STORAGE_KEY` store is neither synced (catalog or own route/`user_settings`) nor declared device-local (2026-10-22; branch `claude/gifted-babbage-rk9pwl`)

---

## Contribution Guidelines

1. **Pick an issue** or propose your own - comment on the issue to claim it
2. **Start small** - break large features into PR-sized chunks
3. **Write tests** - aim for &gt;80% coverage on new code
4. **Follow code style** - run linting/formatting before submitting
5. **Update docs** - README, API docs, and in-code comments