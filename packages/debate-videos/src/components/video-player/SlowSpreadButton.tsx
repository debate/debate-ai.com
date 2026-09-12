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
 *
 * It draws itself as a {@link PlayerIconButton} like every other control, so
 * it sizes with whichever toolbar it is dropped into — the popout player's
 * strip or the watch page's larger one.
 */

"use client"

import { Gauge } from "lucide-react"
import { PlayerIconButton, type PlayerIconButtonSize } from "./PlayerIconButton"
import { useVideoPlayerStore, sendYouTubeCommand } from "../../state/videoPlayerStore"

/** Roughly the slowest rate at which a spread is still intelligible. */
export const SLOW_SPREAD_RATE = 0.65

interface SlowSpreadButtonProps {
  /** Matches the host toolbar's control size; see {@link PlayerIconButton}. */
  size?: PlayerIconButtonSize
}

export function SlowSpreadButton({ size = "sm" }: SlowSpreadButtonProps = {}) {
  const playbackRate = useVideoPlayerStore((state) => state.playbackRate)
  const setPlaybackRate = useVideoPlayerStore((state) => state.setPlaybackRate)
  const isSlowed = playbackRate !== 1

  const toggle = () => {
    const next = isSlowed ? 1 : SLOW_SPREAD_RATE
    setPlaybackRate(next)
    sendYouTubeCommand("setPlaybackRate", [next])
  }

  return (
    <PlayerIconButton
      size={size}
      icon={Gauge}
      label={isSlowed ? "Normal speed" : "Slow down speech rate"}
      tooltip={isSlowed ? "Back to normal speed (1x)" : "Slow down speech rate 65%"}
      active={isSlowed}
      className={isSlowed ? "text-red-300" : "text-red-600 hover:text-foreground"}
      onClick={toggle}
    />
  )
}
