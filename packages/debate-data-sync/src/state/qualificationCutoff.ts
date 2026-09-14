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

// --- Account sync (packages/debate-help-docs/content/docs/features/team-rankings.mdx's "Standings data...
// is stored in localStorage only" Known gap) ------------------------------
//
// Pure validation/serialization helpers shared by the `/api/settings`
// D1-backed route (`apps/debate-ai.com`) and
// `hooks/useStandingsAccountSync.ts`, mirroring
// `qualificationPointsTable.ts`'s sync helpers exactly. `null` means "no
// cutoff saved to the account", the same "not configured" semantics
// `DEFAULT_QUALIFICATION_CUTOFF` already uses for a signed-out browser.

export type QualificationCutoffPayload = {
  qualificationCutoff: QualificationCutoffSettings | null;
};

/** Mirrors every other `DEFAULT_*` in this repo's settings surfaces: the value used when no saved row/value exists yet. */
export const DEFAULT_QUALIFICATION_CUTOFF_SYNC: QualificationCutoffPayload = {
  qualificationCutoff: null,
};

export type QualificationCutoffPatchResult = {
  /** Only the field, if present in `input` *and* valid. */
  valid: Partial<QualificationCutoffPayload>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch: `null`
 * clears the synced cutoff, a valid `{ minPoints, maxQualifiers }` object
 * replaces it.
 */
export function normalizeQualificationCutoffPatch(input: unknown): QualificationCutoffPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<QualificationCutoffPayload> = {};
  const errors: string[] = [];

  if ("qualificationCutoff" in record) {
    const value = record.qualificationCutoff;
    if (value === null) {
      valid.qualificationCutoff = null;
    } else if (isValidCutoff(value)) {
      valid.qualificationCutoff = value;
    } else {
      errors.push('"qualificationCutoff" must be null or a { minPoints, maxQualifiers } object, either field a number or null.');
    }
  }

  return { valid, errors };
}

/** Serializes a cutoff for the `qualification_cutoff` D1 column: `null` clears it. */
export function serializeQualificationCutoff(cutoff: QualificationCutoffSettings | null): string | null {
  return cutoff === null ? null : JSON.stringify(cutoff);
}

/** Parses the `qualification_cutoff` D1 column back into a cutoff, or `null`. Never throws — a null, malformed, or invalid-shape value reads back as `null` rather than erroring the request. */
export function parseQualificationCutoff(raw: string | null | undefined): QualificationCutoffSettings | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidCutoff(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
