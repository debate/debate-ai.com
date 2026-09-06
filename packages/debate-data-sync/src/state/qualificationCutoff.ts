/**
 * @fileoverview Persisted qualification-cutoff settings for the Standings
 * tab — advances idea #1's ("CX NDCA Standings") remaining follow-up in
 * `TODO.md`'s Product Feature Ideas list: a "who's currently qualified"
 * view using the already-existing `ndca-standings.ts#getQualifiedTeams`
 * helper, which previously had no UI ever calling it. Mirrors
 * `qualificationPointsTable.ts`'s get/save/reset shape exactly, kept as
 * its own storage key/module since a cutoff is a separate concern from the
 * point weights (a team can want one without the other).
 *
 * @module state/qualificationCutoff
 */

import type { QualificationOptions } from "../rankings/ndca-standings";

const STORAGE_KEY = "qualificationCutoff";

/** `null` in either field means that half of the cutoff isn't configured. */
export type QualificationCutoffSettings = {
  minPoints: number | null;
  maxQualifiers: number | null;
};

export const DEFAULT_QUALIFICATION_CUTOFF: QualificationCutoffSettings = {
  minPoints: null,
  maxQualifiers: null,
};

function isValidCutoff(value: unknown): value is QualificationCutoffSettings {
  if (!value || typeof value !== "object") return false;
  const cutoff = value as Partial<QualificationCutoffSettings>;
  const minOk = cutoff.minPoints === null || Number.isFinite(cutoff.minPoints);
  const maxOk = cutoff.maxQualifiers === null || Number.isFinite(cutoff.maxQualifiers);
  return minOk && maxOk;
}

/** Reads the persisted cutoff, or `null` if none is saved (or it's invalid/corrupt). */
export function getPersistedQualificationCutoff(): QualificationCutoffSettings | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidCutoff(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Saves the qualification cutoff for this browser. */
export function savePersistedQualificationCutoff(cutoff: QualificationCutoffSettings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cutoff));
}

/** Clears the persisted cutoff, reverting to "not configured" (`DEFAULT_QUALIFICATION_CUTOFF`). */
export function resetPersistedQualificationCutoff(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/** The cutoff standings should actually filter with: the persisted value if saved and valid, else "not configured". */
export function getEffectiveQualificationCutoff(): QualificationCutoffSettings {
  return getPersistedQualificationCutoff() ?? DEFAULT_QUALIFICATION_CUTOFF;
}

/** Whether either half of a cutoff has actually been configured. */
export function isQualificationCutoffConfigured(cutoff: QualificationCutoffSettings): boolean {
  return cutoff.minPoints !== null || cutoff.maxQualifiers !== null;
}

/** Converts a persisted cutoff into the `QualificationOptions` `getQualifiedTeams` expects. */
export function toQualificationOptions(cutoff: QualificationCutoffSettings): QualificationOptions {
  const options: QualificationOptions = {};
  if (cutoff.minPoints !== null) options.minPoints = cutoff.minPoints;
  if (cutoff.maxQualifiers !== null) options.maxQualifiers = cutoff.maxQualifiers;
  return options;
}
