/**
 * @fileoverview Persistent storage for `drill-generator.ts`'s generated
 * `Drill` sets, keyed by `roundId` — the "(c) persisting generated drills
 * per round" follow-up named in the "AI Drill Generator" bullet in TODO.md's
 * Research Crowdsourcing Organizer Features list. Stores drill sets in
 * localStorage, mirroring the existing
 * `preRoundBriefings.ts`/`judgeParadigmSelections.ts` persistence
 * convention.
 *
 * @module state/drillSets
 */

import type { Drill } from "../flow/drill-generator";

export type DrillSetRecord = {
  roundId: string;
  /** The side the drills were generated for (see `buildDrillSet`). */
  sideKey: string;
  drills: Drill[];
};

const STORAGE_KEY = "drillSets";

function readAll(): DrillSetRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DrillSetRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: DrillSetRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted drill set, across all rounds. */
export function listDrillSets(): DrillSetRecord[] {
  return readAll();
}

/** Looks up the persisted drill set for a round, if any. */
export function getDrillSet(roundId: string): DrillSetRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/** Saves a round's drill set, overwriting any existing record for that `roundId`. */
export function saveDrillSet(record: DrillSetRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a round's persisted drill set; a no-op if it isn't stored. */
export function deleteDrillSet(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}
