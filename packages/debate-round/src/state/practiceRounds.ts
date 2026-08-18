/**
 * @fileoverview Persistent storage for a simulated practice round, keyed by
 * `roundId` — the "(c) persisting a simulated practice round (setup,
 * submitted speeches, and feedback) once round-state persistence exists"
 * follow-up named under "Practice Round Simulator" in TODO.md's Research
 * Crowdsourcing Organizer Features list. Round-state persistence now exists
 * via `aiVersusRounds.ts` (idea #3's submitted-speech store), so this store
 * only persists `practice-round-simulator.ts`'s own derived
 * `PracticeRoundSetup`, (once generated) `PracticeRoundFeedback`, and (once
 * requested) a `JudgeDecisionAiResult` from `judge-decision-ai.ts` — a
 * round's submitted speeches are looked up through `getAiVersusRound`
 * instead of being duplicated here. Stores records in localStorage,
 * mirroring the existing `aiVersusRounds.ts`/`drillSets.ts` persistence
 * convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
 * empty list rather than throwing). `buildPracticeRoundsPanelView` sorts the
 * stored list by `roundId` for a stable panel display order, mirroring the
 * same helper on `wordCountRounds.ts`/`aiVersusRounds.ts`.
 *
 * @module state/practiceRounds
 */

import { getAiVersusRound } from "./aiVersusRounds";
import type { PriorSpeechRecord } from "../round/ai-versus-speech-order";
import type { JudgeDecisionAiResult } from "../round/judge-decision-ai";
import type { PracticeRoundFeedback, PracticeRoundSetup } from "../round/practice-round-simulator";

export type PracticeRoundRecord = {
  roundId: string;
  setup: PracticeRoundSetup;
  /** Post-round feedback, once generated. Absent while the round is still in progress. */
  feedback?: PracticeRoundFeedback;
  /** An AI judge's verdict for the round, once requested. Absent until "Get AI judge decision" is used. */
  judgeDecision?: JudgeDecisionAiResult;
};

const STORAGE_KEY = "practiceRounds";

function readAll(): PracticeRoundRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PracticeRoundRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: PracticeRoundRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted practice round. */
export function listPracticeRounds(): PracticeRoundRecord[] {
  return readAll();
}

/** Lists every persisted practice round sorted by `roundId`, for a stable panel display order. */
export function buildPracticeRoundsPanelView(): PracticeRoundRecord[] {
  return [...readAll()].sort((a, b) => a.roundId.localeCompare(b.roundId));
}

/** Looks up a round's persisted practice-round state, if any. */
export function getPracticeRound(roundId: string): PracticeRoundRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/** Saves a round's practice-round state, overwriting any existing record for that `roundId`. */
export function savePracticeRound(record: PracticeRoundRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a round's persisted practice-round state; a no-op if it isn't stored. */
export function deletePracticeRound(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}

/**
 * Looks up the submitted speeches for a practice round through the existing
 * `aiVersusRounds.ts` store, so callers don't need to duplicate that lookup.
 * Returns an empty list if the round hasn't submitted any speeches (or isn't
 * persisted there) yet.
 */
export function getPracticeRoundSubmittedSpeeches(roundId: string): PriorSpeechRecord[] {
  return getAiVersusRound(roundId)?.submittedSpeeches ?? [];
}
