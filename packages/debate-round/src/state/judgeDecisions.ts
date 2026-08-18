/**
 * @fileoverview Persistent storage for a round's generated
 * `JudgeDecisionAiResult` (`round/judge-decision-ai.ts`), keyed by
 * `roundId` — closing the persistence half of idea #5's ("AI Judge
 * Decision Modes") follow-up (a) in TODO.md's Product Feature Ideas list.
 * Stores decisions in localStorage, mirroring the existing
 * `flowSummaries.ts`/`preRoundBriefings.ts` persistence convention.
 *
 * @module state/judgeDecisions
 */

import type { JudgeDecisionAiResult, JudgeDecisionSideNames } from "../round/judge-decision-ai";

export type JudgeDecisionRecord = {
  roundId: string;
  paradigmName: string;
  sideNames: JudgeDecisionSideNames;
  result: JudgeDecisionAiResult;
  generatedAt: number;
};

const STORAGE_KEY = "judgeDecisions";

function readAll(): JudgeDecisionRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JudgeDecisionRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: JudgeDecisionRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted judge decision, across all rounds. */
export function listJudgeDecisions(): JudgeDecisionRecord[] {
  return readAll();
}

/** Looks up the persisted judge decision for a round, if any. */
export function getJudgeDecision(roundId: string): JudgeDecisionRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/** Saves a round's judge decision, overwriting any existing record for that `roundId`. */
export function saveJudgeDecision(record: JudgeDecisionRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a round's persisted judge decision; a no-op if it isn't stored. */
export function deleteJudgeDecision(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}

/**
 * Every persisted judge decision, sorted by `roundId` for a stable display
 * order. Used by `panels/JudgeDecisionPanel.tsx`.
 */
export function buildJudgeDecisionsPanelView(): JudgeDecisionRecord[] {
  return [...listJudgeDecisions()].sort((a, b) => a.roundId.localeCompare(b.roundId));
}
