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
 * [videoId, title, date, channel, viewCount, description, style?, tournament?, roundLevel?, affTeam?, negTeam?, affWin?, judgeDecision?, arg1AC?, arg2NR?, isTopPick?, speechDocsUrl?]
 * Note: For lectures, index 6 can be either a DebateStyle number OR a category string
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

/** Structure of video data returned from the videos API endpoint. */
export type DebateVideosData = {
  rounds: VideoType[];
  lectures: VideoType[];
  topPicks: string[];
  topics?: TopicType[];
  champions?: ChampionType[];
  history?: Record<string, any>;
};

/** Union of all valid video page category identifiers. */
export type CategoryType =
  | "rounds"
  | "lectures"
  | "topPicks"
  | "dictionary"
  | "leaderboard";
