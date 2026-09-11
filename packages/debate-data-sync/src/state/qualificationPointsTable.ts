/**
 * @fileoverview Persisted, user-editable override for `ndca-standings.ts`'s
 * `DEFAULT_QUALIFICATION_POINTS_TABLE` — advances idea #1's follow-up (b) in
 * `TODO.md`'s Product Feature Ideas list. No public, authoritative NDCA point
 * table exists for this repo to hardcode (see `ndca-standings.ts`'s own doc
 * comment), so instead of staying stuck on the illustrative default, a team
 * can now save their own circuit's point weights for this browser.
 * `buildStandingsFromStore` in `tournamentResults.ts` uses this override as
 * its default `pointsTable` whenever a caller doesn't pass one explicitly.
 *
 * @module state/qualificationPointsTable
 */

import {
  DEFAULT_QUALIFICATION_POINTS_TABLE,
  type OutroundFinish,
  type QualificationPointsTable,
} from "../rankings/ndca-standings";

const STORAGE_KEY = "qualificationPointsTable";

const OUTROUND_FINISHES: OutroundFinish[] = [
  "champion",
  "finalist",
  "semifinalist",
  "quarterfinalist",
  "octofinalist",
  "doubleOctofinalist",
  "tripleOctofinalist",
  "prelims",
];

function isValidTable(value: unknown): value is QualificationPointsTable {
  if (!value || typeof value !== "object") return false;
  const table = value as Partial<QualificationPointsTable>;
  if (!table.outroundPoints || typeof table.outroundPoints !== "object") return false;
  const outroundPoints = table.outroundPoints as Record<string, unknown>;
  for (const finish of OUTROUND_FINISHES) {
    if (!Number.isFinite(outroundPoints[finish])) return false;
  }
  return Number.isFinite(table.pointsPerPrelimWin) && Number.isFinite(table.bidLevelBonusRate);
}

/** Reads the persisted custom points table, or `null` if none is saved (or it's invalid/corrupt). */
export function getPersistedQualificationPointsTable(): QualificationPointsTable | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidTable(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Saves a custom points table, overriding `DEFAULT_QUALIFICATION_POINTS_TABLE` for this browser. */
export function savePersistedQualificationPointsTable(table: QualificationPointsTable): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(table));
}

/** Clears the persisted custom points table, reverting to `DEFAULT_QUALIFICATION_POINTS_TABLE`. */
export function resetPersistedQualificationPointsTable(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * The table standings should actually score with: the persisted custom
 * table if one is saved and valid, else `DEFAULT_QUALIFICATION_POINTS_TABLE`.
 */
export function getEffectiveQualificationPointsTable(): QualificationPointsTable {
  return getPersistedQualificationPointsTable() ?? DEFAULT_QUALIFICATION_POINTS_TABLE;
}

// --- Account sync (packages/debate-help-docs/content/docs/features/team-rankings.mdx's "Standings data...
// is stored in localStorage only" Known gap) ------------------------------
//
// Pure validation/serialization helpers shared by the `/api/settings`
// D1-backed route (`apps/debate-ai.com`) and
// `hooks/useStandingsAccountSync.ts`, mirroring `wordLimitPresets.ts`'s
// split. `null` means "no custom table saved to the account", the same
// "use the local/default value" semantics `getPersistedQualificationPointsTable`
// already uses for a signed-out browser.

export type QualificationPointsTablePayload = {
  qualificationPointsTable: QualificationPointsTable | null;
};

/** Mirrors every other `DEFAULT_*` in this repo's settings surfaces: the value used when no saved row/value exists yet. */
export const DEFAULT_QUALIFICATION_POINTS_TABLE_SYNC: QualificationPointsTablePayload = {
  qualificationPointsTable: null,
};

export type QualificationPointsTablePatchResult = {
  /** Only the field, if present in `input` *and* valid. */
  valid: Partial<QualificationPointsTablePayload>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch: `null`
 * clears the synced table, a valid `QualificationPointsTable` object
 * replaces it — mirrors `normalizeWordLimitPresetsPatch`'s "one field,
 * accepted or rejected as a whole" shape.
 */
export function normalizeQualificationPointsTablePatch(input: unknown): QualificationPointsTablePatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<QualificationPointsTablePayload> = {};
  const errors: string[] = [];

  if ("qualificationPointsTable" in record) {
    const value = record.qualificationPointsTable;
    if (value === null) {
      valid.qualificationPointsTable = null;
    } else if (isValidTable(value)) {
      valid.qualificationPointsTable = value;
    } else {
      errors.push(
        '"qualificationPointsTable" must be null or a { outroundPoints, pointsPerPrelimWin, bidLevelBonusRate } qualification points table.',
      );
    }
  }

  return { valid, errors };
}

/** Serializes a table for the `qualification_points_table` D1 column: `null` clears it, matching `serializeWordLimitPresets`'s "no saved value yet" semantics. */
export function serializeQualificationPointsTable(table: QualificationPointsTable | null): string | null {
  return table === null ? null : JSON.stringify(table);
}

/** Parses the `qualification_points_table` D1 column back into a table, or `null`. Never throws — a null, malformed, or invalid-shape value reads back as `null` rather than erroring the request. */
export function parseQualificationPointsTable(raw: string | null | undefined): QualificationPointsTable | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidTable(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
