# debate-data-sync Package
Relevant source files
- [packages/debate-card-parser/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-card-parser/README.md?plain=1)
- [packages/debate-data-sync/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1)
- [packages/debate-data-sync/data/metadata/youtube-stats.json](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/metadata/youtube-stats.json)
- [packages/debate-data-sync/data/videos/debate-lectures.json](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/debate-lectures.json)
- [packages/debate-data-sync/data/videos/debate-top-picks.json](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/debate-top-picks.json)
- [packages/debate-data-sync/data/videos/rounds-college.json](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/rounds-college.json)
- [packages/debate-data-sync/data/videos/rounds-ld.json](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/rounds-ld.json)
- [packages/debate-data-sync/data/videos/rounds-pf.json](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/rounds-pf.json)
- [packages/debate-data-sync/data/videos/rounds-policy.json](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/rounds-policy.json)
- [packages/debate-editor/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor/README.md?plain=1)
- [packages/debate-speech-writer/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-speech-writer/README.md?plain=1)
- [packages/debate-timer/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/README.md?plain=1)
- [packages/debate-timer/src/index.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/src/index.ts)
- [packages/debate-timer/src/timers/TimerProgressRing.tsx](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-timer/src/timers/TimerProgressRing.tsx)
- [packages/debate-ui/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-ui/README.md?plain=1)
- [packages/debate-videos/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-videos/README.md?plain=1)

The `debate-data-sync` package is the core data ingestion and persistence layer within the Debate AI platform. It orchestrates fetching, classification, and parsing of YouTube videos, maintains a carefully structured flat-file JSON dataset representing debate rounds, lectures, and metadata, and provides state persistence utilities for team rankings and standing computations.

It bridges the gap between raw, unstructured external data (such as YouTube descriptions and web-scraped leaderboards) and the structured datasets consumed throughout the platform, powering the video library, rankings, and analytic features.

## System Overview

The package is organized as follows:

| Directory | Purpose |
| --- | --- |
| `data/` | Flat-file JSON data assets used at runtime by the application. This includes video round records, lecture metadata, top picks, and a rich set of reference data such as debate topics and tournaments. [packages/debate-data-sync/README.md9-11](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1#L9-L11) |
| `schemas/` | JSON Schema files validating the data files to ensure correct structure and field types. [packages/debate-data-sync/README.md12](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1#L12-L12) |
| `src/youtube/` | YouTube channel synchronization pipeline: downloading video metadata, handling truncated descriptions, classifying videos as rounds or lectures, and parsing detailed metadata. [packages/debate-data-sync/README.md16](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1#L16-L16) |
| `src/rankings/` | Scrapers and parsers for various debate ranking leaderboards and tournament lists that seed the platform's standings and qualification tracking. [packages/debate-data-sync/README.md14](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1#L14-L14) |
| `src/state/` | Persistence utilities built on LocalStorage to maintain user-modifiable state such as tournament results and customized qualification point tables. [packages/debate-data-sync/README.md15](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1#L15-L15) |

This package acts as a central hub for synchronizing external debate data sources and preparing them for efficient use in the frontend and backend APIs.

---

## Data Ingestion and Transformation Architecture

The following diagram conveys the flow from external natural language sources to structured, code-managed artifacts within the package:

### Data Ingestion and Transformation Map

Sources: [packages/debate-data-sync/README.md51-72](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1#L51-L72)[packages/debate-data-sync/README.md14-20](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1#L14-L20)[packages/debate-data-sync/data/videos/rounds-college.json4-22](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/rounds-college.json#L4-L22)[packages/debate-data-sync/data/videos/rounds-policy.json2-22](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/rounds-policy.json#L2-L22)[packages/debate-data-sync/data/videos/debate-lectures.json5-14](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/debate-lectures.json#L5-L14)

---

## YouTube Sync Pipeline

The YouTube sync pipeline is the primary mechanism for importing video content related to debate rounds and lectures into the system. It performs a multi-step process involving:

- **Channel Configuration:** Channels to sync and `publishedAfter` date cutoffs are set in [src/youtube/channel-config.ts](https://github.com/debate/debate-ai.com/blob/34937310/src/youtube/channel-config.ts)
- **Two-stage Fetching:** Initially fetches basic video metadata, then fetches full descriptions for truncated entries to avoid data loss.
- **Video Classification:** Uses heuristics (title patterns like "vs", "Finals", "R1" and description keywords like "1AC", "2NR") in `video-classifier.ts` to determine if a video is a competitive round or a lecture.
- **Round Parsing:** Extracts key metadata fields for rounds in `round-parsers.ts`, including tournament names, round levels, teams, winners, judge decisions, and other debate-specific attributes.
- **Lecture Classification:** Categorizes lectures into one of 17 topical categories (e.g. "Kritik", "Topicality & Framework", "Speaking & Delivery") using `lecture-classifier.ts`.
- **Output:** Writes synchronized, parsed data to JSON files like `new-rounds.json` and `new-lectures.json` under `data/videos/` for static runtime consumption.

This pipeline fuels the **LEARN** module's video library and the raw data foundation for the `/api/videos` Next.js API route.

For deep technical details, refer to the [YouTube Sync & Video Seeding Pipeline](/debate/debate-ai.com/6.1-youtube-sync-and-video-seeding-pipeline) child page.

Sources: [packages/debate-data-sync/README.md55-76](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1#L55-L76)[packages/debate-data-sync/data/videos/debate-lectures.json1-112](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/debate-lectures.json#L1-L112)

---

## Video Data Files & JSON Schemas

To optimize performance and reduce storage size, videos data is stored in a positional array format rather than verbose object literals:

| Data Type | Format Details | JSON File Examples |
| --- | --- | --- |
| **Rounds** | 17 fields in fixed positions covering video ID, title, date, channel, views, description, style (numeric code), tournament, round level, affirmative/negative teams, winner, judge decisions, topical argument labels, top pick flag, and speech document URLs. | `rounds-policy.json`, `rounds-pf.json`, `rounds-ld.json`, `rounds-college.json` |
| **Lectures** | 7 fields capturing video ID, title, date, channel, view count, description, and categorized lecture topic. | `debate-lectures.json` |

These files are validated against JSON Schemas in the `schemas/` directory, such as `debate-rounds-videos.schema.json`, to ensure data consistency and prevent runtime errors.

The positional array approach supports efficient parsing and reduces JSON size significantly compared to standard objects.

For full schema definitions and file layout, see the [Video Data Files & JSON Schemas](/debate/debate-ai.com/6.2-video-data-files-and-json-schemas) child page.

Sources: [packages/debate-data-sync/data/videos/rounds-college.json4-22](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/rounds-college.json#L4-L22)[packages/debate-data-sync/data/videos/rounds-policy.json2-22](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/rounds-policy.json#L2-L22)[packages/debate-data-sync/data/videos/debate-lectures.json5-14](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/videos/debate-lectures.json#L5-L14)

---

## Metadata & Reference Data

In addition to video content, the package maintains a collection of metadata assets that support features like autocomplete, dictionary lookup, historical context, and statistical aggregation:

- **Reference Metadata:** Includes files like `debate-topics.json`, `debate-champions.json`, `debate-tournaments.json`, `debate-dictionary.json`, and `debate-schools.json`.
- **YouTube Statistics:** Aggregated stats such as total views, video counts, and style-specific metrics are stored in `youtube-stats.json`.
- **Ranking Scrapers:** The `src/rankings/` directory contains scrapers for multiple ranking sources, including DebateDrills, Debateland, and TOC bid lists, providing data for leaderboard and qualification computations.

These metadata files are primarily consumed by frontend APIs such as `/api/history`, `/api/dictionary`, `/api/schools`, `/api/names`, and `/api/tournaments` to power site features and autocompletion lists.

For implementation details and usage, see the [Metadata & Reference Data](/debate/debate-ai.com/6.3-metadata-and-reference-data) child page.

Sources: [packages/debate-data-sync/README.md9-11](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1#L9-L11)[packages/debate-data-sync/README.md43-53](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1#L43-L53)[packages/debate-data-sync/data/metadata/youtube-stats.json1-7](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/data/metadata/youtube-stats.json#L1-L7)

---

## Standing & State Persistence

This package supports the persistence of competitive team standings and tournament results for the **CX NDCA Standings** component within the LEARN module:

- **Tournament Results Storage:**`src/state/tournamentResults.ts` maintains an array of `TournamentResultRecord` objects saved in `localStorage` under the key `tournamentResults`. It provides methods to save or delete results and utilities to group results by team for standings calculations.
- **Qualification Points Table:**`src/state/qualificationPointsTable.ts` houses an illustrative default points table that can be overridden by users with their local scores/weights for outrounds and prelim wins.
- **Standings Computation:**
The function `buildStandingsFromStore` synthesizes stored tournament results, applying the customized or default qualification points table to rank teams. It supports team qualification checks and ranked leaderboard generation.
- **Frontend Integration:**
These states and utilities are consumed by the `StandingsPanel` and rankings pages supplied by the `debate-videos` package.

This architecture enables flexible, client-side management of team standings, allowing personalization without requiring centralized backend storage.

Sources: [packages/debate-data-sync/src/state/tournamentResults.ts20-70](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/src/state/tournamentResults.ts#L20-L70)[packages/debate-data-sync/src/state/qualificationPointsTable.ts1-63](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/src/state/qualificationPointsTable.ts#L1-L63)[packages/debate-videos/README.md3-5](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-videos/README.md?plain=1#L3-L5)

---

## Code-to-Data Entity Map

The following diagram bridges core code entities to the JSON data artifacts and systems they manage or produce:

### Entity Relationship Diagram

Sources: [packages/debate-data-sync/README.md31-39](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/README.md?plain=1#L31-L39)[packages/debate-data-sync/src/state/tournamentResults.ts1-15](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/src/state/tournamentResults.ts#L1-L15)[packages/debate-data-sync/src/state/qualificationPointsTable.ts1-12](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/src/state/qualificationPointsTable.ts#L1-L12)

---

This overview introduces the `debate-data-sync` package as a vital component that pulls together YouTube ingestion, bundled dataset assets, schema validation, and persistent state for rankings. For detailed explorations of the subsystems below, see the linked child pages:

- [YouTube Sync & Video Seeding Pipeline](/debate/debate-ai.com/6.1-youtube-sync-and-video-seeding-pipeline) — Configuration, fetch logic, and classification details for ingesting the debate video library.
- [Video Data Files & JSON Schemas](/debate/debate-ai.com/6.2-video-data-files-and-json-schemas) — Structure, format, and validation contracts for the packaged JSON video and lecture files.
- [Metadata & Reference Data](/debate/debate-ai.com/6.3-metadata-and-reference-data) — Management of static metadata files and scraping logic for tournament rankings and leaderboard data.

This layered approach allows the Debate AI platform to maintain a fresh, high-integrity, and richly annotated dataset powering research, learning, and competitive tracking features.