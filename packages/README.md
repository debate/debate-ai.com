
## debate-webview

The debate-ai.com frontend UI as a standalone React package — the video archive, card
search, the card reuse check over any URL, season standings, and the catalog of every
tool in the app — with no Next.js, no router and no session of its own, so it mounts
anywhere React runs. It reaches the server only through `debate-api-client`, and ships
one scoped stylesheet rather than depending on the host's design system.
`apps/debate-web-ext`'s Options page is its first host.

## debate-api-client

Typed SDK for the [Debate AI API](https://debate-ai.com/api), generated from
`apps/debate-ai.com/public/debate-openapi.yml` with Hey API. Calls run through `grab-url`
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

## debate-editor-cm (git submodule) and debate-editor-cm-adapter

`debate-editor-cm` is a git submodule of upstream CardMirror,
[debate/debate-editor](https://github.com/debate/debate-editor), kept as upstream ships it
and outside the bun workspace (it is a Vite app with its own toolchain).
`debate-editor-cm-adapter` is what the web UI imports: CardMirror's schema, `.docx`
import/export and native `.cmir` format re-exported by path, plus `importDocx(file)`,
`exportDocxBlob(doc)`, `outlineOf(doc)` and `cardsOf(doc)`.

## debate-feature-catalog

Canonical `APP_FEATURES` catalog for the `/features` page — data plus
section/search/doc-url helpers, with no dependencies of its own (a leaf
package, like `debate-data-sync`). Depended on by the app's live `/features`
page (`apps/debate-ai.com/lib/ui/features/FeaturesPanel`) and
`debate-contributor-progress`'s News Stream "Tool spotlight" posts, so a feature
only needs to be registered once instead of hand-synced across forks.

## debate-flow

Package name `debate-flow-ebb`. The `ebb` local-first, keyboard-first flow editor, ported
in as a workspace package. `EbbFlowEmbed` mounts the flow grid as one column of a host
page, such as `debate-round`'s live round editor, while keeping the editor's state,
bridge, palette, and scoped styles here.

## debate-help-docs

Package name `debate-help-docs`. The Debate AI documentation site, built on the Fumadocs
starter template. Publishes the product's feature pages (`content/docs/features/`), the engineering
notes behind them (`content/docs/internals/`) and package READMEs as a searchable docs site. Statically exported under `basePath: '/docs'` and
copied into the web app's `public/docs` by `apps/debate-ai.com/scripts/build-docs.mjs`,
so it is served at [debate-ai.com/docs](https://debate-ai.com/docs) rather than deployed
on its own.

## debate-practice-drills

Package name `debate-practice-rounds`. Practice and AI round tooling: AI drill generator,
AI coach mode, judge paradigm picker, AI judge decision, opponent persona picker,
word-count speeches, practice round simulator, speech transcript summaries, argument-tree
outline, flow annotations, and AI response-outcome charts. Composes `debate-round`,
`debate-speech-writer`, `debate-timer`, `debate-search-evidence`, and
`debate-contributor-progress`.

## debate-rankings

Glicko-2 rankings for HS PF, LD, Policy and college policy — a git submodule of
[debate/debate-rankings](https://github.com/debate/debate-rankings), kept as upstream ships it. A Python pipeline
(`src/main.py`) replays tournament results into CSVs under `output/`; a TypeScript entry
(`js/index.ts`) exposes the dataset list and a lazy, typed loader for them. Read by the
`/rank` panel in `debate-videos`, through `debate-rankings-adapter`.

## debate-rankings-adapter

What the web UI imports for rankings: everything `debate-rankings` exports, plus the
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

## debate-round-practice-ai

Package name `debate-practice-vs-ai`. A full timed debate round against an AI opponent,
mounted at `/versus-ai`. Node/TypeScript port of the Go `arguehub` vs-bot backend (13 bot
personalities, prompt construction, AI judging, gamification) plus the React round UI;
plain `fetch`, no Go/Mongo/Gin, runs under Next.js or a Cloudflare Worker.

## debate-search-evidence

Package name `debate-research-evidence`. The evidence card research interface (search bar,
result list, card content viewer, research and AI-analysis sidebars) plus the shared
evidence/argument library, LLM card scoring, revision incentives, review queue, and topic
coverage dashboard. The foundation that `debate-contributor-progress` and
`debate-team-collaboration` split off from and still build on.

## debate-speech-writer

The AI prompt library behind FIAT's speech and flow features. Includes flow extraction,
judge decisions, flaw finding, research outlines, and a batch quote-analysis helper.

## debate-team-collaboration

Team prep and collaboration tools: task inbox, prep room, topic sprints, team brainstorm
assist, group challenges, research-progress tracking, sprint notes, and (moved from
`debate-round`) prep notes and account/prep-note notifications. Split out of
`debate-card-search` and `debate-round`; depends on `debate-search-evidence` and
`debate-round`.

## debate-timer

Speech and prep timers for live rounds, with per-format speech times built in. Also
includes an in-round speech recorder with mic selection, live waveform, and playback.

## debate-tournaments

Upstream [Tabroom](https://github.com/debate/debate-tournament-tabroom) vendored and adapted
to Cloudflare Workers + D1: its public API as a fetch handler (`debate-tournaments/server`,
mounted at `/api/tabroom`), a React port of its invite/pairings/results pages (mounted at
`/tournaments`), the route table, and the D1 schema. `scripts/sync-upstream.mjs` re-clones
upstream and re-applies this package's patches and overlays, so upstream changes keep flowing in.

## debate-tournaments-tabroom (git submodule) and debate-tournaments-tabroom-adapter

`debate-tournaments-tabroom` is a git submodule of upstream Tabroom,
[debate/debate-tournaments](https://github.com/debate/debate-tournaments), outside the bun
workspace. `debate-tournaments-tabroom-adapter` re-exports its `@tabroom/types` Zod schemas
and inferred types, with `tabroomSchemas` (every schema keyed by record name) and a
non-throwing `parseTabroom(schema, data)`.

The two adapters that reach into a submodule by path link `<submodule>/node_modules` to
their own on `postinstall`, so the submodule's bare imports resolve under bun's isolated
linker. Clone with `git clone --recurse-submodules`, or run
`git submodule update --init` in an existing checkout, before `bun install`.

## debate-videos

LEARN, the debate video library. Covers video search and filtering, grids and cards, a
persistent YouTube player with picture-in-picture, a per-video watch page at
`/videos/watch/<title-slug>` (player, synced transcript, related videos),
lecture pages, and the rankings leaderboard (data from `debate-rankings`).
