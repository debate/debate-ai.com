# Architecture Overview

One product, three shells, sixteen libraries. Almost every behaviour a debater
can see is implemented in a `packages/debate-*` library and merely *mounted* by
a route in `apps/debate-ai.com`. Finding the owning package is the first step of
nearly every task here.

## The product

Tooling for competitive debate (Public Forum, Lincoln-Douglas, Policy), in four
named surfaces:

- **CARDS** — crowdsourced annotated research: evidence search, card scoring,
  review queue, topic coverage, and the CardMirror editor with lossless Verbatim
  `.docx` round-trip.
- **FIAT** — the live round workspace: an ag-Grid flow spreadsheet, column
  navigation and split view, round setup, speech docs, export and history.
- **LEARN** — the video library: search, grids, a persistent YouTube player with
  picture-in-picture, lecture pages, rankings.
- **Practice** — drills, AI coach mode, AI judging, and a full timed round
  against an AI opponent at `/versus-ai`.

## Shells

| Shell | Workspace? | Stack |
| --- | --- | --- |
| `apps/debate-ai.com` | **yes** | Next.js + vinext → Cloudflare Workers, D1 via Drizzle. The deployed product. See [web-app.md](web-app.md). |
| `apps/debate-web-ext` | no | Browser extension: round timer with prep clocks |
| `apps/debate-native-wrapper` | no | Generic Tauri wrapper packaging the site as a native app |

The two non-workspace apps have their own CI (`native-wrapper-ci.yml`,
`native-wrapper-release.yml`) and are not installed by a root `bun install`.

## Packages

Everything is private except `debate-api-client`.

| Directory | Package name | Owns |
| --- | --- | --- |
| `debate-api-client` | *(same)* | **Published.** Typed SDK generated from `apps/debate-ai.com/public/debate-openapi.yml` with Hey API. Calls run through **`grab-url`**, not fetch/axios, so every operation gets caching, retries, rate limiting and dedupe. Resolves to `{ data?, error? }` — **never throws on an HTTP error.** |
| `debate-card-parser` | *(same)* | Verbatim `.docx` and HTML → structured cards with citations and highlighting |
| `debate-contributor-progress` | `debate-community` | Leaderboard, news stream, awards, daily best card, progress unlocks, quest streaks, daily quests |
| `debate-data-sync` | *(same)* | Bundled data assets (metadata, videos, schemas) + the sync scripts; shared record types like `OpponentTeamProfile` |
| `debate-editor` | *(same)* | CardMirror: the ProseMirror engine, Verbatim `.docx` interop (lossless round-trip, encrypted-file decryption, the native `.cmir` format, the `cardmirror-read` headless CLI/MCP server), and the React editor shell |
| `debate-flow` | `debate-flow-ebb` | `ebb`, the local-first keyboard-first flow editor. `EbbFlowEmbed` mounts it as one column of a host page. |
| `debate-help-docs` | *(same)* | The documentation site. See [documentation.md](documentation.md). |
| `debate-practice-drills` | `debate-practice-rounds` | Drill generator, AI coach, judge paradigm picker, AI judge decision, opponent personas, practice round simulator, transcript summaries, argument-tree outline, flow annotations, response-outcome charts |
| `debate-round` | *(same)* | FIAT: ag-Grid flow spreadsheet, column nav and split view, round setup dialogs, speech doc panels, export/history, flow and settings stores, plus the roster panels that render persisted practice records |
| `debate-round-practice-ai` | `debate-practice-vs-ai` | `/versus-ai`: a Node/TS port of the Go `arguehub` vs-bot backend (13 bot personalities, prompt construction, AI judging, gamification) + the React round UI. Plain `fetch`; no Go/Mongo/Gin. |
| `debate-search-evidence` | `debate-research-evidence` | Search bar, result list, card viewer, research and AI-analysis sidebars, the shared evidence/argument library, LLM card scoring, revision incentives, review queue, topic coverage dashboard |
| `debate-speech-writer` | *(same)* | The AI prompt library: flow extraction, judge decisions, flaw finding, research outlines, batch quote analysis |
| `debate-team-collaboration` | *(same)* | Task inbox, prep room, topic sprints, brainstorm assist, group challenges, research-progress tracking, sprint notes, prep notes and notifications |
| `debate-timer` | *(same)* | Speech and prep timers with per-format speech times; in-round recorder with mic selection, live waveform, playback |
| `debate-ui` | *(same)* | shadcn/Radix primitives, the custom icon set, the site footer, `cn` and URL-state helpers |
| `debate-videos` | *(same)* | LEARN: video search and filtering, grids and cards, the persistent YouTube player with PiP, lecture pages, rankings |

## The dependency edges

These are real and they are the reason a "small" change can ripple. Know them
before adding another.

```
debate-ui ──────────────► everything (primitives, icons, cn)

debate-search-evidence ──┬─► debate-contributor-progress
                         └─► debate-team-collaboration
        (both were split out of the old debate-card-search and still build on it)

debate-round ────────────► debate-team-collaboration
                           (prep notes and notifications moved out of debate-round)

debate-practice-drills ──► debate-round, debate-speech-writer, debate-timer,
                           debate-search-evidence, debate-contributor-progress

debate-flow ─────────────► embedded by debate-round (EbbFlowEmbed)
```

`debate-search-evidence` and `debate-round` are the two load-bearing packages:
changing their public exports moves several others. `debate-ui` is load-bearing
in a different way — it is cheap to change and expensive to get wrong, because
every surface renders it.

## `debate-api-client` never throws

Worth stating on its own, because it inverts the usual habit: every operation
resolves to `{ data?, error? }`. A `try/catch` around a call is dead code, and
code that assumes a rejected promise on a 4xx will silently treat an error as
success. Check `error` first.
