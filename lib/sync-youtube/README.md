# Debate YouTube Sync 

This module handles synchronizing debate videos from YouTube channels.

## Main Functions

### `syncYouTubeVideos()`

Main sync function that:

1. Fetches all videos from configured channels
2. Fetches full descriptions for truncated ones
3. Classifies videos into rounds vs lectures
4. Parses metadata for rounds
5. Outputs two files:
   - `lib/debate-data/debate-videos/new-rounds.json`
   - `lib/debate-data/debate-videos/new-lectures.json`

## Configuration

Edit `channel-config.ts` to:

- Add/remove YouTube channels to sync
- Change the `publishedAfter` date filter
- Modify rounds file mappings

## Parsers

### Round Parsers (`parsers/round-parsers.ts`)

Extracts from title/description:

- **Tournament name**: "2012 NDT", "2003 TOC", etc.
- **Round level**: "Finals", "Semifinals", "Quarterfinals", "R1", etc.
- **Teams**: "Northwestern BK v Georgetown AM"
- **Debate style**: Policy (1), PF (2), LD (3), College (4)
- **Winner**: Affirmative (true), Negative (false), Unknown (null)
- **Judge decision**: "2-1 (Judge1, Judge2, *Judge3)"

### Lecture Classifier (`parsers/lecture-classifier.ts`)

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

### Video Classifier (`parsers/video-classifier.ts`)

Determines if a video is a debate round or lecture based on:

- Title patterns (vs, v, Finals, Semifinals, R1, etc.)
- Description indicators (1AC, 2NR, CX, judge decisions, etc.)
- Exclusion patterns (lecture, tutorial, how to, etc.)

## Output Schema

### Rounds (17 fields)

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

### Lectures (7 fields)

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
