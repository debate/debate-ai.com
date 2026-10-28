
## debate-webview

The debate-ai.com frontend UI as a standalone React package — the video archive, card
search, the card reuse check over any URL, season standings, and the catalog of every
tool in the app — with no Next.js, no router and no session of its own, so it mounts
anywhere React runs. It reaches the server only through `debate-api-client`, and ships
one scoped stylesheet rather than depending on the host's design system.
`apps/debate-web-ext`'s Options page is its first host.
It also holds the app's pure server helpers (Stripe webhook verification, the leaderboard
resolver, Tabroom proxies, the `/api/tts` backends, QwkSearch connect, `.docx` → `.cmir`
import and the like) that the `/api` routes call; anything touching D1, auth or env stays in
`apps/debate-web/lib`.

## debate-api-client

Typed SDK for the [Debate AI API](https://debate-ai.com/api), generated from
`packages/debate-api-client/debate-openapi.yml` with Hey API. Calls run through `grab-url`
instead of fetch/axios, so every operation gets caching, retries, rate limiting, and
request dedupe. Each `operationId` has a matching function that resolves to
`{ data?, error? }` and never throws on an HTTP error. It also ships `mcp-tools.json`, the
hosted MCP server's tool list, which [api2ai](https://www.npmjs.com/package/api2ai)
generates from the same spec (`bun run generate:mcp`); the web app serves it at `/api/mcp`.

## debate-card-parser

Parser for debate evidence cards, turning Verbatim `.docx` files and HTML into structured
cards with citations and highlighting. Used to import evidence into the site's card-based
tools.

## debate-contributor-progress

Package name `debate-community`. Community and contributor-progress panels: contribution
leaderboard, news stream, contributor awards, daily best card, progress unlocks, quest
streaks, and daily quests. Split out of `debate-card-search` alongside
`debate-search-evidence` and `debate-team-collaboration`, and depends on both.

## debate-data-sync

Bundled debate data assets (metadata, schemas, the topic list and its formatters in
`src/topics/`) plus the scripts that sync them. Keeps debate rankings up to date, pulls the
openCaselist bulk evidence archives for every caselist (HS Policy, HS LD, HS PF, NDT/CEDA,
NFA LD), and defines shared record types such as `OpponentTeamProfile`. Depends on
`debate-card-parser` for the DOCX half of the caselist ingest. The YouTube video sync moved
to `debate-videos-admin`.

## debate-editor

Debate Editor, the debate-card editor embedded across debate-ai.com. Exposes the
ProseMirror engine, Verbatim `.docx` interop (lossless round-trip, encrypted-file
decryption, the native `.cmir` format, the `cardmirror-read` headless CLI/MCP server), and
a React editor shell sized for the site's speech-doc and `/reason-editor` surfaces.

Its engine is upstream Debate Editor from the `debate-editor-cm` submodule; this package is an
adapter that holds no copy of it. `upstream.json` pins the upstream commit,
`patches/debate-ai.patch` records every edit to an upstream file (the single scrolling
toolbar strip, the embed hooks, the settings sidebar, account sync), and `overlay/` holds
the files upstream doesn't have — the React shell with its dropdown `MenuBar`, the
exported settings tabs, the web `.docx` helpers, the sync clients. `scripts/sync-upstream.mjs` assembles the three into a git-ignored `src/` on
install and before build/typecheck/test; `bun run sync-upstream:save` records edits made in
`src/`, and `bun run sync-upstream` rebases onto a newer submodule commit.

## debate-editor-cm (git submodule)

`debate-editor-cm` is a git submodule of upstream Debate Editor,
[debate/debate-editor](https://github.com/debate/debate-editor), kept as upstream ships it
and outside the bun workspace (it is a Vite app with its own toolchain). `debate-editor` is
its only adapter: the former `debate-editor-cm-adapter` package was merged into it, so
Debate Editor's schema, `.docx` import/export and native `.cmir` format, plus
`importDocx(file)`, `exportDocxBlob(doc)`, `outlineOf(doc)` and `cardsOf(doc)`, all come
from `@debate-ai/editor/engine`.

## debate-emails

Package name `@debate-ai/emails`. The site's transactional emails as React Email
(`@react-email/components`) templates: welcome, file collaboration invite (Debate Editor
card shares), debate round invite and the coach feature tour. `renderEmail(id, props)`
returns `{ subject, html, text }` and runs on Cloudflare Workers (`@react-email/render`'s
`workerd` build). Each template carries sample data that the admin Emails section previews.
Depends on no other `debate-*` package; used by `apps/debate-web` (`/api/rounds/invite`,
`/api/card-shares`, `/api/admin/emails`).

## debate-file-market

Selling research files for wallet balance, mounted at `/research/market` and on the Files sidebar's
"Sell…" menu item. The framework-free core: the free table-of-contents preview read from a file's
headings (`outline.ts`), prices and the sell request (`pricing.ts`), the $10 / $20 Stripe top-ups and
the parsing of their webhook events (`topups.ts`), wire types, a browser client
(`debate-file-market/client`), and the D1 migration for its four tables (`migrations/`, applied by
`.github/scripts/migrate-d1.ts`). The market pages (`debate-file-market/ui`: the board, a listing's preview
and Buy button, the wallet card and the outline preview) live here too; the Sell dialog stays in
`debate-webview` beside the Files sidebar it opens from, and the routes and queries are in `apps/debate-ai.com`.

## debate-flow

Package name `debate-flow-ebb`. The `ebb` local-first, keyboard-first flow editor, ported
in as a workspace package. `EbbFlowEmbed` mounts the flow grid as one column of a host
page, such as `debate-round`'s live round editor, while keeping the editor's state,
bridge, palette, and scoped styles here.

## debate-help-docs

Package name `debate-help-docs`. The Debate AI documentation site, built on the Fumadocs
starter template. Publishes the product's feature pages (`content/docs/features/`), the engineering
notes behind them (`content/docs/internals/`) and package READMEs as a searchable docs site. The web
app mounts its route modules at `app/docs` and compiles its MDX in the app's own Vite build, so it is
served at [debate-ai.com/docs](https://debate-ai.com/docs) rather than deployed on its own.

## dev-docs

Package name `@debate-ai/dev-docs`, private and never published or deployed. Internal developer
documentation: a column-by-column reference for every database table (the app's Drizzle schema
and the Tabroom tables) and a self-hosting guide covering local setup, the Cloudflare D1
schema, deployment and every environment variable. No code and no dependencies.

## debate-practice-drills

Package name `debate-practice-rounds`. Practice and AI round tooling: AI drill generator,
AI coach mode, judge paradigm picker, AI judge decision, opponent persona picker,
word-count speeches, practice round simulator, speech transcript summaries, argument-tree
outline with Kialo-style pro/con map views (d3: tiered tree, sunburst, mind map, bubble
map, sankey), flow annotations, and AI response-outcome charts. Also practice partners (challenges, the
match finder; `src/practice-partners`) and the judge pool (`src/judge-pool`), whose types,
validation and match rules the app's API routes import by path. Composes `debate-round`,
`debate-speech-writer`, `debate-timer`, `debate-search-evidence`, and
`debate-contributor-progress`.

## debate-predictions

Play-money prediction markets on debates, tournament winners and team rating moves, mounted at
`/practice/predictions`. The framework-free core: the LMSR pricing engine (`lmsr.ts`), payouts and the rules
that settle a market from hosted Tabroom ballots, hosted event results or a `debate-rankings` rating
(`settle.ts`), the markets the site opens itself — each division's top five and the season's major tournaments
(`presets.ts`) — request validation and wire types, a browser client (`debate-predictions/client`), and the D1
migration for its three tables (`migrations/`, applied by `.github/scripts/migrate-d1.ts`). The page itself
(`debate-predictions/ui`) is here too and reads team ratings from `debate-rankings-adapter`; `debate-webview`
mounts it and the routes and queries are in `apps/debate-ai.com`.

## debate-rankings

Ballot-level Bradley-Terry rankings for HS PF, LD, Policy and college policy — a git submodule of
[debate/debate-rankings](https://github.com/debate/debate-rankings), kept as upstream ships it. It has its own
Python toolchain (`src/main.py` fits every ballot of the season into CSVs under `output/`), so it stays out of the
bun workspace and its `config/` and `output/` files are read by path rather than by package name — see
`debate-rankings-adapter`, which holds the dataset list and the lazy, typed CSV loader. Read by the `/coaching/rankings` panel in
`debate-videos` and by `debate-round`'s Create New Round team picker, through `debate-rankings-adapter`.

## debate-rankings-adapter

What the web UI imports for rankings: the dataset list and typed CSV loader over `debate-rankings`'
output, ratings moved onto the site's scale (`rating-offset.ts`), plus the
site-only team-label lookup (`findTeamRanking("Harker LL")` and friends) that matches a round
video's team to its rankings row, the tournament-entry lookup (`matchTournamentEntry`,
`rankingDatasetsForEvent`) that `/tournaments` pairings and results use to show an entry's
rating in its own format's rankings, and past-season college policy tables (2009-10 to 2025-26)
scraped from debatedata.weebly.com (`college-history.ts`). Site additions live here so the
submodule never diverges from upstream.

The rankings UI lives here too, under its own entry point `@debate-ai/rankings-adapter/leaderboard`
(the root stays React-free for the Worker): the `/practice/rankings` leaderboard, team and school
profile pages, the matchup simulator, team labels and school logos, follows and "my ranked
teams". Profile pages get their Videos section from the host through `ProfileVideosProvider`
(the grid itself is `ProfileVideos` in `debate-videos`, which depends on this package). Depends
on `debate-data-sync` for the champions, NDT history and TOC bid data.

## debate-reason-docs

Package name `@debate-ai/reason-docs`. The REASON docs workspace moved out of
`debate-webview`: the sidebar file tree and tabs, the file manager, the editor screen,
sharing a file with contacts, selling it (`SellFileDialog`), Topic Starters, and the
helpers for slugs, paths, the save queue and the stored `.cmir` format. Signed-in state
arrives through `ReasonSessionProvider`, which the shell mounts. Depends on `debate-ui`,
`debate-editor`, `debate-file-market`, `debate-team-collaboration`, `debate-data-sync`,
`debate-card-parser` and `debate-types`; depended on by `debate-webview` and
`debate-webview-admin`.

## debate-round

FIAT, the live debate round workspace. Includes the ag-Grid flow spreadsheet, column
navigation and split view, round setup dialogs (tournament, teams, judges, spectators,
winner), speech doc panels, export/history tooling, and the flow/settings stores. Also
exports the roster panels (prep notes, opponent team profiles, drill sets, pre-round
briefings, coaching sessions, flow summaries) that render persisted records from the
practice tools.
The Create New Round dialog reads current tournaments and their fields through
`debate-tournaments`' API client (`@debate-ai/tournaments/client`).

## debate-round-practice-ai

Package name `debate-practice-vs-ai`. A full timed debate round against an AI opponent,
mounted at `/practice/versus-ai` (the Practice Round Simulator's `/practice` redirects there, and
`debate-webview`'s `PracticeVsAiSections` mounts the simulator panels below the round). Setup is a
difficulty → topic → opponent wizard, then a prep step where the opponent turns cards and caselist
outlines found for the topic into a case brief (`backend/case-prep.ts`, `POST /api/vsbot/prep`).
Node/TypeScript port of the Go `arguehub` vs-bot backend (13 bot
personalities, prompt construction, AI judging, gamification) plus the React round UI;
plain `fetch`, no Go/Mongo/Gin, runs under Next.js or a Cloudflare Worker.

## debate-search-evidence

Package name `debate-research-evidence`. The evidence card research interface (search bar,
result list, card content viewer with a source-article reader that pulls a card's full
article through qwksearch, research and AI-analysis sidebars) plus the shared
evidence/argument library, LLM card scoring, revision incentives, review queue, and topic
coverage dashboard. The foundation that `debate-contributor-progress` and
`debate-team-collaboration` split off from and still build on.

## debate-speech-writer

The AI prompt library behind FIAT's speech and flow features. Includes flow extraction,
judge decisions, flaw finding, research outlines, and a batch quote-analysis helper.

## debate-team-collaboration

Team prep and collaboration tools: task inbox, prep room, topic sprints, team brainstorm
assist, group challenges, research-progress tracking, sprint notes, the team calendar
(tasks, assignments, deadlines and group-only virtual tournaments per coaching group),
and (moved from
`debate-round`) prep notes and account/prep-note notifications. Split out of
`debate-card-search` and `debate-round`; depends on `debate-search-evidence` and
`debate-round`.

## debate-timer

Speech and prep timers for live rounds, with per-format speech times built in. Also
includes an in-round speech recorder with mic selection, live waveform, playback and
optional webcam video, and the joined round recording: every speech in one MP3
(`@breezystack/lamejs`), optional Kokoro announcements and Moonshine captions
(`@moonshine-ai/moonshine-js`), and the speech-start modal shared with `debate-videos`.
Also owns the circular progress timer face (`CircularTimerFace`), shared by the round
sidebar's Timer section and the browser extension's timer window.

## debate-types

Package name `@debate-ai/types`. Every shared type — rounds and flows, scouting and
collaboration state, parsed cards, the video feed, prediction markets, the Practice vs AI
wire types — declared once, with a description on each object and field so editors show it
on hover. Declarations only; the packages that owned these types re-export them. Import
with `import type { … } from "@debate-ai/types"`. Depended on by `debate-timer`, `debate-card-parser`,
`debate-round`, `debate-flow`, `debate-tournaments`, `debate-webview`,
`debate-round-practice-ai`, `debate-videos`, `debate-data-sync` and `debate-predictions`.

## debate-tournaments

Upstream [Tabroom](https://github.com/debate/debate-tournaments) vendored and adapted
to Cloudflare Workers + D1: its public API as a fetch handler (`debate-tournaments/server`,
mounted at `/api/tabroom`), a React port of its invite/pairings/results pages (mounted at
`/tournaments`), the route table, its `@tabroom/types` Zod schemas and inferred types
(`debate-tournaments/types`, with `tabroomSchemas` — every schema keyed by record name — and
a non-throwing `parseTabroom(schema, data)`), and the D1 schema. Its own `/host` API creates
tournaments on this site (never on Tabroom) and serves each one's admin web view, and a demo
tournament loads itself for anyone to browse as the mock admin `demo.admin`.
Pairings and results take optional host lookups (`lookupTeamRating`,
`lookupJudgeParadigm` and `lookupJudgeProfile` on `<TournamentsApp>`, see
`src/ui/enrichment.tsx`): the site passes rankings matches, a Tabroom paradigm search and its
judge paradigm cache, so entries show logo, last names and rating and every judge opens a
dialog with their paradigm and voting record. `@debate-ai/tournaments/paradigms` parses Tabroom's
paradigm and judging-record answers, and `fetchTabroomJudge` (in `/server`) reads them from
Tabroom's API with a signed-in session. A judge's own hosted paradigm lives here as well: its
types, Markdown rendering and browser calls (`@debate-ai/tournaments/judge-paradigms/*`) and the
`/practice/paradigm` editor (`@debate-ai/tournaments/paradigm-editor`). The package itself still
depends on no other `debate-*` package.
`scripts/sync-upstream.mjs` re-clones upstream and re-applies this package's patches and
overlays, so upstream changes keep flowing in.

## debate-tournaments-tabroom (git submodule)

`debate-tournaments-tabroom` is a git submodule of upstream Tabroom,
[debate/debate-tournaments](https://github.com/debate/debate-tournaments), outside the bun
workspace. It is only the source `debate-tournaments` vendors from; nothing imports it at
runtime. Clone with `git clone --recurse-submodules`, or run `git submodule update --init` in
an existing checkout, before running the sync script.

The adapters that reach into a submodule by path link `<submodule>/node_modules` to their own
on `postinstall`, so the submodule's bare imports resolve under bun's isolated linker.

## debate-ui

Package name `@debate-ai/ui`. The shared shadcn/Radix primitives (`button`, `card`,
`dialog`, `select`, `sidebar`, …), `cn`, the `useIsMobile` hook and the panel building
blocks (`PanelShell`, `StatTile`, `useStoreSnapshot`) and the app's loading orb (`AnimatedLoader`) — moved out of
`debate-webview/src/lib/ui` so feature packages can render with them without importing
back from the shell. No debate code. Depended on by `debate-webview` and
`debate-webview-admin`.

## debate-videos

LEARN, the debate video library. Covers video search and filtering, grids and cards, a
persistent YouTube player with picture-in-picture, a per-video watch page at
`/videos/watch/<title-slug>` (player, synced transcript, related videos) and
lecture pages. Its read-side data layer (`src/data/`: row conversion, the shared
filter/sort/facet query, the local index, stacks, lecture and round-level classifiers) is what
both `/api/videos` and the in-browser index run. The leaderboard and team profiles moved to
`debate-rankings-adapter`; the admin panels and the YouTube sync to `debate-videos-admin`.

## debate-videos-admin

Package name `@debate-ai/videos-admin`. The video library's admin side: every panel of the
admin page's video sections (round queue, video library and reports, YouTube sync, speech AI,
transcript scraper) and their dialogs; the `/api/admin/videos` and `/api/admin/youtube` handlers
(under `./api`, run against the app's `@/` modules like `debate-webview-admin`'s); and the
YouTube ingest that used to live in `debate-data-sync` — channel config, title parsers, the
sync/stats/view-count CLIs (`bun run sync-youtube` and friends), the curated round queue, the
seed/stack/view-count SQL builders, `data/youtube-stats.json` and the video D1 migrations (still
tracked as `debate-data-sync/<file>` by `migrate-d1.ts`). Depends on `debate-videos`; the admin
page in `debate-webview` mounts its panels.

## shadcn-sidebar

A generic, publishable version of the app sidebar, with no debate code in it: a
drag-resizable column whose width and hidden/shown state persist, three collapse modes
(`offcanvas` with an edge tab, `icon` rail, `none`), `sidebar` / `floating` / `inset`
variants, Ctrl/Cmd+B, a magnifying app dock (in the column, in the rail, floating while
hidden, or a bottom bar on phones), a data-driven accordion nav tree with nested groups and
counts, an account menu with a light/dark/system and colour-theme submenu, and a mobile
drawer. Everything is configured with plain data, and links render through a `renderLink`
hook so any router plugs in. `shadcn-sidebar/demo` ships "ClipWire", a mock site for
watching videos and clipping and sharing news articles; `bun run storybook` in the package
opens its stories. Depends on no other package in this repo.
