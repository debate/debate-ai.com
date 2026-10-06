/**
 * @fileoverview Turns a spoken transcript into timed caption words for the
 * captions ticker (`recorder/SpeechCaptionsTicker.tsx`).
 *
 * The browser's speech recognition only reports when a stretch of speech
 * ends, not per-word times, so each recognized segment's words are spread
 * across that segment's start–end window, weighted by word length. A
 * transcript saved before segment timings were kept is spread across the
 * whole recording instead.
 *
 * @module recorder/speech-captions
 */

import type { SpokenTranscript } from "./spoken-words-store"

/** One caption word and the slice of the recording it covers, in seconds. */
export interface CaptionWord {
  word: string
  start: number
  end: number
}

function spread(text: string, start: number, end: number): CaptionWord[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const span = Math.max(0, end - start)
  // +1 per word stands in for the gap between words.
  const total = words.reduce((n, w) => n + w.length + 1, 0)
  let at = start
  return words.map((word) => {
    const length = (span * (word.length + 1)) / total
    const out = { word, start: at, end: at + length }
    at += length
    return out
  })
}

/**
 * Timed caption words for a transcript.
 *
 * @param transcript - The speech's saved transcript, if any.
 * @param durationSeconds - The recording's length, used when the transcript
 *   has no segment timings. Without either, every word starts at 0.
 */
export function buildCaptionWords(
  transcript: Pick<SpokenTranscript, "text" | "segments"> | null | undefined,
  durationSeconds?: number,
): CaptionWord[] {
  if (!transcript) return []
  if (transcript.segments?.length) {
    return transcript.segments.flatMap((s) => spread(s.text, s.start, s.end))
  }
  return spread(transcript.text, 0, durationSeconds && Number.isFinite(durationSeconds) ? durationSeconds : 0)
}

/**
 * Index of the word being spoken at `time` — the last word starting at or
 * before it — or -1 before the first word.
 */
export function activeCaptionIndex(words: readonly CaptionWord[], time: number): number {
  let lo = 0
  let hi = words.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (words[mid].start <= time) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}
