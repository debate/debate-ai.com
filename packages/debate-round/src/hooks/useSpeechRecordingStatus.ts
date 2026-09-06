/**
 * @fileoverview Tracks whether a saved recording exists for a speech (and its
 * duration), reading from the same `debate-recording-<speech>` localStorage
 * entries that `SpeechRecordingPlayer` writes, and refreshing whenever a
 * recording is saved anywhere in the app.
 *
 * @module hooks/useSpeechRecordingStatus
 */

"use client"

import { useCallback, useEffect, useState } from "react"

function getRecordingDurationSeconds(speechName: string): number | null {
  try {
    const raw = localStorage.getItem(`debate-recording-${speechName}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { durationSeconds?: number }
    return parsed.durationSeconds ?? null
  } catch {
    return null
  }
}

export function useSpeechRecordingStatus(speechName: string) {
  const [recordingDurationSec, setRecordingDurationSec] = useState<number | null>(() =>
    typeof window !== "undefined" ? getRecordingDurationSeconds(speechName) : null
  )
  const [hasRecording, setHasRecording] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(`debate-recording-${speechName}`) !== null
  })

  useEffect(() => {
    const refresh = () => {
      setRecordingDurationSec(getRecordingDurationSeconds(speechName))
      setHasRecording(localStorage.getItem(`debate-recording-${speechName}`) !== null)
    }
    refresh()
    window.addEventListener("debate-recording-saved", refresh)
    return () => window.removeEventListener("debate-recording-saved", refresh)
  }, [speechName])

  const deleteRecording = useCallback((key: string) => {
    localStorage.removeItem(key)
    setHasRecording(false)
    setRecordingDurationSec(null)
    window.dispatchEvent(new CustomEvent("debate-recording-saved"))
  }, [])

  return { hasRecording, recordingDurationSec, deleteRecording }
}
