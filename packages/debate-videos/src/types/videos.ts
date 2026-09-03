import type {
  LectureCategoryFacet,
  VideoFacets,
} from "debate-data-sync/src/videos/video-query";

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
 * [videoId, title, date, channel, viewCount, description, style?, tournament?, roundLevel?, affTeam?, negTeam?, affWin?, judgeDecision?, arg1AC?, arg2NR?, isTopPick?, speechDocsUrl?, seasonYear?]
 * Note: For lectures, index 6 can be either a DebateStyle number OR a category string.
 * `seasonYear` (index 17) is the competition season the video's publish date
 * falls in (e.g. `2025` for the 2024-25 season), 0 for legacy/unparseable
 * dates — format it for display with `formatSeasonLabel`.
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
];

export type TopicType = {
  year: number;
  ndt_topic?: string;
  policy_topic?: string;
  ld_topic?: string;
  pf_topic?: string;
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
  topics?: TopicType[];
  champions?: ChampionType[];
  history?: Record<string, any>;
  backend: string;
};

export type { LectureCategoryFacet, VideoFacets };

/** Union of all valid video page category identifiers. */
export type CategoryType =
  | "rounds"
  | "lectures"
  | "topPicks"
  | "dictionary"
  | "leaderboard";
