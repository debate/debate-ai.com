/** Debate style/format category */
export type DebateStyle = "pf" | "ld" | "policy" | "college";

/** Display labels for each debate style */
export const DEBATE_STYLE_LABELS: Record<DebateStyle, string> = {
  pf: "PF",
  ld: "LD",
  policy: "Policy",
  college: "College",
};

/** Video data tuple: [videoId, title, date, channel, viewCount, description, style?] */
export type VideoType = [string, string, string, string, number, string, DebateStyle?];

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
  topPicks: VideoType[];
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
