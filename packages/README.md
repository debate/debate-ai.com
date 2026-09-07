# Packages

Workspace packages used by the debate-ai.com apps. Section headings are the
directory names; the npm package name is called out where it differs.

## debate-api-client

Typed SDK for the [Debate AI API](https://debate-ai.com/api/api-docs), generated from
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
Keeps YouTube video data and debate rankings up to date, and defines shared record types
such as `OpponentTeamProfile`.

## debate-editor

The CardMirror-based debate-card editor embedded across debate-ai.com. Exposes the
ProseMirror engine, Verbatim `.docx` interop (lossless round-trip, encrypted-file
decryption, the native `.cmir` format, the `cardmirror-read` headless CLI/MCP server), and
a React editor shell sized for the site's speech-doc and `/reason-editor` surfaces.

## debate-flow

Package name `debate-flow-ebb`. The `ebb` local-first, keyboard-first flow editor, ported
in as a workspace package. `EbbFlowEmbed` mounts the flow grid as one column of a host
page, such as `debate-round`'s live round editor, while keeping the editor's state,
bridge, palette, and scoped styles here.

## debate-help-docs

Package name `debate-help-docs`. The Debate AI documentation site, built on the Fumadocs
starter template. Publishes the product's feature specs (`docs/features/`) and package
READMEs as a searchable docs site.

## debate-practice-drills

Package name `debate-practice-rounds`. Practice and AI round tooling: AI drill generator,
AI coach mode, judge paradigm picker, AI judge decision, opponent persona picker,
word-count speeches, practice round simulator, speech transcript summaries, argument-tree
outline, flow annotations, and AI response-outcome charts. Composes `debate-round`,
`debate-speech-writer`, `debate-timer`, `debate-search-evidence`, and
`debate-contributor-progress`.

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

## debate-ui

Shared UI kit for the debate apps. Provides shadcn/Radix primitives, a custom icon set,
the site footer, and the `cn`/URL-state helpers other packages build on.

## debate-videos

LEARN, the debate video library. Covers video search and filtering, grids and cards, a
persistent YouTube player with picture-in-picture, lecture pages, and rankings
leaderboards.
