/**
 * @fileoverview Records every other debater's camera in the webcam room, one
 * clip per person per speech, while the speech timer records with "Record
 * webcam video" on. The clips are spliced into the joined round recording
 * under the speech they belong to (`@debate-ai/timer`'s `RoundRecordingDialog`),
 * each debater's video kept separate.
 *
 * Follows the recorder's own start/stop events, so nothing is captured that
 * the timer isn't already recording, and only streams the room is already
 * receiving are used — no extra camera is opened.
 *
 * @module webcam/useRoomSpeechRecorder
 */

"use client"

import { useEffect, useRef } from "react"
import { RECORDING_STOPPED_EVENT, saveClip } from "@debate-ai/timer"
import type { RemoteParticipant } from "./useWebcamRoom"

const VIDEO_BITS_PER_SECOND = 500_000

interface ActiveRecording {
  speechName: string
  recorders: Map<string, MediaRecorder>
}

function recordStream(stream: MediaStream, onDone: (blob: Blob) => void): MediaRecorder | null {
  if (stream.getVideoTracks().length === 0 || typeof MediaRecorder === "undefined") return null
  try {
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream, { videoBitsPerSecond: VIDEO_BITS_PER_SECOND })
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => { if (chunks.length) onDone(new Blob(chunks, { type: recorder.mimeType || "video/webm" })) }
    recorder.start(1000)
    return recorder
  } catch {
    return null
  }
}

export function useRoomSpeechRecorder(participants: RemoteParticipant[]) {
  const activeRef = useRef<ActiveRecording | null>(null)
  const participantsRef = useRef(participants)
  participantsRef.current = participants

  const startFor = (active: ActiveRecording, p: RemoteParticipant) => {
    if (!p.stream || active.recorders.has(p.id)) return
    const speechName = active.speechName
    const recorder = recordStream(p.stream, (blob) => void saveClip(speechName, p.name, blob))
    if (recorder) active.recorders.set(p.id, recorder)
  }

  useEffect(() => {
    const stopAll = () => {
      const active = activeRef.current
      activeRef.current = null
      active?.recorders.forEach((r) => { if (r.state !== "inactive") r.stop() })
    }
    const onStarted = (e: Event) => {
      const detail = (e as CustomEvent<{ speechName: string; video?: boolean }>).detail
      stopAll()
      if (!detail?.video) return
      const active: ActiveRecording = { speechName: detail.speechName, recorders: new Map() }
      activeRef.current = active
      participantsRef.current.forEach((p) => startFor(active, p))
    }
    window.addEventListener("debate-recording-started", onStarted)
    window.addEventListener(RECORDING_STOPPED_EVENT, stopAll)
    return () => {
      window.removeEventListener("debate-recording-started", onStarted)
      window.removeEventListener(RECORDING_STOPPED_EVENT, stopAll)
      stopAll()
    }
  }, [])

  // Someone who joins (or turns their camera on) mid-speech is recorded from then on.
  useEffect(() => {
    const active = activeRef.current
    if (active) participants.forEach((p) => startFor(active, p))
  }, [participants])
}
