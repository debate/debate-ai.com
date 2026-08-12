/**
 * @fileoverview Word-count-based speech formats: practice and asynchronous
 * debate rounds where a speech is bounded by a maximum word count instead of
 * a time limit. Speech order and side/column layout reuse `DebateStyleFlow`
 * from ../types so this stays consistent with the timed formats in
 * `debate-format-times.ts`.
 */

import type { DebateStyleFlow } from "../types";

export type WordCountSpeech = {
  name: string;
  wordLimit: number;
  secondary: boolean;
  speaker?: string;
};

export type WordCountStyle = {
  primary: DebateStyleFlow;
  secondary?: DebateStyleFlow;
  speeches: WordCountSpeech[];
};

export const wordCountStyleMap = ["practicePublicForum"] as const;

export const wordCountStyleNames = ["Public Forum (Word Count)"];

export type WordCountStyleKey = (typeof wordCountStyleMap)[number];

/** Average speaking pace used to derive word limits from timed speech lengths. */
export const DEFAULT_WORDS_PER_MINUTE = 150;

/**
 * Converts a timed speech length into a comparable word limit, so a
 * word-count format can mirror an existing timed format's speech order.
 */
export function estimateWordLimit(
  minutes: number,
  wordsPerMinute: number = DEFAULT_WORDS_PER_MINUTE,
): number {
  return Math.round(minutes * wordsPerMinute);
}

export const wordCountStyles: {
  [key in WordCountStyleKey]: WordCountStyle;
} = {
  practicePublicForum: {
    primary: {
      name: "aff",
      columns: ["AC", "NC", "AR", "NR", "AS", "NS", "AFF", "NFF"],
      invert: false,
    },
    secondary: {
      name: "neg",
      columns: ["NC", "AR", "NR", "AS", "NS", "AFF", "NFF"],
      invert: true,
    },
    speeches: [
      { name: "AC", wordLimit: estimateWordLimit(4), secondary: false, speaker: "A1" },
      { name: "NC", wordLimit: estimateWordLimit(4), secondary: true, speaker: "N1" },
      { name: "AR", wordLimit: estimateWordLimit(4), secondary: false, speaker: "A1" },
      { name: "NR", wordLimit: estimateWordLimit(4), secondary: true, speaker: "N1" },
      { name: "AS", wordLimit: estimateWordLimit(3), secondary: false, speaker: "A2" },
      { name: "NS", wordLimit: estimateWordLimit(3), secondary: true, speaker: "N2" },
      { name: "AFF", wordLimit: estimateWordLimit(2), secondary: false, speaker: "A1" },
      { name: "NFF", wordLimit: estimateWordLimit(2), secondary: true, speaker: "N1" },
    ],
  },
};

export type WordCountStatus = {
  /** Number of words counted in the submitted text. */
  count: number;
  /** Words remaining before the limit is reached; negative once over. */
  remaining: number;
  /** `count / limit` clamped to `[0, 1]`, for progress display. */
  percentUsed: number;
  overLimit: boolean;
};

/**
 * Counts words by splitting on runs of whitespace. Punctuation-only tokens
 * still count as a word, matching how word processors count them.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/** Computes limit status for a submission, given a word-count limit. */
export function getWordCountStatus(text: string, wordLimit: number): WordCountStatus {
  const count = countWords(text);
  const remaining = wordLimit - count;
  const percentUsed = wordLimit > 0 ? Math.min(1, Math.max(0, count / wordLimit)) : 0;
  return {
    count,
    remaining,
    percentUsed,
    overLimit: count > wordLimit,
  };
}
