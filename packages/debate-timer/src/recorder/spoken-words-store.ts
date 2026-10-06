/**
 * @fileoverview What a debater actually said in each speech, as transcribed
 * by the browser's speech recognition while the speech timer records (see
 * `hooks/useSpeechRecorder.ts`). Stored beside the audio recording under
 * the same per-speech naming (`debate-spoken-{speechName}` next to
 * `debate-recording-{speechName}`), so the timer bar can compare "words
 * spoken" with the words read from the speech doc.
 *
 * Pure localStorage helpers; each write fires {@link SPOKEN_WORDS_EVENT} so
 * mounted widgets refresh without polling.
 *
 * @module recorder/spoken-words-store
 */

import { countWords } from "../formats/word-count-format"

export const SPOKEN_WORDS_EVENT = "debate-spoken-words-updated"

/** One recognized stretch of speech and where it falls in the recording. */
export interface SpokenSegment {
  text: string
  /** Seconds into the (merged) recording where the segment starts. */
  start: number
  /** Seconds into the recording where it was recognized as finished. */
  end: number
}

export interface SpokenTranscript {
  speechName: string
  /** Everything recognized so far, segments joined by spaces. */
  text: string
  wordCount: number
  updatedAt: string
  /** Timed segments, for captions — absent on transcripts saved before timings were kept. */
  segments?: SpokenSegment[]
}

export function spokenTranscriptKey(speechName: string): string {
  return `debate-spoken-${speechName}`
}

function storage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage
  } catch {
    return undefined
  }
}

function notify(speechName: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(SPOKEN_WORDS_EVENT, { detail: { speechName } }))
}

function isSegment(value: unknown): value is SpokenSegment {
  const v = value as SpokenSegment | null
  return !!v && typeof v.text === "string" && Number.isFinite(v.start) && Number.isFinite(v.end)
}

export function loadSpokenTranscript(speechName: string): SpokenTranscript | null {
  const raw = storage()?.getItem(spokenTranscriptKey(speechName))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SpokenTranscript>
    if (typeof parsed.text !== "string") return null
    return {
      speechName,
      text: parsed.text,
      wordCount: typeof parsed.wordCount === "number" ? parsed.wordCount : countWords(parsed.text),
      updatedAt: parsed.updatedAt ?? "",
      ...(Array.isArray(parsed.segments) ? { segments: parsed.segments.filter(isSegment) } : {}),
    }
  } catch {
    return null
  }
}

/** Words spoken in `speechName` so far, 0 when nothing was transcribed. */
export function loadSpokenWordCount(speechName: string): number {
  return loadSpokenTranscript(speechName)?.wordCount ?? 0
}

/**
 * Appends a recognized segment — a resumed recording keeps adding to the
 * same speech, matching how the audio recording is merged segment by segment.
 * When `timing` is given (seconds into the recording) the segment is also
 * kept with its times, which the captions ticker uses to sync words to audio.
 */
export function appendSpokenSegment(
  speechName: string,
  segment: string,
  timing?: { start: number; end: number },
): SpokenTranscript | null {
  const trimmed = segment.trim()
  if (!trimmed) return loadSpokenTranscript(speechName)
  const previous = loadSpokenTranscript(speechName)
  const text = previous?.text ? `${previous.text} ${trimmed}` : trimmed
  const next: SpokenTranscript = {
    speechName,
    text,
    wordCount: countWords(text),
    updatedAt: new Date().toISOString(),
  }
  if (timing || previous?.segments) {
    next.segments = [...(previous?.segments ?? [])]
    if (timing) next.segments.push({ text: trimmed, start: timing.start, end: Math.max(timing.start, timing.end) })
  }
  try {
    storage()?.setItem(spokenTranscriptKey(speechName), JSON.stringify(next))
  } catch (e) {
    console.warn("Could not save spoken transcript:", e)
    return previous
  }
  notify(speechName)
  return next
}

export function clearSpokenTranscript(speechName: string): void {
  storage()?.removeItem(spokenTranscriptKey(speechName))
  notify(speechName)
}
