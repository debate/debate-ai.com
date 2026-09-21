/**
 * @fileoverview The control on a video card (and list row) that opens the
 * video's watch page.
 *
 * It replaces the transcript dialog that used to open over the grid. The
 * dialog could only ever be the player and a narrow column of sentences, with
 * no address of its own — nothing to link a teammate to, nothing for search to
 * index, and no room for anything else about the video. The page it now links
 * to is the same player and the same synced transcript at a URL.
 *
 * The icon is unchanged from the dialog's, because for readers it still means
 * "this video, with its transcript".
 * @module components/watch/WatchPageLink
 */

"use client"

import Link from "next/link"
import { Captions } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/primitives/tooltip"
import { cn } from "../../ui/lib/utils"
import { videoWatchHref } from "../../lib/video-slug"
import { videoRouteHref } from "../../lib/video-route"
import type { VideoType } from "../../types/videos"

interface WatchPageLinkProps {
  videoId: string
  title: string
  /**
   * The whole video row, when the caller has it. The canonical address is
   * built from the season, tournament and teams — see `lib/video-route` — so
   * a caller that can hand those over links straight to it. Without them the
   * old flat `/videos/watch/<slug>` link still works; it just costs the
   * reader a redirect.
   */
  video?: VideoType
  /** Extra classes for the anchor — the list rows pad theirs differently. */
  className?: string
  /** Icon size classes; defaults to the card row's `w-4 h-4`. */
  iconClassName?: string
}

export function WatchPageLink({
  title,
  video,
  className,
  iconClassName,
}: WatchPageLinkProps) {
  const href = video ? videoRouteHref(video) : videoWatchHref(title)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          // Cards and rows are themselves clickable (they start playback in
          // the popout player); this control has its own destination.
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors",
            className,
          )}
          aria-label="Open the watch page with transcript"
        >
          <Captions className={cn("w-4 h-4", iconClassName)} />
        </Link>
      </TooltipTrigger>
      <TooltipContent>Watch with transcript</TooltipContent>
    </Tooltip>
  )
}
