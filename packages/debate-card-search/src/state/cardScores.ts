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
 * `bulkImportScoredCards` closes the "batch-score an uploaded set of cards
 * at once" follow-up — it composes the pure `parseBulkCardSubmissions`
 * against `saveScoredCardsBulk`, so a contributor can paste a whole batch of
 * cards and persist every well-formed one in a single call.
 *
 * `getScoredCardBreakdown` and `scoreEvidenceLibraryEntry` close the "an
 * inline score badge shown directly in Evidence Library search results"
 * follow-up named alongside the batch-scoring one: the former looks up a
 * single persisted card's breakdown by id (the same per-card `otherTexts`
 * comparison `buildPersistedCardScoreRanking` uses for every card, just
 * scoped to one), and the latter scores a Shared Evidence Library entry
 * directly from its own fields — deriving `argBlockKeywords` from the
 * entry's argument block and tags via `deriveArgBlockKeywords`, with a
 * neutral 0.5 quality signal since an evidence-library entry doesn't carry
 * one of its own (mirroring `bulkImportScoredCards`'s default) — and
 * persists the result under the entry's own id, so `EvidenceLibraryPanel`
 * can score a result in place and show its badge on every later visit
 * without re-scoring.
 *
 * @module state/cardScores
 */

import type { CardScoreBreakdown, CardScoreWeights, ScoredCard } from "../lib/llm-card-scoring";
import {
  DEFAULT_CARD_SCORE_WEIGHTS,
  computeCardScoreBreakdown,
  deriveArgBlockKeywords,
  parseBulkCardSubmissions,
  rankCardScores,
} from "../lib/llm-card-scoring";
import type { EvidenceLibraryEntry } from "../lib/shared-evidence-library";
import { listEvidenceLibraryEntries } from "./evidenceLibraryEntries";
import { listTrackedArguments } from "./trackedArguments";

/** Neutral quality signal used when scoring a card with no quality input of its own. */
const NEUTRAL_QUALITY_SIGNAL = 0.5;

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
 * Saves a batch of scored cards in a single read/write pass, upserting each
 * by id (later entries win over earlier ones within the same batch, matching
 * `saveScoredCard`'s per-id overwrite semantics for sequential calls). Used
 * by `bulkImportScoredCards` below to persist a whole parsed batch at once
 * rather than one `saveScoredCard` round-trip per card.
 */
export function saveScoredCardsBulk(cards: ScoredCard[]): void {
  const existing = readAll();
  for (const card of cards) {
    const index = existing.findIndex((entry) => entry.id === card.id);
    if (index === -1) {
      existing.push(card);
    } else {
      existing[index] = card;
    }
  }
  writeAll(existing);
}

/**
 * Parses a pasted multi-card text batch via `parseBulkCardSubmissions` and
 * persists every well-formed entry in one `saveScoredCardsBulk` pass —
 * closes the "batch-score an uploaded set of cards at once" follow-up named
 * under the "🧠 LLM Card Scoring" bullet in TODO.md. Returns the
 * imported and skipped counts so a caller can render an import summary.
 */
export function bulkImportScoredCards(
  rawText: string,
  defaultQuality = 0.5,
): { importedCount: number; skippedCount: number } {
  const { entries, skippedCount } = parseBulkCardSubmissions(rawText, defaultQuality);
  saveScoredCardsBulk(
    entries.map((entry) => ({
      id: entry.id,
      text: entry.text,
      argBlockKeywords: entry.argBlockKeywords,
      qualitySignals: [entry.quality],
    })),
  );
  return { importedCount: entries.length, skippedCount };
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

/**
 * Looks up one persisted scored card's breakdown by id, scored against every
 * other persisted card plus the real `buildRealCorpusTexts` comparison
 * corpus — the same comparison set `buildPersistedCardScoreRanking` builds
 * for every card, just scoped to one. Returns undefined if no card with that
 * id has been scored yet, e.g. for `EvidenceLibraryPanel`'s per-entry score
 * badge to decide between rendering a badge or a "Score card" action.
 */
export function getScoredCardBreakdown(
  id: string,
  weights: CardScoreWeights = DEFAULT_CARD_SCORE_WEIGHTS,
): CardScoreBreakdown | undefined {
  const cards = readAll();
  const card = cards.find((existing) => existing.id === id);
  if (!card) return undefined;

  const otherTexts = [
    ...buildRealCorpusTexts(),
    ...cards.filter((existing) => existing.id !== id).map((existing) => existing.text),
  ];
  return computeCardScoreBreakdown(card, otherTexts, weights);
}

/**
 * Scores a Shared Evidence Library entry directly from its own fields —
 * closes the "an inline score badge shown directly in Evidence Library
 * search results" follow-up named under the "🧠 LLM Card Scoring" bullet in
 * TODO.md. Derives `argBlockKeywords` from the entry's argument block and
 * tags via `deriveArgBlockKeywords` (no separate keyword input required),
 * and scores evidence quality from a neutral `NEUTRAL_QUALITY_SIGNAL` since
 * an `EvidenceLibraryEntry` doesn't carry a quality signal of its own —
 * mirrors `bulkImportScoredCards`'s same default. Persists the resulting
 * `ScoredCard` under the entry's own id (so scoring is idempotent — scoring
 * the same entry again just refreshes it) and returns the fresh breakdown.
 */
export function scoreEvidenceLibraryEntry(
  entry: EvidenceLibraryEntry,
  weights: CardScoreWeights = DEFAULT_CARD_SCORE_WEIGHTS,
): CardScoreBreakdown {
  saveScoredCard({
    id: entry.id,
    text: entry.text,
    argBlockKeywords: deriveArgBlockKeywords([entry.argBlock, ...entry.tags]),
    qualitySignals: [NEUTRAL_QUALITY_SIGNAL],
  });
  return getScoredCardBreakdown(entry.id, weights)!;
}
