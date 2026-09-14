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

interface WatchPageLinkProps {
  videoId: string
  title: string
  /** Extra classes for the anchor — the list rows pad theirs differently. */
  className?: string
  /** Icon size classes; defaults to the card row's `w-4 h-4`. */
  iconClassName?: string
}

export function WatchPageLink({ videoId, title, className, iconClassName }: WatchPageLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={videoWatchHref(title, videoId)}
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
