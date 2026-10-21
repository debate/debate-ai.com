/**
 * @fileoverview The control on a list row that plays the video in the
 * floating popout player, leaving the reader on the page they are on.
 *
 * It swaps places with what the row itself does. A click on the row opens
 * the video's watch page — the player, the transcript and the related videos
 * at an address of their own — and this icon is the way to keep browsing
 * while it plays in the corner.
 *
 * On a watch page the page's own player is the one playing, and only one
 * embed may play at a time. So there the icon lines the video up in the
 * popout instead (`popoutNext`): the page's video keeps playing, and the
 * popout starts the lined-up one when the reader navigates away. A second
 * click cancels it.
 * @module components/watch/PopoutPlayerButton
 */

"use client"

import { PictureInPicture2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/primitives/tooltip"
import { cn } from "../../ui/lib/utils"
import { useVideoPlayerStore, type VideoMeta } from "../../state/videoPlayerStore"
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
  /** A watch page for some other video holds playback, so this one can only wait its turn. */
  const isDeferred = useVideoPlayerStore(
    (state) => state.theaterVideoId !== null && state.theaterVideoId !== videoId,
  )
  const isLinedUp = useVideoPlayerStore((state) => state.popoutNext?.videoId === videoId)
  const setActiveVideo = useVideoPlayerStore((state) => state.setActiveVideo)
  const setMinimized = useVideoPlayerStore((state) => state.setMinimized)
  const setPopoutNext = useVideoPlayerStore((state) => state.setPopoutNext)

  const label = isDeferred
    ? isLinedUp
      ? "Up next in popout player — plays when you leave this page (click to cancel)"
      : "Play in popout player when you leave this page"
    : "Watch in popout player"
  const isHighlighted = isDeferred ? isLinedUp : isPlaying

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            // The row behind it opens the watch page; this has its own job.
            e.stopPropagation()
            const meta: VideoMeta = {
              style: typeof style === "number" ? style : undefined,
              tournament,
              year: new Date(date).getFullYear(),
              affTeam,
              negTeam,
            }
            if (isDeferred) {
              setPopoutNext(isLinedUp ? null : { videoId, title, meta })
              return
            }
            if (isPlaying) {
              setMinimized(false)
              return
            }
            setActiveVideo(videoId, title, meta)
          }}
          className={cn(
            "p-0.5 rounded transition-colors",
            isHighlighted ? "text-primary" : "text-muted-foreground hover:text-foreground",
            className,
          )}
          aria-label={label}
          aria-pressed={isDeferred ? isLinedUp : undefined}
        >
          <PictureInPicture2 className={cn("w-4 h-4", iconClassName)} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
