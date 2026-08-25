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
