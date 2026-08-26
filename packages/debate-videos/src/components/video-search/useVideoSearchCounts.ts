/**
 * @fileoverview Hook that resolves the per-year and per-style counts shown in
 * the filter dropdowns.
 * @module components/debate/DebateVideos/components/video-search/useVideoSearchCounts
 */

import { useMemo } from "react"
import type { VideoFacets } from "../../types/videos"

/** Parameters accepted by the {@link useVideoSearchCounts} hook. */
interface UseVideoSearchCountsParams {
  /**
   * Season and style counts computed server-side alongside the current page of
   * videos, or `null` while the first page is still loading.
   */
  facets: VideoFacets | null
}

/** Values returned by the {@link useVideoSearchCounts} hook. */
interface VideoSearchCounts {
  /** Season year strings descending from maxYear down to 2011 (e.g. `["2026", "2025", ...]`). */
  years: string[]
  /**
   * Video count per season year key.
   * Keys are four-digit year strings plus `"legacy"` for pre-2010 content.
   */
  yearCounts: Record<string, number>
  /** Video count per {@link DebateStyle} numeric key. */
  styleCounts: Record<number, number>
}

/**
 * Resolves the per-year and per-style counts for the search bar filter dropdowns.
 *
 * The counts come from the API, which computes them over the whole library for
 * the active filters — the grid only ever holds the pages loaded so far, so it
 * cannot tally them itself. As on the server, `yearCounts` applies the style
 * filter but ignores the year filter and search term, and `styleCounts` does
 * the reverse, so each dropdown keeps showing live totals for every option.
 *
 * Locally hidden videos are not deducted: they are a browser-only preference
 * the server does not know about.
 *
 * @param params - See {@link UseVideoSearchCountsParams}.
 * @returns Season year list plus the count maps. See {@link VideoSearchCounts}.
 */
export function useVideoSearchCounts({
  facets,
}: UseVideoSearchCountsParams): VideoSearchCounts {
  const maxYear = Math.max(new Date().getFullYear(), 2026)

  const years = useMemo(
    () => Array.from({ length: maxYear - 2011 + 1 }, (_, i) => String(maxYear - i)),
    [maxYear],
  )

  const yearCounts = useMemo(() => facets?.yearCounts ?? {}, [facets])
  const styleCounts = useMemo(() => facets?.styleCounts ?? {}, [facets])

  return { years, yearCounts, styleCounts }
}
