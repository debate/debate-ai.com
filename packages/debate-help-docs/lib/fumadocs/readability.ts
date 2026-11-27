/**
 * @file readability.ts
 * @description Readability scores for a docs page's Info panel
 * (`components/guides/page-info.tsx`), following the formulas of the Python
 * `textstat` / `text-readability` libraries: Flesch Reading Ease, Flesch-Kincaid
 * Grade, Gunning Fog, SMOG, Automated Readability Index, Coleman-Liau, Linsear
 * Write and an overall text-standard grade.
 *
 * Pure TypeScript with no dependencies, no network and no Node APIs, so it
 * runs unchanged on Cloudflare Workers (where the page's stats are computed)
 * and in the browser. Syllables are counted with a vowel-group heuristic
 * rather than a pronunciation dictionary, so individual scores can differ
 * from textstat's by a fraction of a grade.
 *
 * Dale-Chall is left out: it needs textstat's 3,000-word "easy word" list,
 * which is bigger than the rest of this module put together.
 */

/** Below this many words the scores are too noisy to show. */
export const MIN_WORDS = 10;
/** SMOG is defined on samples of at least three sentences. */
export const SMOG_MIN_SENTENCES = 3;

export interface ReadabilityScores {
  fleschReadingEase: number | null;
  fleschKincaidGrade: number | null;
  gunningFog: number | null;
  smog: number | null;
  automatedReadability: number | null;
  colemanLiau: number | null;
  linsearWrite: number | null;
}

export interface Readability {
  words: number;
  sentences: number;
  syllables: number;
  /** Words of three or more syllables. */
  polysyllables: number;
  /** Letters and digits (no spaces or punctuation). */
  letters: number;
  scores: ReadabilityScores;
  /** The grade most of the grade-level formulas agree on, or null for too little text. */
  textStandard: number | null;
  /** Flesch Reading Ease clamped to 0-100 and rounded, or null for too little text. */
  score: number | null;
  /** The band `score` falls in (see {@link readabilityBand}). */
  band: ReadabilityBand | null;
}

export type ReadabilityBand =
  | 'Very Easy'
  | 'Easy'
  | 'Fairly Easy'
  | 'Standard'
  | 'Fairly Difficult'
  | 'Difficult'
  | 'Very Confusing';

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
  if (value >= 90) return 'Very Easy';
  if (value >= 80) return 'Easy';
  if (value >= 70) return 'Fairly Easy';
  if (value >= 60) return 'Standard';
  if (value >= 50) return 'Fairly Difficult';
  if (value >= 30) return 'Difficult';
  return 'Very Confusing';
}

/** A US grade level for a Flesch Reading Ease score, as textstat's `text_standard` does. */
function gradeFromEase(ease: number): number {
  if (ease >= 90) return 5;
  if (ease >= 80) return 6;
  if (ease >= 70) return 7;
  if (ease >= 60) return 8;
  if (ease >= 50) return 10;
  if (ease >= 40) return 11;
  if (ease >= 30) return 12;
  return 13;
}

const EMPTY_SCORES: ReadabilityScores = {
  fleschReadingEase: null,
  fleschKincaidGrade: null,
  gunningFog: null,
  smog: null,
  automatedReadability: null,
  colemanLiau: null,
  linsearWrite: null,
};

/** The Linsear Write formula on the first 100 words, as textstat computes it. */
function linsearWrite(sentences: string[]): number {
  let easy = 0;
  let hard = 0;
  let seen = 0;
  let sampleSentences = 0;
  for (const sentence of sentences) {
    const words = sentence.match(WORD) ?? [];
    if (words.length === 0) continue;
    sampleSentences++;
    for (const word of words) {
      if (seen === 100) break;
      seen++;
      if (countSyllables(word) < 3) easy++;
      else hard++;
    }
    if (seen === 100) break;
  }
  const total = (easy + hard * 3) / Math.max(1, sampleSentences);
  return total > 20 ? total / 2 : (total - 2) / 2;
}

/**
 * Readability of some prose.
 *
 * Scores are null when there are fewer than {@link MIN_WORDS} words (and
 * SMOG when there are fewer than {@link SMOG_MIN_SENTENCES} sentences), never
 * NaN.
 *
 * @param text - Plain prose, without Markdown, citations or headings.
 */
export function readability(text: string): Readability {
  const sentences = sentencesOf(text);
  const words = text.match(WORD) ?? [];
  let syllables = 0;
  let polysyllables = 0;
  let letters = 0;
  for (const word of words) {
    const count = countSyllables(word);
    syllables += count;
    if (count >= 3) polysyllables++;
    letters += word.replace(/[^\p{L}\p{N}]/gu, '').length;
  }
  const base = { words: words.length, sentences: sentences.length, syllables, polysyllables, letters };
  if (words.length < MIN_WORDS || sentences.length === 0) {
    return { ...base, scores: { ...EMPTY_SCORES }, textStandard: null, score: null, band: null };
  }

  const perSentence = words.length / sentences.length;
  const perWord = syllables / words.length;
  const scores: ReadabilityScores = {
    fleschReadingEase: round(206.835 - 1.015 * perSentence - 84.6 * perWord),
    fleschKincaidGrade: round(0.39 * perSentence + 11.8 * perWord - 15.59),
    gunningFog: round(0.4 * (perSentence + (100 * polysyllables) / words.length)),
    smog:
      sentences.length >= SMOG_MIN_SENTENCES
        ? round(1.043 * Math.sqrt(polysyllables * (30 / sentences.length)) + 3.1291)
        : null,
    automatedReadability: round(4.71 * (letters / words.length) + 0.5 * perSentence - 21.43),
    colemanLiau: round(0.0588 * ((letters / words.length) * 100) - 0.296 * ((sentences.length / words.length) * 100) - 15.8),
    linsearWrite: round(linsearWrite(sentences)),
  };

  const grades = [
    scores.fleschKincaidGrade,
    gradeFromEase(scores.fleschReadingEase!),
    scores.smog,
    scores.automatedReadability,
    scores.colemanLiau,
    scores.linsearWrite,
    scores.gunningFog,
  ]
    .filter((grade): grade is number => grade !== null)
    .map((grade) => Math.max(0, Math.round(grade)));
  const tally = new Map<number, number>();
  for (const grade of grades) tally.set(grade, (tally.get(grade) ?? 0) + 1);
  let textStandard = grades[0]!;
  let best = 0;
  for (const [grade, votes] of tally) {
    if (votes > best) {
      best = votes;
      textStandard = grade;
    }
  }

  const score = Math.round(Math.min(100, Math.max(0, scores.fleschReadingEase!)));
  return { ...base, scores, textStandard, score, band: readabilityBand(score) };
}
