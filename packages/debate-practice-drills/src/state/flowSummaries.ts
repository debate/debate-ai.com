/**
 * @fileoverview Persistent storage for `flow-transcript-summary.ts`'s
 * derived `FlowRowSummary` list, keyed by `roundId` — the "(c) persisting
 * generated summaries per round" follow-up named in idea #6 ("Speech
 * Transcript Summaries and Answers") in TODO.md's Product Feature Ideas
 * list. Stores summaries in localStorage, mirroring the existing
 * `preRoundBriefings.ts`/`drillSets.ts` persistence convention.
 *
 * @module state/flowSummaries
 */

import type { FlowRowSummary } from "debate-round/src/flow/flow-transcript-summary";

export type FlowSummaryRecord = {
  roundId: string;
  summaries: FlowRowSummary[];
};

const STORAGE_KEY = "flowSummaries";

function readAll(): FlowSummaryRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FlowSummaryRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: FlowSummaryRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted flow summary, across all rounds. */
export function listFlowSummaries(): FlowSummaryRecord[] {
  return readAll();
}

/** Looks up the persisted flow summary for a round, if any. */
export function getFlowSummary(roundId: string): FlowSummaryRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/** Saves a round's flow summary, overwriting any existing record for that `roundId`. */
export function saveFlowSummary(record: FlowSummaryRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a round's persisted flow summary; a no-op if it isn't stored. */
export function deleteFlowSummary(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}

/**
 * Every persisted flow summary, sorted by `roundId` for a stable display
 * order — the "(b) a summary/cross-ex panel UI ... that reads/writes
 * through the persistence store" follow-up named under idea #6 ("Speech
 * Transcript Summaries and Answers") in TODO.md. Used by
 * `panels/FlowSummariesPanel.tsx`.
 */
export function buildFlowSummariesPanelView(): FlowSummaryRecord[] {
  return [...listFlowSummaries()].sort((a, b) => a.roundId.localeCompare(b.roundId));
}
