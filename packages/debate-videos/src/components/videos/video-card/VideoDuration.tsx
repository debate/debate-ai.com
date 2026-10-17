/**
 * @fileoverview A video's length, shown under the action buttons of a grid
 * card and a list row. Renders nothing until the length is known, and nothing
 * for a video that has none stored.
 * @module components/video-card/VideoDuration
 */

"use client"

import { Clock } from "lucide-react"
import { cn } from "../../ui/lib/utils"
import { formatVideoDuration, useVideoDuration } from "../../state/videoDurations"
import { formatWatchClock } from "../../state/videoWatchHistory"

/**
 * The length of one video, with a clock icon.
 *
 * @param props.videoId - YouTube id.
 * @param props.className - Extra classes for the wrapper.
 */
export function VideoDuration({ videoId, className }: { videoId: string; className?: string }) {
  const seconds = useVideoDuration(videoId)
  if (!seconds) return null

  return (
    <div
      className={cn("flex items-center gap-1 text-xs text-muted-foreground tabular-nums", className)}
      title={`Duration ${formatWatchClock(seconds)}`}
    >
      <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{formatVideoDuration(seconds)}</span>
    </div>
  )
}
