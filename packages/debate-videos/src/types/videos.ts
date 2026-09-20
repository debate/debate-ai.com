import type {
  LectureCategoryFacet,
  VideoFacets,
  VideoSuggestion,
  VideoSuggestions,
} from "debate-data-sync/src/videos/video-query";
import type { DebateTopicYear, SeasonalTopic } from "../lib/debate-topics";

export type { DebateTopicYear, SeasonalTopic };

/** Debate style/format category */
export type DebateStyle = 1 | 2 | 3 | 4;

/** Display labels for each debate style */
export const DEBATE_STYLE_LABELS: Record<DebateStyle, string> = {
  2: "PF",
  3: "LD",
  1: "Policy",
  4: "College",
};

/** Video data tuple:
 * [videoId, title, date, channel, viewCount, description, style?, tournament?, roundLevel?, affTeam?, negTeam?, affWin?, judgeDecision?, arg1AC?, arg2NR?, isTopPick?, speechDocsUrl?, seasonYear?, stackKey?, stackPosition?]
 * Note: For lectures, index 6 can be either a DebateStyle number OR a category string.
 * `seasonYear` (index 17) is the competition season the video's publish date
 * falls in (e.g. `2025` for the 2024-25 season), 0 for legacy/unparseable
 * dates — format it for display with `formatSeasonLabel`.
 * `stackKey` (index 18) names the stacked playlist this video shares a grid
 * slot with and `stackPosition` (index 19) is its place in it; both are null
 * — and usually absent, since the tuple is trimmed — for a video that stands
 * on its own. See `components/video-grid/video-stacks.ts`.
 */
export type VideoType = [
  string,
  string,
  string,
  string,
  number,
  string,
  (DebateStyle | string)?,
  (string | null)?,
  (string | null)?,
  (string | null)?,
  (string | null)?,
  (boolean | null)?,
  (string | null)?,
  (string | null)?,
  (string | null)?,
  boolean?,
  (string | null)?,
  number?,
  (string | null)?,
  (number | null)?,
];

export type TopicType = DebateTopicYear & {
  year: number;
};

export type ChampionType = {
  year: number;
  ndt_champion?: string;
  policy_champion?: string;
  ld_champion?: string;
  pf_champion?: string;
};

/** One page of the paginated `/api/videos` feed. */
export type VideoFeedResponse = {
  /** The videos in this page. */
  videos: VideoType[];
  /** Total matches for the request's filters, across every page. */
  total: number;
  /** Zero-based offset of this page. */
  offset: number;
  /** Page size the server applied. */
  limit: number;
  /** Whether a further page exists. */
  hasMore: boolean;
  /** Season/style dropdown counts, present when `facets=1` was requested. */
  facets?: VideoFacets;
  /** Which backend answered — `"sql"`, or `"json"` before the table is seeded. */
  backend: string;
};

/** Library-wide video totals used by the quick-link cards. */
export type VideoCounts = {
  total: number;
  rounds: number;
  /** Videos ingested from the lectures asset. */
  lectures: number;
  /** Videos with no numeric debate style — the "All Lectures" tab. */
  lecturesOnly: number;
  topPicks: number;
  /** Count per numeric debate style. */
  byStyle: Record<number, number>;
};

/** Response of `/api/videos/meta` — the small, fetch-once page metadata. */
export type VideoMetaResponse = {
  counts: VideoCounts;
  lectureCategories: LectureCategoryFacet[];
  /** Popular keyword and tournament searches shown under the video grid. */
  suggestions?: VideoSuggestions;
  topics?: TopicType[];
  champions?: ChampionType[];
  history?: Record<string, any>;
  backend: string;
};

export type { LectureCategoryFacet, VideoFacets, VideoSuggestion, VideoSuggestions };

/** Response of `/api/videos/stacks` — members of the requested stacks. */
export type VideoStacksResponse = {
  /** Members per stack key, ordered primary-first. */
  stacks: Record<string, VideoType[]>;
  /** Which backend answered — `"sql"`, or `"json"` before the table is seeded. */
  backend: string;
};

/** Union of all valid video page category identifiers. */
export type CategoryType =
  | "rounds"
  | "lectures"
  | "topPicks"
  /** The videos this browser (or account) has actually watched. */
  | "history"
  | "dictionary"
  | "leaderboard";
