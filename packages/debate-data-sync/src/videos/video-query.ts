/**
 * @fileoverview Shared filter/sort/facet semantics for the paginated video
 * feed. The same rules are expressed twice: as SQL in the API route (against
 * the `videos` table) and as the in-memory implementation here, which backs
 * the JSON fallback used before the table has been seeded and is what the
 * unit tests exercise.
 * @module videos/video-query
 */

import type { VideoRow } from "./video-rows";
import { LEGACY_SEASON } from "./video-rows";

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
  /** Restrict to an explicit id list — used by the favourites-only filter. */
  ids?: string[] | null;
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
  key: string;
  label: string;
  count: number;
  maxViews: number;
}

/** Maximum page size a client may request. */
export const MAX_VIDEO_PAGE_SIZE = 200;

/** Page size used when the request does not specify one. */
export const DEFAULT_VIDEO_PAGE_SIZE = 60;

/**
 * Splits a search string into lowercase tokens; every token must match.
 *
 * @param q - Raw search input.
 * @returns Lowercased whitespace-separated tokens (empty when `q` is blank).
 */
export function searchTokens(q?: string | null): string[] {
  if (!q) return [];
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Normalizes the season filter into a numeric season, or `null` for "all".
 *
 * @param year - `"legacy"`, a four-digit year, or an empty value.
 * @returns {@link LEGACY_SEASON} for legacy, the parsed season, else `null`.
 */
export function parseSeasonFilter(year?: string | null): number | null {
  if (!year) return null;
  if (year === "legacy") return LEGACY_SEASON;
  const parsed = Number.parseInt(year, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Applies every filter in {@link VideoQueryParams} except pagination.
 *
 * @param rows - Candidate rows.
 * @param params - Filter parameters; pagination and sort fields are ignored.
 * @returns The matching rows, in input order.
 */
export function filterVideoRows(rows: VideoRow[], params: VideoQueryParams): VideoRow[] {
  const tokens = searchTokens(params.q);
  const season = parseSeasonFilter(params.year);
  const idSet = params.ids && params.ids.length ? new Set(params.ids) : null;

  return rows.filter((row) => {
    if (params.source && params.source !== "all" && row.source !== params.source) return false;
    if (params.lecturesOnly && row.style !== null) return false;
    if (params.topPicksOnly && !row.isTopPick) return false;
    if (params.categoryKey && row.categoryKey !== params.categoryKey) return false;
    if (params.style != null && row.style !== params.style) return false;
    if (season !== null && row.seasonYear !== season) return false;
    if (idSet && !idSet.has(row.videoId)) return false;
    if (tokens.length && !tokens.every((token) => row.searchText.includes(token))) return false;
    return true;
  });
}

/** Orders equal-ranked rows by id, so paging never repeats or skips a video. */
function compareIds(a: VideoRow, b: VideoRow): number {
  if (a.videoId === b.videoId) return 0;
  return a.videoId < b.videoId ? -1 : 1;
}

/**
 * Sorts rows in place by the requested order, breaking ties by video id to
 * match the `ORDER BY` the SQL backend uses.
 *
 * @param rows - Rows to sort (mutated and returned).
 * @param sort - `"Views"` for descending view count, anything else for recency.
 * @returns The same array, sorted.
 */
export function sortVideoRows(rows: VideoRow[], sort?: string | null): VideoRow[] {
  if (sort === "Views") {
    return rows.sort((a, b) => b.viewCount - a.viewCount || compareIds(a, b));
  }
  return rows.sort((a, b) => b.publishedMs - a.publishedMs || compareIds(a, b));
}

/**
 * Runs the full query — filter, sort, then slice one page.
 *
 * @param rows - Candidate rows.
 * @param params - See {@link VideoQueryParams}.
 * @returns The page plus the total match count for infinite-scroll bookkeeping.
 */
export function queryVideoRows(
  rows: VideoRow[],
  params: VideoQueryParams,
): { rows: VideoRow[]; total: number } {
  const matched = sortVideoRows(filterVideoRows(rows, params), params.sort);
  const offset = Math.max(0, params.offset ?? 0);
  const limit = clampPageSize(params.limit);
  return { rows: matched.slice(offset, offset + limit), total: matched.length };
}

/**
 * Clamps a requested page size into the range the API will serve.
 *
 * @param limit - Requested size; `undefined`/invalid falls back to the default.
 * @returns A size between 1 and {@link MAX_VIDEO_PAGE_SIZE}.
 */
export function clampPageSize(limit?: number | null): number {
  if (!limit || !Number.isFinite(limit) || limit <= 0) return DEFAULT_VIDEO_PAGE_SIZE;
  return Math.min(Math.floor(limit), MAX_VIDEO_PAGE_SIZE);
}

/**
 * Season keys offered by the season dropdown, newest first.
 *
 * @param maxYear - Newest season to include.
 * @returns Year strings from `maxYear` down to 2011.
 */
export function seasonKeys(maxYear: number): string[] {
  const top = Math.max(maxYear, 2011);
  return Array.from({ length: top - 2011 + 1 }, (_, i) => String(top - i));
}

/**
 * Computes the dropdown facet counts.
 *
 * Each dimension ignores its own filter (so the season dropdown keeps showing
 * every season's total while a season is selected) and both ignore the search
 * term, matching the behaviour of the previous client-side count hook.
 *
 * @param rows - Candidate rows.
 * @param params - Active query; `q`, `year`/`style` are applied selectively.
 * @returns See {@link VideoFacets}.
 */
export function computeVideoFacets(rows: VideoRow[], params: VideoQueryParams): VideoFacets {
  const base = filterVideoRows(rows, { ...params, q: null, year: null, style: null });

  const yearCounts: Record<string, number> = {};
  const styleCounts: Record<number, number> = {};

  const forYears = params.style != null ? base.filter((r) => r.style === params.style) : base;
  for (const row of forYears) {
    const key = row.seasonYear === LEGACY_SEASON ? "legacy" : String(row.seasonYear);
    yearCounts[key] = (yearCounts[key] ?? 0) + 1;
  }

  const season = parseSeasonFilter(params.year);
  const forStyles = season !== null ? base.filter((r) => r.seasonYear === season) : base;
  for (const row of forStyles) {
    if (row.style == null) continue;
    styleCounts[row.style] = (styleCounts[row.style] ?? 0) + 1;
  }

  return { yearCounts, styleCounts };
}

/** Category labels that never get their own gallery card. */
export const HIDDEN_LECTURE_CATEGORIES = new Set(["Awards"]);

/**
 * Builds the lecture-category cards (label, slug, size, popularity).
 *
 * @param rows - All video rows.
 * @returns One entry per lecture category, most popular first.
 */
export function computeLectureCategories(rows: VideoRow[]): LectureCategoryFacet[] {
  const byLabel = new Map<string, LectureCategoryFacet>();

  for (const row of rows) {
    if (row.style !== null || !row.category || !row.categoryKey) continue;
    if (HIDDEN_LECTURE_CATEGORIES.has(row.category)) continue;
    const existing = byLabel.get(row.category);
    if (existing) {
      existing.count += 1;
      existing.maxViews = Math.max(existing.maxViews, row.viewCount);
    } else {
      byLabel.set(row.category, {
        key: row.categoryKey,
        label: row.category,
        count: 1,
        maxViews: row.viewCount,
      });
    }
  }

  return [...byLabel.values()].sort((a, b) => b.maxViews - a.maxViews);
}
