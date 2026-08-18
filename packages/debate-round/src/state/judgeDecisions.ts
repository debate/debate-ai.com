/**
 * @fileoverview Persistent storage for `judge-decision-ai.ts`'s AI
 * judge-decision verdict, keyed by `roundId` — closes follow-up (a) under
 * idea #5 ("AI Judge Decision Modes") in TODO.md's Product Feature Ideas
 * list: "an AI judge-decision call that uses `buildJudgeParadigmPrompt`
 * output ... instead of (or alongside) the existing static
 * `judgeDecisionPrompt`". Stores a round's chosen side labels, the
 * paradigm it was judged under, and the AI's parsed verdict in
 * localStorage, mirroring the existing `aiVersusRounds.ts`/
 * `preRoundBriefings.ts` persistence convention.
 *
 * @module state/judgeDecisions
 */

import type { JudgeParadigm } from "debate-speech-writer/src/judge/judge-paradigms";
import type { JudgeDecisionAiVerdict } from "../round/judge-decision-ai";

export type JudgeDecisionRecord = {
  roundId: string;
  paradigm: JudgeParadigm;
  sideLabels: [string, string];
  verdict: JudgeDecisionAiVerdict;
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

/** Lists every persisted AI judge decision. */
export function listJudgeDecisions(): JudgeDecisionRecord[] {
  return readAll();
}

/** Looks up the persisted AI judge decision for a round, if any. */
export function getJudgeDecision(roundId: string): JudgeDecisionRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/** Saves a round's AI judge decision, overwriting any existing record for that `roundId`. */
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

/** Deletes a round's persisted AI judge decision; a no-op if it isn't stored. */
export function deleteJudgeDecision(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}

/** Every persisted AI judge decision, sorted by `roundId` for a stable panel display order. */
export function buildJudgeDecisionsPanelView(): JudgeDecisionRecord[] {
  return [...readAll()].sort((a, b) => a.roundId.localeCompare(b.roundId));
}
