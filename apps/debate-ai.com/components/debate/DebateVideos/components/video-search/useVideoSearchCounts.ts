/**
 * @fileoverview Hook that computes per-year and per-style video counts for filter dropdowns.
 * @module components/debate/DebateVideos/components/video-search/useVideoSearchCounts
 */

import { useMemo } from "react"
import { DEBATE_STYLE_LABELS } from "@/lib/types/videos"
import type { DebateStyle } from "@/lib/types/videos"

/** Parameters accepted by the {@link useVideoSearchCounts} hook. */
interface UseVideoSearchCountsParams {
  /** Full unfiltered video list used for count calculations. */
  allVideos: any[]
  /** Set of video IDs that are currently hidden from the grid. */
  hiddenVideos: Set<string>
  /** Currently selected debate-style filter; empty string means no filter. */
  selectedStyle?: DebateStyle | ""
  /** Currently selected season year key (e.g. `"2026"` or `"legacy"`). */
  selectedYear?: string
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
 * Computes per-year and per-style video counts for the search bar filter dropdowns.
 *
 * - `yearCounts` applies the style filter but ignores the year filter and search term,
 *   so the season dropdown always shows live totals for each year option.
 * - `styleCounts` applies the year filter but ignores the style filter and search term,
 *   so the style dropdown always shows live totals for each format option.
 *
 * @param params - See {@link UseVideoSearchCountsParams}.
 * @returns Season year list plus pre-computed count maps. See {@link VideoSearchCounts}.
 */
export function useVideoSearchCounts({
  allVideos,
  hiddenVideos,
  selectedStyle,
  selectedYear,
}: UseVideoSearchCountsParams): VideoSearchCounts {
  const maxYear = Math.max(new Date().getFullYear(), 2026)

  const years = useMemo(
    () => Array.from({ length: maxYear - 2011 + 1 }, (_, i) => String(maxYear - i)),
    [maxYear],
  )

  const yearCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!allVideos.length) return counts

    const visible = allVideos.filter((v) => !hiddenVideos.has(v[0]))
    const filtered = selectedStyle ? visible.filter((v) => v[6] === selectedStyle) : visible

    for (const y of years) {
      const season = parseInt(y)
      const start = new Date(`${season - 1}-06-01`)
      const end = new Date(`${season}-06-01`)
      counts[y] = filtered.filter((v) => {
        const d = new Date(v[2])
        return d >= start && d < end
      }).length
    }

    const legacyCutoff = new Date("2010-06-01")
    counts["legacy"] = filtered.filter((v) => new Date(v[2]) < legacyCutoff).length

    return counts
  }, [allVideos, hiddenVideos, selectedStyle, years])

  const styleCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    if (!allVideos.length) return counts

    const visible = allVideos.filter((v) => !hiddenVideos.has(v[0]))

    let filtered = visible
    if (selectedYear) {
      if (selectedYear === "legacy") {
        const cutoff = new Date("2010-06-01")
        filtered = visible.filter((v) => new Date(v[2]) < cutoff)
      } else {
        const season = parseInt(selectedYear)
        const start = new Date(`${season - 1}-06-01`)
        const end = new Date(`${season}-06-01`)
        filtered = visible.filter((v) => {
          const d = new Date(v[2])
          return d >= start && d < end
        })
      }
    }

    for (const styleStr of Object.keys(DEBATE_STYLE_LABELS)) {
      const styleNum = Number(styleStr) as DebateStyle
      counts[styleNum] = filtered.filter((v) => v[6] === styleNum).length
    }

    return counts
  }, [allVideos, hiddenVideos, selectedYear])

  return { years, yearCounts, styleCounts }
}
