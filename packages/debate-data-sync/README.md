<!-- template-git-repo:badges:start -->
<p align="center">
    <a href="https://debate-ai.com/docs"><img src="https://img.shields.io/badge/Docs-blue?logo=ReadTheDocs&logoColor=white" alt="Documentation" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/stargazers"><img src="https://img.shields.io/github/stars/debate/debate-ai.com" alt="GitHub Stars" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/issues"><img src="https://img.shields.io/github/issues/debate/debate-ai.com?logo=github" alt="GitHub Issues" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls"><img src="https://img.shields.io/github/issues-pr/debate/debate-ai.com?logo=github&label=PRs" alt="Open Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls?q=is%3Apr+is%3Aclosed"><img src="https://img.shields.io/github/issues-pr-closed/debate/debate-ai.com?logo=github&label=PRs%20merged&color=8957e5" alt="Merged Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/discussions"><img src="https://img.shields.io/github/discussions/debate/debate-ai.com" alt="GitHub Discussions" /></a>
    <a href="https://github.com/debate/debate-ai.com/commits/master/"><img src="https://img.shields.io/github/last-commit/debate/debate-ai.com.svg" alt="GitHub last commit" /></a>
    <br />
    <a href="https://stackblitz.com/github/debate/debate-ai.com/tree/master/packages/debate-data-sync"><img height="20px" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" /></a>
    <img src="https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white" alt="Bun" /> <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /> <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
</p>
<!-- template-git-repo:badges:end -->

# debate-data-sync

Bundled debate data assets and the sync scripts that maintain them.

## Layout

```
debate-data-sync/
├── data/          # JSON assets consumed at runtime by the app
│   ├── metadata/  # champions, dictionary, school names, topics, tournaments, youtube-stats
│   └── videos/    # rounds-{policy,pf,ld,college}.json, lectures, top picks
├── schemas/       # JSON Schemas validating the files under data/
└── src/
    ├── rankings/  # Scrapers for debate ranking leaderboards
    ├── state/     # localStorage-backed persistence for team/judge/standings records
    ├── types/     # Ambient declarations for untyped dependencies
    ├── videos/    # tuple<->row conversion + the filter/sort/facet semantics the
    │              #   videos SQL table and its JSON fallback share
    └── youtube/   # YouTube channel ingestion + stats + view-count updates
```

## Importing data from the app

The data files are imported via the `@/` root alias:

```ts
import dictionary from "@/packages/debate-data-sync/data/metadata/debate-dictionary.json";
import rounds from "@/packages/debate-data-sync/data/videos/rounds-pf.json";
import { LeaderboardEntry } from "@/packages/debate-data-sync/src/rankings/sync-rankings-debatedrills";
import { syncYouTubeVideos } from "@/packages/debate-data-sync/src/youtube/youtube-sync";
```

## Scripts

Run from the repo root:

| Command | Description |
| --- | --- |
| `npm run sync-youtube` | Pull new videos from configured YouTube channels and classify them as rounds vs. lectures. |
| `npm run youtube-stats` | Recalculate aggregate view stats and write `data/metadata/youtube-stats.json`. |
| `npm run youtube-update-views` | Refresh view counts for previously synced videos in batches. |
| `bun run sync-caselist` | Refresh the openCaselist bulk-archive manifest for every caselist. Add `--ingest` to download and unpack what is new. |

Set `YOUTUBE_API_KEY` in the environment before running any of the YouTube scripts.
The caselist sync needs no credentials — the archives are public.

## src/caselist/

Syncs the bulk evidence archives openCaselist publishes at
`https://opencaselist.com/{slug}/downloads` — one caselist per event per season,
all serving the same page and the same bucket layout:

| Caselist | Slug |
| --- | --- |
| HS Policy 2026-27 | `hspolicy26` |
| HS LD 2026-27 | `hsld26` |
| HS PF 2026-27 | `hspf26` |
| NDT/CEDA College 2026-27 | `ndtceda26` |
| NFA College LD 2026-27 | `nfald26` |

Each caselist offers one whole-season dump (`{slug}-all-{date}.zip`) and a weekly
delta per Tuesday (`{slug}-weekly-{date}.zip`), each a ZIP of Verbatim `.docx`
files laid out as `{school}/{team}/{file}.docx`.

```ts
import {
  fetchCaselistDownloads,
  selectPendingArchives,
  downloadArchive,
  loadCaselistArchive,
} from "@/packages/debate-data-sync/src/caselist";

const downloads = await fetchCaselistDownloads("hspolicy26");

for (const archive of selectPendingArchives(downloads, state)) {
  const { bytes } = await downloadArchive(archive);
  await loadCaselistArchive(bytes, {
    slug: downloads.slug,
    parseCards: true,
    onDocument: async (document) => {
      // document.school / .team / .side / .html / .cards
    },
  });
}
```

### Discovery falls back three ways

`/{slug}/downloads` is a client-rendered React app: a plain GET returns the
`<div id="root">` shell, so a scraper reading the raw HTML sees no links and
cannot tell that apart from "no archives cut yet".
`fetchCaselistDownloads` therefore tries, in order, and reports which answered
in `result.source`:

1. **`api`** — the JSON endpoint the page's own client calls.
2. **`html`** — the rendered page, either served pre-rendered or handed in as
   `options.html` by a caller that rendered it (headless browser, saved capture).
3. **`probe`** — the bucket layout is fully determined by the slug and the date,
   and archives are cut at midnight every Tuesday, so the candidate URLs for the
   last N weeks are generated and HEAD-checked.

A run that finds nothing returns `source: "none"` and the reasons in
`result.notes` rather than throwing — one caselist being unreachable must not
cost a five-caselist run the other four.

### Unpacking

`loadCaselistArchive` walks the ZIP one entry at a time and hands each converted
document to `onDocument`, so a season dump is never held in memory whole. The
DOCX → HTML → cards conversion itself is `debate-card-parser`'s, the same code
path the editor's import and the admin uploader use. `describeCaselistEntry`
reads the school, team and side back out of an entry's path, degrading to `null`
rather than guessing — a wrong attribution is worse than a missing one.

One unreadable document (password-protected, truncated, a `.doc` renamed) is
recorded in `failures` with a coded reason and the walk continues.

### The manifest

`bun run sync-caselist` writes `data/metadata/caselist-downloads.json`
(schema: [`schemas/caselist-downloads.schema.json`](schemas/caselist-downloads.schema.json)),
which doubles as the sync state: each caselist records the archive URLs already
ingested, so the next `--ingest` run fetches only the weeks added since. Once a
caselist has been seeded, `selectPendingArchives` stops offering the season dump
— the weekly deltas carry the same files for a fraction of the bytes.

| Flag | Effect |
| --- | --- |
| `--caselist=hsld26,hspf26` | Only these caselists (default: all five). |
| `--ingest` | Also download and unpack the archives not yet ingested. |
| `--limit=25` | Stop after N documents per archive. |
| `--cards` | Also run the card parser on each document. |
| `--no-probe` | Skip the bucket probe. |
| `--html-file=page.html` | Read a rendered downloads page saved from a browser instead of discovering. Needs a single `--caselist`. |
| `--dry-run` | Report what would happen; write nothing. |
| `--out=path` | Write the manifest somewhere other than the default. |

## src/rankings/

Scrapers for leaderboards used by `/api/leaderboard`:

- `sync-rankings-debatedrills.ts` — Debatedrills rankings (exports the `LeaderboardEntry` type used elsewhere).
- `sync-rankings-debateland.ts` — Debateland rankings.
- `sync-rankings-tocbidlist.ts` — TOC bid list.
- `sync-tournaments.ts` — Tournament listings.
- `ndca-standings.ts` — NDCA-style qualification points and cumulative season standings computation (`computeTournamentPoints`, `buildStandings`, `rankStandings`, `getQualifiedTeams`), against a configurable, illustrative `QualificationPointsTable`. `state/tournamentResults.ts` persists recorded `TournamentResult`s to localStorage and exposes `buildStandingsFromStore` for callers that need ranked tournament-result data.

## src/youtube/

Synchronizes debate videos from YouTube channels.

Configure channels and the `publishedAfter` cutoff in [src/youtube/channel-config.ts](src/youtube/channel-config.ts):

- Add/remove YouTube channels to sync
- Change the `publishedAfter` date filter
- Modify rounds file mappings

### `syncYouTubeVideos()`

Main sync function that:

1. Fetches all videos from configured channels
2. Fetches full descriptions for truncated ones
3. Classifies videos into rounds vs lectures
4. Parses metadata for rounds
5. Outputs two files:
   - `packages/debate-data-sync/data/videos/new-rounds.json`
   - `packages/debate-data-sync/data/videos/new-lectures.json`

### Parsers

#### Round Parsers ([src/youtube/parsers/round-parsers.ts](src/youtube/parsers/round-parsers.ts))

Extracts from title/description:

- **Tournament name**: "2012 NDT", "2003 TOC", etc.
- **Round level**: "Finals", "Semifinals", "Quarterfinals", "R1", etc.
- **Teams**: "Northwestern BK v Georgetown AM"
- **Debate style**: Policy (1), PF (2), LD (3), College (4)
- **Winner**: Affirmative (true), Negative (false), Unknown (null)
- **Judge decision**: "2-1 (Judge1, Judge2, *Judge3)"

#### Lecture Classifier ([src/youtube/parsers/lecture-classifier.ts](src/youtube/parsers/lecture-classifier.ts))

Categorizes lectures into 17 topics:

- Topic Lectures
- Novice & Introductory
- Affirmative Strategy
- Negative Strategy
- Kritik / Critical Theory
- Counterplans & Theory
- Topicality & Framework
- Disadvantages
- Impact Calculus & Evidence
- Speaking & Delivery
- Research & Flowing
- Public Forum
- Demo Debates
- Judge & Tournament Skills
- Philosophy & IR Theory
- Camp & Coaching Advice
- Documentaries & Culture

#### Video Classifier ([src/youtube/parsers/video-classifier.ts](src/youtube/parsers/video-classifier.ts))

Determines if a video is a debate round or lecture based on:

- Title patterns (vs, v, Finals, Semifinals, R1, etc.)
- Description indicators (1AC, 2NR, CX, judge decisions, etc.)
- Exclusion patterns (lecture, tutorial, how to, etc.)

### Output Schema

#### Rounds (17 fields)

```typescript
[
  videoId: string,
  title: string,
  date: string,
  channel: string,
  views: number,
  description: string,
  style: 1 | 2 | 3 | 4,
  tournament: string | null,
  roundLevel: string | null,
  affTeam: string | null,
  negTeam: string | null,
  winner: boolean | null,
  judgeDecision: string | null,
  arg1AC: string | null,
  arg2NR: string | null,
  isTopPick: boolean,
  speechDocsUrl: string | null
]
```

#### Lectures (7 fields)

```typescript
[
  videoId: string,
  title: string,
  date: string,
  channel: string,
  views: number,
  description: string,
  category: string
]
```

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

```
debate-data-sync/
├── data/             # JSON assets consumed at runtime (not logic, stays at the root)
├── schemas/          # JSON Schemas validating data/
├── src/
│   ├── rankings/     # leaderboard scrapers
│   ├── state/        # localStorage-backed records, and the account sync over them
│   ├── types/        # ambient declarations for untyped dependencies
│   └── youtube/      # channel ingestion, stats, view updates, parsers
└── test/             # Vitest suites for the title/description parsers
```

## The tool-data sync

`src/state/` also holds the account sync that every tool's `localStorage`
store rides on, documented in full under
[Tool Data Sync](https://debate-ai.com/docs/internals/tool-data-sync). It lives
in this package because this is a leaf the tool packages depend on, and it is
kept framework- and fetch-free where it can be so the server, the client and
the tests can all import the same rules.

| Module | Role |
| --- | --- |
| `toolRecordCollections.ts` | The allowlist of synced stores, and the merge rules. **Adding a tool to the sync is one entry here and nothing else.** |
| `tool-records-client.ts` | The `/api/tool-records` calls, and nothing but them. |
| `tool-record-mirror.ts` | What a store's own `save*`/`delete*` calls to push a change immediately; plus the per-collection account merge. |
| `tool-record-auto-sync.ts` | The floor: watches every collection in the catalog and flushes what changed, so a store syncs without its package being wired for it. |
| `sign-in-prompt.ts` | Lets a store ask the app to offer a signed-out user an account to keep their work on. No React, no `fetch`. |

The rule these share: **a local save is never blocked by a sync failure.** A
mirror call returns immediately and swallows its own error, nothing syncs until
the app reports a signed-in session, and a guest's save still happens whether or
not they take the sign-in offer.

## Tests

```bash
bun run test        # or: npx vitest run
bun run coverage    # writes ./coverage for this package alone
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `50322f5` is **51.50%** (tracked under
the `debate-data-sync` flag).
