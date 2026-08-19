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
 * card's uniqueness is scored against every other persisted card plus the
 * real, persisted Shared Evidence Library corpus (`buildRealCorpusTexts`),
 * so a duplicate submitted days apart — or one that's really just a copy of
 * an already-shared card — is still flagged. `deriveArgBlockKeywordsForTopic`
 * closes the other half of that same bullet's "(b) real argument-block
 * keywords and a real submitted-card corpus" follow-up — it composes the
 * pure `deriveArgBlockKeywords` against a topic's own persisted tracked-
 * argument checklist (`trackedArguments.ts`), so a contributor scoring a
 * card for a topic no longer has to hand-type keywords from scratch.
 *
 * @module state/cardScores
 */

import type { CardScoreBreakdown, CardScoreWeights, ScoredCard } from "../lib/llm-card-scoring";
import { DEFAULT_CARD_SCORE_WEIGHTS, deriveArgBlockKeywords, rankCardScores } from "../lib/llm-card-scoring";
import { listEvidenceLibraryEntries } from "./evidenceLibraryEntries";
import { listTrackedArguments } from "./trackedArguments";

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
 * The real, site-wide comparison corpus for uniqueness scoring: every
 * persisted Shared Evidence Library entry's full text (`evidenceLibraryEntries.ts`),
 * so a submitted card is flagged as a likely duplicate not just against other
 * cards submitted through this scoring form, but against the team's actual
 * shared card repository.
 */
export function buildRealCorpusTexts(): string[] {
  return listEvidenceLibraryEntries().map((entry) => entry.text);
}

/**
 * Derives ready-to-use `argBlockKeywords` for a topic from its persisted
 * tracked-argument checklist (`trackedArguments.ts`), reusing the pure
 * `deriveArgBlockKeywords` directly. Returns an empty list for a topic with
 * no tracked arguments yet, rather than throwing.
 */
export function deriveArgBlockKeywordsForTopic(topic: string): string[] {
  return deriveArgBlockKeywords(listTrackedArguments(topic).map((record) => record.argBlock));
}

/**
 * Builds the ranked score breakdown for every persisted card, reusing
 * `rankCardScores` directly against every persisted card plus the real
 * `buildRealCorpusTexts` comparison corpus. An empty store returns an empty
 * ranking rather than throwing.
 */
export function buildPersistedCardScoreRanking(weights: CardScoreWeights = DEFAULT_CARD_SCORE_WEIGHTS): CardScoreBreakdown[] {
  return rankCardScores(readAll(), buildRealCorpusTexts(), weights);
}
