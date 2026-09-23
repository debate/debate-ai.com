/**
 * @fileoverview The analysis tab: the videos an editor has tied to this one.
 *
 * A famous round is rarely watched alone — the 2006 NDT final has coaches'
 * breakdowns, argument explainers and retrospectives pointing back at it, and
 * those are the most useful thing to hand someone who has just watched it.
 * The "Related videos" row under the player cannot do that job: it is derived
 * from tournament and format, so it offers *more rounds like this one*. These
 * links are stated by an editor and are *about* this one.
 *
 * Each entry keeps its own note, because why two videos belong together is
 * usually the part a viewer cannot infer from the title.
 * @module components/watch/WatchAnalysisPanel
 */

"use client"

import Link from "next/link"
import { ScrollArea } from "../../ui/primitives/scroll-area"
import { videoRouteHref } from "../../lib/video-route"
import { formatVideoDate } from "../video-card/videoCardUtils"
import type { VideoType } from "../../types/videos"
import type { VideoRelationKind } from "../../lib/video-relations"

/** One linked video, as the watch page receives it. */
export interface LinkedVideo {
  video: VideoType
  relation: VideoRelationKind | string
  /** The editor's note on why this belongs beside the video being watched. */
  note?: string | null
}

interface WatchAnalysisPanelProps {
  links: LinkedVideo[]
}

export function WatchAnalysisPanel({ links }: WatchAnalysisPanelProps) {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Analysis of this round
        </h3>
        <span className="text-[10px] tabular-nums text-muted-foreground">{links.length}</span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <ul className="divide-y divide-border">
          {links.map(({ video, relation, note }) => {
            const [videoId, title, date, channel, viewCount] = video
            return (
              <li key={`${relation}-${videoId}`}>
                <Link
                  href={videoRouteHref(video)}
                  className="flex gap-2.5 p-2.5 hover:bg-accent/50 transition-colors"
                >
                  <img
                    src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    className="h-12 w-20 shrink-0 rounded object-cover bg-muted"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-medium leading-snug line-clamp-2">{title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {channel}
                      {date ? ` · ${formatVideoDate(date)}` : ""}
                      {viewCount ? ` · ${viewCount.toLocaleString()} views` : ""}
                    </p>
                    {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>

        {links.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            No analysis videos are linked to this one yet.
          </p>
        )}
      </ScrollArea>
    </div>
  )
}
