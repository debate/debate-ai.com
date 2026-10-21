/**
 * @fileoverview Shared types/helpers for rendering a synced video transcript.
 *
 * YouTube's caption tracks are cut for on-screen display, not for reading: a
 * cue runs a couple of seconds and breaks mid-clause ("powers aligning with
 * each other to" / "balance between United States and China."). Rendered one
 * cue per row next to a timestamp, a transcript reads as a column of
 * fragments, so the UI regroups the cues into sentences first.
 */

/** One timed caption cue (or, after grouping, one timed sentence). */
export interface TranscriptSnippet {
  text: string
  start: number
  duration: number
}

/** A word ending a sentence, allowing a trailing quote or bracket. */
const SENTENCE_END = /[.!?…]["')\]]*$/

/**
 * Words that end in a period without ending a sentence: single-letter
 * initials, dotted initialisms ("U.S."), and the common title/abbreviation
 * set. Without this, "the U.S. and China" becomes two "sentences".
 */
const ABBREVIATION = /^(?:[A-Za-z]\.)+$|^(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|no|fig|approx|e\.g|i\.e)\.$/i

/**
 * Auto-generated captions frequently carry no punctuation at all, which would
 * make the whole video one unreadable sentence. A run that never terminates
 * is broken at a word boundary once it reaches this many characters.
 */
const MAX_SENTENCE_CHARS = 220

/**
 * Regroups caption cues into sentences.
 *
 * Each returned entry keeps the `{ text, start, duration }` shape of the cues
 * going in — `start` is when the sentence's first word is spoken and
 * `duration` runs to the end of its last word — so click-to-seek and the
 * active-line highlight work on sentences unchanged.
 */
export function groupIntoSentences(snippets: TranscriptSnippet[]): TranscriptSnippet[] {
  const sentences: TranscriptSnippet[] = []

  let words: string[] = []
  let chars = 0
  let start = 0
  let end = 0

  const flush = () => {
    if (words.length === 0) return
    sentences.push({ text: words.join(" "), start, duration: Math.max(0, end - start) })
    words = []
    chars = 0
  }

  for (const snippet of snippets) {
    const cueWords = snippet.text.split(/\s+/).filter(Boolean)
    if (cueWords.length === 0) continue

    // Words don't carry their own timestamps, so spread the cue's duration
    // evenly across them — that way a sentence boundary falling mid-cue still
    // gets a start time close to when it is actually spoken.
    const perWord = snippet.duration > 0 ? snippet.duration / cueWords.length : 0

    cueWords.forEach((word, index) => {
      if (words.length === 0) start = snippet.start + perWord * index
      words.push(word)
      chars += word.length + 1
      end = snippet.start + perWord * (index + 1)

      const endsSentence = SENTENCE_END.test(word) && !ABBREVIATION.test(word)
      if (endsSentence || chars >= MAX_SENTENCE_CHARS) flush()
    })
  }

  flush()
  return sentences
}

/** One piece of text, with whether it's a search match to highlight. */
export interface TextMatchSegment {
  text: string
  matched: boolean
}

/**
 * Splits `text` around every case-insensitive occurrence of `needle`, so a
 * caller can wrap the matched segments (e.g. in `<mark>`) without touching
 * the rest of the text. An empty or whitespace-only `needle` — nothing
 * typed, or a search box just cleared — returns the whole text unmatched
 * rather than matching every position.
 */
export function splitOnMatch(text: string, needle: string): TextMatchSegment[] {
  const trimmed = needle.trim()
  if (!trimmed) return [{ text, matched: false }]

  const pattern = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig")
  const segments: TextMatchSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), matched: false })
    }
    segments.push({ text: match[0], matched: true })
    lastIndex = match.index + match[0].length
    // A zero-length needle can't happen (guarded above), so no infinite-loop guard is needed here.
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), matched: false })
  }

  return segments.length > 0 ? segments : [{ text, matched: false }]
}
