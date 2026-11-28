/**
 * @file readability.ts
 * @description Readability score for a docs page's Doc Metrics panel
 * (`components/guides/page-info.tsx`): the Flesch Reading Ease formula used by
 * the Python `textstat` library, clamped to 0-100 and labelled with its band.
 *
 * Pure TypeScript with no dependencies, no network and no Node APIs, so it
 * runs unchanged on Cloudflare Workers (where the page's stats are computed)
 * and in the browser. Syllables are counted with a vowel-group heuristic
 * rather than a pronunciation dictionary, so the score can differ from
 * textstat's by a point or two.
 */

/** Below this many words the score is too noisy to show. */
export const MIN_WORDS = 10;

export interface Readability {
  words: number;
  sentences: number;
  syllables: number;
  /** Flesch Reading Ease (unclamped, one decimal), or null for too little text. */
  fleschReadingEase: number | null;
  /** Flesch Reading Ease clamped to 0-100 and rounded, or null for too little text. */
  score: number | null;
  /** The band `score` falls in (see {@link readabilityBand}). */
  band: ReadabilityBand | null;
}

export type ReadabilityBand =
  | 'Very easy'
  | 'Easy'
  | 'Fairly easy'
  | 'Standard'
  | 'Fairly difficult'
  | 'Difficult'
  | 'Very difficult';

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const ABBREVIATION = /\b(?:e\.g|i\.e|et al|etc|vs|cf|Mr|Mrs|Ms|Dr|Prof|St|No)\./g;
const SENTENCE_BREAK = /(?<=[.!?…]["'”’)\]]*)\s+|\n{2,}/;

/** Syllables in one word (heuristic: vowel groups, minus silent endings). */
export function countSyllables(word: string): number {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!letters) return /\d/.test(word) ? 1 : 0;
  if (letters.length <= 3) return 1;
  let stem = letters
    .replace(/(?:[^aeiouyl]|ll)es$/, (m) => m.slice(0, -2))
    .replace(/(?<=[^td])ed$/, '')
    .replace(/(?<=[^aeiouy])e$/, '')
    .replace(/[tscg]ion/g, 'on')
    .replace(/(?<=[cgst])ia(?=l|n)/g, 'a');
  if (!stem) stem = letters;
  let count = stem.match(/[aeiouy]+/g)?.length ?? 0;
  count += stem.match(/ia|io|iu|ua|uo/g)?.length ?? 0;
  count += /(?:[^aeiouy]|^)le$/.test(letters) ? 1 : 0;
  return Math.max(1, count);
}

/** Splits prose into sentences (paragraph breaks also end a sentence). */
function sentencesOf(text: string): string[] {
  return text
    .replace(ABBREVIATION, (m) => m.replace(/\./g, ''))
    .split(SENTENCE_BREAK)
    .filter((sentence) => /[\p{L}\p{N}]/u.test(sentence));
}

const round = (value: number, digits = 1) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

/** The label for a headline score (0-100). */
export function readabilityBand(score: number): ReadabilityBand {
  const value = Math.round(Math.min(100, Math.max(0, score)));
  if (value >= 90) return 'Very easy';
  if (value >= 80) return 'Easy';
  if (value >= 70) return 'Fairly easy';
  if (value >= 60) return 'Standard';
  if (value >= 50) return 'Fairly difficult';
  if (value >= 30) return 'Difficult';
  return 'Very difficult';
}

/**
 * Readability of some prose.
 *
 * The score is null when there are fewer than {@link MIN_WORDS} words, never NaN.
 *
 * @param text - Plain prose, without Markdown, citations or headings.
 */
export function readability(text: string): Readability {
  const sentences = sentencesOf(text);
  const words = text.match(WORD) ?? [];
  let syllables = 0;
  for (const word of words) syllables += countSyllables(word);
  const base = { words: words.length, sentences: sentences.length, syllables };
  if (words.length < MIN_WORDS || sentences.length === 0) {
    return { ...base, fleschReadingEase: null, score: null, band: null };
  }

  const fleschReadingEase = round(206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length));
  const score = Math.round(Math.min(100, Math.max(0, fleschReadingEase)));
  return { ...base, fleschReadingEase, score, band: readabilityBand(score) };
}
