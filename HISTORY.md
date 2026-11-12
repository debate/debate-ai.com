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
| October 2026 | 1,079 |
| November 2026 (through the 11th) | 333 |

# AI Debate Era (MVP, 2026+)

## November 2026 (so far) — 333 commits

Saved-data management in Settings, school pages with mascots and history, fallacy hints across practice, Read aloud everywhere, and openCaselist team sync.

- Rankings: school pages gained a Historical legend with yearly best-team strength back to each school's first TOC, all-time and decade ranks, title counts, an All seasons NDT points modal, CEDA and NDCA titles, and places moved since last season; team handles now use debaters' last names; the Schools table is precomputed in D1 and cached in the browser.
- Schools and logos: every school logo and its spellings resolve, logos sorted into colleges, high schools and organizations, school mascots on school pages and watch-page team cards, and Settings toggles to hide mascots or logos.
- Caselist: sync one team's openCaselist pages, cites and docx files from the admin panel or a button on team and school pages; caselist speech-doc HTML and card full text move from D1 to R2 (now on an hourly cron).
- Settings: Saved to your account now searches, renames, opens, exports and restores saved docs, flows, rounds, drill sets and word-count rounds; shows where each tool saves and account tool-sync status in Settings → General.
- Practice: fallacy hints in Word-Count Speeches, Practice vs AI drafts, Speech Transcript Summaries, Argument Trees, AI outcome responses and round-sidebar speech docs; online challenges against players and AI with a Practice sidebar section; coaching personas for AI Coach Mode, remembered per account; argument maps download as SVG, PNG or PDF; volunteer-to-coach and team-needs-a-coach signups.
- Videos: Speech AI picks each round's aff and 2NR arguments, debaters' last names fill initials-only teams, computed titles for every round video, tournament names saved without years, uploads of the same round stacked into one playlist, view counts in ten color tiers, quiet breaks skipped between speeches, the topic season under the year badge, and an Incomplete videos admin tab with bulk auto-fill.
- Rounds: play a joined round recording beside its speech doc, synced to the estimated card with captions and an H1/H2/H3 outline; pop the mini player out into the desktop app.
- Read aloud: Kokoro read-aloud per paragraph in the Debate Editor with progress and a shared R2 cache; a Voice button on Synergy Slayer pages; Workers AI bound so Cloudflare read-aloud stops returning 503.
- Help docs: Suggest questions use the hosting site's AI without forced sign-in, with Markdown, collapsible, publicly saved answers asked only once; page titles with hover breadcrumbs; a citation style switcher and Chicago-order references on Synergy Slayer; the Nietzsche section and the November 2026 revision of Synergy Slayer of Critiques; the Debate AI Collective Consciousness paper; developer docs published as an unlisted site at `/docs/dev` with dependency graphs and file trees per package.
- New tools: Paper to Web AI turns any PDF or paper link into Synergy Slayer-style MDX; forums gained categories, thread likes, sort orders and collapsible reply trees; Topic Starters get one tree per topic code; LD Nationals 2025 and 2026 topics added; LD/PF topic codes now put the letter before the year.
- Admin: impersonate users, let moderators run the YouTube channel sync, export videos, teams and tournament records as CSV/JSON, and send the welcome email to a pasted list.
- Platform: Amplitude identifies signed-in users; the Worker stays under Cloudflare's 64 MiB cap (dropped the ONNX wasm) and deploys retry error 10002; D1 hiccups no longer turn into 500s, 401s or failed sessions; every OpenRouter call goes to `openrouter/free` with the user's own key first; a School Names, Logos and Trademarks section in the Terms and Privacy Policy; credits now sell through the $10 Stripe Payment Link; removed the `debate-ui` and `debate-types` packages in favour of each owning package; SEO canonical links and sitemap fixes; the browser extension release builds with Bun.

## October 2026 — 1,079 commits

Prediction markets, a rankings engine, a native Tournaments product, account sync across every tool, read-aloud in the Debate Editor, and personal debater stats.

- Launched play-money prediction markets on debates, tournaments and team ratings, plus an argument market kind and a file market selling files for wallet balance.
- Built Bradley-Terry team rankings with a head-to-head matchup simulator, side-balance bias charts, 80+ Legendary ratings, a balanced school score, and past-season college policy rankings (2009–2025).
- Regrouped the video sidebar into Research, Prep & Scout, Practice, Coaching and Insights; added AI speech detection with per-speech LLM summaries, transcription from audio, team ranking stats, follow teams and schools, viewer edit requests, an admin Speech AI pipeline, and canonical URLs by season.
- Made `/tournaments` a native product with a live Tabroom list, debate formats typed to upstream events, the Debate AI Demo Invitational, judge ballot submission with Tabroom email check, and a public field allowlist.
- Synced speech-doc links, pinned debates, flow-editor settings, auto-save mode, and the welcome dialog to signed-in accounts; added per-tool sync badges; moved flows off `localStorage`; added bring-your-own-key for OpenRouter and Anthropic.
- Consolidated tools: Practice Round Simulator into Practice vs AI, five prep tools into one Prep Workspace, six research tools into Team Research, five coaching tools into one tabbed Coaching page, News Stream plus forums into News & Forums; deleted the All Tools page; rebuilt the shell around one resizable, hideable sidebar; added fuzzy-ranked Ctrl/Cmd-K search.
- Added a judge pool, anonymous partner matching, tournament-aware team suggestions, click-to-activate speeches, AI outcome responses, and a speech-recording captions ticker.
- Debate Editor: always create `.cmir` docs, read-only mode, saved/unsaved/failed status, card hover buttons (summarize, find flaws, read aloud), BM25-ranked FTS5 card search, and a full-page reading overlay in the browser extension.
- Schools: coaches and administrators can claim a school's page.
- Added `@types/debate`, made every package publishable under `@debate-ai/`, upgraded dependencies, raised test coverage, added Stripe subscriptions (Pro VIP and Research Team), Turnstile, and Mixpanel.
- Debate Editor: read cards and whole documents aloud with Kokoro in the browser or Cloudflare Workers AI, with voice, speed and model downloads in Settings; read mode shows tag, cite, then highlights; card sharing and co-editing through the signed-in account; a shadcn Menubar; topic starters open in their own tabs with per-tab undo; CardMirror renamed to Debate Editor.
- Rounds: a shared round clock with a circular, pop-out timer and cross-ex clock; signpost outlines on sidebar speeches; camera seats inferred from the round invite; round speeches joined into one MP3 saved to R2, with one speech-start editor for the MP3, the watch page and YouTube.
- Personal Debater Stats from logged rounds: per-case breakdown, win/loss streaks, speech length, argument tags, and logged rounds linked to their saved flows.
- Settings shows everything saved to your account, opens, exports and deletes single items, pages the Manage list, and bulk-exports past the old 100-item cap; a Privacy tab adds recording release, credit options and deletion requests; debater XP now sums across devices through a per-event ledger.
- Videos: team labels with school logos and rank badges everywhere, watch pages titled after the round, shared AI results and speech detection from caption pauses, a simulated matchup prediction, a pop-out always-on-top mini player, WSD, ACC and Misc styles, TOC and CEDA history on school pages, and a daily scan of subscribed YouTube channels.
- Rankings: 2025-26 college policy ratings with a win calculator, ratings on a 10-point scale, a TOC bids column, last-decade elim stats, and school pages at `@school` handles.
- Tournaments: judge paradigms and voting records in pairings, team ratings on pairings and results, combined elimination brackets, and an Info & links dropdown.
- Help docs: debate-style highlights across the learn, feature and blog pages; both Synergy Slayer papers updated to their October 2026 revisions with MLA and Chicago citations, hover cards and an Underlining toggle.
- Platform: hosted an MCP server generated from the OpenAPI spec, React Email templates with admin previews, card full text moved to R2, a heuristic fallacy detector, the Android app on Google Play, signed desktop auto-update and a tray background service, and Chicago/MLA/APA citations plus QwkSearch sign-in in the browser extension.
- Moved code to its owners: removed `debate-data-sync`, moved shared primitives into `debate-ui`, the QwkSearch workspace into `debate-qwksearch`, the REASON docs workspace into `debate-reason-docs`, and split the leaderboard and admin out of `debate-videos`.

## September 2026 — 1,024 commits

Practice, collaboration, second-draft polish across research tools, a tool-page UI pass, a working docs site, account sync for every tool, a rankings engine, and a faster app shell.

- Ported the practice-vs-AI backend from Go to Node/TS, added a difficulty slider and past-attempts comparison, and layered multi-judge panel mode onto AI Judge Decision Modes.
- Reworked the videos experience with a collapsible sidebar nav tree, transcript modal with synced YouTube playback, resizable columns, and admin YouTube management.
- Added live presence and conflict-diff to Shared Flow Sync, team capacity and reassign controls in Task Inbox, a shared checklist and timeline in the Collaboration Prep Room, and coaching program reviewer/approval workflows.
- Added side-by-side case comparison, bulk CSV import and printable scouting reports, cross-device goal-setting, a winner-history calendar, multi-judge comparison for Judge Profiles, threaded replies, and a public topic starter library.
- Reorganized Debate Editor shell with a file tree and tabs sidebar, restored the Google-Docs-style menu bar, gave Ctrl/Cmd-Shift-Space an app-wide command palette, and moved the Topic Starter library onto Debate Editor's native `.cmir` format.
- Linked Debate Editor real-time collaboration to better-auth accounts with a contacts page, Share with contacts, and a Shared cards tab.
- Added a card library importer for the Parquet card dump (`debate-cards-upload` CLI, admin ingest endpoint, browser import panel) and a `debate_cards` upsert table.
- Gave 27 tool routes one shared tool page header; redesigned the Coach and Research Workspace hubs with sticky section tabs, per-section intro cards, current-round bar, and `?section=` URL sync.
- Finished the debate-ai-docs Fumadocs site and published it at `debate-ai.com/docs`; added Guides; closed route 404s for `/docs/features` and `/docs/packages`.
- Built `debate-data-sync` to sync every tool's saved work to the account with Tool data list, sync status on settings/tools, guest sign-in prompt, and visible watcher failures.
- Synced the Flow Edit Log, Daily Best Card, prep-note notifications, quest teams, completed research tasks, Quick Cards, AI card assessments, personal dictionary, Learn decks, and more; added optimistic concurrency and cloud-save conflict rejection.
- Surfaced saved items in My Saved Items with filtering, deletion, and sample data; added Debater Level XP at `/cards/level`.
- Gave every video its own watch page with side transcript, canonical URLs, watch history, stacked playlists, related videos, and admin video tools; added an openCaselist ZIP downloader and scraper.
- Added first rankings: clickable team and school profiles, Schools table, team radar, side-bias visualization, Glicko-2 ratings, and short titles/emoji for every 2010–2026 topic.
- Made the card corpus searchable (Parquet, duplicate count as rounds-read count); moved the REASON file tree into the app sidebar; let you download documents as `.docx`.
- Tauri native wrapper gained system tray, autostart, global shortcuts, Linux Docker build, splash video, and app-source choice; extension merged timer and card-reuse extensions with article panel; added Stripe subscriptions, Turnstile, and Mixpanel.
- Cut app shell startup JS from 4.6 MB to 1.0 MB, dropped 3.5 MB of render-blocking CSS, halved Worker startup memory, migrated D1 to the Sessions API, added weekly SQL backups to R2, and hardened the offline service worker.
- Published a typed OpenAPI SDK (`debate-api-client`), stood up `native-wrapper` Tauri shell, `debate-ai-docs` package, and fixed bun.lock.

## August 2026 — 363 commits

Identity, live sync, and a real content feed.

- Wired signed-in Google/better-auth identity into research and round panels, replacing free-typed contributor IDs.
- Added cross-tab live updates to Daily Best Card, Leaderboard, Task Inbox, Progress Unlocks, Research Progress, Quest Streaks, and News Stream; persisted D1-backed cloud save for settings, flows and rounds; added "Save all rounds" bulk action.
- Built the News Stream feed auto-aggregating quest streaks, group challenges, revisions, prep notes, Argument Library submissions, AI Coach Mode sessions, plus Tool spotlight posts.
- Overhauled Debate Editor shell with Plugins dropdown, Workspace menu, and ebb as an embeddable panel; restored the `debate-editor` re-export shim; added Insert Short Cite command.
- Migrated the video library from static JSON to a SQL-backed paginated feed seeded inside the Worker.
- Wired orphaned tool routes into nav entries; added "Tools for this round" menu; surfaced saved flows in the `/tools` widget; added Site Links/Debate Links submenus and `/legal/privacy`.
- Removed the CX NDCA Standings tool; replaced the card-reuse checker with debate-web-ext; stopped the service worker from intercepting unsafe requests.
- Added unit tests for Debate Editor schema-id, footnote, and timer sound helpers.

## June 2026 — 18 commits

Debate Editor release milestone month.

- Integrated the Debate Editor engine into a new reason-editor workspace package on TipTap/React; ported AI editing tools (cite, repair, explain, alt text); implemented HTML-to-card parsing with citation extraction.
- Added server configuration and session management hooks; fixed Vercel builds to run as Vite; rebuilt the PWA service worker precache; declared missing workspace dependencies.

## May 2026 — 57 commits

Research platform and rebranding push.

- Rebranded to Debate-AI.com with pillars CARDS, FIAT, LEARN, STREAM, REASON; authored the Debate Singularity research paper.
- Built the LecturesPage with category navigation and YouTube statistics; overhauled the video library with leaderboard and dictionary panels; ingested NDCA 2026 LD rounds.
- Initialized Lexical editor integration with yjs-backed collaborative components; extracted sync and data modules into debate-data-sync; moved the offline service worker to `lib/offline-sw`.

## April 2026 — 9 commits

Flow tooling and archive maintenance.

- Implemented an interactive flow spreadsheet; added persistent video playback timestamps; refreshed the tournament video archive with NDT/TOC rounds; updated README branding and demo images.

## March 2026 — 128 commits

The biggest month of development.

- Built the complete Debate Round feature: round creation and editing, flow interface with spreadsheet, per-speech timers with persistence, speech management, and timer sound effects.
- Overhauled card search with AI analysis sidebars, advanced filtering, responsive layouts, client-side caching; rebuilt the card parser with human-name, citation extraction and DOCX parsing.
- Added AI speech-to-flow and speech-to-response prompts, and speech-sync card highlighting.
- Shipped a persistent floating video player; added video categorization, infinite scroll, structured tournament/round/team metadata, and YouTube synchronization.
- Enhanced rankings with school name normalization and ELO leaderboard fixes; added mobile UX polish and new visual components; added service worker offline caching.

## February 2026 — 14 commits

Beta V2 major release: core debate application with flow editor, video integration, card parsing, and UI components.

- Completed the TipTap to Lexical editor migration with a quotes plugin; added the debate flow spreadsheet, speech document panel, and markdown editor.
- Implemented Debate Flow and Debate Videos pages; redesigned ChampionsPanel; restructured documentation into `docs/`.

# Paperless Debate Era (Prototype, 2010-2026)

## December 2025 — 6 commits

Created the FLOW Research Manager Next.js app; established the debate flow and timer system foundation with React Context providers; completed Phase 1 and Phase 2 MVP.

## July 2024 — 2 commits

Editor prototype milestone with sidebar, file system, flow integration, TOC and block splitting; indexed 2,000 videos; built the frontpage UI; laid the auth and docs foundation.


## Prior Work

- [Archived Web Demo](https://web.archive.org/web/20241222141238/https://debate-ai.com/) (2024)
- [Prototype Demo](https://web.archive.org/web/20140517065121/http://debatesynergy.com/) (2014)
- [Office Template Demo](https://github.com/debate/debatesynergy-office-template-2010) (2010)
