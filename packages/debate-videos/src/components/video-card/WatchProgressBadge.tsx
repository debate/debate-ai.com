/**
 * @fileoverview The "you have watched this" marker the video grid shows.
 *
 * Two shapes, because the two facts a user wants from a grid are different
 * questions: *have I finished this?* and *how far did I get?*. A finished
 * video gets a filled check — one glance, no arithmetic. An unfinished one
 * gets a ring drawn to the fraction actually watched, which answers the second
 * question without the user hovering anything. Both carry the same tooltip
 * with the numbers, because "68%" and "42:10 of 1:01:44" are what decides
 * whether a round is worth reopening.
 *
 * The colour band tracks {@link WatchStatus} rather than the raw percentage,
 * so the same video reads the same way in the grid, the rows and the watch
 * page.
 *
 * @module components/video-card/WatchProgressBadge
 */

"use client"

import { CircleCheckBig } from "lucide-react"
import { cn } from "../../ui/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/primitives/tooltip"
import {
  describeWatchProgress,
  watchPercent,
  watchStatus,
  type WatchHistoryEntry,
  type WatchStatus,
} from "../../state/videoWatchHistory"

/** Colour per band — amber while in progress, emerald once finished. */
const STATUS_CLASSES: Record<Exclude<WatchStatus, "unwatched">, string> = {
  started: "text-sky-300",
  partly: "text-amber-300",
  mostly: "text-amber-200",
  watched: "text-emerald-300",
}

/** Props for {@link WatchProgressBadge}. */
export interface WatchProgressBadgeProps {
  /** The video's watch record; nothing renders without one. */
  entry: WatchHistoryEntry | null
  /** Badge diameter in pixels. */
  size?: number
  /** Extra classes for the wrapper — positioning, usually. */
  className?: string
  /** Drops the dark disc behind the glyph, for use on an opaque surface. */
  plain?: boolean
}

/**
 * The progress ring, drawn as a stroked circle with a dash offset.
 *
 * @param percent - How much of the video has been watched, 0–100.
 * @param size - Diameter in pixels.
 */
function ProgressRing({ percent, size }: { percent: number; size: number }) {
  const stroke = Math.max(2, Math.round(size / 7))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  // A video the embed never reported a length for has no percentage to draw;
  // a token arc still says "you started this" rather than showing an empty
  // ring that reads as unwatched.
  const drawn = percent > 0 ? percent : 8

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="opacity-25"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.min(100, drawn) / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

/**
 * The watch marker for one video, or nothing when it has not been watched.
 *
 * Must be rendered inside a `TooltipProvider`; every surface that uses it
 * (the card, the rows table) already has one.
 *
 * @param props - See {@link WatchProgressBadgeProps}.
 */
export function WatchProgressBadge({
  entry,
  size = 18,
  className,
  plain = false,
}: WatchProgressBadgeProps) {
  const status = watchStatus(entry)
  if (!entry || status === "unwatched") return null

  const percent = watchPercent(entry)
  const description = describeWatchProgress(entry)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          // A tooltip alone is not an accessible label — the same sentence
          // rides as text so a screen reader and a touch device, neither of
          // which get a hover, still learn how much of this the user watched.
          role="img"
          aria-label={description}
          data-watch-status={status}
          data-watch-percent={percent}
          onClick={(event) => {
            // The whole thumbnail is a play button; the badge is information,
            // not a control, so a stray tap on it must not start playback.
            event.stopPropagation()
          }}
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            plain ? "" : "bg-black/70 p-0.5 shadow-lg backdrop-blur-sm",
            STATUS_CLASSES[status],
            className,
          )}
        >
          {status === "watched" ? (
            <CircleCheckBig style={{ width: size, height: size }} strokeWidth={2.5} />
          ) : (
            <ProgressRing percent={percent} size={size} />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The thin bar along the bottom of a thumbnail, the way every video app marks
 * a part-watched item. Renders nothing for a video with no measurable
 * progress, so an unwatched grid looks exactly as it did.
 *
 * @param entry - The video's watch record.
 */
export function WatchProgressBar({ entry }: { entry: WatchHistoryEntry | null }) {
  const status = watchStatus(entry)
  if (!entry || status === "unwatched") return null
  const percent = watchPercent(entry)
  if (percent <= 0) return null

  return (
    <div
      className="absolute inset-x-0 bottom-0 h-1 bg-black/50"
      aria-hidden="true"
      data-testid="watch-progress-bar"
    >
      <div
        className={cn("h-full", status === "watched" ? "bg-emerald-400" : "bg-amber-400")}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
