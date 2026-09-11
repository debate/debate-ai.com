/**
 * @fileoverview Debate-specific player control: slow a round down so the
 * spread is followable.
 *
 * This is deliberately *not* part of the player. The player exposes a generic
 * playback rate (`playbackRate` / `setPlaybackRate` on the store) and a slot
 * for host-supplied controls; what that speed is called, which icon it gets
 * and which rate it drops to are debate concerns, and live here. The same
 * seam exists in the extracted npm package (`extract-youtube/react`'s
 * `extraControls`), so the two stay swappable.
 */

"use client"

import { Gauge } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/primitives/tooltip"
import { useVideoPlayerStore, sendYouTubeCommand } from "../../state/videoPlayerStore"

/** Roughly the slowest rate at which a spread is still intelligible. */
export const SLOW_SPREAD_RATE = 0.65

export function SlowSpreadButton() {
  const playbackRate = useVideoPlayerStore((state) => state.playbackRate)
  const setPlaybackRate = useVideoPlayerStore((state) => state.setPlaybackRate)
  const isSlowed = playbackRate !== 1

  const toggle = () => {
    const next = isSlowed ? 1 : SLOW_SPREAD_RATE
    setPlaybackRate(next)
    sendYouTubeCommand("setPlaybackRate", [next])
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggle}
          className={`p-1 rounded hover:bg-accent transition-colors ${isSlowed ? "text-red-300 bg-accent" : "text-red-600 text-muted-foreground hover:text-foreground"}`}
          aria-label={isSlowed ? "Normal speed" : "Slow down debate spread"}
        >
          <Gauge className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {isSlowed ? "Back to debate spread speed (1x)" : "Slow down debate spread 65%"}
      </TooltipContent>
    </Tooltip>
  )
}
