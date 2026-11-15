/**
 * @fileoverview The radio player for one live round stream: play / pause,
 * a LIVE badge with the speech on air, "Go live" to skip ahead to the newest
 * speech, and the speeches so far as chapters to jump between. Used on the
 * stream's own page (`/videos/live/<id>`) and inline under the library's
 * live strip.
 *
 * @module components/videos/live/LiveRadioPanel
 */

"use client"

import { Pause, Play, Radio, SkipForward } from "lucide-react"
import { formatBroadcastLength, speechChapters } from "@debate-ai/timer/src/recorder/live-radio"
import { cn } from "../../../ui/lib/utils"
import { useLiveRadio } from "./useLiveRadio"

export function LiveRadioPanel({ streamId, className }: { streamId: string; className?: string }) {
  const radio = useLiveRadio(streamId)
  const { stream, segments, playback } = radio

  if (radio.loading) {
    return <div className={cn("rounded-xl border p-4 text-sm text-muted-foreground", className)}>Tuning in…</div>
  }
  if (radio.error || !stream) {
    return <div className={cn("rounded-xl border p-4 text-sm text-muted-foreground", className)}>{radio.error ?? "Stream not found."}</div>
  }

  const live = stream.status === "live"
  const isPlaying = playback.state === "playing" || playback.state === "waiting"
  const chapters = speechChapters(segments)
  const newestSpeech = segments[segments.length - 1]?.speech ?? null
  const behindLive = live && isPlaying && playback.speech !== null && playback.speech !== newestSpeech

  const statusLine =
    playback.state === "waiting"
      ? live
        ? "Waiting for the next speech…"
        : "End of broadcast"
      : playback.state === "finished"
        ? "End of broadcast"
        : playback.speech
          ? `${isPlaying ? "Playing" : "Paused on"} ${playback.speech}`
          : live
            ? stream.onAirSpeech
              ? `On air now: ${stream.onAirSpeech}`
              : segments.length > 0
                ? "Between speeches — press play to hear the latest speech"
                : "No speech yet — this round goes on air when the first speech starts"
            : `Replay · ${formatBroadcastLength(stream.durationMs)}`

  return (
    <div className={cn("rounded-xl border bg-card p-4 space-y-3", className)}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={isPlaying ? radio.pause : radio.play}
          disabled={!live && segments.length === 0}
          aria-label={isPlaying ? "Pause" : "Play"}
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-colors disabled:opacity-40",
            live ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90",
          )}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {live ? (
              <span className="inline-flex items-center gap-1 rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                <Radio className={cn("h-3 w-3", stream.onAirSpeech && "animate-pulse")} /> Live
              </span>
            ) : (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Replay
              </span>
            )}
            <h3 className="truncate font-semibold">{stream.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {stream.aff} <span className="text-blue-600 dark:text-blue-400">Aff</span> vs {stream.neg}{" "}
            <span className="text-red-600 dark:text-red-400">Neg</span>
          </p>
          <p className="mt-1 text-sm" aria-live="polite">{statusLine}</p>
        </div>
        {behindLive && (
          <button
            type="button"
            onClick={radio.goLive}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
          >
            <SkipForward className="h-3.5 w-3.5" /> Go live
          </button>
        )}
      </div>

      {chapters.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Speeches">
          {chapters.map((chapter) => (
            <button
              key={chapter.seq}
              type="button"
              onClick={() => radio.jumpTo(chapter.seq)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium hover:bg-muted",
                playback.speech === chapter.speech && isPlaying && "border-primary bg-primary/10",
              )}
            >
              {chapter.speech}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
