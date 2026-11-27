/**
 * @fileoverview The stacked date badge: the two-digit year in a filled orange
 * badge, the upload month in a smaller outlined badge colored per month under
 * it, and the topic season ("25-26") in small type under that. The watch
 * page header and the list rows share it so the date reads the same in both.
 */

"use client"

import { cn } from "../../../ui/lib/utils"
import { WatchSeasonTopic } from "../watch/WatchSeasonTopic"
import { formatVideoDate, getMonthBadgeColor } from "./videoCardUtils"
import type { TopicType } from "../../../types/videos"

export function VideoDateBadge({
  date,
  seasonYear,
  style,
  topics,
  className,
}: {
  /** The video's raw publication date. */
  date: string
  /** The competition season, by the year it ends (2026 for "25-26"). 0 for legacy. */
  seasonYear: number
  /** The round's format, for the season's hover topic. */
  style: number | undefined
  /** `debate-topics.json`, once loaded. */
  topics?: TopicType[]
  className?: string
}) {
  const year = new Date(date).getFullYear()
  if (!year) return null
  const monthLabel = formatVideoDate(date, "month")

  return (
    <span className={cn("flex flex-col items-center gap-0.5", className)} data-testid="video-date-badge">
      <span className="text-sm font-bold text-orange-300 backdrop-blur-md bg-orange-900/80 border border-orange-400/90 px-2 py-1 rounded shadow-lg">
        &apos;{String(year).slice(-2)}
      </span>
      {/* The year already says when, so the upload date under it is just the
          month, colored per month. */}
      {monthLabel && (
        <span
          title={formatVideoDate(date, "full")}
          className={cn(
            "text-[11px] font-semibold leading-none backdrop-blur-md border px-1.5 py-0.5 rounded shadow-sm",
            getMonthBadgeColor(date),
          )}
        >
          {monthLabel}
        </span>
      )}
      {/* The topic season, with the resolution debated that season on hover. */}
      <WatchSeasonTopic seasonYear={seasonYear} style={style} topics={topics} />
    </span>
  )
}
