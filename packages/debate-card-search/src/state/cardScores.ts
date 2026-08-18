/**
 * @fileoverview Persistent storage for `llm-card-scoring.ts`'s `ScoredCard`
 * submissions — the "(c) a scoring/duplicate-flag panel UI" follow-up named
 * under the "🧠 LLM Card Scoring" bullet in TODO.md. Stores submitted cards
 * in localStorage, mirroring the existing `evidenceLibraryEntries.ts`/
 * `contributions.ts` persistence convention (SSR/no-storage-safe, corrupt or
 * missing JSON degrades to an empty list rather than throwing).
 *
 * `buildPersistedCardScoreRanking` closes that same follow-up's "panel UI"
 * data half — it composes `llm-card-scoring.ts`'s pure `rankCardScores`
 * directly against every persisted card, rather than requiring a caller to
 * hold and pass in the full card list themselves, mirroring
 * `evidenceLibraryEntries.ts`'s `searchPersistedEvidenceLibrary` "compose the
 * pure function directly against the persisted store" convention. Each
 * card's uniqueness is scored against every other persisted card, so a
 * duplicate submitted days apart is still flagged.
 *
 * @module state/cardScores
 */

import type { CardScoreBreakdown, CardScoreWeights, ScoredCard } from "../lib/llm-card-scoring";
import { DEFAULT_CARD_SCORE_WEIGHTS, rankCardScores } from "../lib/llm-card-scoring";

const STORAGE_KEY = "cardScores";

function readAll(): ScoredCard[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScoredCard[]) : [];
  } catch {
    return [];
  }
}

function writeAll(cards: ScoredCard[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

/** Lists every persisted scored card. */
export function listScoredCards(): ScoredCard[] {
  return readAll();
}

/** Looks up a single persisted scored card by id, if any. */
export function getScoredCard(id: string): ScoredCard | undefined {
  return readAll().find((card) => card.id === id);
}

/** Saves a scored card, overwriting any existing record with the same id. */
export function saveScoredCard(card: ScoredCard): void {
  const cards = readAll();
  const index = cards.findIndex((existing) => existing.id === card.id);
  if (index === -1) {
    cards.push(card);
  } else {
    cards[index] = card;
  }
  writeAll(cards);
}

/** Deletes a persisted scored card by id; a no-op if it isn't stored. */
export function deleteScoredCard(id: string): void {
  writeAll(readAll().filter((card) => card.id !== id));
}

/**
 * Builds the ranked score breakdown for every persisted card, reusing
 * `rankCardScores` directly. An empty store returns an empty ranking rather
 * than throwing.
 */
export function buildPersistedCardScoreRanking(weights: CardScoreWeights = DEFAULT_CARD_SCORE_WEIGHTS): CardScoreBreakdown[] {
  return rankCardScores(readAll(), [], weights);
}
