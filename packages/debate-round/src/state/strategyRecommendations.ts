/**
 * @fileoverview Persistent storage for `scout-to-strategy.ts`'s
 * `StrategyRecommendation`, keyed by `matchupId` — part of the "(a) a
 * case-choice/strategy panel UI" follow-up named under the
 * "Scout-to-Strategy Workflow" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features list. Stores recommendations in localStorage,
 * mirroring the existing `preRoundBriefings.ts`/`vulnerabilityReports.ts`
 * persistence convention.
 *
 * @module state/strategyRecommendations
 */

import type { StrategyRecommendation } from "../round/scout-to-strategy";

export type StrategyRecommendationRecord = {
  matchupId: string;
  recommendation: StrategyRecommendation;
};

const STORAGE_KEY = "strategyRecommendations";

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

/** Lists every persisted strategy recommendation. */
export function listStrategyRecommendations(): StrategyRecommendationRecord[] {
  return readAll();
}

/** Looks up the persisted strategy recommendation for a matchup, if any. */
export function getStrategyRecommendation(matchupId: string): StrategyRecommendationRecord | undefined {
  return readAll().find((record) => record.matchupId === matchupId);
}

/** Saves a matchup's strategy recommendation, overwriting any existing record for that `matchupId`. */
export function saveStrategyRecommendation(record: StrategyRecommendationRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.matchupId === record.matchupId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a matchup's persisted strategy recommendation; a no-op if it isn't stored. */
export function deleteStrategyRecommendation(matchupId: string): void {
  writeAll(readAll().filter((record) => record.matchupId !== matchupId));
}

/**
 * Every persisted strategy recommendation, sorted by `matchupId` for a
 * stable display order. Used by `panels/StrategyPanel.tsx`.
 */
export function buildStrategyRecommendationsPanelView(): StrategyRecommendationRecord[] {
  return [...listStrategyRecommendations()].sort((a, b) => a.matchupId.localeCompare(b.matchupId));
}
