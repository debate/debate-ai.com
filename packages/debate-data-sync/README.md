# debate-data-sync

Bundled debate data assets and the sync scripts that maintain them.

## Layout

```
debate-data-sync/
├── data/          # JSON assets consumed at runtime by the app
│   ├── metadata/  # champions, dictionary, school names, topics, tournaments, youtube-stats
│   └── videos/    # rounds-{policy,pf,ld,college}.json, lectures, top picks
├── schemas/       # JSON Schemas validating the files under data/
├── rankings/      # Scrapers for debate ranking leaderboards
└── youtube/       # YouTube channel ingestion + stats + view-count updates
```

## Importing data from the app

The data files are imported via the `@/` root alias:

```ts
import dictionary from "@/packages/debate-data-sync/data/metadata/debate-dictionary.json";
import rounds from "@/packages/debate-data-sync/data/videos/rounds-pf.json";
import { LeaderboardEntry } from "@/packages/debate-data-sync/rankings/sync-rankings-debatedrills";
import { syncYouTubeVideos } from "@/packages/debate-data-sync/youtube/youtube-sync";
```

## Scripts

Run from the repo root:

| Command | Description |
| --- | --- |
| `npm run sync-youtube` | Pull new videos from configured YouTube channels and classify them as rounds vs. lectures. |
| `npm run youtube-stats` | Recalculate aggregate view stats and write `data/metadata/youtube-stats.json`. |
| `npm run youtube-update-views` | Refresh view counts for previously synced videos in batches. |

Set `YOUTUBE_API_KEY` in the environment before running any of these.

## rankings/

Scrapers for leaderboards used by `/api/leaderboard`:

- `sync-rankings-debatedrills.ts` — Debatedrills rankings (exports the `LeaderboardEntry` type used elsewhere).
- `sync-rankings-debateland.ts` — Debateland rankings.
- `sync-rankings-tocbidlist.ts` — TOC bid list.
- `sync-tournaments.ts` — Tournament listings.

## youtube/

Synchronizes debate videos from YouTube channels.

Configure channels and the `publishedAfter` cutoff in [youtube/channel-config.ts](youtube/channel-config.ts):

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

#### Round Parsers ([youtube/parsers/round-parsers.ts](youtube/parsers/round-parsers.ts))

Extracts from title/description:

- **Tournament name**: "2012 NDT", "2003 TOC", etc.
- **Round level**: "Finals", "Semifinals", "Quarterfinals", "R1", etc.
- **Teams**: "Northwestern BK v Georgetown AM"
- **Debate style**: Policy (1), PF (2), LD (3), College (4)
- **Winner**: Affirmative (true), Negative (false), Unknown (null)
- **Judge decision**: "2-1 (Judge1, Judge2, *Judge3)"

#### Lecture Classifier ([youtube/parsers/lecture-classifier.ts](youtube/parsers/lecture-classifier.ts))

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

#### Video Classifier ([youtube/parsers/video-classifier.ts](youtube/parsers/video-classifier.ts))

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
