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
- **Completed (tracker review 2026-10-29)**: already shipped as the Outline Filters and Argument Tree View (`/outline`): `ArgumentTreePanel` with Outline plus five map views (`ArgumentMapView`, `ArgumentMapChart` in `packages/debate-practice-drills/src/panels/argument-map/`), text export via `buildArgumentTreeOutlineText`, Vitest in `argument-map.test.ts` and `ArgumentMapView.test.tsx`, documented in `argument-tree-outline.mdx`. Image/PDF export is not implemented; deferred.
  - [x] Map image export, SVG slice (2026-11-10, branch `claude/gifted-babbage-0o1b2q`, PR #1630): **Download SVG** button on every map view (`ArgumentMapChart`), `buildArgumentMapSvg` / `argumentMapSvgFilename` in `packages/debate-practice-drills/src/panels/argument-map/export-svg.ts` inline the theme classes into a standalone light-palette SVG, with Vitest in `argument-map-export-svg.test.tsx`; documented in `argument-tree-outline.mdx` (features + internals)
  - [x] Map image export, PNG slice (2026-11-10, branch `claude/gifted-babbage-ehnuoa`, PR #1631): **Download PNG** button next to Download SVG in `ArgumentMapChart`; `argumentMapPngSize` (2x, clamped to 4096 px per side), `rasterizeSvgToPng` (injectable image/canvas, rejects on decode / context / encode failure) and `argumentMapPngFilename` in `packages/debate-practice-drills/src/panels/argument-map/export-png.ts`; busy state and a `role="alert"` fallback message; Vitest in `argument-map-export-png.test.tsx`; documented in `argument-tree-outline.mdx` (features + internals). Verified: `bun run typecheck` (32/32), `bun run test` (1106 files / 15057 tests pass), `bun run build:web` pass (after `git submodule update --init`)
  - [x] Map image export, PDF slice (2026-11-11, branch `claude/gifted-babbage-qvhoi7`, PR #1644): **Download PDF** button next to Download PNG in `ArgumentMapChart`; dependency-free one-page PDF writer `buildImagePdf` (JPEG embedded via `/DCTDecode`, byte-exact xref), `argumentMapPdfPageSize` (on-screen size at 96 px = 72 pt), `argumentMapToPdf` and `argumentMapPdfFilename` in `packages/debate-practice-drills/src/panels/argument-map/export-pdf.ts`; `rasterizeSvgToImage` generalizes the PNG rasterizer to JPEG; PNG and PDF share one busy state and alert; Vitest in `argument-map-export-pdf.test.tsx`; documented in `argument-tree-outline.mdx` (features + internals)
  - [ ] Follow-up (deferred, low priority): embedding the site web font in exported images; a vector (selectable-text) PDF would need a PDF library
  - [ ] Follow-up (flaky test, found 2026-11-11, unrelated to the PDF slice): in a full `bun run test` run, `EditorSettingsPanel.tsx:288` (the `?category=` anchor-scroll `setInterval`) fired after jsdom teardown and raised `ReferenceError: document is not defined`, attributed to `packages/debate-webview/test/components/settings/editor-settings-panel.test.tsx`; all 15084 tests passed but Vitest exited 1. The file passes alone (3/3 runs). Likely fix: unmount in that test's `afterEach`, or guard the interval callback with `typeof document`

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
- [x] `ToolPageHeader` shows where the tool's data is saved (Vitest) — **stale**: removed again by `7428594`
- [x] Follow-up withdrawn: per-tool "Save to account" buttons contradict `7428594` (Save now buttons removed on purpose); auto-sync is the model
- [x] Resolved (2026-10-27, environment only): `apps/debate-web/lib/__tests__/tool-catalog-consistency.test.ts` imports the generated `packages/debate-editor/src/editor/workspace-links`, which exists once `node scripts/sync-upstream.mjs` assembles the git-ignored `src/` (use the plain script, not `sync-upstream`, which runs `--rebase`); the test then passes

## Word-count rounds saved to the account (In Progress, started 2026-11-11, branch `claude/gifted-babbage-eh59uu`, PR #1657)

Status: code, tests and docs are done (`ce5751f`). This stays In Progress only because `bun run test` and `bun run build:web` fail on `master` for the two pre-existing reasons below. Move it to Completed once those are fixed and both pass on this branch.

Slice of the standing request to save flows, docs and debates in SQL linked to users. `/word-count` kept round history in `localStorage` only, although `saved_word_count_rounds` exists, Settings counts it, `planWordCountRoundMerge` / `adoptWordCountRound` were written for an account merge, and `storage-key-coverage.test.ts` lists `wordCountRounds` as synced elsewhere. Nothing wrote the table.

Acceptance criteria:
- [x] `GET /api/word-count-rounds`, `PUT` / `DELETE /api/word-count-rounds/[roundId]`: 401 signed out, rows scoped to the user, validated (`isValidWordCountRoundRecord`), 413 over 200 KB, upsert per (user, round)
- [x] `useWordCountRounds` merges once per page load (newer `updatedAt` wins), pushes local-only rounds, mirrors save / delete / clear best-effort; signed out it stays local-only
- [x] `WordCountRoundsPanel` says where rounds are saved and shows a dismissible "Synced round … from another device" notice
- [x] Vitest: validator, client, hook, panel (signed out + signed in), routes against in-memory SQLite
- [x] Docs: `features/rounds/word-count-rounds.mdx` and new `dev-docs/internals/word-count-rounds.mdx`
- [x] `bun run typecheck`: 33/33 tasks pass. Focused Vitest for the new and changed files: 61 tests pass
- [ ] `bun run test`: 1085 files pass, 2 fail (4 tests) on `master` too, without this change: `packages/debate-rankings/test/school-logos.test.ts` and `packages/debate-videos/test/tournament-logos.test.ts` expect a map entry for `packages/debate-icons/colleges/oklahoma.png`, which `1d69c9c` added without one. Follow-up below
- [ ] `bun run build:web`: fails on `master` too, without this change: `[MISSING_EXPORT] "introspectPostgresTables" is not exported by "lib/stubs/kysely-adapter.ts"` (imported by `better-auth@1.7.21`'s `db/get-migration.mjs`). Follow-up below
- Follow-up (pre-existing, 2026-11-11): add the `colleges/oklahoma.png` entry to the school / tournament logo maps (`@debate-ai/icons/schools`) so the 4 logo tests pass
- Follow-up (pre-existing, 2026-11-11): export an `introspectPostgresTables` stub from `apps/debate-web/lib/stubs/kysely-adapter.ts` so `bun run build:web` builds against `better-auth@1.7.21`
- Follow-up (deferred, needs a decision): deletion tombstones so a round deleted on one device isn't re-uploaded by another (same gap as drill sets)
- Follow-up (deferred): a **Manage** list for word-count rounds in Settings (#1654 records it too) and a `/word-count?roundId=` deep link

## Account sync of tools (Completed)

- **Completed 2026-11-11** (branch `claude/gifted-babbage-h81shi`, PR #1646) — Manage word-count rounds and drill sets from Settings → General → **Saved to your account**. Both were counted there but, unlike docs, flows, rounds and practice debates, couldn't be listed, opened, exported or deleted one by one.
  - [x] `wordCountRounds` and `drills` added to `ITEM_KINDS` in `apps/debate-web/lib/saved-data/saved-data-items.ts`: list (titled via `wordCountRoundTitle` / `drillSetTitle`, linking to `/word-count` and `/practice/drills`), delete by row id (own rows only), per-item export and the **Export all** archive (each with its `roundId`)
  - [x] `SavedDataSection` shows **Manage** for both kinds; judge decisions and sent speeches stay count-only
  - [x] Vitest: `saved-data-items.test.ts` (titles incl. malformed JSON, ownership, paging, delete, export, archive) and `saved-data-section.test.tsx` (Manage offered for both, item link + export link)
  - [x] Docs: `user-settings.mdx` (Manage list, export archive, new Known gap)
  - [x] Verified: `bun run typecheck` (32/32), `bun run test` (1107 files / 15075 tests pass, 7 files skipped), `bun run build:web` pass (after `git submodule update --init`); no lint script is configured
- [ ] Follow-up (2026-11-11, needs a sync-design call): deleting a drill set in Settings removes only the account row; a browser still holding it locally re-pushes it on its next Practice Drills merge (`planDrillSetMerge` → `pushLocal` in `packages/debate-practice-drills/src/hooks/useDrillSets.ts`). A tombstone or "deleted on account" signal would fix it. Documented in `user-settings.mdx` Known gaps
- [ ] Follow-up (2026-11-11, low priority): per-item Manage for judge decisions and sent speeches (both are append-only logs; listing them needs a title format decision)

- **Completed 2026-11-10** (branch `claude/gifted-babbage-1kv1m8`, PR #1625) — Account sync status back in the UI. The `/tools` page that mounted `ToolSyncStatusPanel` is gone, so nothing in the app showed tool-sync failures or offered **Sync now**, while `tool-data-sync.mdx` still called it fixed.
  - [x] `useToolSyncSnapshot` (`packages/debate-webview/src/lib/hooks/`) reads the `tool-sync-store` snapshot; `ToolSyncStatusPanel` uses it instead of `useToolRecordSync`, whose cleanups would stop the global auto-sync watcher on unmount
  - [x] Panel mounted in Settings → General right after **Saved to your account** (`EditorSettingsPanel`)
  - [x] Vitest: `test/components/tools/tool-sync-status-panel.test.tsx` (hidden signed out, syncing → synced, failure list + link + **Sync now**, sign-in reminder opt-back-in, never calls the driving hook) and a mount check in `editor-settings-panel.test.tsx`
  - [x] Docs: `user-settings.mdx` (Account sync status) and `dev-docs/internals/tool-data-sync.mdx` (where the panel lives; header storage line / badge removed on purpose)
  - No per-tool header badge or **Save now**: `ToolPageHeader.test.tsx` keeps asserting neither exists
- [x] Follow-up (2026-11-10, needs owner call): delete the unused `toolSyncBadgeState` / `resolveToolSyncKeys` (`tool-sync-status.ts`), `summarizeToolSyncStatus` (`tool-sync-summary.ts`) and `describeToolStorage` (`tool-storage.ts`) in `packages/debate-webview/src/lib/tools/` plus their tests, or render them somewhere other than `ToolPageHeader` — **rendered** (see "Where each tool saves" below), except `summarizeToolSyncStatus`

- **Where each tool saves** (started 2026-11-10, branch `claude/gifted-babbage-sr44xm`) — one place that answers "where is this tool's data and is it synced", replacing the per-tool header line/badge that was removed on purpose.
  - Goal: in Settings → General's Account sync box, a collapsed list of every catalog tool that stores data, grouped by catalog heading, with `describeToolStorage`'s line and a status pill (Synced / Syncing… / Couldn't sync / Saved to account / This device only), each linking to its tool
  - Non-goals: no per-tool header badge or **Save now** (`ToolPageHeader.test.tsx` still asserts neither); no new storage; `summarizeToolSyncStatus` stays unused
  - [x] `buildToolStorageOverview` / `toolStorageStatusLabel` in `packages/debate-webview/src/lib/tools/tool-storage-overview.ts` (drops `derived` tools and duplicate hrefs; SQL tools → `account`)
  - [x] `toolSyncBadgeState` takes optional `collectionKeys` (via `resolveToolSyncKeys`) so parent-route tools such as `/research/cards/awards` report their collections
  - [x] `<details>` **Where each tool saves** in `ToolSyncStatusPanel`
  - [x] Vitest: `test/lib/tools/tool-storage-overview.test.ts` (incl. every storing catalog tool listed once), a `collectionKeys` case in `tool-sync-status.test.ts`, a list case in `tool-sync-status-panel.test.tsx`
  - [x] Docs: `user-settings.mdx` (features) and `dev-docs/internals/tool-data-sync.mdx`
  - [x] Verification (2026-11-10, after `git submodule update --init` and `node scripts/sync-upstream.mjs` in `debate-editor` / `debate-tournaments`): `bun run typecheck` (32/32), `bun run test` (1110 files / 15129 tests pass, 19 skipped), `bun run build:web` pass
  - **Completed 2026-11-10** — PR #1638 (awaiting review)
  - [ ] Follow-up (low priority, needs owner call): delete or render `summarizeToolSyncStatus` (`tool-sync-summary.ts`), still unused

- **Completed 2026-11-11** (branch `claude/gifted-babbage-7721m2`, PR #1655) — Tool pages count as "Recent" however they're opened. Visits were recorded only from the command palette (and the editor's Workspace menu), so a tool opened from the sidebar, a bookmark, a typed URL or another page's link never reached the palette's **Recent** group or its account-synced `recent_tools` list (the gap `command-palette.mdx` named).
  - [x] `recordToolVisit` / `useRecordToolVisit` in `packages/debate-webview/src/lib/hooks/useRecentTools.ts`: waits for the once-per-page-load account read, promotes the href locally, announces it to mounted `useRecentTools`, sends the `recordRecentTool` op when signed in; never rejects
  - [x] `RecordToolVisit` (`components/tools/favorites/`) mounted by `ToolPageHeader` for any cataloged href
  - [x] Vitest: `test/lib/hooks/useRecordToolVisit.test.tsx` (signed out / signed in after hydrate / already-first no-op / invalid href / load and save failures / hook mount, href change, `undefined` / component renders nothing)
  - [x] Docs: `dev-docs/internals/command-palette.mdx` (gap closed, data flow) and `features/ui-navigation/user-settings.mdx`
  - [x] Verified: `bun run typecheck` (32/32), `bun run test` (1108 files / 15076 tests pass, 7 skipped), `bun run build:web` pass (after `git submodule update --init`)
  - Not covered: `/reason-editor` and `/research/docs` don't use `ToolPageHeader` (they already record via the editor's Workspace menu or the palette)

- [x] Speech-doc links (editor document <-> round/flow speech) sync via the `speechDocLinks` tool-record collection
- [x] Pinned debates - synced via the `pinnedDebates` tool-record collection
- [x] Surface the Tool data sync status where each tool is used (tool page header badge) — **stale** (tracker review 2026-11-10): the header badge was removed on purpose; `ToolPageHeader.test.tsx` asserts no badge or Save now. Sync status now shows once, in Settings → General (`ToolSyncStatusPanel`, see the 2026-11-10 entry below). `toolSyncBadgeState` / `resolveToolSyncKeys` in `lib/tools/tool-sync-status.ts` are unused — see follow-up below

- **Completed (started 2026-10-21; closed 2026-10-28 tracker review)** (branch `claude/gifted-babbage-2agbmy`) — "Saved to your account" summary: `GET /api/settings/saved-data` + `SavedDataSection` in Settings → General (counts of docs, flows, rounds, debates saved in SQL per user), with Vitest.
  - [x] `loadOwnSavedData` + route, Vitest against in-memory SQLite
  - [x] `SavedDataSection` mounted in Settings → General, with Vitest
  - [x] Documented in `user-settings.mdx`
  - [x] List / open (docs) / delete individual saved docs, flows, rounds and practice debates from this section (2026-10-22, branch `claude/gifted-babbage-uf5f12`): `saved-data-items.ts`, `/api/settings/saved-data/[kind]`, **Manage** in `SavedDataSection`, with Vitest
  - [x] Export an individual saved item as JSON (2026-10-24, branch `agent/todo-saved-item-export`): `exportOwnSavedItem`, `GET /api/settings/saved-data/[kind]?id=`, **Export** link in `SavedDataSection`, with Vitest
  - [x] Bulk export (2026-10-24, branch `agent/todo-saved-data-bulk-export`): `exportAllOwnSavedData`, `GET /api/settings/saved-data?export=all`, **Export all as JSON** link in `SavedDataSection`, with Vitest; removed two stale duplicate export tests that failed on `master`
  - [x] Bulk export no longer capped at 100 per kind (2026-10-25, branch `claude/gifted-babbage-frrxt0`): pages through every row, `EXPORT_PAGE_SIZE`, with Vitest across page boundaries
  - [x] Paginate the **Manage** list (2026-10-26, branch `claude/gifted-babbage-c0kevh`): `listOwnSavedItemsPage`, `?offset=&limit=` + `hasMore` on `/api/settings/saved-data/[kind]`, **Load more** in `SavedDataSection`, with Vitest
  - [x] Stable open link for rounds (2026-10-26, branch `agent/todo-saved-round-open-link`): list items link to `/debate?roundId=N` (handled by `useOpenRoundFromLink`), with Vitest. Earlier note: (flows and practice debates already open via `/debate?flowId=N` and `/practice/versus-ai?debate=N`)
  - [x] Rename saved documents from **Manage** (2026-11-11, branch `claude/gifted-babbage-za56j6`, PR #1645): **Rename** button on document rows in `SavedDataSection` prompts for a title (`normalizeRenameTitle`: trimmed, 200-char cap, blank/unchanged sends nothing) and calls the existing `PUT /api/doc/documents/[id]` (keeps `previousSlug` redirects), with Vitest in `saved-data-section.test.tsx`; documented in `user-settings.mdx`. Verified: `bun run typecheck` (32/32), `bun run test` (1107 files / 15072 tests pass), `bun run build:web` pass
  - [ ] Follow-up (deferred, needs a sync-model decision): rename flows and rounds from Settings. Their labels are client-authoritative (browser flow store pushed up on sync), so a SQL-side rename would be overwritten; it needs either a server-wins rule for `label` or a client-side rename via the flow store
  - [x] Tool Data Sync collections (`saved_tool_records`) included in the summary (branch `agent/todo-saved-data-tool-records`, Vitest in `saved-data.test.ts` + `saved-data-section.test.tsx`)
  - [x] Search saved items by title in **Manage** (2026-11-11, branch `claude/gifted-babbage-h5d8g3`): `titleContains` (case-insensitive, `%` / `_` / backslash matched literally) and a `query` argument on `listOwnSavedItems` / `listOwnSavedItemsPage`; `?q=` on `GET /api/settings/saved-data/[kind]` (400 past 100 chars); search box in `SavedDataSection` that **Load more** keeps and clearing resets, with Vitest in `saved-data-items.test.ts` and `saved-data-section.test.tsx`; documented in `user-settings.mdx`. Untitled rows (empty stored title) can't be matched by their "Untitled …" placeholder — by design. Verified: `bun run typecheck` (32/32), `bun run test` (1107 files / 15072 tests pass, 7 files skipped), `bun run build:web` pass (after `git submodule update --init`)
  - [x] Sync/save markers on open-flow tabs and the `/doc` header (2026-10-27, tracker review; already shipped): `FlowTab` shows a "Saved to your account" marker via `flowAccountStatus` (`packages/debate-round/test/FlowTab.test.tsx`, `flowAccountStatus.test.ts`), and `ReasonEditorScreen` shows `describeDocSaveStatus` (`doc-save-status.test.ts`). No open follow-ups remain for this section.

- **Completed 2026-11-11** (branch `claude/gifted-babbage-bt0nz6`, PR #1652) — **Manage** list survives failures. One failed **Delete** or **Load more** replaced the whole list with "Couldn't update … Try again later" and a failed first load had no retry.
  - [x] `ManageKind` (`SavedDataSection.tsx`): a failed delete / load more keeps the rows and shows a `role="alert"` message (the delete message names the item); a failed first load shows **Try again**; dropped the unused `fetchPage` and its `eslint-disable`
  - [x] Vitest: three cases in `packages/debate-webview/test/components/settings/saved-data-section.test.tsx`
  - [x] Documented in `user-settings.mdx` (Saved to your account)
  - [x] Verified: `bun run typecheck` (32/32), `bun run test` (1107 files / 15070 tests pass, 7 skipped), `bun run build:web` pass

- **Completed 2026-10-27** (branch `agent/todo-round-log-words-from-flow`) — Fill "Words spoken" from a saved flow (deferred follow-up from the Analytics Dashboard idea in IDEAS.md):
  - [x] `countFlowWordsForSide` in `packages/debate-round/src/flow/flow-word-count.ts`, with Vitest
  - [x] "Count from a saved flow…" picker in the Log-a-round form (`PreRoundBriefingsPanel`), with Vitest
  - [x] Documented in `pre-round-briefings.mdx` (features + internals)
  - [x] Logged round links to the saved flow its word count came from (2026-10-27, branch `claude/gifted-babbage-o678dn`): optional `flowClientId` on the record, **Open flow** link in `PreRoundBriefingsPanel`, with Vitest; documented in `pre-round-briefings.mdx`
  - [x] Suggest a saved flow for the round being logged (2026-10-28, branch `agent/todo-round-log-suggest-flow`): `suggestFlowsForRound` matches flow labels on tournament (then division), **Use suggested flow** button in `PreRoundBriefingsPanel`, with Vitest; documented in `pre-round-briefings.mdx`. Flows carry only a free-text label (no round id), so matching is label-based
  - [x] Optional **Round** input in the Log-a-round form narrows the suggested flow (2026-10-28, branch `claude/gifted-babbage-lb4e8d`), with Vitest; documented in `pre-round-briefings.mdx`. Search-only, not stored
  - [x] Re-verified 2026-10-28 (branch `claude/gifted-babbage-7s7xy5`): CLAUDE.md's Vitest path is no longer stale (it names `apps/debate-web/vitest.config.ts`). `bunx vitest run --config apps/debate-web/vitest.config.ts packages/debate-round` → 1721 tests pass; the only failures are 7 test files that import the `debate-rankings` git submodule (`git submodule update --init` fixes it) — environment only, not a code defect
  - [ ] Follow-up (deferred, needs a schema decision): store a round id on saved flows for exact linking; record fallacy data for a fallacy-frequency stat

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

## Fallacy hints in Word-Count Speeches (Completed 2026-11-05, branch `claude/gifted-babbage-e3a5i3`)

Slice of the IDEAS.md "AI-Powered Argument Analysis & Feedback" idea: surface the existing offline `detectFallacies` heuristic in the UI.

- [x] `FallacyHints` panel component (`packages/debate-practice-drills/src/panels/FallacyHints.tsx`), shown under each speech in `WordCountRoundsPanel`, with Vitest in `WordCountRoundsPanel.test.tsx`
- [x] Documented in `features/rounds/word-count-rounds.mdx`
- [x] Hints on the unsent draft in the Practice vs AI room (2026-11-07, branch `claude/gifted-babbage-59uqvl`): `FallacyHints` moved to `packages/debate-speech-writer/src/ui/` and mounted in `DebateRoom`, with Vitest (`debate-room.test.tsx`, `FallacyHints.test.tsx`); documented in `practice-vs-ai.mdx` (features + internals)
- [x] Hints on the outline of each AI Outcome Responses candidate (2026-11-09, branch `claude/gifted-babbage-j5jsq8`): `FallacyHints` mounted in `CandidateCard` (`packages/debate-round/src/dialogs/AiOutcomeResponsesDialog.tsx`), with Vitest in `AiOutcomeCandidateCard.test.tsx`; documented in `ai-outcome-responses.mdx`. Environment note: the 7 `debate-round` test files that import `debate-rankings` / `@debate-ai/editor` fail without the git submodules; `bun run typecheck` stops at `@debate-ai/editor#build` for the same reason
- [x] Hints under each pasted transcript in the Speech Transcript Summaries extraction form (2026-11-09, branch `claude/gifted-babbage-dgqcux`): `FallacyHints` mounted in `FlowSummariesPanel`, with Vitest in `FlowSummariesPanel.test.tsx`; documented in `flow-summaries.mdx`
- [x] Hints under each pasted speech in the AI Judge Decision panel and under the speech draft in Online Debate Versus AI (2026-11-11, branch `claude/gifted-babbage-3ibl21`, PR #1647): `FallacyHints` mounted in `SpeechJudgeSection` and `AiVersusRoundPanel` (`packages/debate-practice-drills/src/panels/`), with Vitest in `JudgeDecisionPanel.test.tsx` and `AiVersusRoundPanel.test.tsx`; documented in `ai-versus-rounds.mdx`, `practice-tools.mdx` and `dev-docs/internals/judge-paradigm-selections.mdx`
- [ ] Follow-up (deferred): show hints in remaining text surfaces (editor speech docs, `ebb` flow cells — both in upstream-synced packages); evidence-quality and rhetorical-strength feedback via the LLM; persist fallacy counts for a fallacy-frequency stat (needs a schema decision)

## Debate Coaching AI Persona (Completed 2026-11-11, branch `claude/gifted-babbage-7huvxp`, PR #1641)

Slice 1 of IDEAS.md bonus idea 8, "Configurable AI personas (Socratic, Devil's Advocate, Fact-Checker) for practice sessions". Goal: pick how the AI coach talks when you ask for AI feedback in AI Coach Mode (`/coaching?section=ai-coach`).

Non-goals: personas for the team coach Q&A or the practice-vs-AI coach; saving the choice to the account; custom persona authoring.

- [x] `coach/coach-personas.ts` in `debate-speech-writer` (Standard, Socratic, Devil's Advocate, Fact-Checker; shared "critique the argument, never the debater" guardrail; unknown ids fall back to Standard), exported from the package index
- [x] `buildCoachFeedbackAiSystemPrompt(personaId)` in `debate-practice-drills` `round/coach-feedback-ai.ts`; `requestCoachFeedback` sends it (Standard keeps the old prompt byte for byte)
- [x] Optional `aiFeedbackPersonaId` on `CoachingSessionRecord` (additive, syncs with the record); the coaching-notes download names the style
- [x] **Coaching style for AI feedback** picker (toggle buttons, `aria-pressed`) and a persona badge on the feedback in `CoachingSessionsPanel`
- [x] Vitest: `coach-personas.test.ts`, `coach-feedback-ai.test.ts`, `coach-feedback-client.test.ts`, `coachingSessions.test.ts`, `CoachingSessionsPanel.test.tsx`
- [x] Docs: `features/ai-coaching/coaching-sessions.mdx` (Coaching style) and new `dev-docs/internals/coaching-sessions.mdx`
- [x] Verified: `bun run typecheck` (32/32), `bun run test` (1108 files / 15079 tests pass), `bun run build:web` pass (after `git submodule update --init`); PR #1641
- [x] Personas for the team coach Q&A (2026-11-11, branch `claude/gifted-babbage-jb3rg3`) — see "Coaching style for Ask the coach" below
- [x] Remember the choice per account: AI Coach Mode (2026-11-11, see "Remember the AI Coach Mode coaching style per account" below; synced as a tool-record collection rather than a `user_settings` column, so no schema change)
- [ ] Follow-up (deferred): personas for the practice-vs-AI coach; remember the "Ask the coach" choice (store ready: `"team-coach"` surface, see below); custom coaching personas

## Coaching style for "Ask the coach" (Completed 2026-11-11, branch `claude/gifted-babbage-jb3rg3`, PR #1667)

Slice 2 of IDEAS.md bonus idea 8 (and the "add tools where needed in the UI" part of the standing request): the Team Coach Q&A on Coach Materials (`CoachMaterialsPanel`, "Ask the coach") gets the same Standard / Socratic / Devil's Advocate / Fact-Checker picker AI Coach Mode has.

Non-goals: practice-vs-AI coach; remembering the choice (per device or account); changes to the grounding rules. Doesn't touch Settings / saved-data files (open PR #1662 is repairing those).

Acceptance criteria:
- [x] `buildTeamCoachAiSystemPrompt(personaId)` in `debate-speech-writer` `coach/team-coach-ai.ts` appends the persona after the grounding rules; Standard / missing / unknown id keeps `TEAM_COACH_AI_SYSTEM_PROMPT` byte for byte; exported from the package index
- [x] `requestTeamCoachAnswer` takes an optional `personaId` and sends it as the system prompt (not as a body field)
- [x] Optional `personaId` on `CoachConversationTurn`, stored by `appendCoachConversationTurn` only for non-Standard styles (additive; syncs with the `coachConversation` collection)
- [x] **Coaching style** picker (toggle buttons, `aria-pressed`, description + "Every style answers only from your materials") and a "<name> coach" badge on styled turns in `CoachMaterialsPanel`
- [x] Vitest: `team-coach-ai.test.ts`, `team-coach-client.test.ts`, `coachConversation.test.ts`, `CoachMaterialsPanel.test.tsx` (51 tests in the 5 coach files pass)
- [x] Docs: `features/ai-coaching/coach-materials.mdx` and `dev-docs/internals/coach-materials.mdx` (behaviour + new Known gap: the choice isn't remembered)
- [x] Verification, against the `master` this branch is level with: `bun run typecheck` 31/32 tasks pass. The one failure, `@debate-ai/ai-web`, is the `saved-data-restore.ts` / `saved-data-items.test.ts` break that PR #1662 fixes. `bun run test`: 1122 files / 15240 tests pass, 3 tests fail in those same two saved-data test files. `bun run build:web` fails on `master` with `MISSING_EXPORT introspectPostgresTables` (#1662 fixes it). With #1662's one-line stub applied locally and not committed, the build passes, so the MDX edits compile. No lint script is configured

## Remember the AI Coach Mode coaching style per account (Completed 2026-11-11, branch `claude/gifted-babbage-pahdkv`, PR #1668, `cf4b174`)

Slice of the standing request (user settings saved in SQL and linked to users; better tool UI) and the "remember the choice per account" follow-up of the Debate Coaching AI Persona entry above. AI Coach Mode's **Coaching style for AI feedback** picker resets to Standard on every page load and every device.

Goal: the picked style is saved in this browser and, when signed in, to the account (`saved_tool_records`, no schema change), so it is the starting style on every device.

Scope:
- `state/coachPersonaPreferences.ts` in `debate-speech-writer`: one record per picker surface (`{ id, personaId, updatedAt }`), SSR/corrupt-storage safe, unknown persona ids read back as Standard
- One `TOOL_RECORD_COLLECTIONS` entry (`coachPersonaPreferences`, Coaching section, `/coaching`) so the existing auto-sync watcher carries it to the account
- `CoachingSessionsPanel` starts on the saved style, saves on change, and follows a `storage` event (another tab or an account merge)

Non-goals: the Coach Materials "Ask the coach" picker (open PR #1667 adds it; it can pass its own surface id later); a Settings row for it; custom personas.

Acceptance criteria:
- [x] Picking a style persists it; reopening AI Coach Mode starts on it
- [x] Missing / corrupt / unknown stored values fall back to Standard without throwing
- [x] Signed in, the preference syncs through the generic tool-record sync (catalog entry + id-field pin)
- [x] A `storage` event for the key updates the open picker
- [x] Vitest: store, panel, catalog (`coachPersonaPreferences.test.ts`, 3 new cases in `CoachingSessionsPanel.test.tsx`, `coachPersonaPreferences: "id"` pin in `tool-record-catalog.test.ts`)
- [x] Verified against the current `master` (after `git submodule update --init` and `node scripts/sync-upstream.mjs` in `debate-editor` / `debate-tournaments`). No lint script is configured. Every failure below is pre-existing and fixed by open PR #1662:
  - `bun run typecheck`: 31/32 tasks pass. The failing task is `@debate-ai/ai-web`, in `saved-data-restore.ts` / `saved-data-items.test.ts`
  - `bun run test`: 1125 files / 15303 tests pass, 19 skipped. 3 tests fail in `saved-data-items.test.ts` and `saved-data-restore.test.ts`, and fail the same way with this change set aside
  - `bun run build:web`: fails with `MISSING_EXPORT introspectPostgresTables`. With #1662's one-line stub applied locally (not committed) it passes (4/4 tasks)
- [x] Docs: `features/ai-coaching/coaching-sessions.mdx`, `dev-docs/internals/coaching-sessions.mdx`, `dev-docs/internals/tool-data-sync.mdx`

Implementation plan:
- [x] Store module + export from the package index
- [x] Catalog entry + `EXPECTED_ID_FIELDS` pin
- [x] Panel wiring
- [x] Tests, docs, verification
- [ ] Follow-up (ready: PR #1667 has merged): Coach Materials' "Ask the coach" picker reads and saves `getCoachPersonaPreference("team-coach")` / `saveCoachPersonaPreference("team-coach", …)`. The surface id is already reserved
- [ ] Follow-up (deferred, low priority): the practice-vs-AI coach picker, once it exists, gets its own surface id
