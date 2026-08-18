/**
 * @fileoverview Persistent storage for a round's AI counsel-panel
 * assessment — follow-up (a) under idea #4 ("AI Response-Outcome Charts")
 * in TODO.md ("an actual AI-panel call (multiple 'counsel' model roles)
 * that evaluates likely response paths and clash points beyond this
 * deterministic heuristic"). Stores each round's
 * `CounselPanelAiResult` (from `flow/response-outcome-ai.ts`, fetched via
 * `flow/response-outcome-client.ts`) in localStorage, keyed by `roundId`,
 * mirroring `debate-card-search`'s `state/aiCardAssessments.ts` exact
 * persistence convention (SSR/no-storage-safe; corrupt or missing JSON
 * degrades to an empty store rather than throwing) under a distinct
 * storage key so the two stores don't collide.
 *
 * @module state/counselPanelAssessments
 */

import type { CounselPanelAiResult } from "../flow/response-outcome-ai";

const STORAGE_KEY = "counselPanelAssessments";

type AssessmentsByRoundId = Record<string, CounselPanelAiResult>;

function readAll(): AssessmentsByRoundId {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as AssessmentsByRoundId)
      : {};
  } catch {
    return {};
  }
}

function writeAll(assessments: AssessmentsByRoundId): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assessments));
}

/** Looks up a round's persisted AI counsel-panel assessment by `roundId`, if any. */
export function getCounselPanelAssessment(roundId: string): CounselPanelAiResult | undefined {
  return readAll()[roundId];
}

/** Saves a round's AI counsel-panel assessment, overwriting any existing record for that `roundId`. */
export function saveCounselPanelAssessment(roundId: string, assessment: CounselPanelAiResult): void {
  const assessments = readAll();
  assessments[roundId] = assessment;
  writeAll(assessments);
}

/** Deletes a round's persisted AI counsel-panel assessment; a no-op if it isn't stored. */
export function deleteCounselPanelAssessment(roundId: string): void {
  const assessments = readAll();
  if (!(roundId in assessments)) return;
  delete assessments[roundId];
  writeAll(assessments);
}
