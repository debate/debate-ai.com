/**
 * @fileoverview Records the user's screen during a speech, capturing exactly
 * one window the user chooses (not the whole screen). Starts when a speech's
 * recording starts and stops when it stops, mirroring the mic/webcam recorder
 * in `@debate-ai/timer`'s `useSpeechRecorder`. The chosen window stream is
 * saved as a clip keyed to the speech (`saveClip`).
 *
 * `navigator.mediaDevices.getDisplayMedia` requires a user gesture, so the
 * first capture is either attempted automatically when the speech starts or,
 * if the browser blocks it, triggered by the user clicking "Select window".
 *
 * @module webcam/useScreenRecorder
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { readRecordScreen, saveClip, writeRecordScreen, RECORD_SCREEN_EVENT } from "@debate-ai/timer"

const VIDEO_BITS_PER_SECOND = 500_000

interface ActiveScreenRecording {
  speechName: string
  recorder: MediaRecorder | null
  stream: MediaStream | null
  chunks: Blob[]
}

export function useScreenRecorder(currentSpeechName: string) {
  const [recordScreen, setRecordScreenState] = useState<boolean>(readRecordScreen())
  const [isScreenRecording, setIsScreenRecording] = useState(false)
  const [awaitingSelection, setAwaitingSelection] = useState(false)
  const activeRef = useRef<ActiveScreenRecording | null>(null)

  const stopActive = useCallback(() => {
    const active = activeRef.current
    activeRef.current = null
    if (active?.recorder && active.recorder.state !== "inactive") active.recorder.stop()
    active?.stream?.getTracks().forEach((t) => t.stop())
    setIsScreenRecording(false)
    setAwaitingSelection(false)
  }, [])

  const setRecordScreen = useCallback(
    (on: boolean) => {
      setRecordScreenState(on)
      writeRecordScreen(on)
      if (!on) stopActive()
    },
    [stopActive],
  )

  const startCapture = useCallback(
    async (stream: MediaStream, speechName: string): Promise<void> => {
      const chunks: Blob[] = []
      const recorder = new MediaRecorder(stream, { videoBitsPerSecond: VIDEO_BITS_PER_SECOND })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = async () => {
        if (chunks.length) {
          try {
            await saveClip(speechName, "Screen", new Blob(chunks, { type: recorder.mimeType || "video/webm" }))
          } catch {
            // IndexedDB unavailable; clip not persisted this session.
          }
        }
        if (activeRef.current === active) {
          activeRef.current = null
          setIsScreenRecording(false)
        }
        stream.getTracks().forEach((t) => t.stop())
      }
      const active: ActiveScreenRecording = { speechName, recorder, stream, chunks }
      activeRef.current = active
      recorder.start(1000)
      setIsScreenRecording(true)
      setAwaitingSelection(false)
    },
    [saveClip],
  )

  const selectWindow = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setAwaitingSelection(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "window" } })
      await startCapture(stream, currentSpeechName)
    } catch {
      setAwaitingSelection(false)
    }
  }, [currentSpeechName, startCapture])

  const onScreenSettingChange = useCallback(() => setRecordScreenState(readRecordScreen()), [])

  const stopRecording = useCallback(() => {
    stopActive()
  }, [stopActive])

  useEffect(() => {
    const onStarted = async (e: Event) => {
      const detail = (e as CustomEvent<{ speechName: string; video?: boolean }>).detail
      if (!detail?.speechName) return
      if (!recordScreen) return
      const speechName = detail.speechName
      const active = activeRef.current
      // Already capturing a window for this speech; nothing to do.
      if (active && active.speechName === speechName && active.recorder?.state === "recording") return
      // Stop a previous speech's capture and start a fresh clip for this one.
      stopActive()
      try {
        const stream = await navigator.mediaDevices?.getDisplayMedia?.({ video: { displaySurface: "window" } })
        if (stream) await startCapture(stream, speechName)
      } catch {
        // getDisplayMedia needs a user gesture; let the user pick a window manually.
        setAwaitingSelection(true)
      }
    }
    const onStopped = (e: Event) => {
      const detail = (e as CustomEvent<{ speechName: string }>).detail
      if (detail?.speechName && activeRef.current && activeRef.current.speechName === detail.speechName) {
        stopActive()
      }
    }
    window.addEventListener("debate-recording-started", onStarted)
    window.addEventListener("debate-recording-stopped", onStopped)
    window.addEventListener(RECORD_SCREEN_EVENT, onScreenSettingChange)
    return () => {
      window.removeEventListener("debate-recording-started", onStarted)
      window.removeEventListener("debate-recording-stopped", onStopped)
      window.removeEventListener(RECORD_SCREEN_EVENT, onScreenSettingChange)
      stopActive()
    }
  }, [recordScreen, startCapture, stopActive, onScreenSettingChange])

  return {
    recordScreen,
    setRecordScreen,
    isScreenRecording,
    awaitingSelection,
    selectWindow,
    stopRecording,
  }
}
