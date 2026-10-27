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
- **Completed 2026-10-21** (branch `agent/todo-debater-analytics-stats-gate`): `buildDebaterStats` in `packages/debate-round/src/round/debater-stats.ts` computes win rate, side/division/argument splits and recent-form trend from `ownRoundHistory` (account-synced via the `ownRoundHistory` tool-record collection).
  - [x] Pure stats model + Vitest
  - [x] `DebaterStatsPanel` mounted in the Prep Workspace ("Debater Stats" tab) and the Coach Hub Prep section, with Vitest
  - [x] Base blocker cleared: no merge-conflict markers remain on `master`; `bun run typecheck` (29/29 tasks) and `bun run build:web` pass
  - [x] Argument length (2026-10-22, branch `claude/gifted-babbage-r8x5vc`): optional `speechWordCount` on logged rounds, "Words spoken" input in the Log-a-round form, `speechLength` stat (average, wins vs losses) in `buildDebaterStats` and `DebaterStatsPanel`, with Vitest
  - [ ] Follow-up (deferred): record fallacy data so a fallacy-frequency stat can be added
  - [x] Word count can be derived from a saved flow (2026-10-27, branch `agent/todo-round-log-words-from-flow`)
  - [ ] Follow-up (deferred): link logged rounds to a flow automatically; add an argument-tag input to the log form
  - [x] Follow-up (pre-existing, unrelated): the sidebar tests asserting the old four-section nav were updated to Research / Coaching / Insights in `f09ee1c` and `a394e02` (verified 2026-10-21: `debate-videos` sidebar tests, `debate-webview` `judge-link.test.ts` and `dock-menu-sections.test.ts` pass). Remaining local failures in `debate-videos` / `site-footer` tests only occur when the `packages/debate-rankings` git submodule is not checked out (`git submodule update --init`)

1. ability to challenge legends - and speculators bet
2. random pair webcam debate matching on mutual pref topics
3. human feedback on redos and badges and practicle drills against 

## Account sync of tools (Completed 2026-10-07 — see TODO.md "Account-synced user data across all tools")

- [x] Speech-doc links (editor document <-> round/flow speech) sync via the `speechDocLinks` tool-record collection
- [x] Pinned debates - synced via the `pinnedDebates` tool-record collection (`{ roundId, pinnedAt }`; PR #1095)
- [x] Flow tabs and `/debate` round cards show a saved-to-account marker; flow auto-save mode syncs via `user_settings`
- [x] Tool pages show the sync badge / Save now (`ToolPageHeader`, `ToolSyncBadge`)
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