/**
 * @fileoverview Account-linked drill-set sync — the "sharing the 'Practice
 * tier' status across devices for a signed-in user" follow-up named under
 * the "📚 AI Drill Generator" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features, and `docs/features/drill-sets.md`'s Known gaps. Pure
 * validation helpers shared by the `/api/drill-sets` D1-backed routes
 * (`apps/debate-ai.com`) and `hooks/useDrillSets.ts`, mirroring
 * `state/savedWordCountRounds.ts`'s split — kept framework/fetch-free so
 * both sides agree on what a valid synced record is without duplicating
 * logic.
 *
 * Like `saved_word_count_rounds`, a `DrillSetRecord`'s payload is small (a
 * handful of templated drill prompts plus optional AI scripts/completion
 * indexes/review dates) so `GET /api/drill-sets` returns every record in
 * full — there is no separate summary/label concept here.
 *
 * @module state/savedDrillSets
 */

import type { Drill, DrillDifficulty, DrillKind } from "../flow/drill-generator";
import type { DrillSetRecord } from "./drillSets";

/** Hard cap on a single drill set's JSON size — generous for even a large round, well short of D1's row-size limits. */
export const MAX_SAVED_DRILL_SET_BYTES = 200_000;

const DRILL_KINDS: readonly DrillKind[] = ["overview", "frontline", "cross_ex", "collapse"];
const DRILL_DIFFICULTIES: readonly DrillDifficulty[] = ["easy", "medium", "hard"];

function isValidDrill(value: unknown): value is Drill {
  if (typeof value !== "object" || value === null) return false;
  const drill = value as Record<string, unknown>;
  return (
    typeof drill.kind === "string" &&
    (DRILL_KINDS as string[]).includes(drill.kind) &&
    (drill.rowIndex === null || typeof drill.rowIndex === "number") &&
    typeof drill.prompt === "string" &&
    typeof drill.difficulty === "string" &&
    (DRILL_DIFFICULTIES as string[]).includes(drill.difficulty)
  );
}

function isValidStringRecord(value: unknown): value is Record<number, string> {
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value as Record<string, unknown>).every(
    ([key, entry]) => !Number.isNaN(Number(key)) && typeof entry === "string",
  );
}

function isValidNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "number");
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `DrillSetRecord`. `aiScripts`/`scheduledReviewAt`
 * (index-keyed records) and `completedDrillIndexes` (an index array) are all
 * optional, matching their optionality on `DrillSetRecord` itself.
 */
export function isValidDrillSetRecord(value: unknown): value is DrillSetRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  if (typeof record.roundId !== "string" || record.roundId.trim().length === 0) return false;
  if (typeof record.sideKey !== "string") return false;
  if (!Array.isArray(record.drills) || !record.drills.every(isValidDrill)) return false;
  if (record.aiScripts !== undefined && !isValidStringRecord(record.aiScripts)) return false;
  if (record.completedDrillIndexes !== undefined && !isValidNumberArray(record.completedDrillIndexes)) return false;
  if (record.scheduledReviewAt !== undefined && !isValidStringRecord(record.scheduledReviewAt)) return false;
  if (record.updatedAt !== undefined && typeof record.updatedAt !== "number") return false;

  return true;
}
