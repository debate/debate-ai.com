/**
 * @fileoverview The control on a list row that plays the video in the
 * floating popout player, leaving the reader on the listing.
 *
 * It swaps places with what the row itself does. A click on the row opens
 * the video's watch page — the player, the transcript and the related videos
 * at an address of their own — and this icon is the way to keep browsing
 * while it plays in the corner.
 * @module components/watch/PopoutPlayerButton
 */

"use client"

import { PictureInPicture2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/primitives/tooltip"
import { cn } from "../../ui/lib/utils"
import { useVideoPlayerStore } from "../../state/videoPlayerStore"
import type { VideoType } from "../../types/videos"

interface PopoutPlayerButtonProps {
  video: VideoType
  /** Extra classes for the button — the list rows pad theirs differently. */
  className?: string
  /** Icon size classes; defaults to `w-4 h-4`. */
  iconClassName?: string
}

export function PopoutPlayerButton({ video, className, iconClassName }: PopoutPlayerButtonProps) {
  const [videoId, title, date, , , , style, tournament, , affTeam, negTeam] = video
  const isPlaying = useVideoPlayerStore((state) => state.activeVideoId === videoId)
  const setActiveVideo = useVideoPlayerStore((state) => state.setActiveVideo)
  const setMinimized = useVideoPlayerStore((state) => state.setMinimized)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            // The row behind it opens the watch page; this has its own job.
            e.stopPropagation()
            if (isPlaying) {
              setMinimized(false)
              return
            }
            setActiveVideo(videoId, title, {
              style: typeof style === "number" ? style : undefined,
              tournament,
              year: new Date(date).getFullYear(),
              affTeam,
              negTeam,
            })
          }}
          className={cn(
            "p-0.5 rounded transition-colors",
            isPlaying ? "text-primary" : "text-muted-foreground hover:text-foreground",
            className,
          )}
          aria-label="Watch in popout player"
        >
          <PictureInPicture2 className={cn("w-4 h-4", iconClassName)} />
        </button>
      </TooltipTrigger>
      <TooltipContent>Watch in popout player</TooltipContent>
    </Tooltip>
  )
}
