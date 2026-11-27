/**
 * @file voice-read-words.ts
 * @description Word-level helpers for the Voice reader (`voice-read-button.tsx`):
 * which word is being spoken (`activeWordIndex`), where a sentence begins
 * (`sentenceStart`), and which word a click landed on (`locateWord`).
 *
 * The speech engines give a whole clip with no per-word timing, so the active
 * word is estimated: each word takes time in proportion to its length, plus a
 * pause after commas and sentence ends.
 */
import type { VoiceBlock } from "./voice-read-text"

/** Words that end in a period without ending a sentence. */
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "cf", "no", "fig", "figs", "eq", "inc", "ltd", "co", "al", "approx", "ch", "sec", "vol", "pp", "ed", "eds",
])

/** A sentence-ending mark, then any closing quotes or brackets. */
const SENTENCE_END = /[.!?…]["'”’)\]]*$/

/** True when `word` is the last word of a sentence. */
export function endsSentence(word: string): boolean {
  if (!SENTENCE_END.test(word)) return false
  const bare = word.replace(/["'”’)\]]+$/, "")
  if (!/[?!…]$/.test(bare)) {
    // "U.S.", "e.g.", "J." and "Dr." end in a period without ending the sentence.
    if (/^(?:\p{L}\.)+$/u.test(bare)) return false
    if (ABBREVIATIONS.has(bare.replace(/\.$/, "").toLowerCase())) return false
  }
  return true
}

/** Index of the word that starts the sentence holding word `index`. */
export function sentenceStart(words: readonly string[], index: number): number {
  for (let i = Math.min(index, words.length) - 1; i >= 0; i--) {
    if (endsSentence(words[i]!)) return i + 1
  }
  return 0
}

/** Relative time a word takes to say. */
function weight(word: string): number {
  const base = 2 + word.replace(/[^\p{L}\p{N}]/gu, "").length
  if (/[.!?…]["'”’)\]]*$/.test(word)) return base + 6
  if (/[,;:—–]["'”’)\]]*$/.test(word)) return base + 3
  return base
}

/** Index of the word being spoken when `fraction` (0 to 1) of the clip `words` has played. */
export function activeWordIndex(words: readonly string[], fraction: number): number {
  if (words.length <= 1) return 0
  const weights = words.map(weight)
  const total = weights.reduce((sum, w) => sum + w, 0)
  const target = Math.min(1, Math.max(0, fraction)) * total
  let seen = 0
  for (let i = 0; i < weights.length; i++) {
    seen += weights[i]!
    if (target < seen) return i
  }
  return words.length - 1
}

/** Index of the word whose end is at or after `charIndex` in `words` joined by spaces. */
export function wordAtCharacter(words: readonly string[], charIndex: number): number {
  let end = 0
  for (let i = 0; i < words.length; i++) {
    end += words[i]!.length
    if (charIndex <= end) return i
    end += 1
  }
  return Math.max(0, words.length - 1)
}

/** A place in the read passages: block `block`, word `word` of that block. */
export interface WordLocation {
  block: number
  word: number
}

/**
 * The first word at or after the page point (`node`, `offset`), or null when
 * the point is past the last word (a click below the text).
 */
export function locateWord(blocks: readonly VoiceBlock[], node: Node, offset: number): WordLocation | null {
  const range = node.ownerDocument?.createRange()
  if (!range) return null
  for (let b = 0; b < blocks.length; b++) {
    const { words, element } = blocks[b]!
    const last = words.at(-1)
    // Skip whole passages that end before the point.
    if (last?.end?.node.isConnected) {
      try {
        range.setStart(last.end.node, last.end.offset)
        range.setEnd(last.end.node, last.end.offset)
        if (range.comparePoint(node, offset) > 0) continue
      } catch {
        continue
      }
    } else if (!element.isConnected) {
      continue
    }
    for (let w = 0; w < words.length; w++) {
      const { start, end } = words[w]!
      if (!start || !end || !start.node.isConnected || !end.node.isConnected) continue
      try {
        range.setStart(start.node, start.offset)
        range.setEnd(end.node, end.offset)
        if (range.comparePoint(node, offset) <= 0) return { block: b, word: w }
      } catch {
        continue
      }
    }
  }
  return null
}
