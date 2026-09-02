/**
 * @fileoverview Persistent storage for `scout-to-strategy.ts`'s
 * `StrategyRecommendation`, keyed by its own generated `id` and grouped by
 * `matchupId` — part of the "🧭 Scout-to-Strategy Workflow" bullet in
 * TODO.md's Research Crowdsourcing Organizer Features list. Every requested
 * recommendation is appended (its own `id`) instead of overwriting the
 * matchup's prior recommendation, closing that bullet's "a history log of
 * past strategy recommendations per matchup" follow-up — mirrors
 * `state/judgeDecisions.ts`'s exact append-only-history-log pattern. Stores
 * recommendations in localStorage, mirroring the existing
 * `flowSummaries.ts`/`preRoundBriefings.ts` persistence convention.
 *
 * `aiCaseChoice` is additive and optional (a fresh record has none) — it
 * holds `round/case-choice-client.ts`'s AI-generated case-choice evaluation
 * once a caller has requested one for that specific recommendation, closing
 * follow-up (c) named under the "🧭 Scout-to-Strategy Workflow" bullet,
 * mirroring `drillSets.ts`'s `aiScripts` convention.
 *
 * @module state/strategyRecommendations
 */

import type { CaseChoiceAiResult } from "../round/case-choice-ai";
import type { StrategyRecommendation } from "../round/scout-to-strategy";

export type StrategyRecommendationRecord = {
  /** Generated once when the recommendation is first built; the record's stable cross-device identity. */
  id: string;
  matchupId: string;
  recommendation: StrategyRecommendation;
  /** The AI's case-choice evaluation for this recommendation, once requested — see `case-choice-client.ts`. */
  aiCaseChoice?: CaseChoiceAiResult;
  generatedAt: number;
};

const STORAGE_KEY = "strategyRecommendations";

/**
 * Mirrors `judgeDecisions.ts`'s `MAX_JUDGE_DECISIONS_PER_ROUND` cap-constant
 * convention exactly, including the value — a heavily-rebuilt matchup can
 * otherwise accumulate recommendations without bound.
 */
export const MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP = 20;

function readAll(): StrategyRecommendationRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StrategyRecommendationRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: StrategyRecommendationRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateStrategyRecommendationId(): string {
  return `strategy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Lists every persisted strategy recommendation, across every matchup. */
export function listStrategyRecommendations(): StrategyRecommendationRecord[] {
  return readAll();
}

/** Looks up a single persisted strategy recommendation by its own `id`, if any. */
export function getStrategyRecommendation(id: string): StrategyRecommendationRecord | undefined {
  return readAll().find((record) => record.id === id);
}

/** Every persisted strategy recommendation for a matchup, newest-first. */
export function listStrategyRecommendationsForMatchup(matchupId: string): StrategyRecommendationRecord[] {
  return readAll()
    .filter((record) => record.matchupId === matchupId)
    .sort((a, b) => b.generatedAt - a.generatedAt);
}

/** The most recently built strategy recommendation for a matchup, if any. */
export function getLatestStrategyRecommendationForMatchup(
  matchupId: string,
): StrategyRecommendationRecord | undefined {
  return listStrategyRecommendationsForMatchup(matchupId)[0];
}

export type AppendStrategyRecommendationResult = {
  /** The newly stamped record. */
  record: StrategyRecommendationRecord;
  /**
   * Ids trimmed from this matchup's history to enforce
   * `MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP`, oldest-first; empty while
   * the matchup stays under the cap. The caller
   * (`hooks/useStrategyRecommendations.ts`) best-effort deletes these from
   * the account too, mirroring `useJudgeDecisions.ts`'s `appendDecision`.
   */
  trimmedIds: string[];
};

/**
 * Appends a newly built strategy recommendation to that matchup's history
 * log, assigning it a fresh `id` — never overwrites an existing entry,
 * mirroring `judgeDecisions.ts#appendJudgeDecision`'s `Omit<Record, "id">`
 * input shape (the caller stamps `generatedAt` at build time). Once the
 * matchup's log exceeds `MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP` entries,
 * the oldest ones beyond the cap are trimmed away.
 */
export function appendStrategyRecommendation(
  input: Omit<StrategyRecommendationRecord, "id">,
): AppendStrategyRecommendationResult {
  const record: StrategyRecommendationRecord = { ...input, id: generateStrategyRecommendationId() };
  const all = [...readAll(), record];

  const matchupRecordsNewestFirst = all
    .filter((existing) => existing.matchupId === record.matchupId)
    .sort((a, b) => b.generatedAt - a.generatedAt);
  const trimmedIds = matchupRecordsNewestFirst
    .slice(MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP)
    .map((existing) => existing.id);

  if (trimmedIds.length > 0) {
    const trimmed = new Set(trimmedIds);
    writeAll(all.filter((existing) => !trimmed.has(existing.id)));
  } else {
    writeAll(all);
  }

  return { record, trimmedIds };
}

/**
 * Adopts a strategy recommendation as-is — e.g. one fetched from the
 * account during cross-device sync (`hooks/useStrategyRecommendations.ts`)
 * — upserting by `id` rather than assigning a fresh one, so a recommendation
 * built on one device doesn't duplicate when merged onto another.
 */
export function adoptStrategyRecommendation(record: StrategyRecommendationRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === record.id);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/**
 * Sets a specific recommendation's `aiCaseChoice`, leaving every other field
 * untouched. Returns the updated record for the caller
 * (`hooks/useStrategyRecommendations.ts`) to push to the account, or
 * `undefined` when the `id` isn't stored — an evaluation call is only ever
 * made against an already-built, already-persisted recommendation.
 */
export function updateStrategyRecommendationAiCaseChoice(
  id: string,
  aiCaseChoice: CaseChoiceAiResult,
): StrategyRecommendationRecord | undefined {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === id);
  if (index === -1) return undefined;
  const updated: StrategyRecommendationRecord = { ...records[index], aiCaseChoice };
  records[index] = updated;
  writeAll(records);
  return updated;
}

/** Deletes a single persisted strategy recommendation by its own `id`; a no-op if it isn't stored. */
export function deleteStrategyRecommendation(id: string): void {
  writeAll(readAll().filter((record) => record.id !== id));
}

/**
 * Clears every persisted recommendation for one matchup at once (a "Clear
 * all history for this matchup" bulk action, mirroring
 * `judgeDecisions.ts#deleteJudgeDecisionsForRound`). Returns the ids that
 * were actually removed, newest-first, so the caller
 * (`hooks/useStrategyRecommendations.ts`) knows exactly which ids to also
 * remove from the account sync; an empty array for a matchup with no
 * history.
 */
export function deleteStrategyRecommendationsForMatchup(matchupId: string): string[] {
  const all = readAll();
  const removedIds = all
    .filter((record) => record.matchupId === matchupId)
    .sort((a, b) => b.generatedAt - a.generatedAt)
    .map((record) => record.id);
  if (removedIds.length > 0) {
    writeAll(all.filter((record) => record.matchupId !== matchupId));
  }
  return removedIds;
}

export type StrategyRecommendationMatchupGroup = {
  matchupId: string;
  /** Newest-first. */
  recommendations: StrategyRecommendationRecord[];
};

/**
 * Every persisted strategy recommendation grouped by matchup for
 * `panels/StrategyPanel.tsx`'s history log — each matchup's recommendations
 * sorted newest-first, matchups sorted by `matchupId` for a stable display
 * order.
 */
export function buildStrategyRecommendationsPanelView(): StrategyRecommendationMatchupGroup[] {
  const byMatchup = new Map<string, StrategyRecommendationRecord[]>();
  for (const record of readAll()) {
    const existing = byMatchup.get(record.matchupId);
    if (existing) {
      existing.push(record);
    } else {
      byMatchup.set(record.matchupId, [record]);
    }
  }
  return [...byMatchup.entries()]
    .map(([matchupId, recommendations]) => ({
      matchupId,
      recommendations: [...recommendations].sort((a, b) => b.generatedAt - a.generatedAt),
    }))
    .sort((a, b) => a.matchupId.localeCompare(b.matchupId));
}
