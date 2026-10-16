# Changelog

## Commit totals by month

| Month | Commits |
|-------|---------|
| September 2023 | 4 |
| October 2023 | 12 |
| February 2026 | 14 |
| March 2026 | 128 |
| April 2026 | 9 |
| May 2026 | 57 |
| June 2026 | 18 |
| July 2026 | 9 |
| August 2026 | 363 |
| September 2026 | 1,024 |
| October 2026 (through the 13th) | 514 |

# AI Debate Era (MVP, 2026+)

## October 2026 (so far) — 514 commits

Prediction markets, a rankings engine, a native Tournaments product, and a big consolidation of the tool sprawl into a handful of workspaces — with account sync finishing its rollout across every tool.

### Prediction markets and the file market

- Launched **play-money prediction markets** on debates, tournaments and team ratings, with preset markets for each division's top five and the season's majors, and rating and tournament markets that **auto-open weekly**. Hid names on the top-forecasters board and dropped partner-name search.
- Laid groundwork for an **argument market** kind with source and wager validation.
- Added a **file market**: sell files for wallet balance, with free table-of-contents previews so buyers see what they're paying for.

### Rankings

- Built **Bradley-Terry team rankings** from the new upstream CSVs, plus a **head-to-head matchup simulator** for any two ranked teams (later with per-side sims, school/individual weights and a "my team" shortcut).
- Rated **side balance separately in prelims and elims** and drew prelim and elim side bias as one two-bar chart.
- Reworked the scale a few times — rescaled ratings to roughly 0–110, capped at 109, zero-padded with shaded tier digits — and gave 80+ ratings a gold border and a **Legendary** top five, sized per list from its 80+ and 90+ counts, with rows labelled by format ("PF Legend").
- Added a **balanced school score** that dilutes small schools and is led by each school's top three, with a school-average overlay on the team-profile radar.
- Added **past-season college policy rankings**, 2009-10 through 2024-25.

### Videos and the watch page

- Regrouped the sidebar into Research, Prep & Scout, Practice, Coaching and Insights, then into Lectures plus College Policy, HS Policy, HS Policy 1v1 (LD) and Public Forum; lettered NDT/VP/PF/LD badges and per-link icons throughout, with an optional anime.js hover animation on sidebar icons (off by default, switch in Settings).
- Rows now list newest first at every level, load every page so no video goes missing, show two columns when the screen fits them, open the watch page directly, and show each video's duration.
- The watch page gained **AI speech detection with a per-speech LLM summary**, transcription of caption-less videos from their audio, both teams' ranking stats and radars, a related-videos total, and a pop-out you can line a video up in without navigating. A team page got a record card with categorized stat bands.
- **Follow teams and schools**, with their updates in the news feed; ask guests to sign in after 10 videos; canonical URLs spelled by season (`26-27`) and `/videos/<season>/<tournament>` listings.
- Moderation: a category dropdown, viewer **edit requests for moderator approval**, "submit a video or channel" from the library, an admin **Speech AI pipeline** (segmentation, summaries, alternatives), removal of videos YouTube no longer serves, and the 506 curated rounds queued for admin approval on deploy. Dartmouth RR rounds are now filed as college and re-parsed with AI.
- Featured the **NDT 2015 Finals** on the debate start screen and let you flip through its speech docs beside the video.

### Tournaments

- Made `/tournaments` a native product: a live Tabroom list, every debate format typed to upstream Tabroom events, and tournaments addressed by year and name.
- Added a full-size **Debate AI Demo Invitational** with brackets, speaker awards, simulated live rounds in its pairings, and an admin view to edit its mock data.
- Added **judge ballot submission with a Tabroom email check**, an explicit relationship registry, public field allowlists, and a fuller schema audit; Tabroom is now linked as a submodule.

### Account sync, finished

- Synced speech-document links, pinned debates, flow-editor display and keymap settings, flow auto-save mode, and the welcome dialog (shown once per account) to the signed-in account.
- Added a per-tool **sync badge with Save now** in the tool page header and across the cards, docs, videos, round and Reason Editor workspaces, plus saved-to-account markers on flow tabs and round cards. (Later hid the badge from the header once the rollout was complete.)
- Flows moved off `localStorage` entirely, with unlimited storage through the browser extension; auto-save of edited flows already on the account got an off / saved / all preference.
- Added the **bring-your-own-key** path for OpenRouter and Anthropic, and an AI-limit dialog that offers an account upgrade alongside your own key.

### Consolidating the tools

- Merged the **Practice Round Simulator into Practice vs AI**, five prep tools into one **Prep Workspace**, six research tools into one **Team Research** page, five coaching tools into one tabbed **Coaching** page, and News Stream plus forums into **News & Forums**. Deleted the All Tools page and showed feature categories as tabs on `/features`. Added "Load sample data" built from real cards to Coaching and Research.
- Rebuilt the app shell around **one resizable, hideable sidebar** (shadcn sidebar-07) on every view, with organizations, notifications and site links in the account menu, Docs and Settings pinned at the foot, a hover-to-reveal dock, and a full-page Settings. Published the generic `shadcn-sidebar` package with Storybook demos.
- Gave Ctrl/Cmd-K a **fuzzy-ranked, highlighted search**.

### Practice and rounds

- Added a **judge pool** (volunteer for circuit weekends, organizers hire), anonymous partner matching with a ranked topic poll, a next-season entry on `/practice/statistics`, and Kialo-style argument-map views on the argument tree.
- In rounds: tournament-aware school and team suggestions, pick the opposing team from a school's ranked teams, click-to-activate speeches with your own highlighted, AI outcome responses in the speech timer menu, a judge's "be more clear" request, and a speech-recording **captions ticker** and full transcript modal with AI sections.

### CardMirror, search and the extension

- Always create new speech docs as `.cmir`, open `.cmir` in read mode, show featured speech docs in highlighted-only read mode, and added saved/unsaved/failed document status, a tab right-click menu, hover buttons beside cards to **summarize, find flaws, and read aloud** (Kokoro/Deepgram voices), and compact two-line nav tags.
- Card search moved to **BM25-ranked FTS5** with phrase match and autocomplete, with first-search and time-boxed query performance work and an "embiggen" highlight-only quotes view.
- The browser extension got a **full-page reading overlay** with AI beside the article, reading mode for YouTube transcripts, PDFs and any URL, backtick search, and app settings and AI key.
- Schools: coaches and administrators can **claim a school's page**.

### Platform and housekeeping

- Added `@types/debate`, made every package publishable under `@debate/`, added the private `dev-docs` package (table reference and self-hosting guide), upgraded every dependency, and cut startup work (stopped warming the practice stack, deduped app-wide polls).
- Fixed the Tauri app's webcam and a macOS `.icns` bug, and raised test coverage across flow, webview, round, videos, speech-writer and community.
- A noisy stretch of parallel PRs produced a run of **bad-merge repair commits** (conflict markers, lost imports, a broken typecheck) — all cleaned up, and the CI allowlists and tests were repaired alongside.

## September 2026 — 1,024 commits

Practice, collaboration, and a wave of "second draft" polish across research tools, followed by a tool-page UI pass, a working docs site, and — in the second half — every tool's saved work syncing to the account, a rankings engine and a faster app shell.

### Practice and AI opponents

- Ported the **practice-vs-AI** backend from Go to Node/TS and docked it in the main app.
- Layered a **difficulty slider** on top of AI persona choice and added past-attempts comparison to the Practice Round Simulator.
- Gave AI Judge Decision Modes a **multi-judge panel mode**: run two or more judge paradigms against the same round in one click and see a combined majority decision alongside a side-by-side comparison table of each paradigm's own vote and rationale, synced to the account like any other decision.

### Videos

- Chased down a run of `/videos` bugs — a route crash from Lucide icons reaching `next/image`, the service worker's fabricated 502, a YouTube "error 153," and a transcript API that always 404'd.
- Reworked the videos experience with a **collapsible sidebar nav tree**, persistent left-sidebar controls, a **transcript modal with synced YouTube playback**, and resizable/sortable list columns.
- Added admin YouTube video management with per-video publish/delete and a weekly resync cron that both scans the subscribed channels for new videos and refreshes every stored video's view count, so the library's "most viewed" sort stops drifting.

### Collaboration and coaching

- Pushed real-time collaboration further: **live "who's editing now" presence** and a side-by-side conflict-diff view in Shared Flow Sync.
- Added a team capacity view and coach-facing reassign/override controls in the Task Inbox.
- Added a shared checklist and activity timeline in the Collaboration Prep Room, and an end-of-sprint retrospective summary for Team Collaboration Mode.
- Rounded out Coaching Programs with a reviewer/approval workflow for coach materials, a coach-facing roster analytics dashboard, and a program-roster-scoped challenge digest.

### Research and scouting tools

- Side-by-side case comparison and export-to-briefing in Scout-to-Strategy.
- Bulk CSV import and printable scouting reports for Opponent Team Profiles.
- Cross-device goal-setting for Research Progress.
- A winner-history calendar for Daily Best Card.
- Multi-judge comparison for Judge Profiles.
- Threaded replies and a high-priority flag for Strategy Sync Notes.
- A public topic starter library.

### CardMirror and the editor shell

- Reorganized the **CardMirror** editor shell again — a file tree + open tabs sidebar for the REASON editor, tighter menu-bar categories, Benchmark/About-this-install moved into Settings, and the ebb Flow start page retired into the flow toolbar with speech timers mirrored to the sidebar.
- Restored the **Google-Docs-style menu bar** (File / Edit / Insert / Workspace / …) above the ribbon toolbar in every editor host, so the same commands the `Ctrl`/`Cmd`-Shift-Space palette exposes are also one click away as a text-labeled menu strip, not just ribbon icons.
- Gave `Ctrl`/`Cmd`-Shift-Space an **app-wide command palette**, not just the Reason Editor's own: every feature doc's "reachable from the command palette" line is now true from `/tools`, `/settings`, both workspace hubs, and everywhere else, not only while a document happened to be open. Built from the same `/tools` catalog favorites already key against, so a starred tool, a palette result, and a Workspace-menu link all agree; stands down entirely on `/reason-editor`, where the editor engine's own richer palette (quick cards, commands, files) keeps the shortcut.
- Moved the **Topic Starter library** onto CardMirror's native format: an uploaded DOCX is converted with the editor's own OOXML importer and stored as a `.cmir` (so the Verbatim outline, comment threads, images and named character styles survive an import that used to flatten them to card HTML), the `/reason-editor` embed parses the stored file in the browser, and rows imported before the switch keep opening as HTML.
- Fixed the report that a file loaded into **CardMirror sometimes disappears and goes blank**, which was never only a display bug:
  - The embed reported *any* document change as a user edit, so a blank mounted by the engine's own machinery (boot, New/Open, crash recovery) — or by stored content that failed to parse — was written straight over the file in D1.
  - The embed now reports only real edits, restores a blank it didn't ask for, refuses to save over a document it couldn't read, and stopped dropping footnotes on every HTML round trip.
  - On the storage side, one debounce per document (with a `keepalive` flush on tab close, retry-with-backoff, and a truthful save-state indicator) replaced a single shared timer that cancelled other documents' pending writes.

### Accounts and sharing

- Linked the CardMirror editor's **real-time collaboration to better-auth accounts**: a `/contacts` page with a typical friends list (search-and-request, accept/decline, remove, block/unblock, online presence from a poll heartbeat), a **Share with contacts** control in the Reason Editor that starts a co-editing session and hands its share code + guest pass to a contact's account through `/api/card-shares` (no clipboard), and a Shared cards tab where every received card shows as available to open on any device.
- Restored that feature's four tables, which had been dropped from `lib/database/schema.ts` by a merge, breaking the production build along with node-canvas — a native `.node` addon pulled in as linkedom's optional peer that the Worker bundle cannot parse and now resolves to a no-op shim.
- Fixed **Google sign-in dead-ending on `state_mismatch`**: better-auth checks the OAuth `state` against both a database row and a signed cookie when the provider redirects back, and both halves could go missing on their own — the row because `/api/auth/*` reads could be answered by a D1 read replica that had not yet caught up with the sign-in request's write (auth now always opens its session on the primary), and the cookie because its five-minute default expired while the ten-minute state row was still valid (the two now match). Failed callbacks land back on `/login` with the reason in plain words and the sign-in buttons right there, instead of better-auth's built-in "Something went wrong / CODE: state_mismatch" page with nothing but a Go Home button.

### Card library import

- Added a **card library importer** for the published Parquet card dump: a `debate-cards-upload` CLI that streams each shard row-group by row-group and posts normalized batches to a new admin ingest endpoint (resumable with `--start-row`, `--dry-run` to check a shard without writing).
- Added the matching "Card library import" panel on `/admin` that runs the same import in the browser one file at a time.
- Added a `debate_cards` table cards are upserted into by id, so re-importing a shard corrects it instead of duplicating the corpus.

### Tool pages and workspace hubs

- Gave every training, practice, and research-collaboration page (27 routes, from `/coach` and `/drills` through `/versus-ai` and `/cards/prep-room`) one shared **tool page header** — a named back link, the tool's icon, title, and description from the tools catalog, an eyebrow naming its guide, **Docs** and **Guide** links, the favorite star, and the related-tools row where one exists — in place of the bare "Back" button each page opened with.
- Redesigned the **Coach Workspace** and **Research Workspace** hubs around a sticky, keyboard-navigable section tab strip with icons and panel counts, a per-section intro card explaining the stage and listing every panel (each chip scrolls to its panel, and an arrow opens the panel's own page), a "current round" bar in the Coach hub naming the flow every generate action reads, a workspace-identity card in the Research hub, and **`?section=` URL sync** so a hub section can be shared or bookmarked (with the last section remembered per device).

### Documentation site

- Finished the **debate-ai-docs** Fumadocs site, which had content but none of its Next.js routes: added the root and docs layouts, the MDX page route, the landing page, the Orama search index, and the `llms-full.txt` / per-page `.mdx` endpoints.
- Wrote a new **Guides** section (training tools, practice tools, research collaboration) that the app's page headers and hub sections link to via `NEXT_PUBLIC_DOCS_URL`, falling back to the source on GitHub.
- Pinned `fumadocs-mdx` to the version compatible with the pinned `fumadocs-core`, moved the site onto Next 16.2+ (which its Turbopack MDX rules require), and pointed its Turbopack root at the monorepo so bun's nested installs resolve.
- Closed the month by **publishing the help docs at `debate-ai.com/docs`**, which until now existed only as a Fumadocs package nobody had a way to read: the site is statically exported under `basePath: '/docs'` and copied into the web app's `public/docs` on every build, so the Worker serves all ~75 pages — the guides, one page per feature, one per workspace package, the Orama search index, and `llms-full.txt` — as static assets on the app's own origin.
- Every **Docs** and **Guide** link in the app (the tool page headers, both workspace hubs, and every card on `/features`) now opens the real page instead of falling back to raw Markdown on GitHub, the five feature docs that had never been ported were published, and `/docs/features` and `/docs/packages` got the section index pages their links had been 404ing against.
- The service worker skips the docs entirely, so first-time visitors don't precache a documentation site to open the app.

### Account sync of every tool (second half of the month)

- Built `debate-data-sync` to **sync every tool's saved work to the account**, with a searchable, sectioned *Tool data* list and sync status on `/settings` and `/tools`, a persistent "don't ask again" guest sign-in prompt, and visible failures from the background watcher.
- Synced the Flow Edit Log and flow-history undo log, Daily Best Card and award announcements, prep-note notifications, quest teams, completed research tasks, Quick Cards, AI card assessments, the CardMirror personal dictionary and Learn decks (with a create/rename/delete UI, review-log History view and per-deck badges), the pending task verification queue, open chat tabs on `/doc`, group-challenge wins, and more.
- Replaced whole-list overwrites with **optimistic concurrency** — concurrent edits to presets, libraries, decks, quick cards and streaks now resolve against the account's current value — and rejected cloud saves that would clobber a newer flow or round.
- Surfaced all of it in **My Saved Items** (flows, rounds, drill sets, judge decisions, outcome charts, pairings, personas, Learn decks, Prep Notes, Evidence Library entries and more) with filtering, deletion, and sample data for new accounts.
- Added a first look at **Debater Level XP** at `/cards/level`.

### Videos, rankings and the openCaselist

- Gave every video its **own watch page with a side transcript**, canonical URLs, per-user watch history, stacked playlists, a browser-cached library queried locally, a collapsible season → tournament → round tree, related videos as rows, and `←`/`→` between them.
- Added admin tools to edit, remove, dedupe, recompute stacks, and seed videos, plus an ADMIN_EMAIL allowlist and invitable moderators, and an interactive ZIP downloader and scraper for **openCaselist** bulk archives.
- Added the first **rankings**: clickable team and school profiles with a July 1 season rollover, a Schools table, a team radar, a side-bias visualization, and Glicko-2 ratings displayed on a friendlier scale.
- Gave every 2010–2026 debate topic a short title and emoji.

### Cards and evidence

- Searchable **Parquet card corpus** (with the duplicate count as the rounds-read count) and a popup for submitting evidence from card search; read-by-row-group made the admin import survive a real dump.
- Moved the REASON file tree and open tabs into the app sidebar, addressed documents by name instead of id, and let you download owned documents and topic starters as `.docx`.

### Native, extension and billing

- The Tauri **native wrapper** gained a system tray, autostart, global quick-launch shortcuts, a Linux Docker build, a splash video, and a choice of app source (offline, debate-ai.com or beta), then dropped its updater.
- The browser extension merged the timer and card-reuse extensions, gained an article panel that reads any page and saves to your account, and now ships no remotely hosted code for Chrome Web Store MV3.
- Added **Stripe subscriptions** for the Pro VIP and Research Team plans with tiered limits, a team roster with lesson plans and drills, Cloudflare **Turnstile** on first page loads, and Mixpanel analytics.

### Performance and reliability

- Cut the app shell's startup JS from **4.6 MB to 1.0 MB**, dropped 3.5 MB of render-blocking CSS, halved the Worker's startup memory, stopped loading the whole video library on video pages, and replaced hidden-iframe dock pages with regular React routes.
- Routed D1 through the Sessions API for read replication, migrated D1 on every master push, added weekly **SQL backups to R2** (with a `.7z` copy in KV), and hardened the offline service worker so it stops serving half of one build and half of another.
- The `drizzle/` migrations and help-docs internals were deleted and restored several times (with a drift/deletion regression test added along the way) until `apps/debate-ai.com/drizzle` was deliberately untracked on the 30th.

### Platform and packages

- Split debate-card-search and debate-round into four category packages, and vendored debate-ui into each consumer.
- Published a typed **OpenAPI SDK** (`debate-api-client`) to npm.
- Added `native-wrapper`, a Tauri desktop/mobile shell shipped as Debate AI.
- Stood up a `debate-ai-docs` package and fixed an EventEmitter memory leak.
- Fixed **bun.lock**, which bun refused to parse because of a duplicated `exceljs/uuid` entry.

## August 2026 — 363 commits

Identity, live sync, and a real content feed.

### Accounts and identity

- Wired real signed-in **Google/better-auth** identity into more than a dozen research and round panels (Leaderboard, Progress Unlocks, Research Progress, Daily Quests, Review Queue, Team Collaboration Mode, Team Brainstorm Assist, Group Challenges, Task Inbox, Collaboration Prep Room), replacing free-typed contributor IDs with session-derived prefills and, for Task Inbox verification, a real identity gate.
- Chased down a run of **Google One Tap** auth bugs: prompting on every signed-out page, a wrong runtime client id, and a 401 caused by a missing `isAnonymous` column plus overly strict account linking.

### Live sync and cloud save

- Added **cross-tab live updates** (via `storage` events / BroadcastChannel-style polling) to the Daily Best Card Challenge, Contribution Leaderboard, Task Inbox, Progress Unlocks, Research Progress, Quest Streaks, and the new News Stream feed.
- Persisted account-linked **D1-backed cloud save** for user settings, saved flows, and saved rounds (idea #17 follow-ups), synced the color-theme preference server-side, and wired D1 migrations into the deploy pipeline to fix a production `unable_to_create_user` failure.
- Fixed two independently-merged **user settings/rounds** persistence systems that collided and broke the production build.
- Added a **"Save all rounds"** bulk action for Round Cloud Save so every local round (and its flows) syncs to the account in one click instead of one at a time.

### News Stream

- Built a brand-new **News Stream** feed that auto-aggregates activity across the app — quest-streak milestones, group challenges, revisions, prep notes, Argument Library submissions, AI Coach Mode sessions — plus an auto-generated "Tool spotlight" post for every unannounced entry in the tools catalog, capped for readability.

### CardMirror and the editor shell

- Overhauled the CardMirror editor shell — added a Plugins dropdown and a Workspace menu with full Tools-page search/highlights, confined CardMirror's own chrome to its own column with **ebb** brought in as an embeddable panel, redesigned the settings panels around that layout, retired the old CardMirror start screen, and fixed a menu-bar crash on load.
- Restored a `debate-editor` re-export shim split out from the CardMirror engine.
- Added an **Insert Short Cite** CardMirror command.

### Videos

- Migrated the video library from a static JSON feed to a **SQL-backed paginated feed**, seeded from inside the Worker with byte-batched inserts.

### Navigation and routes

- Wired up several previously orphaned tool routes (LLM Card Scoring, Scout-to-Strategy, Team Rankings, Speech Documents) into their nav entries.
- Added a "Tools for this round" quick-access menu to the round workspace.
- Added Site Links/Debate Links submenus and a direct settings link to the dock's Settings menu, and shipped a `/legal/privacy` page.
- Surfaced saved flows in the `/tools` "My Saved Items" widget.

### Feature polish (Product Feature Ideas backlog)

- Argument Tree Outline auto-sync while flowing.
- A nearest-match datalist on the Judge/Opponent Team Profiles round-ID filters.
- Common Argument Library tag autocomplete plus cross-store tag rename/merge.
- A custom opponent-persona authoring flow for the AI Practice Opponent.
- An undo/redo affordance for logged opponent rounds.
- A surfaced live-sync toggle in Shared Flow Sync.
- Conversation history for the Coach Materials "Ask the coach" action.

### Removals and replacements

- Removed the CX NDCA Standings tool and its now-unused custom qualification-points-table follow-up.
- Replaced the browser-extension card-reuse checker with a new **debate-web-ext** implementation.
- Stopped the service worker from intercepting requests it can't safely handle.

### Docs and tests

- A docs pass fixing a stale "global dock's Settings menu" claim across 34 feature docs, plus a revised README features section.
- New unit test coverage for CardMirror schema-id helpers, footnote helpers, and timer sound effects.

## June 2026 — 18 commits

CardMirror release milestone month.

### Editor

- Integrated the **CardMirror engine** into a new **reason-editor** workspace package built on **TipTap/React**.
- Ported CardMirror's **AI editing tools** (cite, repair, explain, alt text).
- Implemented an **HTML-to-card parser** with citation extraction and metadata assembly.
- Simplified HTML extraction functions across several refactoring passes.

### Server and build

- Added new server configuration and **session management hooks**.
- Fixed **Vercel** builds to run as a **Vite** app instead of failing Next.js detection.
- Rebuilt the **PWA service worker** precache for the Vite build (fixing React #130 errors).
- Declared missing workspace dependencies and pinned loose dependency specifiers with an emotion alias fix.

## May 2026 — 57 commits

Research platform and rebranding push.

### Brand and research

- Rebranded the project to **Debate-AI.com** and defined the core platform pillars — **CARDS**, **FIAT**, **LEARN** (renamed from DEARLY), **STREAM**, and **REASON**.
- Authored the **Debate Singularity** research paper on AI-driven argument reasoning and collective knowledge mapping, plus a companion theory paper, with a PDF route and expanded citations.

### Videos and lectures

- Built the **LecturesPage** with category navigation, quick links, and **YouTube statistics** integration.
- Overhauled the video library with new **leaderboard** and **dictionary** panels, and added dynamic `/videos/[category]` routing.
- Ingested **NDCA 2026 LD rounds** with duplicate-video detection.

### Editor and packages

- Initialized **Lexical editor** integration with advanced plugins, custom nodes, and collaborative **Image, Poll, and Sticky** components backed by **yjs**.
- Extracted sync and data modules into a new **debate-data-sync** workspace package, and moved the offline service worker to `lib/offline-sw`.

## April 2026 — 9 commits

Flow tooling and archive maintenance.

### Flow tooling

- Implemented an **interactive flow spreadsheet** with custom cell rendering, row operations, and context menus.

### Videos and maintenance

- Added **persistent video playback timestamps** and improved type safety in video card metadata.
- Refreshed the tournament video archive with **NDT/TOC** rounds.
- Updated README branding and demo images, removed legacy build scripts, and cleaned up obsolete test suites.

## March 2026 — 128 commits

The biggest month of development.

### Debate Round

- Built the complete **Debate Round** feature: round creation and editing, a **flow interface** with spreadsheet, per-speech **timers with persistence**, speech management, and embedded timer **sound effects**.

### Cards and search

- Overhauled **CARD search** with new state management, **AI analysis** sidebars, advanced filtering, responsive layouts, and client-side caching.
- Rebuilt the **card parser** with human-name and citation extraction plus **DOCX parsing**.

### AI features

- Added **AI speech-to-flow** and **speech-to-response** prompts.
- Added **speech-sync card highlighting** for live reading progress.

### Videos

- Shipped a **persistent floating video player** that survives page navigation (portal-based, draggable popout).
- Added video categorization by format, infinite scroll, structured tournament/round/team metadata with **JSON schemas**, and **YouTube synchronization**.

### Rankings

- Enhanced rankings with **school name normalization** and ELO leaderboard fixes.

### UI and infrastructure

- Extensive mobile UX polish (dock navigation, speech toolbar, timers) and new visual components (**GlowingEffect**, **CardSpotlight**, **CanvasRevealEffect**).
- Added service worker **offline caching** and an auto-merge CI workflow.

## February 2026 — 14 commits

**Beta V2 major release**: core debate application with flow editor, video integration, card parsing, and comprehensive UI components.

### Editor

- Completed the **TipTap to Lexical** editor migration with a quotes plugin.
- Added the **debate flow spreadsheet**, speech document panel, and a new markdown editor.

### Pages and docs

- Implemented new **Debate Flow** and **Debate Videos** pages with supporting components and hooks, and redesigned the **ChampionsPanel**.
- Restructured documentation into a new `docs/` directory with project vision and feature docs.

#  Paperless Debate Era (Prototype, 2010-2026)

## December 2025 — 6 commits

- Created the **FLOW Research Manager** as a **Next.js** application.
- Established the debate flow and timer system foundation with **React Context** providers and conversion tracking.
- Completed Phase 1 MVP (core Flow editor with React/Next.js) and Phase 2 (advanced Flow features and UI enhancements).

## July 2024 — 2 commits

Editor prototype milestone. Working editor with **sidebar, file system, and flow integration**, plus **TOC and block splitting**. Indexed **2,000 videos**, built the frontpage UI, and laid the **auth and docs** foundation. 

- [Archived Web Demo](https://web.archive.org/web/20241222141238/https://debate-ai.com/) (2024)
- [Prototype Demo](https://web.archive.org/web/20140517065121/http://debatesynergy.com/) (2014)
- [Office Template Demo](https://github.com/debate/debatesynergy-office-template-2010) (2010)

