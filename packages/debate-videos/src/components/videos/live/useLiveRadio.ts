/**
 * @fileoverview React wrapper around {@link LiveRadioPlayer}: loads a live
 * round stream, polls for new segments while it's live, and exposes play /
 * pause / jump controls.
 *
 * @module components/videos/live/useLiveRadio
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { fetchLiveRound, type LiveRoundSummary, type LiveSegment } from "@debate-ai/timer/src/recorder/live-radio"
import { LiveRadioPlayer, type LiveRadioSnapshot } from "./live-radio-player"

/** How often a live stream is checked for new segments. */
export const LIVE_POLL_MS = 3_000

export interface LiveRadioState {
  stream: LiveRoundSummary | null
  segments: LiveSegment[]
  playback: LiveRadioSnapshot
  /** True until the first read answers. */
  loading: boolean
  /** Set when the stream can't be read (missing, private, offline). */
  error: string | null
  play: () => void
  pause: () => void
  jumpTo: (seq: number) => void
  goLive: () => void
}

export function useLiveRadio(streamId: string): LiveRadioState {
  const [stream, setStream] = useState<LiveRoundSummary | null>(null)
  const [segments, setSegments] = useState<LiveSegment[]>([])
  const [playback, setPlayback] = useState<LiveRadioSnapshot>({ state: "idle", seq: null, speech: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const playerRef = useRef<LiveRadioPlayer | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || typeof Audio === "undefined") return
    const player = new LiveRadioPlayer({ streamId, createAudio: () => new Audio(), onChange: setPlayback })
    playerRef.current = player
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastSeq = -1

    const poll = async () => {
      const detail = await fetchLiveRound(streamId, lastSeq)
      if (cancelled) return
      setLoading(false)
      if (!detail) {
        if (lastSeq < 0) {
          setError("This stream isn't available. It may be private or switched off.")
          return
        }
      } else {
        setError(null)
        setStream(detail.stream)
        player.setLive(detail.stream.status === "live")
        if (detail.segments.length > 0) {
          lastSeq = detail.segments[detail.segments.length - 1].seq
          player.addSegments(detail.segments)
          setSegments((prev) => {
            const known = new Set(prev.map((s) => s.seq))
            return [...prev, ...detail.segments.filter((s) => !known.has(s.seq))]
          })
        }
        if (detail.stream.status !== "live") return
      }
      timer = setTimeout(poll, LIVE_POLL_MS)
    }
    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      player.destroy()
      playerRef.current = null
    }
  }, [streamId])

  const play = useCallback(() => playerRef.current?.play(), [])
  const pause = useCallback(() => playerRef.current?.pause(), [])
  const jumpTo = useCallback((seq: number) => playerRef.current?.jumpTo(seq), [])
  const goLive = useCallback(() => playerRef.current?.goLive(), [])

  return { stream, segments, playback, loading, error, play, pause, jumpTo, goLive }
}
