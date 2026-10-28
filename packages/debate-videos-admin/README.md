# debate-videos-admin

Package name `@debate-ai/videos-admin`. The video library's admin side for
[debate-ai.com](https://debate-ai.com): the panels of the admin page's video
sections, the `/api/admin/videos` and `/api/admin/youtube` route handlers, and
the YouTube ingest that keeps the library filled.

## Layout

```
debate-videos-admin/
├── data/            # youtube-stats.json, served by /api/youtube-stats
├── migrations/      # video D1 migrations (channels seed, curated round queue, reclassifications)
├── src/
│   ├── components/  # RoundQueuePanel, YoutubeSyncPanel, VideoLibraryTable, VideoReportsPanel,
│   │                #   YoutubeChannelsPanel, TranscriptScraperPanel, SpeechAnalysisPanel, dialogs
│   ├── api/admin/   # the /api/admin/videos and /api/admin/youtube handlers (`./api`)
│   ├── sync/
│   │   ├── videos/  # curated round queue, seed/stack/view-count SQL builders
│   │   └── youtube/ # channel config, YouTube API client, sync/stats/view-count CLIs, title parsers
│   ├── lib/         # result formatters for the admin jobs
│   └── ui/          # this package's own primitives
└── test/
```

The read model the public library and the admin share — row conversion, the
filter/sort/facet query, stacks, the lecture and round-level classifiers — is in
`debate-videos/src/data/`, since this package depends on `debate-videos` and
not the other way round.

## Scripts

| Command | Description |
| --- | --- |
| `bun run sync-youtube` | Pull new videos from configured YouTube channels and classify them as rounds vs. lectures. |
| `bun run youtube-stats` | Recalculate aggregate view stats and write `data/youtube-stats.json`. |
| `bun run youtube-update-views` | Refresh view counts for previously synced videos in batches. |
| `bun run extract-transcripts` | Fetch lecture transcripts. |

Set `YOUTUBE_API_KEY` in the environment before running any of the YouTube scripts.

## src/sync/youtube/

Synchronizes debate videos from YouTube channels.

Configure channels and the `publishedAfter` cutoff in [src/sync/youtube/channel-config.ts](src/sync/youtube/channel-config.ts):

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
   - `packages/debate-videos-admin/data/new-rounds.json`
   - `packages/debate-videos-admin/data/new-lectures.json`

### Parsers

#### Round Parsers ([src/sync/youtube/parsers/round-parsers.ts](src/sync/youtube/parsers/round-parsers.ts))

Extracts from title/description:

- **Tournament name**: "2012 NDT", "2003 TOC", etc.
- **Round level**: "Finals", "Semifinals", "Quarterfinals", "R1", etc.
- **Teams**: "Northwestern BK v Georgetown AM"
- **Debate style**: Policy (1), PF (2), LD (3), College (4)
- **Winner**: Affirmative (true), Negative (false), Unknown (null)
- **Judge decision**: "2-1 (Judge1, Judge2, *Judge3)"

#### Lecture Classifier ([debate-videos/src/data/lecture-classifier.ts](../debate-videos/src/data/lecture-classifier.ts))

Categorizes lectures into 17 topics:

- Topic Lectures
- Novice & Introductory
- Affirmative Strategy
- Negative Strategy
- Critique / Critical Theory
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

#### Video Classifier ([src/sync/youtube/parsers/video-classifier.ts](src/sync/youtube/parsers/video-classifier.ts))

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

