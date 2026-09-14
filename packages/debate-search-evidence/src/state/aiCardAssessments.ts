/**
 * @fileoverview Persistent storage for a card's AI-scoring assessment —
 * follow-up (a) under the "🧠 LLM Card Scoring" bullet in TODO.md ("an
 * actual LLM-scoring call for the more subjective dimensions instead of
 * the heuristic proxy"). Stores each card's `CardScoringAiAssessment` (from
 * `lib/llm-card-scoring-ai.ts`, fetched via
 * `lib/llm-card-scoring-client.ts`) in localStorage under a distinct storage
 * key from `state/cardScores.ts`'s so the two stores don't collide.
 *
 * Persisted as a JSON array of records tagged with `cardId`, rather than an
 * object keyed by card id, so this store fits `debate-data-sync`'s
 * `TOOL_RECORD_COLLECTIONS` shape requirement (a JSON array under one
 * `localStorage` key, each record carrying a stable string id field) and
 * syncs to a signed-in user's account — see
 * `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx`.
 * SSR/no-storage-safe; corrupt or missing JSON degrades to an empty store
 * rather than throwing, mirroring `state/cardScores.ts`'s convention.
 *
 * @module state/aiCardAssessments
 */

import type { CardScoringAiAssessment } from "../lib/llm-card-scoring-ai";

const STORAGE_KEY = "aiCardAssessments";

/** One card's persisted AI assessment, tagged with the card id it syncs by. */
type AiAssessmentRecord = CardScoringAiAssessment & { cardId: string };

function readAll(): AiAssessmentRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AiAssessmentRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: AiAssessmentRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Looks up a card's persisted AI assessment by id, if any. */
export function getAiAssessment(cardId: string): CardScoringAiAssessment | undefined {
  const record = readAll().find((entry) => entry.cardId === cardId);
  if (!record) return undefined;
  const { cardId: _cardId, ...assessment } = record;
  return assessment;
}

/** Saves a card's AI assessment, overwriting any existing record for that id. */
export function saveAiAssessment(cardId: string, assessment: CardScoringAiAssessment): void {
  const records = readAll();
  const index = records.findIndex((entry) => entry.cardId === cardId);
  const record: AiAssessmentRecord = { cardId, ...assessment };
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}
