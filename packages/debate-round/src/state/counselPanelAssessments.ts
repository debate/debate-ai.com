/**
 * @fileoverview Persistent storage for a round's AI counsel-panel
 * assessments — follow-up (a) under idea #4 ("AI Response-Outcome Charts")
 * in TODO.md ("a timeline of past AI counsel-panel assessments for a round,
 * not just the latest"). Every requested assessment is appended (its own
 * generated `id`) instead of overwriting the round's prior assessment,
 * mirroring `state/judgeDecisions.ts`'s exact append-only-history-log
 * pattern (itself closing the analogous follow-up under idea #5). Stores
 * assessments in localStorage, keyed by their own `id`, under a distinct
 * storage key from the old single-record shape.
 *
 * @module state/counselPanelAssessments
 */

import type { CounselPanelAiResult } from "../flow/response-outcome-ai";

export type CounselPanelAssessmentRecord = {
  /** Generated once when the assessment is first requested; the record's stable cross-device identity. */
  id: string;
  roundId: string;
  result: CounselPanelAiResult;
  generatedAt: number;
};

const STORAGE_KEY = "counselPanelAssessments";

/**
 * Idea #4's "a timeline of past AI counsel-panel assessments for a round"
 * follow-up doesn't itself call for a cap, but a heavily-re-consulted round
 * can otherwise accumulate assessments without bound — mirrors
 * `judgeDecisions.ts`'s `MAX_JUDGE_DECISIONS_PER_ROUND` cap-constant
 * convention exactly, including the value.
 */
export const MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND = 20;

function readAll(): CounselPanelAssessmentRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CounselPanelAssessmentRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: CounselPanelAssessmentRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateCounselPanelAssessmentId(): string {
  return `counsel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Lists every persisted counsel-panel assessment, across every round. */
export function listCounselPanelAssessments(): CounselPanelAssessmentRecord[] {
  return readAll();
}

/** Looks up a single persisted counsel-panel assessment by its own `id`, if any. */
export function getCounselPanelAssessment(id: string): CounselPanelAssessmentRecord | undefined {
  return readAll().find((record) => record.id === id);
}

/** Every persisted counsel-panel assessment for a round, newest-first. */
export function listCounselPanelAssessmentsForRound(roundId: string): CounselPanelAssessmentRecord[] {
  return readAll()
    .filter((record) => record.roundId === roundId)
    .sort((a, b) => b.generatedAt - a.generatedAt);
}

/** The most recently generated counsel-panel assessment for a round, if any. */
export function getLatestCounselPanelAssessmentForRound(
  roundId: string,
): CounselPanelAssessmentRecord | undefined {
  return listCounselPanelAssessmentsForRound(roundId)[0];
}

export type AppendCounselPanelAssessmentResult = {
  /** The newly stamped record. */
  record: CounselPanelAssessmentRecord;
  /**
   * Ids trimmed from this round's history to enforce
   * `MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND`, oldest-first; empty while the
   * round stays under the cap. The caller
   * (`hooks/useCounselPanelAssessments.ts`) best-effort deletes these from
   * the account too, mirroring `useJudgeDecisions.ts`'s `appendDecision`.
   */
  trimmedIds: string[];
};

/**
 * Appends a newly requested counsel-panel assessment to that round's
 * history log, assigning it a fresh `id` — never overwrites an existing
 * entry, mirroring `judgeDecisions.ts#appendJudgeDecision`'s
 * `Omit<Record, "id">` input shape (the caller stamps `generatedAt` at
 * request time). Once the round's log exceeds
 * `MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND` entries, the oldest ones beyond
 * the cap are trimmed away.
 */
export function appendCounselPanelAssessment(
  input: Omit<CounselPanelAssessmentRecord, "id">,
): AppendCounselPanelAssessmentResult {
  const record: CounselPanelAssessmentRecord = { ...input, id: generateCounselPanelAssessmentId() };
  const all = [...readAll(), record];

  const roundRecordsNewestFirst = all
    .filter((existing) => existing.roundId === record.roundId)
    .sort((a, b) => b.generatedAt - a.generatedAt);
  const trimmedIds = roundRecordsNewestFirst
    .slice(MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND)
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
 * Adopts a counsel-panel assessment as-is — e.g. one fetched from the
 * account during cross-device sync (`hooks/useCounselPanelAssessments.ts`)
 * — upserting by `id` rather than assigning a fresh one, so an assessment
 * generated on one device doesn't duplicate when merged onto another.
 */
export function adoptCounselPanelAssessment(record: CounselPanelAssessmentRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === record.id);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a single persisted counsel-panel assessment by its own `id`; a no-op if it isn't stored. */
export function deleteCounselPanelAssessment(id: string): void {
  writeAll(readAll().filter((record) => record.id !== id));
}

/**
 * Clears every persisted assessment for one round at once (a "Clear all
 * history for this round" bulk action, mirroring
 * `judgeDecisions.ts#deleteJudgeDecisionsForRound`). Returns the ids that
 * were actually removed, newest-first, so the caller
 * (`hooks/useCounselPanelAssessments.ts`) knows exactly which ids to also
 * remove from the account sync; an empty array for a round with no history.
 */
export function deleteCounselPanelAssessmentsForRound(roundId: string): string[] {
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

export type CounselPanelAssessmentRoundGroup = {
  roundId: string;
  /** Newest-first. */
  assessments: CounselPanelAssessmentRecord[];
};

/**
 * Every persisted counsel-panel assessment grouped by round for
 * `panels/VulnerabilityChartsPanel.tsx`'s history log — each round's
 * assessments sorted newest-first, rounds sorted by `roundId` for a stable
 * display order.
 */
export function buildCounselPanelAssessmentsPanelView(): CounselPanelAssessmentRoundGroup[] {
  const byRound = new Map<string, CounselPanelAssessmentRecord[]>();
  for (const record of readAll()) {
    const existing = byRound.get(record.roundId);
    if (existing) {
      existing.push(record);
    } else {
      byRound.set(record.roundId, [record]);
    }
  }
  return [...byRound.entries()]
    .map(([roundId, assessments]) => ({
      roundId,
      assessments: [...assessments].sort((a, b) => b.generatedAt - a.generatedAt),
    }))
    .sort((a, b) => a.roundId.localeCompare(b.roundId));
}
