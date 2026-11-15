/**
 * @fileoverview "Live rounds" in the video library: rounds being broadcast
 * right now (Round Editor → **Live stream**) and the replays of earlier ones,
 * as a row of cards. Picking one opens its radio player under the row; each
 * card also links to the stream's own page. Renders nothing when there are no
 * streams, so the library looks as before.
 *
 * @module components/videos/live/LiveRoundsStrip
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, Radio } from "lucide-react"
import {
  fetchLiveRounds,
  formatBroadcastLength,
  liveRoundPagePath,
  type LiveRoundSummary,
} from "@debate-ai/timer/src/recorder/live-radio"
import { cn } from "../../../ui/lib/utils"
import { LiveRadioPanel } from "./LiveRadioPanel"

/** How often the list refreshes while the library is open. */
export const LIVE_LIST_REFRESH_MS = 30_000

export function LiveRoundsStrip({ className }: { className?: string }) {
  const [streams, setStreams] = useState<LiveRoundSummary[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const load = async () => {
      const next = await fetchLiveRounds()
      if (cancelled) return
      setStreams(next)
      timer = setTimeout(load, LIVE_LIST_REFRESH_MS)
    }
    void load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  if (streams.length === 0) return null
  const liveCount = streams.filter((s) => s.status === "live").length

  return (
    <section className={cn("space-y-3", className)} aria-label="Live rounds">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Radio className={cn("h-5 w-5", liveCount > 0 ? "text-red-500" : "text-muted-foreground")} />
        {liveCount > 0 ? `Live rounds · ${liveCount} on now` : "Round radio replays"}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {streams.map((stream) => {
          const live = stream.status === "live"
          const active = selected === stream.id
          return (
            <div
              key={stream.id}
              className={cn(
                "relative w-64 shrink-0 rounded-xl border bg-card p-3 text-left transition-colors",
                active ? "border-primary" : "hover:border-foreground/30",
              )}
            >
              <button
                type="button"
                onClick={() => setSelected(active ? null : stream.id)}
                className="block w-full text-left"
                aria-pressed={active}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  {live ? (
                    <span className="inline-flex items-center gap-1 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      <Radio className={cn("h-3 w-3", stream.onAirSpeech && "animate-pulse")} /> Live
                    </span>
                  ) : (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Replay
                    </span>
                  )}
                  <span className="truncate text-xs text-muted-foreground">
                    {live ? (stream.onAirSpeech ? `On air: ${stream.onAirSpeech}` : "Between speeches") : formatBroadcastLength(stream.durationMs)}
                  </span>
                </div>
                <p className="line-clamp-1 text-sm font-semibold">{stream.aff} vs {stream.neg}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {[stream.tournamentName, stream.roundLevel].filter(Boolean).join(" · ")}
                </p>
              </button>
              <Link
                href={liveRoundPagePath(stream.id)}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                aria-label={`Open ${stream.title}`}
                title="Open this stream's page"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )
        })}
      </div>
      {selected && <LiveRadioPanel key={selected} streamId={selected} />}
    </section>
  )
}
