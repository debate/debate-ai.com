/**
 * @fileoverview Append-only score-history log for `llm-card-scoring.ts`'s
 * `ScoredCard`s — the "🧠 LLM Card Scoring" bullet's next-named follow-up in
 * TODO.md ("a per-contributor score-trend chart over time"). Unlike
 * `cardScores.ts`'s own `ScoredCard` store (keyed by card id, overwritten on
 * re-score), a contributor's chart needs every scoring event over time, so
 * this mirrors `revisionHistory.ts`'s "own synthetic id, append rather than
 * overwrite" convention (SSR/no-storage-safe, corrupt or missing JSON
 * degrades to an empty list rather than throwing) instead of
 * `cardScores.ts`'s own upsert-by-id one.
 *
 * `state/cardScores.ts`'s `saveScoredCard`/`saveScoredCardsBulk` append an
 * entry here for every card that carries a `contributorId` — cards scored
 * with no contributor attribution (e.g. `scoreEvidenceLibraryEntry`'s
 * auto-scored Evidence Library entries) aren't anyone's own submission, so
 * they're left out of every contributor's trend.
 *
 * @module state/cardScoreHistory
 */

/** One scoring-event snapshot: a card's overall score at the moment it was (re-)scored. */
export interface CardScoreHistoryEntry {
  id: string;
  cardId: string;
  contributorId: string;
  overallScore: number;
  scoredAt: string;
}

const STORAGE_KEY = "cardScoreHistory";

function readAll(): CardScoreHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CardScoreHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: CardScoreHistoryEntry[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function byScoredAtAscending(a: CardScoreHistoryEntry, b: CardScoreHistoryEntry): number {
  return a.scoredAt.localeCompare(b.scoredAt);
}

/** Lists every persisted score-history entry, across all cards and contributors, oldest first. */
export function listCardScoreHistory(): CardScoreHistoryEntry[] {
  return readAll().sort(byScoredAtAscending);
}

/** Lists every persisted score-history entry for one contributor, oldest first — the per-contributor trend chart's own data source. */
export function listCardScoreHistoryForContributor(contributorId: string): CardScoreHistoryEntry[] {
  return readAll()
    .filter((entry) => entry.contributorId === contributorId)
    .sort(byScoredAtAscending);
}

/** Every distinct contributor id with at least one recorded scoring event, sorted alphabetically. */
export function listCardScoreHistoryContributorIds(): string[] {
  return Array.from(new Set(readAll().map((entry) => entry.contributorId))).sort();
}

/**
 * Appends a scoring-event snapshot, called by `state/cardScores.ts` right
 * after a card carrying a `contributorId` is saved (or re-saved) with a
 * freshly computed `overallScore`. Never overwrites a prior entry — each
 * call adds a new point to that contributor's trend, mirroring
 * `revisionHistory.ts`'s own append-only convention.
 */
export function appendCardScoreHistoryEntry(
  cardId: string,
  contributorId: string,
  overallScore: number,
  scoredAt: string = new Date().toISOString(),
): CardScoreHistoryEntry {
  const entries = readAll();
  const entry: CardScoreHistoryEntry = {
    id: `${cardId}-${contributorId}-${scoredAt}-${entries.length}`,
    cardId,
    contributorId,
    overallScore,
    scoredAt,
  };
  entries.push(entry);
  writeAll(entries);
  return entry;
}
