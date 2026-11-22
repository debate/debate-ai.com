# Ideas for New Contributors

> **Scheduled run 2026-11-22, third run** (branch `claude/gifted-babbage-ystm4n`, PR #1863): open PRs #1858–#1862 edit Practice vs AI, the round's AI Outcome Responses, the saved-row API routes and the Settings tool-storage list, so this run stayed out of their files. For "user settings … link to users", it moved the **video watch page's remembered choices** (copy format, auto-scroll, Skip breaks, live caption box) from four browser-only keys into one store that syncs to the account (see "Sync the video watch page's choices to the account" under Account sync of tools below).

> **Scheduled run 2026-11-22, second run** (branch `claude/gifted-babbage-3gzrq6`, PR #1857): open PR #1856 already takes the last Account-sync follow-up (debrief save order), so this run stayed off its files' changed lines. For "develop better tool UI" on the debates the routine saves, it closed a documented Known gap of Practice vs AI: the **Coach debrief** now reads the opponent's speeches and the arguments each side chose on the setup wizard, not only the user's speeches (see "Give the Coach debrief the whole round" under Account sync of tools below).

> **Scheduled run 2026-11-21, fifth run** (branch `claude/gifted-babbage-05ry7b`, PR #1855): no open PRs. For "save … debates in SQL and link to users", it took the ready follow-up of PR #1854: a signed-in Practice vs AI round now keeps the **Judge feedback style** its verdict was written in, with the round in D1, and Debate History says which style judged it (see "Save the Judge feedback style with its round" under Account sync of tools below).

> **Scheduled run 2026-11-21, fourth run** (branch `claude/gifted-babbage-j4px8s`, PR #1854): open PRs #1850–#1852 edit Settings, saved-data and Account sync files, and #1853 is help-docs reading mode, so this run stayed out of all of them. For "save … debates in SQL and link to users", it took a documented Known gap of Practice vs AI: the scorecard's **Coach debrief** was shown once and lost. A signed-in round now keeps its latest debrief with the round in D1, and Debate History shows it (see "Save the Coach debrief with its round" under Account sync of tools below).

> **Scheduled run 2026-11-16, second run** (branch `claude/gifted-babbage-dafs2u`, PR #1785): only PR #1783 (HISTORY docs) is open, so the Settings-overlap blocker is cleared. The deep-link follow-up was already on `master` (tracker corrected). This run added **Settings → General → Coaching styles**: every AI coach's remembered style, changeable in one place, with **Reset all to Standard** (see TODO.md).

> **Scheduled run 2026-11-16** (branch `claude/gifted-babbage-y48nil`, PR #1774): 17 PRs are open. Eight of them (#1758, #1760, #1766–#1768, #1770, #1771, #1773) edit the same Settings / saved-data / account-sync files, so this run stayed out of them. It capped the watch page's "Do the full speech" drafts in `localStorage` at the 40 most recently saved, a documented reliability gap in `debate-videos` (see TODO.md). Next step needs the owner: review or merge the queued Settings PRs before the routine adds more slices there.

> **Scheduled run 2026-11-15, second run** (branch `claude/gifted-babbage-s5mc2s`): the editor-patch blocker is fixed on `master` (`1c8b7f3`) and PR #1743 already records it. Open PRs #1743–#1748 don't touch the Account sync panel. This run improved that panel: it now says how many tools are synced, and **Sync now** shows a busy, disabled "Syncing…" state while a merge runs (see TODO.md).

> **Scheduled run 2026-11-15** (branch `claude/gifted-babbage-x9xeup`): no open PRs. The stale root-scripts follow-up was already fixed on `master`. This run took the remaining unblocked follow-up of the user-settings-in-SQL request: the storage-key coverage guard now follows storage wrappers. That surfaced `flows` / `rounds` (via `getBulkItem` / `setBulkItem`), which had never been audited (see TODO.md).

> **Scheduled run 2026-11-14, fifth run** (branch `claude/gifted-babbage-swzqsw`): open PR #1738 is native-wrapper and doesn't overlap. Took the ready follow-up of PR #1736 for the user-settings-in-SQL request: the storage-key coverage guard now also audits `apps/debate-web` and keys passed straight to `localStorage` (literal or template), and classifies the 13 newly seen keys; the QwkSearch chat model choice and editor plugin settings are listed as awaiting a sync decision (see TODO.md).

> **Scheduled run 2026-11-14, fourth run** (branch `claude/gifted-babbage-63g3lb`, PR #1736): open PRs #1733 / #1735 are reason-docs / help-docs and don't overlap. Took the ready follow-up of PR #1726 for the user-settings-in-SQL request: the storage-key coverage guard now audits every `*_KEY` localStorage store, not just `STORAGE_KEY`, and all ~45 newly seen keys are classified (see TODO.md).

> **Scheduled run 2026-11-14, third run** (branch `claude/gifted-babbage-2ms8pf`): open PRs #1727 / #1728 are rankings / videos and don't overlap. Took the follow-up of PR #1722 for the SQL-saved debates request: **Restore from export…** now brings back practice debates vs AI instead of skipping them (see TODO.md).

> **Scheduled run 2026-11-14, second run** (branch `claude/gifted-babbage-w8r3o6`, PR #1722): the ready root-scripts follow-up is already covered by open PR #1721, so this run took a Known gap of the SQL-saved data request instead. **Restore from export…** in Settings now brings back word-count rounds and drill sets, where before it skipped them (see TODO.md). Practice debates vs AI stay skipped (follow-up).

> **Scheduled run 2026-11-14** (branch `claude/gifted-babbage-p1au8q`): no open PRs remain, so the overlap blocker of 2026-11-11 is cleared. The tools / user settings / SQL-saved flows, docs and debates request stays shipped; this run took its ready follow-up — Coach Materials' "Ask the coach" coaching style is now remembered per account (see TODO.md).

> **Scheduled run 2026-11-11, fourth run** (branch `claude/gifted-babbage-jb3rg3`): PR #1662 is repairing `master` and the saved-data / Settings files, so this run stayed out of them. It added the coaching-style picker to the Team Coach Q&A ("Ask the coach" on Coach Materials), a deferred follow-up of bonus idea 8 (see TODO.md).

> **Scheduled run 2026-11-11** (branch `claude/gifted-babbage-uk1vcn`): the tools / user settings / SQL-saved flows, docs and debates request stays shipped. Open PRs #1634 (Manage search) and #1638 (where each tool saves) already cover the nearest slices, so this run linked each "Saved to your account" row to the tool that opens it (see TODO.md). It also added a route check that found the `vulnerabilityReports` → `/coaching/outcomes` dead link (follow-up in TODO.md).
>

> **Scheduled run 2026-11-11** (branch `claude/gifted-babbage-oulxdq`): no code written, no PR opened. 19 PRs are open, most from this routine and unreviewed, and several overlap each other: #1634 and #1648 (search saved items in Manage), #1638 and #1649 (where each tool saves), #1646 and #1650 (manage saved drill sets), plus #1643, #1645, #1651, #1652 on the same `SavedDataSection`. Every new slice of the tools / user settings / SQL-saved flows, docs and debates request touches that same component, so another PR would only add merge conflicts. Next step needs the owner: merge or close the duplicate pairs. The routine should resume once the open settings PRs are down to one or two.
>
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
  - [x] Map image export, PDF slice (2026-11-11, branch `claude/gifted-babbage-qvhoi7`, PR #1644): **Download PDF** button next to Download PNG in `ArgumentMapChart`; dependency-free one-page PDF writer `buildImagePdf` (JPEG embedded via `/DCTDecode`, byte-exact xref), `argumentMapPdfPageSize` (on-screen size at 96 px = 72 pt), `argumentMapToPdf` and `argumentMapPdfFilename` in `packages/debate-practice-drills/src/panels/argument-map/export-pdf.ts`; `rasterizeSvgToImage` generalizes the PNG rasterizer to JPEG; PNG and PDF share one busy state and alert; Vitest in `argument-map-export-pdf.test.tsx`; documented in `argument-tree-outline.mdx` (features + internals)
  - [x] Site font in exported images (2026-11-15, branch `claude/gifted-babbage-eoiwrw`): SVG / PNG / PDF name the page's font and inline its `@font-face` files as `data:` URLs (`export-fonts.ts`), so the PNG and PDF render in it too; see TODO.md "Draw argument-map exports in the site font"
  - [ ] Follow-up (deferred, low priority): a vector (selectable-text) PDF would need a PDF library
  - Remaining Bonus ideas 6–9 and Real-time Rooms are large or need product/infra decisions (WebSockets/Redis, speech APIs, persona design); none has a small independent slice yet

---

## Additional Ideas (Bonus)

### 6\.  **Offline Support**

- Service workers, IndexedDB for offline drafting, push notifications for debate updates

### 7\. **Voice Debate Mode**

- Speech-to-text for arguments, text-to-speech for reading opponent arguments, voice activity detection

### 8\. **Debate Coaching AI Persona**

- Configurable AI personas (Socratic, Devil's Advocate, Fact-Checker) for practice sessions
- **Slice 1 done 2026-11-11** (branch `claude/gifted-babbage-7huvxp`): coaching personas for AI Coach Mode feedback — see TODO.md "Debate Coaching AI Persona". Opponent personas (policy-heavy, critique, lay, fast-flow) already existed in `opponent-personas.ts`; this adds the coaching side.
  - [ ] Follow-up (deferred): ~~personas for the team coach Q&A~~ (done 2026-11-11) and ~~the practice-vs-AI coach~~ (done 2026-11-15 as the judge feedback style, see TODO.md); ~~remember the chosen style per account~~ (done); custom coaching personas

### 9\. **Evidence Library & Citation Manager**

- Shared evidence database, auto-citation formatting, source credibility scoring
- **Slice: auto-citation formatting** (started 2026-11-10, branch `claude/gifted-babbage-mruc9z`). The shared evidence database already exists (`/research/cards/library`, `EvidenceLibraryPanel`).
  - Goal: a **Format citation** button in the Evidence Library submission form that rewrites a pasted citation short-cite first (`Smith 24 — Jane Smith, …`) and appends the Source URL
  - Non-goals: MLA / APA / Chicago styles; parsing title/publication/date fields; the button in the card editor or Contributions Feed dialog; source credibility scoring
  - [x] `formatEvidenceCitation` in `packages/debate-search-evidence/src/lib/citation-format.ts`, reusing `debate-card-parser`'s `extractCiteInfo` + `formatShortCiteTag`; idempotent, `null` when blank or no author
  - [x] **Format citation** button + `aria-live` note under the Citation field in `EvidenceLibraryPanel`
  - [x] Vitest: `test/citation-format.test.ts`, **Format citation** block in `test/EvidenceLibraryPanel.test.tsx`
  - [x] Docs: `features/research-evidence/evidence-library.mdx` (section + Known gap) and new `dev-docs/internals/evidence-citation-format.mdx`
  - [x] Verification (2026-11-10, after `git submodule update --init` and `node scripts/sync-upstream.mjs` in `debate-editor` / `debate-tournaments`): `bun run typecheck` (32/32), `bun run test` (1110 files / 15133 tests pass, 19 skipped), `bun run build:web` pass
  - **Completed 2026-11-10** — PR #1639 (awaiting review)
  - [ ] Follow-up (deferred): other citation styles; ~~the same button in the Contributions Feed `SubmitEvidenceDialog`~~; source credibility scoring (needs a product decision on the signal)
    - Checked 2026-11-15: `SubmitEvidenceDialog` (the **Submit card** popup on the cards search page) renders `EvidenceLibraryPanel submitOnly`, so it already has **Format citation**. The Contributions Feed form (`ContributionsFeedPanel`) has no citation field at all, so the button needs a product decision on adding one first

### 10\. **Analytics Dashboard for Debaters**

- Personal stats: win rate, fallacy frequency, argument length, topic expertise, improvement trends
- **Completed 2026-10-21** (branch `agent/todo-debater-analytics-stats-gate`): `buildDebaterStats` in `packages/debate-round/src/round/debater-stats.ts` computes win rate, side/division/argument splits and recent-form trend from `ownRoundHistory` (account-synced via the `ownRoundHistory` tool-record collection).
  - [x] Pure stats model + Vitest
  - [x] `DebaterStatsPanel` mounted in the Prep Workspace ("Debater Stats" tab) and the Coach Hub Prep section, with Vitest
  - [x] Base blocker cleared: no merge-conflict markers remain on `master`; `bun run typecheck` (29/29 tasks) and `bun run build:web` pass
  - [x] Argument length (2026-10-22, branch `claude/gifted-babbage-r8x5vc`): optional `speechWordCount` on logged rounds, "Words spoken" input in the Log-a-round form, `speechLength` stat (average, wins vs losses) in `buildDebaterStats` and `DebaterStatsPanel`, with Vitest
  - [x] Fallacy frequency (2026-11-16): derived on read from saved word-count rounds and shown on `/word-count` (see TODO.md "Fallacy frequency across saved word-count rounds"). A figure in Debater Stats stays deferred: logged rounds carry no speech text
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
- [x] **One "Where each tool saves" list in Settings** (Completed 2026-11-21, branch `claude/gifted-babbage-0vslpv`, PR #1852). Problem: Settings → General rendered two lists with the same heading, one under the other — a grouped one inside `ToolSyncStatusPanel` (signed in only, no filter) and a flat, filterable `ToolStorageList` from a parallel `tool-storage-rows.ts`, with different status labels. Goal: one list, grouped like the sidebar, filterable, shown signed in or out. Non-goals: new status filters, changing what each tool stores, the `SavedDataSection` rows (open PR #1850)
  - [x] `buildToolStorageOverview` takes `{ query }` (tool label or group heading, case-insensitive; a tool hidden in its first group is not moved to a later one); new `countToolStorageRows`
  - [x] `ToolStorageList` renders the grouped overview with a filter box, a count in the heading, a "Showing N of M tools." / "No tools match …" line, the failure reason under a failed row, and the panel's status pills
  - [x] `ToolSyncStatusPanel` no longer renders its own copy; `lib/tools/tool-storage-rows.ts` and its test removed
  - [x] Vitest: `tool-storage-overview.test.ts` (query, count), `tool-storage-list.test.tsx` (grouping, filter by name and by group, empty, clear), `tool-sync-status-panel.test.tsx` (no duplicate list)
  - [x] Docs: `features/ui-navigation/user-settings.mdx`, `dev-docs/internals/user-guide-notes/user-settings.mdx`, `dev-docs/internals/tool-data-sync.mdx` (Tool storage map + Known gaps)
  - [x] Verified (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 31/31; `bun run test` 1249 files / 16614 tests pass (5 files / 25 tests skipped); `bun run build:web` pass. Feature commit `e51d477`
  - Follow-ups: none new

- [x] **Save the Coach debrief with its round** (Completed 2026-11-21, branch `claude/gifted-babbage-j4px8s`, PR #1854, feature commit `9ebade55`). Problem: the Practice vs AI scorecard's Coach debrief was never stored (`DebateVsBotRecord` had no field for it), so it couldn't be reopened from Debate History or exported — a Known gap in `dev-docs/internals/practice-vs-ai.mdx`. Goal: a signed-in round keeps its latest debrief in its `practice_vs_ai_debates` row, linked to the user, and Debate History shows it. Non-goals: keeping every debrief of a round (only the latest); saving a guest's debrief; storing the Judge feedback style with the round; a schema change
  - [x] `RoundDebriefRecord` + optional `DebateVsBotRecord.debrief`; `isValidRoundDebrief` (non-blank style id ≤ 64 chars, non-blank text ≤ `MAX_ROUND_DEBRIEF_CHARS` 8,000, integer `savedAt`), accepted by `isValidDebateVsBotRecord` so Restore keeps it
  - [x] Optional `DebateStore.setDebrief` (in-memory store implements it); `saveDebrief` handler: trims, 400 / 413 / 404 / 500, `{ saved: false }` with no lookup for a store without `setDebrief` (guest)
  - [x] `POST /api/vsbot/debrief` (`withVsBotBackend`); D1 `setDebrief` rewrites the owner's `data` blob; `rowToRecord` reads the debrief back and drops a malformed one
  - [x] Client `saveRoundDebrief`; `RoundCoachDebrief` `saveDebrief` prop (passed through `JudgmentPopup`, wired in `DebateRoom`) with an `aria-live` save line (saving / saved / not saved — sign in / failed) and a stale-save guard; `DebateHistory` shows an expanded round's debrief with its style badge
  - [x] Vitest: `handlers.test.ts` (11 cases), `record-validation.test.ts` (4), `store-and-client.test.ts` (3), `round-coach-debrief.test.tsx` (7), `debate-history.test.tsx` (3), app `store.test.ts` (5, in-memory SQLite), `saved-data-restore.test.ts` (Export → Restore keeps it)
  - [x] Docs: `features/rounds/practice-vs-ai.mdx` and `dev-docs/internals/practice-vs-ai.mdx` (new "Saving the debrief with the round" section, Known gap struck)
  - [x] Verified 2026-11-21 on `master` `060a020` + this branch (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 31/31; `bun run test` 1250 files / 16652 tests pass (5 files / 19 tests skipped); `bun run build:web` 4/4
  - [x] ~~Follow-up (deferred, low priority): two saves for one round aren't ordered on the server, so an older debrief that lands last wins~~ — done 2026-11-22, see "Order Coach debrief saves by when they were written" below
  - [x] ~~Follow-up (deferred, already a Known gap): store the Judge feedback style with the round~~ — done 2026-11-21, see "Save the Judge feedback style with its round" below

- [x] **Save the Judge feedback style with its round** (Completed 2026-11-21, branch `claude/gifted-babbage-05ry7b`, PR #1855, feature commit `38e0f7c`). Problem: a judged round kept the reasons in `outcome` but not the style (Standard / Socratic / Devil's Advocate / Fact-Checker) that wrote them — a Known gap in `dev-docs/internals/practice-vs-ai.mdx`. Goal: a signed-in round stores the resolved style with its verdict in its `practice_vs_ai_debates` row, linked to the user; Debate History and an export show it. Non-goals: a schema change; backfilling rounds judged earlier; showing the style for a guest round; changing the judge prompt
  - [x] `DebateVsBotRecord.judgeFeedbackStyle` + `OutcomeDetails`; `DebateStore.setOutcome(id, outcome, details?)` stores it and clears it when replaced without one (a concede); in-memory store implements it
  - [x] `judge` handler stores `resolveCoachPersona(body.feedbackStyle).id` (missing / unknown → `"standard"`, matching the prompt)
  - [x] `isValidJudgeFeedbackStyle` (non-blank, ≤ 64 chars), accepted by `isValidDebateVsBotRecord` so Restore keeps it
  - [x] D1 `setOutcome` rewrites the owner's `data` blob with the outcome columns in one owner-scoped update; `rowToRecord` drops a malformed style
  - [x] `DebateHistory`: "Judged in the <name> feedback style" on an expanded round that has one
  - [x] Vitest: `handlers.test.ts` (2), `record-validation.test.ts` (3), `store-and-client.test.ts` (1), `debate-history.test.tsx` (2), app `store.test.ts` (4, in-memory SQLite), `saved-data-restore.test.ts` (Export → Restore keeps it, malformed rejected)
  - [x] Docs: `features/rounds/practice-vs-ai.mdx` and `dev-docs/internals/practice-vs-ai.mdx` (Judge feedback style section, Known gap struck)
  - [x] Verified 2026-11-21 (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 31/31; `bun run test` 1260 files / 16718 tests pass (5 files / 19 skipped); `bun run build:web` 4/4
  - Follow-ups: none new (the unordered-debrief-saves follow-up above still stands — done 2026-11-22, below)

- [x] **Order Coach debrief saves by when they were written** (Completed 2026-11-22, branch `claude/gifted-babbage-kbkppi`, PR #1856, feature commit `a53675c`). Problem: two `POST /api/vsbot/debrief` saves for one round weren't ordered on the server, so an older debrief that arrived last (two tabs, a slow request) overwrote the newer one in the user's `practice_vs_ai_debates` row. Goal: the later-written debrief wins, and the scorecard says when a newer one is already saved. Non-goals: a schema change; server-side transactions; reconciling skewed clocks between devices; keeping more than one debrief
  - [x] `RoundDebriefRecord.writtenAt` / `SaveDebriefRequestBody.writtenAt` (Unix ms, optional for older clients); `isDebriefWrittenAt`; `isValidRoundDebrief` accepts a valid one so Restore keeps it
  - [x] `shouldReplaceDebrief(existing, incoming)` in `backend/record-validation.ts`: drops a save only when both carry `writtenAt` and the incoming one is older
  - [x] `saveDebrief` handler: 400 on a malformed `writtenAt`; answers `{ saved: false, superseded: true }` from its own check or when `setDebrief` resolves `false`
  - [x] In-memory and D1 `setDebrief` re-check against the row they read and resolve `false` when they keep the existing debrief
  - [x] Client `saveRoundDebrief` sends `writtenAt`; `RoundCoachDebrief` stamps it and shows "Not saved — a newer debrief for this round is already in Debate History."; `DebateRoom` maps `superseded`
  - [x] Vitest: `handlers.test.ts`, `record-validation.test.ts`, `store-and-client.test.ts`, `round-coach-debrief.test.tsx`, app `store.test.ts`
  - [x] Docs: `features/rounds/index.mdx` (Practice vs AI section), `dev-docs/internals/practice-vs-ai.mdx` (save section, Known gap struck)
  - [x] Verified 2026-11-22 (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 31/31; `bun run test` 1272 files / 16791 tests pass (5 files / 19 skipped); `bun run build:web` 4/4
  - Follow-ups: none new; the remaining limits (player clock, no transaction in D1) are recorded in the internals Known gaps

- [x] **Give the Coach debrief the whole round** (Completed 2026-11-22, branch `claude/gifted-babbage-3gzrq6`, PR #1857). Problem: the Practice vs AI scorecard's Coach debrief quoted only the user's speeches, so the coach couldn't say how well the user answered the opponent or which chosen arguments were extended or dropped — a Known gap in `dev-docs/internals/practice-vs-ai.mdx`. Goal: the debrief prompt also carries the opponent's speeches and both sides' setup-wizard arguments. Non-goals: storing the round plan with the saved record; giving the judge the plan; changing the debrief's save path (open PR #1856); a schema change
  - [x] `RoundDebriefInput.opponentSpeeches`, `userArguments`, `opponentArguments` (`RoundDebriefArgument`) in `debate-speech-writer`'s `coach/round-debrief-ai.ts`; opponent speeches on their own `MAX_DEBRIEF_OPPONENT_SPEECHES_CHARS` (3000) budget after the user's; arguments listed before the scorecard, capped at `MAX_DEBRIEF_ARGUMENTS` (12) per side with summaries clipped to `MAX_DEBRIEF_ARGUMENT_SUMMARY_CHARS` (300); system prompt says the opponent's lines are only for judging the student's answers
  - [x] `buildRoundDebriefInput`: `"Bot"` / persona-named lines → `opponentSpeeches`, `"Judge"` and blank lines never quoted; new `plan` option → each side's arguments (untitled / malformed skipped)
  - [x] `JudgmentPopup` `plan` prop, passed from `DebateRoom`
  - [x] Vitest: `debate-speech-writer/test/round-debrief.test.ts` (8 new cases), `debate-round-practice-ai/test/round-debrief-input.test.ts` (6), `test/judgment-popup-debrief-plan.test.tsx` (1)
  - [x] Docs: `features/rounds/index.mdx` (Practice vs AI) and `dev-docs/internals/practice-vs-ai.mdx` (Coach debrief section, Known gap struck, Tests)
  - [x] Verified 2026-11-22 (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 31/31; `bun run test` 1274 files / 16794 tests pass (5 files / 19 skipped); `bun run build:web` 4/4. Feature commit `be23971`
  - Follow-ups: none new (the plan staying out of the saved record is recorded in the internals Known gaps)

- [x] **Sync the video watch page's choices to the account** (Completed 2026-11-22, branch `claude/gifted-babbage-ystm4n`, PR #1863, feature commit `7819b8e`). Problem: the watch page remembered its copy format, auto-scroll, Skip breaks and live-caption choices in four bare-string `localStorage` keys classified device-local, so a signed-in viewer reset them on every new device. Goal: one JSON store that syncs to the user's `tool_records` rows, with old choices carried over. Non-goals: syncing the playback speed, outcome lens or panel layout keys; applying a change from another device to an already-open page; a Settings section for these choices; a schema change
  - [x] `packages/debate-videos/src/lib/watch-preferences.ts`: `debate-videos:watch-preferences` JSON object, `readWatchPreference` / `writeWatchPreference` / `sanitizeWatchPreferences`; old per-choice keys read as a fallback and removed when their choice is written
  - [x] `VideoWatchPage` (copy format, Skip breaks), `WatchSidePanel` (auto-scroll), `LiveCaptionLine` read/write through it; `readCopyFormat` / `writeCopyFormat` and the four `*_STORAGE_KEY` constants removed
  - [x] `videoWatchPreferences` tool-record collection (Videos) with `watch-preferences-codec.ts`: one `preferences` record, only valid values pass both ways, field-by-field merge (account wins where both chose)
  - [x] Coverage guard: the four old keys leave `DEVICE_LOCAL`
  - [x] Vitest: `debate-videos/test/watch-preferences.test.ts` (11), `debate-search-evidence/test/account-sync/watch-preferences-codec.test.ts` (7); updated `copy-format`, `watch-round-panel`, `watch-document-tabs`, `tool-record-catalog`, `storage-key-coverage`
  - [x] Docs: `features/videos.mdx` (watch page), `dev-docs/packages/debate-videos.mdx` (new "Watch page preferences" section)
  - [x] Verified 2026-11-22 (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 31/31; `bun run test` 1279 files / 16855 tests pass (5 files / 25 skipped); `bun run build:web` pass
  - [x] PR #1863 opened
  - Follow-ups (deferred): the recorder's playback speed (`debate-playback-speed`, `debate-timer`) and the outcome lens (`debate-videos:outcome-lens`) are the same kind of per-user choice still kept per device; an open watch page doesn't follow a change made on another device until reload

---

## Contribution Guidelines

1. **Pick an issue** or propose your own - comment on the issue to claim it
2. **Start small** - break large features into PR-sized chunks
3. **Write tests** - aim for &gt;80% coverage on new code
4. **Follow code style** - run linting/formatting before submitting
5. **Update docs** - README, API docs, and in-code comments