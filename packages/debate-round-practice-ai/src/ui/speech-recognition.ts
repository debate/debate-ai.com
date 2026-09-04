/**
 * @fileoverview Minimal Web Speech API typings — the port of the upstream
 * `frontend/src/types/speech-recognition.d.ts`, narrowed to what the debate
 * room actually touches and kept as a module rather than an ambient
 * declaration so it does not leak into the host app's global scope.
 *
 * @module ui/speech-recognition
 */

export interface SpeechRecognitionAlternativeLike {
  transcript: string
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
}

export interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [index: number]: SpeechRecognitionResultLike }
}

export interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((event: Event & { error?: string }) => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

/**
 * Resolve the browser's SpeechRecognition constructor, prefixed or not.
 * Returns null when the API is unavailable, which is how the debate room
 * decides whether to render the mic button as usable.
 */
export function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}
