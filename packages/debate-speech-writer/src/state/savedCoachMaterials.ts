/**
 * @fileoverview Account-linked coach-material sync — TODO.md idea #8
 * ("Video-Lecture-Training Coach AI")'s "Account sync for coach materials
 * (and their version history) — both are still purely per-browser
 * localStorage today, unlike most other panels in this repo" follow-up.
 * Pure validation helpers shared by the `/api/coach-materials` D1-backed
 * routes (`apps/debate-ai.com`) and `hooks/useCoachMaterialsSync.ts`,
 * mirroring `debate-round`'s `state/savedRoundPairings.ts` split — kept
 * framework/fetch-free so both sides agree on what a valid synced record is
 * without duplicating logic.
 *
 * Like `saved_round_pairings`, a `CoachMaterial` is looked up/edited by its
 * own id (not appended to a growing log), so `GET /api/coach-materials`
 * returns every record in full.
 *
 * @module state/savedCoachMaterials
 */

import { COACH_MATERIAL_KIND_ORDER, type CoachMaterial } from "../coach/team-coach-materials";

/**
 * Hard cap on a single material's JSON size — generous for a full lecture
 * transcript or camp document, well short of D1's row-size limits.
 */
export const MAX_SAVED_COACH_MATERIAL_BYTES = 1_000_000;

const VALID_KINDS: ReadonlySet<string> = new Set(COACH_MATERIAL_KIND_ORDER);

function isOptionalNonEmptyString(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.trim().length > 0);
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `CoachMaterial`.
 */
export function isValidCoachMaterialRecord(value: unknown): value is CoachMaterial {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || record.id.trim().length === 0) return false;
  if (typeof record.kind !== "string" || !VALID_KINDS.has(record.kind)) return false;
  if (typeof record.title !== "string" || record.title.trim().length === 0) return false;
  if (!isOptionalNonEmptyString(record.topic)) return false;
  if (!Array.isArray(record.tags) || !record.tags.every((tag) => typeof tag === "string")) return false;
  if (typeof record.text !== "string" || record.text.trim().length === 0) return false;

  return true;
}
