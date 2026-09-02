/**
 * @fileoverview Account-linked coach-material version-history sync — the
 * same TODO.md idea #8 follow-up as `state/savedCoachMaterials.ts`, applied
 * to `state/coachMaterialVersions.ts`'s snapshots. Pure validation helpers
 * shared by the `/api/coach-material-versions` D1-backed routes
 * (`apps/debate-ai.com`) and `hooks/useCoachMaterialsSync.ts`, mirroring
 * `debate-round`'s `state/savedJudgeDecisions.ts` split: many version rows
 * can share a `materialId`, the same way many judge decisions share a
 * `roundId`, so a version is looked up/removed by its own generated `id`.
 *
 * @module state/savedCoachMaterialVersions
 */

import { COACH_MATERIAL_KIND_ORDER } from "../coach/team-coach-materials";
import type { CoachMaterialVersion } from "./coachMaterialVersions";

/** Hard cap on a single version snapshot's JSON size — same as `MAX_SAVED_COACH_MATERIAL_BYTES`, since a version holds the same fields. */
export const MAX_SAVED_COACH_MATERIAL_VERSION_BYTES = 1_000_000;

const VALID_KINDS: ReadonlySet<string> = new Set(COACH_MATERIAL_KIND_ORDER);

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `CoachMaterialVersion`.
 */
export function isValidCoachMaterialVersionRecord(value: unknown): value is CoachMaterialVersion {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || record.id.trim().length === 0) return false;
  if (typeof record.materialId !== "string" || record.materialId.trim().length === 0) return false;
  if (typeof record.kind !== "string" || !VALID_KINDS.has(record.kind)) return false;
  if (typeof record.title !== "string") return false;
  if (record.topic !== undefined && typeof record.topic !== "string") return false;
  if (!Array.isArray(record.tags) || !record.tags.every((tag) => typeof tag === "string")) return false;
  if (typeof record.text !== "string") return false;
  if (typeof record.replacedAt !== "number") return false;

  return true;
}
