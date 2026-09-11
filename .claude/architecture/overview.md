# Architecture Overview

One Next.js app on Cloudflare Workers, two secondary shells, and sixteen
`debate-*` packages that hold nearly all the behaviour. The app is mostly routing,
API handlers and the database; when a feature "isn't working", the code is
usually in a package.

## The product

Five product areas, all sharing one account and one D1 database:

- **CARDS** — crowdsourced annotated evidence: full-text search over tagged cards,
  AI annotation and highlighting, citation formatting, `.docx` import.
- **FIAT** — the round workspace: a multi-column flow spreadsheet, shareable round
  URLs, speech docs, format-aware timers, judge decisions, collaboration.
- **LEARN** — the archive: ~1,400 college NDT rounds back to 1995, ~900
  instructional videos, a 200-term dictionary, team rankings.
- **STREAM** — web search with extraction and an answer model (the QwkSearch
  integration, `lib/qwksearch`).
- **REASON** — `/reason-editor` and every speech-doc panel, running on
  `packages/debate-editor` — the ported CardMirror ProseMirror engine, ~500
  editing commands, lossless Verbatim `.docx` round-trip, CRDT collaboration.

## Apps

| App | Stack | Owns |
| --- | --- | --- |
| `apps/debate-ai.com` | Next.js + vinext → Cloudflare Worker, D1 via Drizzle | The deployed product: ~44 `/api` routes, auth, schema, migrations, the offline service worker. See [web-app.md](web-app.md). |
| `apps/debate-native-wrapper` | Tauri (`src-tauri/`), profile-driven | Desktop and mobile wrappers around the site. Build, platform, store and OAuth notes live in its own `docs/` next to the code it describes. |
| `apps/debate-web-ext` | WXT browser extension | `entrypoints/` — the in-page card capture surface. |

Only `packages/*` and `apps/debate-ai.com` are in the root workspace globs; the
other two apps are built from their own directories.

## Packages

| Package | Owns |
| --- | --- |
| `debate-editor` | CardMirror: the ProseMirror engine, `.docx`/`.cmir` interop, the `cardmirror-read` CLI/MCP tool, the React editor shell |
| `debate-flow` | The flow sheet — columns, cells, annotations, cloud save |
| `debate-round` | Rounds, flow summaries, judge decisions, round records |
| `debate-practice-drills` | Drill sets, practice rounds, coaching sessions, the argument tree |
| `debate-search-evidence` | Evidence search, card library, on-page reuse search |
| `debate-speech-writer` | Speech docs, coach materials, judge profiles, opponent personas |
| `debate-team-collaboration` | Prep rooms, invites, shared flow sync, presence |
| `debate-contributor-progress` | (npm `debate-community`) leaderboard, news stream, awards, quests |
| `debate-videos` | The video library, transcripts, category galleries, sidebar routes |
| `debate-round-practice-ai` | The AI practice opponent, plus its own `cf-app/` Worker |
| `debate-card-parser` | Verbatim `.docx` / HTML → structured cards with cites |
| `debate-data-sync` | Bundled data assets and the scripts that refresh them |
| `debate-api-client` | Typed SDK generated from the OpenAPI spec, over `grab-url` |
| `debate-timer` | Format-aware prep and speech timers |
| `debate-ui` | Shared primitives, the app dock, the feature catalog |
| `debate-help-docs` | The Fumadocs documentation site. See [documentation.md](documentation.md). |

`debate-contributor-progress`, `debate-search-evidence` and
`debate-team-collaboration` were split out of a former `debate-card-search`, and
still depend on each other — a change in one often needs the others rebuilt.

## How a feature is wired

Most tool features follow the same shape, and both docs for a feature describe it
in these terms:

```
packages/<pkg>/src/state/<thing>.ts          localStorage, the source of truth
  → build<Thing>PanelView()                  a pure selector
  → packages/<pkg>/src/panels/<Thing>Panel.tsx
  → apps/debate-ai.com/app/<route>/page.tsx  a thin route that renders the panel
```

Account sync is layered on top rather than replacing it: `POST/GET
/api/tool-records/[collection]` stores one `saved_tool_records` row per (user,
collection, record) so a localStorage-backed tool becomes cross-device without
its panel changing shape. `collection` is an allowlist key from
`TOOL_RECORD_COLLECTIONS` — adding a synced tool means adding an entry there, not
a new route.

When you change a panel, check whether its state is in that sync allowlist; a new
field that never reaches D1 is the most common half-finished change here.
