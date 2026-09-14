/**
 * @fileoverview Persistent storage for a round's generated
 * `JudgeDecisionAiResult` (`round/judge-decision-ai.ts`) — closing idea #5's
 * ("AI Judge Decision Modes") "(b) a decision history log per round instead
 * of only the latest result" follow-up in TODO.md's Product Feature Ideas
 * list. Every requested decision is appended, keyed by its own generated
 * `id`, rather than upserted by `roundId` — a round can now show its full
 * history of past AI verdicts instead of only the most recent one. Stores
 * decisions in localStorage, mirroring the existing
 * `flowSummaries.ts`/`preRoundBriefings.ts` persistence convention.
 *
 * @module state/judgeDecisions
 */

import type { JudgeDecisionAiResult, JudgeDecisionSideNames } from "debate-round/src/round/judge-decision-ai";
import { combineJudgePanelDecisions, type JudgePanelCombinedDecision } from "debate-round/src/round/judge-decision-panel";

export type JudgeDecisionRecord = {
  /** Generated once when the decision is first requested; the record's stable cross-device identity. */
  id: string;
  roundId: string;
  paradigmName: string;
  sideNames: JudgeDecisionSideNames;
  result: JudgeDecisionAiResult;
  generatedAt: number;
  /**
   * Set when this decision was requested as part of a multi-judge "panel"
   * run (idea #5's follow-up) — every decision from the same panel run
   * shares one `batchId` so `buildJudgeDecisionHistoryItems` can group them
   * back together and show a combined decision alongside each paradigm's
   * individual verdict. Absent for a regular single-paradigm decision.
   */
  batchId?: string;
};

const STORAGE_KEY = "judgeDecisions";

/**
 * Idea #5's third "Next" bullet ("a per-round decision count cap, now that a
 * heavily-re-judged round can accumulate many entries even with the new
 * bulk-clear action available"). Once a round's history log exceeds this
 * many entries, `appendJudgeDecision` trims the oldest ones, mirroring
 * `wordLimitPresets.ts`'s `MAX_WORD_LIMIT_PRESETS` cap-constant convention.
 */
export const MAX_JUDGE_DECISIONS_PER_ROUND = 20;

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

function generateJudgeDecisionId(): string {
  return `decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Generates a fresh `batchId` for a new multi-judge panel run, stamped onto every decision it requests. */
export function generateJudgeDecisionBatchId(): string {
  return `panel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Lists every persisted judge decision, across every round. */
export function listJudgeDecisions(): JudgeDecisionRecord[] {
  return readAll();
}

/** Looks up a single persisted judge decision by its own `id`, if any. */
export function getJudgeDecision(id: string): JudgeDecisionRecord | undefined {
  return readAll().find((record) => record.id === id);
}

/** Every persisted judge decision for a round, newest-first. */
export function listJudgeDecisionsForRound(roundId: string): JudgeDecisionRecord[] {
  return readAll()
    .filter((record) => record.roundId === roundId)
    .sort((a, b) => b.generatedAt - a.generatedAt);
}

export type AppendJudgeDecisionResult = {
  /** The newly stamped record, as before this cap existed. */
  record: JudgeDecisionRecord;
  /**
   * Ids trimmed from this round's history to enforce
   * `MAX_JUDGE_DECISIONS_PER_ROUND`, oldest-first; empty while the round
   * stays under the cap. The caller (`hooks/useJudgeDecisions.ts`)
   * best-effort deletes these from the account too, mirroring
   * `deleteRoundHistory`'s per-id cleanup.
   */
  trimmedIds: string[];
};

/**
 * Appends a newly requested judge decision to that round's history log,
 * assigning it a fresh `id` — unlike the old "latest result only" shape,
 * this never overwrites an existing entry. Once the round's log exceeds
 * `MAX_JUDGE_DECISIONS_PER_ROUND` entries, the oldest ones beyond the cap
 * are trimmed away.
 */
export function appendJudgeDecision(input: Omit<JudgeDecisionRecord, "id">): AppendJudgeDecisionResult {
  const record: JudgeDecisionRecord = { ...input, id: generateJudgeDecisionId() };
  const all = [...readAll(), record];

  const roundRecordsNewestFirst = all
    .filter((existing) => existing.roundId === record.roundId)
    .sort((a, b) => b.generatedAt - a.generatedAt);
  const trimmedIds = roundRecordsNewestFirst.slice(MAX_JUDGE_DECISIONS_PER_ROUND).map((existing) => existing.id);

  if (trimmedIds.length > 0) {
    const trimmed = new Set(trimmedIds);
    writeAll(all.filter((existing) => !trimmed.has(existing.id)));
  } else {
    writeAll(all);
  }

  return { record, trimmedIds };
}

/**
 * Adopts a judge decision as-is — e.g. one fetched from the account during
 * cross-device sync (`hooks/useJudgeDecisions.ts`) — upserting by `id`
 * rather than assigning a fresh one, so a decision generated on one device
 * doesn't duplicate when merged onto another.
 */
export function adoptJudgeDecision(record: JudgeDecisionRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === record.id);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a single persisted judge decision by its own `id`; a no-op if it isn't stored. */
export function deleteJudgeDecision(id: string): void {
  writeAll(readAll().filter((record) => record.id !== id));
}

/**
 * Clears every persisted decision for one round at once (the "Clear all
 * history for this round" bulk action) — idea #5's third still-open "Next"
 * bullet in TODO.md. Returns the ids that were actually removed, newest-first
 * (matching `listJudgeDecisionsForRound`'s order), so the caller
 * (`hooks/useJudgeDecisions.ts`) knows exactly which ids to also remove from
 * the account sync; an empty array for a round with no history.
 */
export function deleteJudgeDecisionsForRound(roundId: string): string[] {
  const all = readAll();
  const removedIds = all
    .filter((record) => record.roundId === roundId)
    .sort((a, b) => b.generatedAt - a.generatedAt)
    .map((record) => record.id);
  if (removedIds.length > 0) {
    writeAll(all.filter((record) => record.roundId !== roundId));
  }
  return removedIds;
}

export type JudgeDecisionRoundGroup = {
  roundId: string;
  /** Newest-first. */
  decisions: JudgeDecisionRecord[];
  /** Newest-first, `decisions` regrouped into single decisions and multi-judge panel runs — see `buildJudgeDecisionHistoryItems`. */
  historyItems: JudgeDecisionHistoryItem[];
};

/** One entry in a round's rendered decision history: either a lone decision, or a multi-judge panel run's decisions plus their combined verdict. */
export type JudgeDecisionHistoryItem =
  | { kind: "single"; decision: JudgeDecisionRecord }
  | { kind: "panel"; batchId: string; decisions: JudgeDecisionRecord[]; combined: JudgePanelCombinedDecision };

/**
 * Regroups a round's newest-first `decisions` list so every 2+ decisions
 * sharing a `batchId` (a multi-judge panel run) render as one grouped item
 * with a combined decision, instead of as unrelated single-decision cards.
 * A `batchId` shared by only one surviving decision (e.g. every other
 * member of that panel run was individually cleared) falls back to
 * rendering as a plain single decision, since `combineJudgePanelDecisions`
 * needs at least two.
 *
 * Each group's position is the position of its newest member, so panel
 * runs interleave correctly with single decisions in the newest-first
 * order the panel already relies on.
 */
export function buildJudgeDecisionHistoryItems(decisions: readonly JudgeDecisionRecord[]): JudgeDecisionHistoryItem[] {
  const byBatch = new Map<string, JudgeDecisionRecord[]>();
  for (const decision of decisions) {
    if (!decision.batchId) continue;
    const existing = byBatch.get(decision.batchId);
    if (existing) existing.push(decision);
    else byBatch.set(decision.batchId, [decision]);
  }

  const items: JudgeDecisionHistoryItem[] = [];
  const consumedBatchIds = new Set<string>();

  for (const decision of decisions) {
    const batch = decision.batchId ? byBatch.get(decision.batchId) : undefined;
    if (batch && batch.length >= 2) {
      if (consumedBatchIds.has(decision.batchId!)) continue;
      consumedBatchIds.add(decision.batchId!);
      items.push({
        kind: "panel",
        batchId: decision.batchId!,
        decisions: batch,
        combined: combineJudgePanelDecisions(
          batch.map((record) => ({ paradigmName: record.paradigmName, result: record.result })),
        ),
      });
    } else {
      items.push({ kind: "single", decision });
    }
  }

  return items;
}

/**
 * Every persisted judge decision grouped by round for `panels/JudgeDecisionPanel.tsx`'s
 * history log — each round's decisions sorted newest-first, rounds sorted
 * by `roundId` for a stable display order.
 */
export function buildJudgeDecisionsPanelView(): JudgeDecisionRoundGroup[] {
  const byRound = new Map<string, JudgeDecisionRecord[]>();
  for (const record of readAll()) {
    const existing = byRound.get(record.roundId);
    if (existing) {
      existing.push(record);
    } else {
      byRound.set(record.roundId, [record]);
    }
  }
  return [...byRound.entries()]
    .map(([roundId, decisions]) => {
      const sorted = [...decisions].sort((a, b) => b.generatedAt - a.generatedAt);
      return { roundId, decisions: sorted, historyItems: buildJudgeDecisionHistoryItems(sorted) };
    })
    .sort((a, b) => a.roundId.localeCompare(b.roundId));
}
