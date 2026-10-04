/** Debate style/format category: 1 Policy, 2 PF, 3 LD, 4 College. */
export type VideoDebateStyle = 1 | 2 | 3 | 4;

/** One season's topic entries across the formats. */
export type SeasonalTopic = {
  /** Month the topic takes effect, e.g. "September". */
  start_month?: string;
  /** Short name of the topic. */
  topic_name?: string;
  /** Icon shown beside `topic_name` (e.g. "🧊"). */
  emoji?: string;
  /** The resolution text. */
  topic: string;
};

/** The topics of one competition year across every format. */
export type DebateTopicYear = {
  /** The year, as a number or a season string such as "2024-25". */
  year: number | string;
  /** Short name of the NDT/CEDA topic. */
  ndt_topic_name?: string;
  /** Icon for the NDT/CEDA topic. */
  ndt_topic_emoji?: string;
  /** The NDT/CEDA resolution. */
  ndt_topic?: string;
  /** Short name of the high-school policy topic. */
  policy_topic_name?: string;
  /** Icon for the high-school policy topic. */
  policy_topic_emoji?: string;
  /** The high-school policy resolution. */
  policy_topic?: string;
  /** Lincoln-Douglas topics, one per month or period. */
  ld_topics?: SeasonalTopic[];
  /** Public Forum topics, one per month. */
  pf_topics?: SeasonalTopic[];
  /** Legacy single HTML string from older debate-topics.json. */
  ld_topic?: string;
  /** Legacy single HTML string from older debate-topics.json. */
  pf_topic?: string;
};

/**
 * Video data tuple:
 * [videoId, title, date, channel, viewCount, description, style?, tournament?, roundLevel?, affTeam?, negTeam?, affWin?, judgeDecision?, arg1AC?, arg2NR?, isTopPick?, speechDocsUrl?, seasonYear?, stackKey?, stackPosition?]
 *
 * For lectures, index 6 can be either a {@link VideoDebateStyle} number OR a category string.
 * `seasonYear` (index 17) is the competition season the video's publish date
 * falls in (e.g. `2025` for the 2024-25 season), 0 for legacy/unparseable
 * dates. `stackKey` (index 18) names the stacked playlist this video shares a
 * grid slot with and `stackPosition` (index 19) is its place in it; both are
 * null — and usually absent, since the tuple is trimmed — for a video that
 * stands on its own.
 */
export type VideoType = [
  /** 0 — YouTube video id. */
  string,
  /** 1 — Title. */
  string,
  /** 2 — Publish date. */
  string,
  /** 3 — Channel name. */
  string,
  /** 4 — View count. */
  number,
  /** 5 — Description. */
  string,
  /** 6 — Debate style, or a category string for a lecture. */
  (VideoDebateStyle | string)?,
  /** 7 — Tournament name. */
  (string | null)?,
  /** 8 — Round level. */
  (string | null)?,
  /** 9 — Affirmative team. */
  (string | null)?,
  /** 10 — Negative team. */
  (string | null)?,
  /** 11 — Whether the affirmative won. */
  (boolean | null)?,
  /** 12 — The judge's decision. */
  (string | null)?,
  /** 13 — First affirmative constructive argument. */
  (string | null)?,
  /** 14 — Second negative rebuttal argument. */
  (string | null)?,
  /** 15 — Whether the video is a top pick. */
  boolean?,
  /** 16 — URL of the round's speech documents. */
  (string | null)?,
  /** 17 — Competition season year. */
  number?,
  /** 18 — Stacked playlist key. */
  (string | null)?,
  /** 19 — Position within the stacked playlist. */
  (number | null)?,
];

/** A topic year with its year coerced to a number. */
export type TopicType = DebateTopicYear & {
  /** The year as a number. */
  year: number;
};

/** The champions of one competition year. */
export type ChampionType = {
  /** The year. */
  year: number;
  /** NDT champion. */
  ndt_champion?: string;
  /** High-school policy champion. */
  policy_champion?: string;
  /** Lincoln-Douglas champion. */
  ld_champion?: string;
  /** Public Forum champion. */
  pf_champion?: string;
};

/** Sort modes accepted by the feed; anything else falls back to recency. */
export type VideoSortOrder = "Views" | "Recency";

/** Filter/pagination parameters accepted by `GET /api/videos`. */
export interface VideoQueryParams {
  /** Restrict to one asset family; `"all"` (default) spans both. */
  source?: "round" | "lecture" | "all";
  /**
   * Keep only rows without a numeric debate style — the "All Lectures" rule
   * the lectures page applies when no style filter is active.
   */
  lecturesOnly?: boolean;
  /** Keep only top-pick videos. */
  topPicksOnly?: boolean;
  /** Lecture category slug (see `normalizeCategoryKey`). */
  categoryKey?: string | null;
  /** Numeric debate style filter (1–4). */
  style?: number | null;
  /** Season filter: a four-digit year string, `"legacy"`, or empty for all. */
  year?: string | null;
  /** Free-text search over title, channel and description. */
  q?: string | null;
  /**
   * Restrict to rows whose `tournament` field contains this substring
   * (case-insensitive) — a narrower match than `q`, which also scans
   * the title, channel and description and so can pull in videos that merely
   * mention the tournament rather than belonging to it.
   */
  tournament?: string | null;
  /** Restrict to an explicit id list — used by the favourites-only filter. */
  ids?: string[] | null;
  /**
   * Drop an explicit id list — used to keep hidden videos out of both the
   * grid and the season/style facet counts, without affecting search (which
   * still needs to surface a hidden video so it can be unhidden).
   */
  excludeIds?: string[] | null;
  /** Sort order; defaults to recency. */
  sort?: string | null;
  /** Page size. */
  limit?: number;
  /** Zero-based offset of the page. */
  offset?: number;
}

/** Per-dimension counts backing the season and style dropdowns. */
export interface VideoFacets {
  /** Count per season key (`"2026"`, …, plus `"legacy"`). */
  yearCounts: Record<string, number>;
  /** Count per numeric debate style. */
  styleCounts: Record<number, number>;
}

/** One lecture-category card: label, slug, size and popularity. */
export interface LectureCategoryFacet {
  /** Category slug. */
  key: string;
  /** Display name. */
  label: string;
  /** Videos in the category. */
  count: number;
  /** The highest view count of any video in it. */
  maxViews: number;
}

/** Which family a search suggestion chip came from. */
export type VideoSuggestionKind = "keyword" | "tournament";

/** One search-suggestion chip: the term to search for and how many videos it hits. */
export interface VideoSuggestion {
  /** Text placed into the search box when the chip is clicked. */
  label: string;
  /** Number of videos in the library the term matches. */
  count: number;
  /** Whether the chip is a debate keyword or a tournament name. */
  kind: VideoSuggestionKind;
}

/** Popular search terms offered under the video grid. */
export interface VideoSuggestions {
  /** Curated debate terms, only those the library actually has videos for. */
  keywords: VideoSuggestion[];
  /** Tournament names taken from the library itself, biggest first. */
  tournaments: VideoSuggestion[];
}

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
  /** Every video in the library. */
  total: number;
  /** Videos of rounds. */
  rounds: number;
  /** Videos ingested from the lectures asset. */
  lectures: number;
  /** Videos with no numeric debate style — the "All Lectures" tab. */
  lecturesOnly: number;
  /** Videos flagged as top picks. */
  topPicks: number;
  /** Count per numeric debate style. */
  byStyle: Record<number, number>;
};

/** Response of `/api/videos/meta` — the small, fetch-once page metadata. */
export type VideoMetaResponse = {
  /** Library-wide totals. */
  counts: VideoCounts;
  /** Lecture category cards. */
  lectureCategories: LectureCategoryFacet[];
  /** Popular keyword and tournament searches shown under the video grid. */
  suggestions?: VideoSuggestions;
  /** Debate topics by year. */
  topics?: TopicType[];
  /** Champions by year. */
  champions?: ChampionType[];
  /** Per-year debate history entries, loosely typed. */
  history?: Record<string, any>;
  /** Which backend answered — `"sql"`, or `"json"` before the table is seeded. */
  backend: string;
};

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
  | "leaderboard"
  | "statistics";
