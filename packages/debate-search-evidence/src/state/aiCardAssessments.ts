/**
 * @fileoverview Persistent storage for a card's AI-scoring assessment —
 * follow-up (a) under the "🧠 LLM Card Scoring" bullet in TODO.md ("an
 * actual LLM-scoring call for the more subjective dimensions instead of
 * the heuristic proxy"). Stores each card's `CardScoringAiAssessment` (from
 * `lib/llm-card-scoring-ai.ts`, fetched via
 * `lib/llm-card-scoring-client.ts`) in localStorage, keyed by card id,
 * mirroring `state/cardScores.ts`'s exact persistence convention
 * (SSR/no-storage-safe; corrupt or missing JSON degrades to an empty
 * store rather than throwing) under a distinct storage key so the two
 * stores don't collide.
 *
 * @module state/aiCardAssessments
 */

import type { CardScoringAiAssessment } from "../lib/llm-card-scoring-ai";

const STORAGE_KEY = "aiCardAssessments";

type AssessmentsById = Record<string, CardScoringAiAssessment>;

function readAll(): AssessmentsById {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as AssessmentsById)
      : {};
  } catch {
    return {};
  }
}

function writeAll(assessments: AssessmentsById): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assessments));
}

/** Looks up a card's persisted AI assessment by id, if any. */
export function getAiAssessment(cardId: string): CardScoringAiAssessment | undefined {
  return readAll()[cardId];
}

/** Saves a card's AI assessment, overwriting any existing record for that id. */
export function saveAiAssessment(cardId: string, assessment: CardScoringAiAssessment): void {
  const assessments = readAll();
  assessments[cardId] = assessment;
  writeAll(assessments);
}
