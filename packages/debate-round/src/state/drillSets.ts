/**
 * @fileoverview Persistent storage for `drill-generator.ts`'s generated
 * `Drill` sets, keyed by `roundId` — the "(c) persisting generated drills
 * per round" follow-up named in the "AI Drill Generator" bullet in TODO.md's
 * Research Crowdsourcing Organizer Features list. Stores drill sets in
 * localStorage, mirroring the existing
 * `preRoundBriefings.ts`/`judgeParadigmSelections.ts` persistence
 * convention.
 *
 * `aiScripts` is additive and optional (existing records without one stay
 * valid) — it holds `round/drill-script-client.ts`'s AI-generated practice
 * scripts, keyed by a drill's index in `drills`, once a caller has
 * generated one for that drill; see `saveDrillAiScript` below, closing
 * follow-up (b) named under the "📚 AI Drill Generator" bullet.
 *
 * `completedDrillIndexes` is likewise additive and optional — it tracks
 * which drills (by index in `drills`) the user has marked practiced, the
 * "completion tracking" follow-up named under the "📚 AI Drill Generator"
 * bullet. See `toggleDrillCompletion`/`getDrillSetCompletionStats` below.
 * This slice tracks completion locally only; tying completion into the
 * separate `debate-card-search` Progress Unlocks tier system stays a named
 * open follow-up.
 *
 * @module state/drillSets
 */

import type { Flow } from "../types/flow";
import { buildDrillSet, type Drill } from "../flow/drill-generator";

export type DrillSetRecord = {
  roundId: string;
  /** The side the drills were generated for (see `buildDrillSet`). */
  sideKey: string;
  drills: Drill[];
  /** AI-generated practice scripts, keyed by the drill's index in `drills`. */
  aiScripts?: Record<number, string>;
  /** Indexes (into `drills`) of drills the user has marked practiced/completed. */
  completedDrillIndexes?: number[];
};

/** A round's drill-completion progress — see `getDrillSetCompletionStats`. */
export type DrillSetCompletionStats = {
  completed: number;
  total: number;
  /** `completed / total`, or `0` when `total` is `0`. */
  ratio: number;
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

/**
 * Sets a round's persisted `aiScripts[drillIndex]`
 * (`round/drill-script-client.ts`'s `requestDrillScript` result for that
 * drill), leaving `drills` and every other drill's script untouched. A
 * no-op when the roundId isn't stored — a script call is only ever made
 * against an already-generated, already-persisted drill set.
 */
export function saveDrillAiScript(roundId: string, drillIndex: number, aiScript: string): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === roundId);
  if (index === -1) return;
  const existing = records[index];
  records[index] = {
    ...existing,
    aiScripts: { ...(existing.aiScripts ?? {}), [drillIndex]: aiScript },
  };
  writeAll(records);
}

/**
 * Toggles whether a drill (by index in `drills`) is marked completed/
 * practiced, leaving `drills` and `aiScripts` untouched. A no-op when the
 * roundId isn't stored or `drillIndex` is out of range for that record's
 * `drills` — mirrors `saveDrillAiScript`'s guard, since a completion toggle
 * is only ever made against an already-generated, already-persisted drill.
 */
export function toggleDrillCompletion(roundId: string, drillIndex: number): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === roundId);
  if (index === -1) return;
  const existing = records[index];
  if (drillIndex < 0 || drillIndex >= existing.drills.length) return;
  const completed = new Set(existing.completedDrillIndexes ?? []);
  if (completed.has(drillIndex)) {
    completed.delete(drillIndex);
  } else {
    completed.add(drillIndex);
  }
  records[index] = {
    ...existing,
    completedDrillIndexes: [...completed].sort((a, b) => a - b),
  };
  writeAll(records);
}

/**
 * A round's drill-completion progress — how many of its drills are marked
 * completed, out of the total, and the ratio (`0` when there are no
 * drills, matching `MeterBar`'s own `max <= 0` handling). Used by
 * `panels/DrillSetsPanel.tsx` to render a per-round progress meter.
 */
export function getDrillSetCompletionStats(record: Pick<DrillSetRecord, "drills" | "completedDrillIndexes">): DrillSetCompletionStats {
  const total = record.drills.length;
  const completed = (record.completedDrillIndexes ?? []).filter(
    (drillIndex) => drillIndex >= 0 && drillIndex < total,
  ).length;
  return { completed, total, ratio: total > 0 ? completed / total : 0 };
}

/**
 * Derives a round's drill set from an already-flowed `Flow` and persists it
 * in one step — the "generate a new drill set for a round" affordance named
 * in `docs/features/drill-sets.md`'s Known gaps. Lets a caller with a live
 * flow (e.g. the round workspace's currently selected flow) create a
 * `DrillSetRecord` without hand-building it, mirroring
 * `roundContributorFlows.ts`'s `buildAndSaveRoundContributorFlow`. Overwrites
 * any existing drill set for `roundId`, same as `saveDrillSet`.
 */
export function buildAndSaveDrillSet(
  flow: Pick<Flow, "children" | "columns">,
  roundId: string,
  sideKey: string,
  options: { collapseLimit?: number } = {},
): DrillSetRecord {
  const record: DrillSetRecord = { roundId, sideKey, drills: buildDrillSet(flow, sideKey, options) };
  saveDrillSet(record);
  return record;
}

/**
 * Every persisted drill set, sorted by `roundId` then `sideKey` for a
 * stable display order — the "(a) a drill-panel UI that reads/writes
 * through the persistence store" follow-up named under the "📚 AI Drill
 * Generator" bullet in TODO.md. Used by `panels/DrillSetsPanel.tsx`.
 */
export function buildDrillSetsPanelView(): DrillSetRecord[] {
  return [...listDrillSets()].sort(
    (a, b) => a.roundId.localeCompare(b.roundId) || a.sideKey.localeCompare(b.sideKey),
  );
}
