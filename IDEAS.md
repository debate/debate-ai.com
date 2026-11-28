# Ideas for New Contributors

> **Scheduled run 2026-11-28** (branch `claude/gifted-babbage-7a4bev`): open PRs #2095–#2097 from this routine cover REASON docs saves, word-count deletes and judge-decision caps, and #2082 fixes the 16 failing tests on `master`, so this run stayed out of their files. For "save … in SQL and link to users", Settings' **Export all as JSON** now includes the "More saved work" tables (briefings, flashcards, opponent personas and 7 more) that it used to leave out (see "Put "More saved work" in Export all" under Account sync of tools below).

> **Scheduled run 2026-11-23** (branch `claude/gifted-babbage-emly6r`, PR #1897): open PRs #1881–#1896 cover Flow History, Settings' tool-storage list, Debate History, judge decisions, the timer and REASON docs, so this run stayed out of their files. The videos-admin test follow-up was already fixed on `master`. For "save … in SQL and link to users" and "better tool UI", it fixed word-count rounds deleted from the account coming back on the next merge, and made deletes ask first (see "Don't let a deleted word-count round come back" under Account sync of tools below).

> **Scheduled run 2026-11-22, seventh run** (branch `claude/gifted-babbage-y5m2my`, PR #1871): no open PRs. For "develop better tool UI" on the flows and rounds saved in SQL, Flow History's **Saved to account** tab now says why a saved flow or round won't open (no longer in the account, or the route's 422 "damaged" message) instead of silently doing nothing, and a saved round still opens when one of its flows can't be read (see "Say why a saved flow or round won't open" under Account sync of tools below). `bun run test` has 25 pre-existing failures in `debate-videos-admin` on `master` (follow-up recorded there).

> **Scheduled run 2026-11-22, sixth run** (branch `claude/gifted-babbage-kk4b50`, PR #1870): open PRs #1861–#1865 edit the account SQL routes, Settings' saved-data counts, AI Outcome Responses and the watch page, so this run stayed out of their files. For "develop better tool UI" on the debates saved in SQL, Practice vs AI's **Debate History** gains a search box (topic or opponent), a result filter and a "N of M rounds · Record" line (see "Find a round in Debate History" under Account sync of tools below).

> **Scheduled run 2026-11-22, fifth run** (branch `claude/gifted-babbage-fmyzat`, PR #1861): open PRs #1858–#1860 edited Practice vs AI and Settings' tool-storage list, so this run stayed out of their files. For "save flows, docs and debates in SQL and link to users", it fixed a reliability gap in the account SQL routes: one saved row whose JSON `data` can't be parsed no longer turns a user's whole list (drill sets, judge decisions, quick cards, synced tool records and 14 more) into a 500, and a damaged saved flow or round answers a described 422 (see "Don't let one damaged saved row hide the rest" under Account sync of tools below).

> **Scheduled run 2026-11-22, third run** (branch `claude/gifted-babbage-ybkv6p`, PR #1868): ten PRs from this routine are open (#1858–#1867) and cover Settings, tool storage, the tool-record catalog, saved-data and Practice vs AI, so this run stayed out of all their files. For "develop better tool UI" on the flows and rounds saved in SQL, it fixed the round workspace's **Flow History → Saved to account** tab: removing a saved flow or round from the account was one click with no confirmation and failed silently. It now asks first, says when a removal fails, and gains a sort menu, counts and named buttons (see "Confirm, sort and count the Saved to account lists" under Account sync of tools below). Note: the `dev-docs/internals/` notes were removed on `master` (`e6671cb`), so engineering notes now go to `dev-docs/packages/`.

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
- [x] **Don't let one damaged saved row hide the rest** (Completed 2026-11-22, branch `claude/gifted-babbage-fmyzat`, PR #1861, feature commit `632217e`). Problem: 17 account list routes (`/api/drill-sets`, `/api/judge-decisions`, `/api/quick-cards`, `/api/tool-records/[collection]`, `/api/learn-*`, `/api/coach-material*`, …) answered `rows.map((row) => JSON.parse(row.data))`, so one row with unparseable `data` threw and the user saw none of their items; `GET /api/flows/[clientId]` and `GET /api/rounds/[clientId]` answered a bodiless 500 for one. Goal: lists skip only the broken row; a broken flow or round says it is damaged. Non-goals: shape-validating rows on read (older rows could be rejected); the PUT conflict paths of `quick-cards` / `learn-cards` / `learn-decks` (inside `withRouteErrors`, described 500); deleting or repairing damaged rows automatically; a schema change
  - [x] `apps/debate-web/lib/api/saved-rows.ts`: `parseSavedRowData` (never throws) and `parseSavedRows(rows, shape?)`
  - [x] All 17 list routes use `parseSavedRows` (`coach-materials` keeps mixing in `updatedAt` via `shape`); `word-count-rounds` and `tool-records` swap their hand-rolled try/catch for the helper
  - [x] `GET /api/flows/[clientId]` / `GET /api/rounds/[clientId]`: 422 "This saved flow/round is damaged and can't be opened. You can remove it from your account."
  - [x] Vitest: `lib/api/__tests__/saved-rows.test.ts` (5), `lib/database/__tests__/saved-rows-corrupt-data-route.test.ts` (5, in-memory SQLite; all 5 fail on the old routes)
  - [x] Docs: `features/app-ui.mdx` (Flow auto-save section), `dev-docs/setup/operations.md` (Troubleshooting), `.claude/apps/debate-ai.com/CLAUDE.md` (convention)
  - [x] Verified 2026-11-22 (after `git submodule update --init`, `bun install`, each package's `scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 31/31; `bun run test` 1279 files / 16856 tests pass (5 files / 19 skipped); `bun run build:web` 4/4
  - Follow-ups: none new (shape validation on read and the three PUT conflict-path parses are recorded as non-goals above)

- [x] **One "Where each tool saves" list in Settings** (Completed 2026-11-21, branch `claude/gifted-babbage-0vslpv`, PR #1852). Problem: Settings → General rendered two lists with the same heading, one under the other — a grouped one inside `ToolSyncStatusPanel` (signed in only, no filter) and a flat, filterable `ToolStorageList` from a parallel `tool-storage-rows.ts`, with different status labels. Goal: one list, grouped like the sidebar, filterable, shown signed in or out. Non-goals: new status filters, changing what each tool stores, the `SavedDataSection` rows (open PR #1850)
  - [x] `buildToolStorageOverview` takes `{ query }` (tool label or group heading, case-insensitive; a tool hidden in its first group is not moved to a later one); new `countToolStorageRows`
  - [x] `ToolStorageList` renders the grouped overview with a filter box, a count in the heading, a "Showing N of M tools." / "No tools match …" line, the failure reason under a failed row, and the panel's status pills
  - [x] `ToolSyncStatusPanel` no longer renders its own copy; `lib/tools/tool-storage-rows.ts` and its test removed
  - [x] Vitest: `tool-storage-overview.test.ts` (query, count), `tool-storage-list.test.tsx` (grouping, filter by name and by group, empty, clear), `tool-sync-status-panel.test.tsx` (no duplicate list)
  - [x] Docs: `features/ui-navigation/user-settings.mdx`, `dev-docs/internals/user-guide-notes/user-settings.mdx`, `dev-docs/internals/tool-data-sync.mdx` (Tool storage map + Known gaps)
  - [x] Verified (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 31/31; `bun run test` 1249 files / 16614 tests pass (5 files / 25 tests skipped); `bun run build:web` pass. Feature commit `e51d477`
  - Follow-ups: none new

- [x] **Don't tell signed-out visitors their SQL tools are saved** (Completed 2026-11-22, branch `claude/gifted-babbage-4ud3al`, PR #1860, feature commit `d63b306`). Problem: Settings → General's "Where each tool saves" (`ToolStorageList`, shown signed in or out) gave every tool with its own SQL table (Contacts, Word Count, Speech Documents, Notifications…) the **Saved to account** pill even for a signed-out guest, who has nothing in an account. Goal: signed out, those rows read **Sign in to save**; signed in, nothing changes. Non-goals: the row's "where" line (`describeToolStorage`, in `tool-storage.ts`, changed by open PR #1859); the synced-plus-SQL rows of PR #1859; a `/debate` row; changing what any tool stores
  - [x] `ToolStorageRowStatus` gains `signIn`; `buildToolStorageOverview` returns it for a `sql` tool when `sync.enabled` (the signed-in flag) is false; `toolStorageStatusLabel` → "Sign in to save"
  - [x] `ToolStorageList`: dashed muted pill for `signIn`; the signed-out intro says tools marked Sign in to save keep their items in the account. `ToolSyncStatusPanel`'s account-tool count skips `signIn` rows as it skips `local`
  - [x] Vitest: `tool-storage-overview.test.ts` (signed out → `signIn`, signed in while merging → `account`, label), `tool-storage-list.test.tsx` (guest sees Sign in to save; signed in sees Saved to account)
  - [x] Docs: `features/app-ui.mdx` (Saved to your account), `dev-docs/packages/debate-webview.mdx`
  - [x] Verified 2026-11-22 (after `git submodule update --init`, `bun install`, each package's `scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 31/31; `bun run test` 1277 files / 16848 tests pass (5 files / 19 skipped); `bun run build:web` 4/4
  - Follow-ups: none

- [ ] **Say what each tool saves now, signed in or out** (In Progress 2026-11-22, branch `claude/gifted-babbage-mxiniq`). Problem: Settings → General's **Where each tool saves** gave every row the same line signed in or out, so a signed-out guest read "Saved to your account: practice debates vs AI. …" or "Saved to your account when you're signed in…" beside a **This device only** / **Sign in to save** pill — a Known gap in `dev-docs/packages/debate-webview.mdx`. Goal: signed out, rows say items are saved "once you sign in" and synced data is "kept on this device until you sign in"; signed in, rows say plainly "Saved to your account". Non-goals: status pills (unchanged); a `/debate` row (still a Known gap); the static notes in Settings' Coaching styles / Sound effects sections, which don't know the sign-in state and keep the either-way line; changing what any tool stores
  - [x] `describeToolStorage(storage, { signedIn? })` in `packages/debate-webview/src/lib/tools/tool-storage.ts`: `false` → "Saved to your account once you sign in: …" / "Kept on this device until you sign in, then saved to your account." / "… Its other settings are kept on this device until then."; `true` → "Saved to your account: …" / "Saved to your account." / "…, plus its other settings."; left out → the existing line
  - [x] `buildToolStorageOverview` passes `signedIn: sync.enabled`
  - [x] Vitest: `test/lib/tool-storage.test.ts` (every kind × state), `test/lib/tools/tool-storage-overview.test.ts` (signed-out rows, no signed-out row in the real catalog opens with "Saved to your account"), `test/components/tools/tool-storage-list.test.tsx` (guest and signed-in lines)
  - [x] Docs: `features/app-ui.mdx` (Saved to your account), `dev-docs/packages/debate-webview.mdx` (row line, Known gap struck)
  - [ ] Verification and PR (see run report)

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

- [x] **Confirm, sort and count the Saved to account lists in Flow History** (Completed 2026-11-22, branch `claude/gifted-babbage-ybkv6p`, PR #1868, feature commit `2dc2b6f`). Problem: in the round workspace's Flow History dialog, the **Saved to account** tab deleted a flow or round from the user's `saved_flows` / `saved_rounds` rows on one click of the trash icon, with no confirmation, and a failed delete showed nothing. The lists also had no sort, no counts, and icon-only buttons with no accessible name. Goal: removal asks first and reports failure; the lists can be sorted and show how many items match. Non-goals: remembering the sort across page loads or syncing it; undo after removal; changing the API routes or schema; the Rounds / History tabs
  - [x] `sortSavedSummaries` (newest / oldest by `updatedAt`, name natural and case-insensitive, ties by `clientId`, never mutates), `SAVED_SUMMARY_SORT_OPTIONS`, `toSavedSummarySort`, `savedSummaryCountLabel` in `packages/debate-round/src/state/savedSummaryFilter.ts`
  - [x] `FlowHistoryDialog`: `confirm()` before removing a saved flow or round (the round prompt says its saved flows stay — the `DELETE` route only touches `saved_rounds`); new `"remove-error"` status with a `role="alert"` line; sort `<select>` beside the search box; `· N` / `· N of M` counts beside the Flows / Rounds headings; `aria-label`s naming the item on Load / Remove; Remove disabled while removing
  - [x] Vitest: `savedSummaryFilter.test.ts` (sort, fallback, counts), `FlowHistoryDialog.test.tsx` (confirm / cancel for flows and rounds, failure message, counts while searching, hidden counts when empty, sort order, button names)
  - [x] Docs: `features/flow.mdx` (Flow Cloud Save) and `dev-docs/packages/debate-round.mdx` (new "Flow History: Saved to account" section)
  - [x] Verified 2026-11-22 (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 31/31; `bun run test` 1277 files / 16862 tests pass (5 files / 19 skipped); `bun run build:web` 4/4
  - Follow-ups: none new (remembering the sort choice per account would need a tool-record collection, which four open PRs are editing)

- [x] **Find a round in Debate History** (Completed 2026-11-22, branch `claude/gifted-babbage-kk4b50`, PR #1870, feature commit `5b3e6e1`). Problem: Practice vs AI's Debate History listed every round the user saved in `practice_vs_ai_debates`, newest first, with no search, no filter and no record, so a user with dozens of rounds had to scroll to find one topic or opponent. Goal: narrow the list by text and by result and show how many rounds match and the overall record. Non-goals: server-side search or paging; remembering the search / filter across visits or syncing it; deleting rounds; changing the API or schema
  - [x] `ui/history-filter.ts`: `debateHistoryResult` (blank → in progress, "User conceded" → conceded, else `resolveResultStatus`), `filterDebateHistory` (every query word in topic or opponent, case-insensitive; result filter; never mutates), `tallyDebateHistory`, `debateHistoryRecordLabel` ("Record: 4–2 · 1 draw · 1 conceded", `null` before any finished round), `debateHistoryCountLabel` ("3 of 12 rounds"), `toDebateHistoryResultFilter`
  - [x] `DebateHistory`: search input and result `<select>` (both labelled), Clear, `aria-live` count / record line, "No rounds match these filters."; the badge reuses `debateHistoryResult`; the fallacy-hints summary follows the filtered rounds
  - [x] Vitest: `test/history-filter.test.ts` (10), `test/debate-history.test.tsx` (4 new: count + record, search, result filter + empty match + Clear, hidden with no rounds)
  - [x] Docs: `features/rounds.mdx` (Practice vs AI) and `dev-docs/packages/debate-round-practice-ai.mdx` (new "Finding a round in Debate History" section)
  - [x] Verified 2026-11-22 (after `git submodule update --init`, `bun install`, each package's `scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 31/31; `bun run test` 1281 files / 16957 tests pass (5 files / 19 skipped); `bun run build:web` 4/4
  - Follow-ups: none

- [x] **Say why a saved flow or round won't open** (Completed 2026-11-22, branch `claude/gifted-babbage-y5m2my`, PR #1871, feature commit `9ab686f`). Problem: in the round workspace's Flow History dialog, **Load** on a row of the **Saved to account** tab set an `"error"` status that the row never rendered, so a flow or round removed on another device, or a damaged row answering the 422 added by PR #1861 ("This saved flow is damaged … You can remove it from your account."), just stopped spinning with no message. Loading a saved round also failed outright when any one of its saved flows threw. Goal: the row says why it won't open; one unreadable flow doesn't keep its round shut. Non-goals: changing the `/api/flows` / `/api/rounds` routes or schema; repairing damaged rows; telling the user which of a round's flows were skipped; the Rounds / History tabs
  - [x] `describeSavedLoadFailure(kind, failure)` in `packages/debate-round/src/state/savedSummaryFilter.ts`: `"missing"` → "This flow/round is no longer in your account…", an `Error` → its trimmed message, anything else → "Couldn't open this flow/round. Try again."
  - [x] `FlowHistoryDialog`: new `"load-error"` status (kept apart from `"error"`, which the Rounds tab's save chips read for the same flow ids) with messages in `cloudLoadErrors` / `cloudRoundLoadErrors`, shown as a `role="alert"` line under the row and cleared when the dialog reopens; a saved round's missing flows are fetched with `.catch(() => null)` and skipped like unsaved flows
  - [x] Vitest: `savedSummaryFilter.test.ts` (3), `FlowHistoryDialog.test.tsx` (4: flow missing → damaged → retry succeeds; the local save chip stays clean; round missing → damaged; a round opens with one damaged flow)
  - [x] Docs: `features/flow.mdx` (Flow Cloud Save) and `dev-docs/packages/debate-round.mdx` (Flow History: Saved to account)
  - [x] Verified 2026-11-22 (after `git submodule update --init`, `bun install`, each package's `scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 31/31; `bunx vitest run` on the two touched test files 69/69; `bun run build:web` 4/4; `bun run test` 1289 files / 17000 tests pass, **25 fail in one file not touched here** (below)
  - [x] ~~Follow-up (pre-existing on `master`, not caused by this change): `packages/debate-videos-admin/test/video-queue-routes.test.ts` fails all 25 tests with `No "getCloudflareContext" export is defined on the "@/lib/database/context" mock` (thrown from `apps/debate-web/lib/env.ts:9`). The test's `vi.mock("@/lib/database/context")` needs a `getCloudflareContext` stub (or `importOriginal`) since `master` commit `f451f72` routed the video routes through `getEnv`~~ — already fixed on `master` (30/30 pass, checked 2026-11-23)

- [x] **Don't let a deleted word-count round come back** (Completed 2026-11-23, branch `claude/gifted-babbage-emly6r`, PR #1897, feature commit `c6483554`). Problem: on `/word-count`, **Clear** and **Delete all history** removed the user's `saved_word_count_rounds` rows on one click with no confirmation. The account `DELETE` was fire-and-forget with an empty `.catch`, and a delete made before the first merge settled was never sent. Either way the account kept the round and the next merge adopted it back with no message. Goal: deletes ask first, a failed account delete is named with Try again, and the merge never re-adopts a round deleted here. Non-goals: tombstones for deletes from a second device that still has the round locally (Known gap), persisting pending deletes across tab closes, server-side changes.
  - [x] `state/savedWordCountRounds.ts`: `buildWordCountRoundDeleteConfirm`, `buildWordCountClearAllConfirm`, `buildWordCountDeleteFailureMessage` (names up to three rounds, then "and N more")
  - [x] `hooks/useWordCountRounds.ts`: module-level `pendingAccountDeletes`; the merge drops pending ids from the account list before `planWordCountRoundMerge` and deletes them; a failed delete stays pending for the next merge; `accountDeleteError`, `retryAccountDeletes`, `dismissAccountDeleteError`; a re-save under a pending id cancels the delete; signed out sends nothing
  - [x] `WordCountRoundsPanel`: `confirm()` before Clear / Delete all history; `role="alert"` line with Try again / Dismiss; "Round history · N"; Clear titled "Delete round <id>"
  - [x] Vitest: `useWordCountRounds.test.tsx` (7 new; the in-flight-merge case fails on the old hook), `savedWordCountRounds.test.ts` (3), `WordCountRoundsPanel.test.tsx` (confirm + cancel), `WordCountRoundsPanel.sync.test.tsx` (signed-in prompt, failure alert, Try again)
  - [x] Docs: `features/rounds.mdx` (Word-Count-Only Speech Format) and `dev-docs/packages/debate-practice-drills.mdx` (new "Word-count rounds: deleting from the account" section with Known gaps)
  - [x] Verified 2026-11-23 (after `git submodule update --init`, `bun install`, each package's `scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 32/32; `bun run test` 1298 files / 17125 tests pass (5 files / 19 skipped); `bun run build:web` 4/4
  - Follow-ups: none new (tombstones for second-device deletes and persisting pending deletes are recorded as Known gaps in the dev doc)

- [ ] **Put "More saved work" in Export all** (In Progress 2026-11-28, branch `claude/gifted-babbage-7a4bev`). Problem: Settings → General's **Export all as JSON** carried the work kinds and synced tool data but none of the rows tools keep in their own `saved_*` tables (`SAVED_SQL_TOOLS`: briefings, strategies, outcome charts, opponent personas, coach materials, topic sprints, quick cards, flashcard decks, flashcards, best-card comments), so a user's "backup" silently left out work Settings counts under "More saved work" — a documented gap in `dev-docs/database/app-schema.md`. Goal: the archive holds every one of those rows, linked to the caller only. Non-goals: restoring them (**Restore from export…** still reads only the work kinds and tool data); adding them to **Manage**; a schema change
  - [x] `exportOwnSqlTools(db, userId, maxPerTable)` in `apps/debate-web/lib/saved-data/saved-data-items.ts`: every `SAVED_SQL_TOOLS` table, owner-scoped, keyset-paged by id (oldest first), `data` parsed (raw text kept if it isn't JSON), timestamps ISO, `user_id` dropped, extra columns (`matchupId`, `roundId`, `topic`, `dayKey`, `shared`) kept; stops at the per-kind ceiling and names the tables that had more
  - [x] `exportAllOwnSavedData` adds `moreSavedWork` and `moreSavedWorkTruncated`; the Export all link's tooltip names More saved work
  - [x] Vitest: `lib/saved-data/__tests__/saved-data-items.test.ts` (5: every key present and empty, owner-only rows with parsed data and extra columns, non-JSON data, paging past a page boundary, ceiling + truncated names)
  - [x] Docs: `features/app-ui.mdx` (Saved to your account), `dev-docs/database/app-schema.md` (gap narrowed to Manage and Restore)
  - [x] Verified 2026-11-28 (after `git submodule update --init`, `bun install`, each package's `scripts/sync-upstream.mjs`; no lint script is configured): `bun run typecheck` 32/32; `bun run build:web` 4/4; `bun run test` 20621 pass / 19 skipped, **16 fail in 13 files this change doesn't touch** — the same 16 open PR #2082 ("Fix master CI") fixes
  - [ ] PR
  - Follow-ups: restore `moreSavedWork` from an export (each table has its own route and conflict rules, so it needs a per-tool restore plan); list them in **Manage**

---

## Contribution Guidelines

1. **Pick an issue** or propose your own - comment on the issue to claim it
2. **Start small** - break large features into PR-sized chunks
3. **Write tests** - aim for &gt;80% coverage on new code
4. **Follow code style** - run linting/formatting before submitting
5. **Update docs** - README, API docs, and in-code comments