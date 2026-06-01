"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import grab from "grab-url"
import type { SpeechTimerState } from "@/components/debate/DebateTimer/types"

interface UseSpeechRecorderOptions {
  /** Timer state — recording starts/stops in sync with this */
  timerState: SpeechTimerState["state"]
  /** Name of the current speech (used as localStorage key) */
  currentSpeechName: string
  /** Display label for the recording (falls back to currentSpeechName) */
  speechLabel?: string
  /** Controlled mic device ID */
  micDeviceId?: string
  /** Callback when mic device changes */
  onMicDeviceIdChange?: (id: string | undefined) => void
  /** Controlled recording-enabled state */
  recordingEnabled?: boolean
  /** Callback when recording-enabled changes */
  onRecordingEnabledChange?: (enabled: boolean) => void
}

/**
 * Decode a Blob into an AudioBuffer using a temporary AudioContext.
 */
async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new AudioContext()
  try {
    return await ctx.decodeAudioData(arrayBuffer)
  } finally {
    void ctx.close()
  }
}

/**
 * Concatenate two AudioBuffers sequentially using OfflineAudioContext,
 * then re-encode the result into a valid WebM blob via MediaRecorder.
 */
async function mergeAudioBlobs(existing: Blob, newSegment: Blob): Promise<{ blob: Blob; durationSeconds: number }> {
  const [buf1, buf2] = await Promise.all([decodeBlob(existing), decodeBlob(newSegment)])
  const sampleRate = buf1.sampleRate
  const channels = Math.max(buf1.numberOfChannels, buf2.numberOfChannels)
  const totalLength = buf1.length + buf2.length
  const totalDuration = buf1.duration + buf2.duration

  const offline = new OfflineAudioContext(channels, totalLength, sampleRate)
  const src1 = offline.createBufferSource()
  src1.buffer = buf1
  src1.connect(offline.destination)
  src1.start(0)
  const src2 = offline.createBufferSource()
  src2.buffer = buf2
  src2.connect(offline.destination)
  src2.start(buf1.duration)
  const rendered = await offline.startRendering()

  const blob = await new Promise<Blob>((resolve) => {
    const liveCtx = new AudioContext({ sampleRate })
    const dest = liveCtx.createMediaStreamDestination()
    const src = liveCtx.createBufferSource()
    src.buffer = rendered
    src.connect(dest)
    const outChunks: Blob[] = []
    const recorder = new MediaRecorder(dest.stream)
    recorder.ondataavailable = (e) => { if (e.data.size > 0) outChunks.push(e.data) }
    recorder.onstop = () => {
      void liveCtx.close()
      resolve(new Blob(outChunks, { type: "audio/webm" }))
    }
    recorder.start()
    src.start()
    src.onended = () => recorder.stop()
  })
  return { blob, durationSeconds: totalDuration }
}

export function useSpeechRecorder({
  timerState,
  currentSpeechName,
  speechLabel,
  micDeviceId: controlledMicDeviceId,
  onMicDeviceIdChange,
  recordingEnabled: controlledRecordingEnabled,
  onRecordingEnabledChange,
}: UseSpeechRecorderOptions) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])

  // Internal state (used when not controlled externally)
  const [internalRecordingEnabled, setInternalRecordingEnabled] = useState(false)
  const [, setIsActivelyRecording] = useState(false)
  const [internalMicDeviceId, setInternalMicDeviceId] = useState<string | undefined>(undefined)

  // Effective values: use controlled props if provided, otherwise fall back to internal state
  const isRecordingEnabled = controlledRecordingEnabled !== undefined ? controlledRecordingEnabled : internalRecordingEnabled
  const selectedMicDeviceId = controlledMicDeviceId !== undefined ? controlledMicDeviceId : internalMicDeviceId

  const setIsRecordingEnabled = (val: boolean) => {
    if (controlledRecordingEnabled === undefined) setInternalRecordingEnabled(val)
    onRecordingEnabledChange?.(val)
  }
  const setSelectedMicDeviceId = (id: string | undefined) => {
    if (controlledMicDeviceId === undefined) setInternalMicDeviceId(id)
    onMicDeviceIdChange?.(id)
  }

  /**
   * Save a new segment to localStorage, merging it with any existing
   * recording for this speech using proper audio decoding + re-encoding.
   */
  const saveRecordingToLocalStorage = useCallback((
    chunks: Blob[],
    speechName: string,
    label: string,
  ) => {
    if (chunks.length === 0) return
    const newSegmentBlob = new Blob(chunks, { type: "audio/webm" })
    const key = `debate-recording-${speechName}`

    const persist = (finalBlob: Blob, durationSeconds?: number) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        try {
          localStorage.setItem(key, JSON.stringify({
            speechName,
            speechLabel: label,
            recordedAt: new Date().toISOString(),
            audio: reader.result as string,
            durationSeconds,
          }))
          window.dispatchEvent(new Event("debate-recording-saved"))
        } catch (e) {
          console.warn("Could not save recording to localStorage:", e)
        }
      }
      reader.readAsDataURL(finalBlob)
    }

    const existingRaw = localStorage.getItem(key)
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as { audio: string }
        grab(existing.audio)
          .then((result) => result.data)
          .then((existingBlob) => mergeAudioBlobs(existingBlob, newSegmentBlob))
          .then(({ blob, durationSeconds }) => persist(blob, durationSeconds))
          .catch((err) => {
            console.warn("Merge failed, saving segment only:", err)
            decodeBlob(newSegmentBlob)
              .then((buf) => persist(newSegmentBlob, buf.duration))
              .catch(() => persist(newSegmentBlob))
          })
      } catch {
        persist(newSegmentBlob)
      }
    } else {
      decodeBlob(newSegmentBlob)
        .then((buf) => persist(newSegmentBlob, buf.duration))
        .catch(() => persist(newSegmentBlob))
    }
  }, [])

  /**
   * Start microphone recording.
   */
  const startRecording = useCallback(async () => {
    try {
      recordedChunksRef.current = []
      const constraints: MediaStreamConstraints = {
        audio: selectedMicDeviceId ? { deviceId: { exact: selectedMicDeviceId } } : true,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data)
        }
      }
      mr.onstop = () => {
        const label = speechLabel ?? currentSpeechName
        saveRecordingToLocalStorage(recordedChunksRef.current, currentSpeechName, label)
        stream.getTracks().forEach((t) => t.stop())
        setIsActivelyRecording(false)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setIsActivelyRecording(true)
      window.dispatchEvent(
        new CustomEvent("debate-recording-started", { detail: { speechName: currentSpeechName } })
      )
    } catch (err) {
      console.warn("Microphone access denied or unavailable:", err)
    }
  }, [currentSpeechName, speechLabel, selectedMicDeviceId, saveRecordingToLocalStorage])

  /**
   * Stop microphone recording.
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
  }, [])

  /** Sync recording with timer state */
  useEffect(() => {
    if (!isRecordingEnabled) {
      stopRecording()
      return
    }
    if (timerState.name === "running") {
      startRecording()
    } else {
      stopRecording()
    }
  }, [timerState.name, isRecordingEnabled, startRecording, stopRecording])

  return {
    isRecordingEnabled,
    setIsRecordingEnabled,
    selectedMicDeviceId,
    setSelectedMicDeviceId,
  }
}
