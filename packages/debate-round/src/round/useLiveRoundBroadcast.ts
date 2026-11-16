/**
 * @fileoverview Puts the speaker on air in a live-streamed round.
 *
 * Follows the speech recorder: when `@debate-ai/timer`'s `useSpeechRecorder`
 * announces a speech started (`debate-recording-started`, fired as the speech
 * timer starts with recording on), this opens the mic a second time and
 * records it as short self-contained segments, uploading each to
 * `/api/live-rounds` in order. It stops with the recorder
 * (`RECORDING_STOPPED_EVENT`). Prep time, cross-ex between timers and silence
 * between speeches are never sent — only the speeches themselves — so the
 * stream is the round's speeches back to back, like radio.
 *
 * The round is live when its local copy has **Live stream** on, or — for
 * participants whose copy doesn't carry the flag (they joined from an invite)
 * — when the server says its stream is live. Who broadcasts which speech is
 * decided by {@link shouldBroadcastSpeech}.
 *
 * @module round/useLiveRoundBroadcast
 */

"use client"

import { useEffect, useRef, useState } from "react"
import {
  LIVE_AUDIO_BITS_PER_SECOND,
  SegmentUploadQueue,
  SegmentedRecorder,
  type SegmentRecorderLike,
  fetchLiveRound,
  liveStreamIdForSlug,
  pickLiveMimeType,
  registerLiveRound,
  uploadLiveSegment,
} from "@debate-ai/timer/src/recorder/live-radio"
import { RECORDING_STOPPED_EVENT } from "@debate-ai/timer/src/hooks/useSpeechRecorder"
import type { TimerSpeech } from "@debate-ai/timer/src/types"
import type { Round } from "../types/flow"
import { inferRoomSeat } from "../webcam/room-seat"
import { liveRegistrationForRound, shouldBroadcastSpeech } from "./live-broadcast"

export interface UseLiveRoundBroadcastOptions {
  round: Round | null | undefined
  viewerEmails: readonly (string | null | undefined)[]
  viewerName?: string | null
  /** The round format's speeches, for who gives each one. */
  speeches: readonly TimerSpeech[]
}

export interface LiveRoundBroadcastState {
  /** The round's stream id, when it has a slug. */
  streamId: string | null
  /** Whether the round is live streamed (locally switched on, or live on the server). */
  enabled: boolean
  /** The speech this browser is broadcasting right now, or null. */
  onAirSpeech: string | null
}

interface ActiveBroadcast {
  speech: string
  stream: MediaStream | null
  recorder: SegmentedRecorder | null
}

/** Asks the server whether a stream is live; segments are skipped (`after` past any real seq). */
async function isStreamLive(id: string): Promise<boolean> {
  const detail = await fetchLiveRound(id, Number.MAX_SAFE_INTEGER)
  return detail?.stream.status === "live"
}

export function useLiveRoundBroadcast({
  round,
  viewerEmails,
  viewerName,
  speeches,
}: UseLiveRoundBroadcastOptions): LiveRoundBroadcastState {
  const streamId = liveStreamIdForSlug(round?.slug)
  const localOn = !!round?.liveStream
  const [serverLive, setServerLive] = useState(false)
  const [onAirSpeech, setOnAirSpeech] = useState<string | null>(null)

  // The event handlers read the latest values through refs, so the listeners
  // are attached once per stream rather than on every render.
  const latest = useRef({ round, viewerEmails, viewerName, speeches, localOn })
  latest.current = { round, viewerEmails, viewerName, speeches, localOn }
  const active = useRef<ActiveBroadcast | null>(null)

  // Learn whether an invitee's round is live, and make sure a round switched on
  // here has its stream on the server (idempotent).
  useEffect(() => {
    setServerLive(false)
    if (!streamId) return
    let cancelled = false
    const current = latest.current.round
    if (localOn && current) {
      const registration = liveRegistrationForRound(current, true)
      if (registration) void registerLiveRound(registration).then((id) => { if (!cancelled && id) setServerLive(true) })
    } else {
      void isStreamLive(streamId).then((live) => { if (!cancelled) setServerLive(live) })
    }
    return () => { cancelled = true }
  }, [streamId, localOn])

  useEffect(() => {
    if (!streamId || typeof window === "undefined") return
    const queue = new SegmentUploadQueue((segment) => uploadLiveSegment(streamId, segment).then(() => undefined))

    const stop = () => {
      const broadcast = active.current
      active.current = null
      setOnAirSpeech(null)
      if (!broadcast) return
      broadcast.recorder?.stop()
      // Let the last recorder flush its file before the mic is released.
      const stream = broadcast.stream
      if (stream) setTimeout(() => stream.getTracks().forEach((track) => track.stop()), 500)
    }

    const start = async (speech: string) => {
      stop()
      const broadcast: ActiveBroadcast = { speech, stream: null, recorder: null }
      active.current = broadcast
      const { round: currentRound, viewerEmails: emails, viewerName: name, speeches: format, localOn: on } = latest.current
      if (!currentRound) return void (active.current = null)
      const live = on || (await isStreamLive(streamId))
      if (active.current !== broadcast) return
      if (!live) return void (active.current = null)
      const seat = inferRoomSeat(currentRound, emails, name)
      if (!shouldBroadcastSpeech(currentRound, seat, speech, format)) return void (active.current = null)
      if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return void (active.current = null)

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      } catch (error) {
        console.warn("Live stream: microphone unavailable", error)
        if (active.current === broadcast) active.current = null
        return
      }
      if (active.current !== broadcast) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const mimeType = pickLiveMimeType((type) => MediaRecorder.isTypeSupported(type))
      broadcast.stream = stream
      broadcast.recorder = new SegmentedRecorder({
        // MediaRecorder's handlers take a BlobEvent; the segmenter only reads `data`.
        createRecorder: () =>
          new MediaRecorder(stream, {
            ...(mimeType ? { mimeType } : {}),
            audioBitsPerSecond: LIVE_AUDIO_BITS_PER_SECOND,
          }) as unknown as SegmentRecorderLike,
        onSegment: (segment) => void queue.push({ ...segment, speech }),
      })
      broadcast.recorder.start()
      setServerLive(true)
      setOnAirSpeech(speech)
    }

    const onStarted = (event: Event) => {
      const speech = (event as CustomEvent<{ speechName?: string }>).detail?.speechName
      if (speech) void start(speech)
    }
    const onStopped = () => stop()

    window.addEventListener("debate-recording-started", onStarted)
    window.addEventListener(RECORDING_STOPPED_EVENT, onStopped)
    return () => {
      window.removeEventListener("debate-recording-started", onStarted)
      window.removeEventListener(RECORDING_STOPPED_EVENT, onStopped)
      stop()
    }
  }, [streamId])

  return { streamId, enabled: localOn || serverLive, onAirSpeech }
}
