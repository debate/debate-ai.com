
## debate-webview

The debate-ai.com frontend UI as a standalone React package — the video archive, card
search, the card reuse check over any URL, season standings, and the catalog of every
tool in the app — with no Next.js, no router and no session of its own, so it mounts
anywhere React runs. It reaches the server only through `debate-api-client`, and ships
one scoped stylesheet rather than depending on the host's design system.
`apps/debate-web-ext`'s Options page is its first host.

## debate-api-client

Typed SDK for the [Debate AI API](https://debate-ai.com/api), generated from
`packages/debate-api-client/debate-openapi.yml` with Hey API. Calls run through `grab-url`
instead of fetch/axios, so every operation gets caching, retries, rate limiting, and
request dedupe. Each `operationId` has a matching function that resolves to
`{ data?, error? }` and never throws on an HTTP error.

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

Bundled debate data assets (metadata, videos, schemas) plus the scripts that sync them.
Keeps YouTube video data and debate rankings up to date, pulls the openCaselist bulk
evidence archives for every caselist (HS Policy, HS LD, HS PF, NDT/CEDA, NFA LD), and
defines shared record types such as `OpponentTeamProfile`. Depends on
`debate-card-parser` for the DOCX half of the caselist ingest.

## debate-editor

The CardMirror-based debate-card editor embedded across debate-ai.com. Exposes the
ProseMirror engine, Verbatim `.docx` interop (lossless round-trip, encrypted-file
decryption, the native `.cmir` format, the `cardmirror-read` headless CLI/MCP server), and
a React editor shell sized for the site's speech-doc and `/reason-editor` surfaces.

Its engine is upstream CardMirror from the `debate-editor-cm` submodule; this package is an
adapter that holds no copy of it. `upstream.json` pins the upstream commit,
`patches/debate-ai.patch` records every edit to an upstream file (the single scrolling
toolbar strip, the embed hooks, the settings sidebar, account sync), and `overlay/` holds
the files upstream doesn't have — the React shell with its dropdown `MenuBar`, the
exported settings tabs, the web `.docx` helpers, the sync clients. `scripts/sync-upstream.mjs` assembles the three into a git-ignored `src/` on
install and before build/typecheck/test; `bun run sync-upstream:save` records edits made in
`src/`, and `bun run sync-upstream` rebases onto a newer submodule commit.

## debate-editor-cm (git submodule)

`debate-editor-cm` is a git submodule of upstream CardMirror,
[debate/debate-editor](https://github.com/debate/debate-editor), kept as upstream ships it
and outside the bun workspace (it is a Vite app with its own toolchain). `debate-editor` is
its only adapter: the former `debate-editor-cm-adapter` package was merged into it, so
CardMirror's schema, `.docx` import/export and native `.cmir` format, plus
`importDocx(file)`, `exportDocxBlob(doc)`, `outlineOf(doc)` and `cardsOf(doc)`, all come
from `@debate/editor/engine`.

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

## debate-practice-drills

Package name `debate-practice-rounds`. Practice and AI round tooling: AI drill generator,
AI coach mode, judge paradigm picker, AI judge decision, opponent persona picker,
word-count speeches, practice round simulator, speech transcript summaries, argument-tree
outline with Kialo-style pro/con map views (d3: tiered tree, sunburst, mind map, bubble
map, sankey), flow annotations, and AI response-outcome charts. Composes `debate-round`,
`debate-speech-writer`, `debate-timer`, `debate-search-evidence`, and
`debate-contributor-progress`.

## debate-predictions

Play-money prediction markets on debates, tournament winners and team rating moves, mounted at
`/practice/predictions`. The framework-free core: the LMSR pricing engine (`lmsr.ts`), payouts and the rules
that settle a market from hosted Tabroom ballots, hosted event results or a `debate-rankings` rating
(`settle.ts`), the markets the site opens itself — each division's top five and the season's major tournaments
(`presets.ts`) — request validation and wire types, a browser client (`debate-predictions/client`), and the D1
migration for its three tables (`migrations/`, applied by `.github/scripts/migrate-d1.ts`). No dependencies;
the page is in `debate-webview` and the routes and queries in `apps/debate-ai.com`.

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
video's team to its rankings row. Site additions live here so the submodule never diverges
from upstream.

## debate-round

FIAT, the live debate round workspace. Includes the ag-Grid flow spreadsheet, column
navigation and split view, round setup dialogs (tournament, teams, judges, spectators,
winner), speech doc panels, export/history tooling, and the flow/settings stores. Also
exports the roster panels (prep notes, opponent team profiles, drill sets, pre-round
briefings, coaching sessions, flow summaries) that render persisted records from the
practice tools.
The Create New Round dialog reads current tournaments and their fields through
`debate-tournaments`' API client (`@debate/tournaments/client`).

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
includes an in-round speech recorder with mic selection, live waveform, and playback.

## debate-types

Package name `@debate/types`. Every shared type — rounds and flows, scouting and
collaboration state, parsed cards, the video feed, prediction markets, the Practice vs AI
wire types — declared once, with a description on each object and field so editors show it
on hover. Declarations only; the packages that owned these types re-export them. Import
with `import type { … } from "@debate/types"`. Depended on by `debate-timer`, `debate-card-parser`,
`debate-round`, `debate-flow`, `debate-tournaments`, `debate-webview`,
`debate-round-practice-ai`, `debate-videos`, `debate-data-sync` and `debate-predictions`.

## debate-tournaments

Upstream [Tabroom](https://github.com/debate/debate-tournament-tabroom) vendored and adapted
to Cloudflare Workers + D1: its public API as a fetch handler (`debate-tournaments/server`,
mounted at `/api/tabroom`), a React port of its invite/pairings/results pages (mounted at
`/tournaments`), the route table, its `@tabroom/types` Zod schemas and inferred types
(`debate-tournaments/types`, with `tabroomSchemas` — every schema keyed by record name — and
a non-throwing `parseTabroom(schema, data)`), and the D1 schema. Its own `/host` API creates
tournaments on this site (never on Tabroom) and serves each one's admin web view, and a demo
tournament loads itself for anyone to browse as the mock admin `demo.admin`.
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

## debate-videos

LEARN, the debate video library. Covers video search and filtering, grids and cards, a
persistent YouTube player with picture-in-picture, a per-video watch page at
`/videos/watch/<title-slug>` (player, synced transcript, related videos),
lecture pages, and the rankings leaderboard (data from `debate-rankings`).

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
