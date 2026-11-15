/**
 * @fileoverview The small pill a live-streamed round shows in its corner:
 * "Live stream" while the round is live, "On air · 1AC" (pulsing red) while
 * this browser is broadcasting a speech. Links to the round's listening page
 * in the video library, so a debater can share it.
 *
 * @module round/LiveOnAirBadge
 */

"use client"

import { Radio } from "lucide-react"
import { liveRoundPagePath } from "@debate-ai/timer/src/recorder/live-radio"
import { cn } from "../ui/lib/utils"
import type { LiveRoundBroadcastState } from "./useLiveRoundBroadcast"

export function LiveOnAirBadge({ state }: { state: LiveRoundBroadcastState }) {
  if (!state.enabled || !state.streamId) return null
  const onAir = !!state.onAirSpeech
  return (
    <a
      href={liveRoundPagePath(state.streamId)}
      target="_blank"
      rel="noreferrer"
      title={onAir ? "Your speech is being broadcast live. Open the listening page." : "This round is live streamed. Open the listening page."}
      className={cn(
        "fixed bottom-3 left-3 z-40 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm",
        onAir
          ? "border-red-500/50 bg-red-500 text-white"
          : "border-border bg-background/90 text-muted-foreground backdrop-blur",
      )}
    >
      <Radio className={cn("h-3.5 w-3.5", onAir && "animate-pulse")} />
      {onAir ? `On air · ${state.onAirSpeech}` : "Live stream"}
    </a>
  )
}
