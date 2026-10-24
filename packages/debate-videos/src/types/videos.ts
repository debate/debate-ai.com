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
} from "@debate-ai/types";

// The definitions (and their field docs) live in `@debate-ai/types`.
import type { VideoDebateStyle } from "@debate-ai/types";

/** Debate style/format category */
export type DebateStyle = VideoDebateStyle;

/** Display labels for each debate style */
export const DEBATE_STYLE_LABELS: Record<DebateStyle, string> = {
  2: "PF",
  3: "LD",
  1: "Policy",
  4: "College",
  5: "WSD",
  6: "ACC",
  7: "Misc",
};
