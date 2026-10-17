/**
 * @fileoverview The play queue, beside the related videos under the player.
 *
 * The queue used to be visible only as the floating player's "Up next" strip
 * — one title and a `+n more` count — which the watch page stands down on
 * mount. So on the page where you actually line videos up, nothing showed
 * what was lined up. This panel is that list: every queued video, in order,
 * with the controls to play one now or drop it.
 *
 * Playing from here goes through the store, not the router, because this
 * page turns a change of active video into a navigation already
 * (`VideoWatchPage`) — the queue's own "play next when this ends" path and a
 * click here then land on the same URL by the same route.
 * @module components/watch/WatchQueuePanel
 */

"use client"

import { ListVideo, Play, X } from "lucide-react"
import { cn } from "../../ui/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/primitives/tooltip"
import { useVideoPlayerStore } from "../../state/videoPlayerStore"

export function WatchQueuePanel({ className }: { className?: string }) {
  // Per-field selectors: the panel re-renders on a queue change, not on every
  // tick of playback position the store also carries.
  const queue = useVideoPlayerStore((state) => state.queue)
  const setActiveVideo = useVideoPlayerStore((state) => state.setActiveVideo)
  const removeFromQueue = useVideoPlayerStore((state) => state.removeFromQueue)
  const clearQueue = useVideoPlayerStore((state) => state.clearQueue)

  return (
    <aside
      className={cn("rounded-md border border-border bg-muted/20", className)}
      aria-label="Play queue"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <ListVideo className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Queue
        </h3>
        {queue.length > 0 && (
          <>
            <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {queue.length}
            </span>
            <button
              type="button"
              onClick={clearQueue}
              className="ml-auto text-[11px] text-muted-foreground hover:text-destructive"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {queue.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">
          Nothing queued. Add a related video with its
          <ListVideo className="mx-1 inline h-3 w-3 align-text-bottom" />
          button and it lines up here, to play when this one ends.
        </p>
      ) : (
        <ol className="max-h-80 divide-y divide-border/60 overflow-y-auto">
          {queue.map((item, index) => (
            <li key={item.videoId} className="group flex items-center gap-2 px-3 py-2">
              <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => setActiveVideo(item.videoId, item.title, item.meta ?? undefined)}
                className="min-w-0 flex-1 truncate text-left text-xs text-foreground hover:text-primary hover:underline"
                title={item.title}
              >
                {item.title}
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setActiveVideo(item.videoId, item.title, item.meta ?? undefined)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={`Play ${item.title} now`}
                  >
                    <Play className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Play now</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => removeFromQueue(item.videoId)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`Remove ${item.title} from the queue`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Remove from queue</TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
