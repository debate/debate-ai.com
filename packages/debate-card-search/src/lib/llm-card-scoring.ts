/**
 * @fileoverview Pure card-scoring helpers for the "LLM Card Scoring" idea
 * under Research Crowdsourcing Organizer Features in TODO.md ("Use an LLM
 * to score cards for relevance, clarity, uniqueness, evidence quality, and
 * usability"). Scores a submitted card's text against those five
 * dimensions with deterministic heuristics — keyword/phrase overlap for
 * relevance, sentence-length balance for clarity, token-overlap against the
 * rest of the corpus for uniqueness, the existing idea #11
 * `community-rating.ts` quality-signal scoring for evidence quality, and a
 * word-count target band for usability — then blends them into an overall
 * score. This is the first slice only — it's a heuristic stand-in for an
 * eventual LLM call, not the LLM call itself; it doesn't call any model,
 * persist scores, or render a scoring UI. See the follow-ups noted in
 * TODO.md.
 *
 * @module lib/llm-card-scoring
 */

import { scoreQualitySignal } from "./community-rating";

/** Minimal shape of a card needed to score it. */
export interface ScoredCard {
  id: string;
  /** Plain-text card body (summary + underlined/highlighted evidence). */
  text: string;
  /** Keywords or short phrases describing the argument block this card supports. */
  argBlockKeywords: string[];
  /** Popularity-independent quality signals, each 0-1 — same shape `community-rating.ts` scores. */
  qualitySignals: number[];
}

/** Relative share of each dimension in the blended overall score. Should sum to 1. */
export interface CardScoreWeights {
  relevance: number;
  clarity: number;
  uniqueness: number;
  evidenceQuality: number;
  usability: number;
}

/** A middling default weighting relevance and evidence quality slightly above the rest. */
export const DEFAULT_CARD_SCORE_WEIGHTS: CardScoreWeights = {
  relevance: 0.25,
  clarity: 0.15,
  uniqueness: 0.2,
  evidenceQuality: 0.25,
  usability: 0.15,
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

/**
 * Scores relevance 0-100 as the share of `argBlockKeywords` (single words or
 * short phrases) found as a substring of `text`, case-insensitively. Empty
 * keywords score 0 rather than a vacuous 100, since there's nothing to
 * confirm the card is actually on-topic.
 */
export function scoreRelevance(text: string, argBlockKeywords: string[]): number {
  const keywords = argBlockKeywords.map((keyword) => keyword.trim()).filter(Boolean);
  if (keywords.length === 0) return 0;

  const lowerText = text.toLowerCase();
  const matched = keywords.filter((keyword) => lowerText.includes(keyword.toLowerCase())).length;
  return clampScore(Math.round((matched / keywords.length) * 100));
}

/** Average words-per-sentence at or between these bounds scores clarity at 100. */
const IDEAL_MIN_SENTENCE_WORDS = 12;
const IDEAL_MAX_SENTENCE_WORDS = 28;

/**
 * Scores clarity 0-100 from average sentence length: sentences within the
 * ideal band (roughly a debate-card-length, not a run-on) score 100, and
 * the score falls off the further average sentence length strays from that
 * band in either direction.
 */
export function scoreClarity(text: string): number {
  const sentences = text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length === 0) return 0;

  const avgWordsPerSentence =
    sentences.reduce((sum, sentence) => sum + tokenize(sentence).length, 0) / sentences.length;

  if (avgWordsPerSentence >= IDEAL_MIN_SENTENCE_WORDS && avgWordsPerSentence <= IDEAL_MAX_SENTENCE_WORDS) {
    return 100;
  }

  const distance =
    avgWordsPerSentence < IDEAL_MIN_SENTENCE_WORDS
      ? IDEAL_MIN_SENTENCE_WORDS - avgWordsPerSentence
      : avgWordsPerSentence - IDEAL_MAX_SENTENCE_WORDS;

  return clampScore(Math.round(100 - distance * 4));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Scores uniqueness 0-100 as `100 - (100 * highest Jaccard token similarity
 * to any text in otherTexts)`, so a card near-identical to one already in
 * the corpus scores close to 0 while a card sharing no vocabulary with the
 * corpus scores 100. Scores 100 when `otherTexts` is empty — there's
 * nothing to be a duplicate of.
 */
export function scoreUniqueness(text: string, otherTexts: string[]): number {
  if (otherTexts.length === 0) return 100;

  const tokens = new Set(tokenize(text));
  const maxSimilarity = otherTexts.reduce(
    (max, other) => Math.max(max, jaccardSimilarity(tokens, new Set(tokenize(other)))),
    0,
  );

  return clampScore(Math.round((1 - maxSimilarity) * 100));
}

/** Evidence-quality score 0-100, reusing `community-rating.ts`'s quality-signal scoring directly. */
export const scoreEvidenceQuality = scoreQualitySignal;

/**
 * Derives `scoreRelevance`'s `argBlockKeywords` from a topic's tracked
 * argument-block labels (e.g. "Warming DA", "Case NEG Solvency") instead of
 * requiring a contributor to hand-type keywords: each label is kept whole as
 * one phrase, plus its individual words (longer than two characters, so
 * "DA"/"CP"-style short tags don't drown out real words) so a card matching
 * just part of a block's name still scores partial relevance. Blank labels
 * and duplicate keywords are dropped.
 */
export function deriveArgBlockKeywords(argBlocks: string[]): string[] {
  const keywords = new Set<string>();
  for (const block of argBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    keywords.add(trimmed);
    for (const word of tokenize(trimmed)) {
      if (word.length > 2) keywords.add(word);
    }
  }
  return Array.from(keywords);
}

/** Word counts at or between these bounds score usability at 100. */
const IDEAL_MIN_WORD_COUNT = 150;
const IDEAL_MAX_WORD_COUNT = 500;

/**
 * Scores usability 0-100 from word count: a card in the ideal length band
 * (long enough to be useful, short enough to read live) scores 100, and
 * the score falls off the further word count strays from that band.
 */
export function scoreUsability(wordCount: number): number {
  if (wordCount <= 0) return 0;
  if (wordCount >= IDEAL_MIN_WORD_COUNT && wordCount <= IDEAL_MAX_WORD_COUNT) return 100;

  const distance =
    wordCount < IDEAL_MIN_WORD_COUNT ? IDEAL_MIN_WORD_COUNT - wordCount : wordCount - IDEAL_MAX_WORD_COUNT;

  return clampScore(Math.round(100 - distance / 4));
}

/** Uniqueness score below this counts a card as a likely duplicate for moderator review. */
const LIKELY_DUPLICATE_THRESHOLD = 25;

/** The scored breakdown of one card across all five dimensions. */
export interface CardScoreBreakdown {
  cardId: string;
  relevanceScore: number;
  clarityScore: number;
  uniquenessScore: number;
  evidenceQualityScore: number;
  usabilityScore: number;
  /** Weighted blend of the five dimension scores above, 0-100. */
  overallScore: number;
  /** True when `uniquenessScore` is below `LIKELY_DUPLICATE_THRESHOLD`. */
  isLikelyDuplicate: boolean;
}

/**
 * Computes the full scored breakdown for one card, blending relevance,
 * clarity, uniqueness (against `otherTexts`), evidence quality, and
 * usability per `weights` (defaults to `DEFAULT_CARD_SCORE_WEIGHTS`).
 */
export function computeCardScoreBreakdown(
  card: ScoredCard,
  otherTexts: string[] = [],
  weights: CardScoreWeights = DEFAULT_CARD_SCORE_WEIGHTS,
): CardScoreBreakdown {
  const relevanceScore = scoreRelevance(card.text, card.argBlockKeywords);
  const clarityScore = scoreClarity(card.text);
  const uniquenessScore = scoreUniqueness(card.text, otherTexts);
  const evidenceQualityScore = scoreEvidenceQuality(card.qualitySignals);
  const usabilityScore = scoreUsability(tokenize(card.text).length);

  const overallScore =
    Math.round(
      (relevanceScore * weights.relevance +
        clarityScore * weights.clarity +
        uniquenessScore * weights.uniqueness +
        evidenceQualityScore * weights.evidenceQuality +
        usabilityScore * weights.usability) *
        10,
    ) / 10;

  return {
    cardId: card.id,
    relevanceScore,
    clarityScore,
    uniquenessScore,
    evidenceQualityScore,
    usabilityScore,
    overallScore,
    isLikelyDuplicate: uniquenessScore < LIKELY_DUPLICATE_THRESHOLD,
  };
}

/**
 * Scores and ranks a batch of cards by overall score, descending, tie-broken
 * by `id` for a stable, deterministic order. Each card's uniqueness is
 * checked against every other card in `cards` plus any `corpusTexts`
 * supplied (e.g. previously submitted cards), so near-duplicates within the
 * same batch are caught even before either card exists in the corpus.
 */
export function rankCardScores(
  cards: ScoredCard[],
  corpusTexts: string[] = [],
  weights: CardScoreWeights = DEFAULT_CARD_SCORE_WEIGHTS,
): CardScoreBreakdown[] {
  return cards
    .map((card, index) => {
      const otherTexts = [
        ...corpusTexts,
        ...cards.filter((_, otherIndex) => otherIndex !== index).map((other) => other.text),
      ];
      return computeCardScoreBreakdown(card, otherTexts, weights);
    })
    .sort((a, b) => b.overallScore - a.overallScore || a.cardId.localeCompare(b.cardId));
}

/** Renders a one-line summary of a card's score breakdown, flagging likely duplicates. */
export function buildCardScoreSummaryText(breakdown: CardScoreBreakdown): string {
  if (breakdown.isLikelyDuplicate) {
    return `Card "${breakdown.cardId}" scored ${breakdown.overallScore}/100 — flagged as a likely duplicate (uniqueness ${breakdown.uniquenessScore}/100).`;
  }

  return (
    `Card "${breakdown.cardId}" scored ${breakdown.overallScore}/100 ` +
    `(relevance ${breakdown.relevanceScore}, clarity ${breakdown.clarityScore}, ` +
    `uniqueness ${breakdown.uniquenessScore}, evidence ${breakdown.evidenceQualityScore}, ` +
    `usability ${breakdown.usabilityScore}).`
  );
}
