/**
 * @fileoverview Route configuration for /videos/[category] path slugs.
 * Maps URL path segments to panel state overrides (style filter, active view,
 * favorites flag, stats modal).
 * @module components/debate/DebateVideos/panels/lectureRouteConfig
 */

import type { CategoryType, DebateStyle } from "@/lib/types/videos"

/**
 * Shape of per-slug state overrides applied when navigating to
 * `/videos/<slug>`.1
 */
export interface SlugState {
  /** DebateStyle filter to apply (1=Policy, 2=PF, 3=LD, 4=College). */
  style?: DebateStyle
  /** Active category view override. */
  view?: CategoryType
  /** When `true`, enables the favorites-only filter. */
  favorites?: boolean
  /** When `true`, auto-opens the YouTube stats modal. */
  stats?: boolean
}

/**
 * Maps lower-cased URL path slugs to initial panel state.
 * Unknown slugs are treated as lecture-category IDs (e.g. `/videos/topic_lectures`).
 */
export const SLUG_MAP: Record<string, SlugState> = {
  policy: { style: 1 },
  ld: { style: 3 },
  pf: { style: 2 },
  college: { style: 4 },
  toppicks: { view: "topPicks" },
  favoritedebates: { favorites: true },
  favoritelectures: { favorites: true, view: "lectures" },
  favorites: { favorites: true },
  dictionary: { view: "dictionary" },
  rankings: { view: "leaderboard" },
  statistics: { stats: true },
  stats: { stats: true },
  lectures: { view: "lectures" },
}

