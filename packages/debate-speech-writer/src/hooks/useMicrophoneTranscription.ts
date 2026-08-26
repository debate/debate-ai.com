/**
 * @fileoverview React wiring for `coach/microphone-transcription.ts` — see
 * that module's file doc for the idea #8 ("Video-Lecture-Training Coach AI")
 * follow-up this closes.
 *
 * Instantiates the browser's real `SpeechRecognition`/`webkitSpeechRecognition`
 * API. Like every other browser-API hook in this repo (e.g.
 * `debate-round/src/hooks/useMicrophoneTranscription.ts`, which this mirrors),
 * this file is untested wiring — the feature-detection, text-joining, and
 * error-message logic it calls into lives in `coach/microphone-transcription.ts`
 * and is Vitest covered there instead.
 *
 * @module hooks/useMicrophoneTranscription
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  describeMicrophoneTranscriptionError,
  getSpeechRecognitionConstructor,
  isMicrophoneTranscriptionSupported,
  type SpeechRecognitionErrorCode,
} from "../coach/microphone-transcription"

/** Minimal shape of the Web Speech API this hook needs — not in `lib.dom.d.ts`. */
interface SpeechRecognitionResultLike {
  0: { transcript: string }
  isFinal: boolean
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionErrorEventLike {
  error: SpeechRecognitionErrorCode
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike

export interface UseMicrophoneTranscriptionOptions {
  /** Called with each finalized dictated segment (not interim/in-progress text). */
  onSegment: (segment: string) => void
  /** BCP-47 language tag passed to `SpeechRecognition.lang`. */
  lang?: string
}

/**
 * Wraps the browser's native speech-to-text API for a "record with your
 * microphone" control. `isSupported` reflects real feature detection (SSR and
 * unsupported browsers both report `false` rather than throwing on `start`).
 */
export function useMicrophoneTranscription({
  onSegment,
  lang = "en-US",
}: UseMicrophoneTranscriptionOptions) {
  const host = typeof window === "undefined" ? undefined : window
  const isSupported = isMicrophoneTranscriptionSupported(host)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onSegmentRef = useRef(onSegment)
  onSegmentRef.current = onSegment

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (!isSupported) return
    setError(null)
    const Constructor = getSpeechRecognitionConstructor(host) as SpeechRecognitionConstructorLike
    const recognition = new Constructor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          onSegmentRef.current(result[0].transcript)
        }
      }
    }
    recognition.onerror = (event) => {
      setError(describeMicrophoneTranscriptionError(event.error))
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
    }
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [host, isSupported, lang])

  // Stop recognition on unmount so a closed panel doesn't keep the mic hot.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  return { isSupported, isListening, start, stop, error }
}
