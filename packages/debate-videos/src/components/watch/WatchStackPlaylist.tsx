/**
 * @fileoverview The stacked playlist a video belongs to, as a playlist under
 * the player.
 *
 * A stack is a small group the library knows belongs together — a round and
 * the round-analysis video made from it, a debate split across uploads (see
 * `components/video-grid/video-stacks.ts`). The grid folds a stack into one
 * card; on the watch page it is spelled out in order, so the analysis of the
 * round on screen, or its next part, is one click away rather than somewhere
 * in the related rows.
 *
 * Each entry is labelled by what it is to the round — `Round`, `Analysis`,
 * `Part 2` — read from the variant segment of its address.
 * @module components/watch/WatchStackPlaylist
 */

"use client"

import Link from "next/link"
import { ListVideo } from "lucide-react"
import { cn } from "../../ui/lib/utils"
import { videoRouteHref, videoRouteParts, videoRouteSegments } from "../../lib/video-route"
import type { VideoType } from "../../types/videos"

/**
 * What a stack member is to its round: `"Round"` for the round itself, else
 * its variant segment in words (`analysis` → `Analysis`, `part-2` → `Part 2`).
 *
 * @returns The label, or `null` for a video not filed as a round.
 */
export function stackMemberLabel(video: VideoType): string | null {
  const segments = videoRouteSegments(videoRouteParts(video))
  if (!segments.teams) return null
  if (!segments.variant) return "Round"
  const words = segments.variant.replace(/-/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

interface WatchStackPlaylistProps {
  /** The video on screen. */
  current: VideoType
  /** Every member of its stack, in stack order, `current` included. */
  stack: VideoType[]
  className?: string
}

export function WatchStackPlaylist({ current, stack, className }: WatchStackPlaylistProps) {
  if (stack.length < 2) return null
  const position = stack.findIndex((video) => video[0] === current[0])

  return (
    <section className={cn("rounded-lg border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ListVideo className="h-3.5 w-3.5" />
          Playlist
        </h2>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {position >= 0 ? `${position + 1} / ${stack.length}` : stack.length}
        </span>
      </div>

      <ol className="divide-y divide-border">
        {stack.map((video, index) => {
          const [videoId, title, , channel] = video
          const isCurrent = videoId === current[0]
          const label = stackMemberLabel(video)
          return (
            <li key={videoId}>
              <Link
                href={videoRouteHref(video)}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 p-2.5 transition-colors",
                  isCurrent ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                <span className="w-4 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">
                  {isCurrent ? "▶" : index + 1}
                </span>
                <img
                  src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  className="h-12 w-20 shrink-0 rounded object-cover bg-muted"
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-medium leading-snug line-clamp-2">{title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {label ? `${label} · ` : ""}
                    {channel}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
