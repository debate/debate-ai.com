/**
 * @fileoverview Route configuration for /videos/[category] path slugs.
 * Maps URL path segments to panel state overrides (style filter, active view,
 * favorites flag, stats modal).
 * @module components/debate/DebateVideos/panels/lectureRouteConfig
 */

import type { CategoryType, DebateStyle } from "../types/videos"

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
  statistics: { view: "statistics" },
  stats: { view: "statistics" },
  lectures: { view: "lectures" },
  history: { view: "history" },
  watchhistory: { view: "history" },
}


/**
 * Routes outside `/videos/[category]` that render the same page, and the slug
 * each one stands for. The lecture library and the three reference views live
 * under their sidebar category (`/lectures`, `/practice/...`) rather than as
 * `/videos/<slug>`, so there is no `category` param to read the view from.
 */
export const PATH_SLUGS: Record<string, string> = {
  "/lectures": "lectures",
  "/practice/glossary": "dictionary",
  "/practice/rankings": "rankings",
  "/practice/statistics": "statistics",
}

/**
 * The lower-cased slug the page is showing: the route's `category` param when
 * it has one (`/videos/pf`, `/lectures/topic_lectures`), otherwise the slug the
 * path itself stands for ({@link PATH_SLUGS}), otherwise `undefined` (`/videos`).
 */
export function librarySlug(
  category: string | string[] | undefined,
  pathname: string | null | undefined,
): string | undefined {
  if (typeof category === "string") return category.toLowerCase()
  if (Array.isArray(category) && category.length > 0) return String(category[0]).toLowerCase()
  const path = pathname?.replace(/\/+$/, "") ?? ""
  return PATH_SLUGS[path]
}

/**
 * Where a lecture category lives: `/lectures` for all of them,
 * `/lectures/<id>` for one.
 */
export function lectureCategoryHref(categoryId: string): string {
  return categoryId === "all" ? "/lectures" : `/lectures/${encodeURIComponent(categoryId)}`
}
