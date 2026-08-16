/**
 * @fileoverview Persistent storage for `pre-round-briefing.ts`'s
 * `PreRoundBriefing`, keyed by `roundId` — the "(c) persisting a generated
 * briefing per round" follow-up named in idea #12 ("Pre-Round Intelligence
 * Panel") in TODO.md's Product Feature Ideas list. Stores briefings in
 * localStorage, mirroring the existing
 * `judgeParadigmSelections.ts`/`coachingPrograms.ts` persistence convention.
 *
 * @module state/preRoundBriefings
 */

import type { PreRoundBriefing } from "../round/pre-round-briefing";

export type PreRoundBriefingRecord = {
  roundId: string;
  briefing: PreRoundBriefing;
};

const STORAGE_KEY = "preRoundBriefings";

function readAll(): PreRoundBriefingRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PreRoundBriefingRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: PreRoundBriefingRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted pre-round briefing. */
export function listPreRoundBriefings(): PreRoundBriefingRecord[] {
  return readAll();
}

/** Looks up the persisted briefing for a round, if any. */
export function getPreRoundBriefing(roundId: string): PreRoundBriefingRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/** Saves a round's briefing, overwriting any existing record for that `roundId`. */
export function savePreRoundBriefing(record: PreRoundBriefingRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a round's persisted briefing; a no-op if it isn't stored. */
export function deletePreRoundBriefing(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}
