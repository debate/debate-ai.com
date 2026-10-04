export type {
  DebateTopicYear,
  SeasonalTopic,
  TopicType,
  ChampionType,
  VideoType,
  VideoFeedResponse,
  VideoCounts,
  VideoMetaResponse,
  VideoStacksResponse,
  CategoryType,
  LectureCategoryFacet,
  VideoFacets,
  VideoSuggestion,
  VideoSuggestions,
} from "debate";

// The definitions (and their field docs) live in `@types/debate`.
import type { VideoDebateStyle } from "debate";

/** Debate style/format category */
export type DebateStyle = VideoDebateStyle;

/** Display labels for each debate style */
export const DEBATE_STYLE_LABELS: Record<DebateStyle, string> = {
  2: "PF",
  3: "LD",
  1: "Policy",
  4: "College",
};
