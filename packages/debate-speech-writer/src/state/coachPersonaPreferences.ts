/**
 * @fileoverview The coaching style (`coach/coach-personas.ts`) each AI coach
 * picker last used, so the picker starts there next time instead of
 * resetting to Standard on every page load and device.
 *
 * One record per picker **surface** (`CoachPersonaSurface`), so AI Coach
 * Mode's "Get AI feedback" picker and any later picker (Coach Materials'
 * "Ask the coach") remember their own choices independently.
 *
 * Stored as a JSON array under {@link COACH_PERSONA_PREFERENCES_STORAGE_KEY},
 * each record keyed by `id`, which is the shape `debate-search-evidence`'s
 * `TOOL_RECORD_COLLECTIONS` syncs. Its `coachPersonaPreferences` entry carries
 * the store to a signed-in user's account (`saved_tool_records`). This module
 * itself does no network I/O. The auto-sync watcher flushes local changes,
 * and an account merge writes back here and dispatches a `storage` event,
 * which {@link isCoachPersonaPreferencesStorageEvent} recognizes.
 *
 * SSR- and corrupt-storage-safe: with no `localStorage`, bad JSON, or an
 * unknown persona id, reads return Standard and never throw.
 *
 * @module state/coachPersonaPreferences
 */

import { DEFAULT_COACH_PERSONA_ID, isCoachPersonaId, type CoachPersonaId } from "../coach/coach-personas";

/** The `localStorage` key (and synced collection key) for the preferences. */
export const COACH_PERSONA_PREFERENCES_STORAGE_KEY = "coachPersonaPreferences";

/** The pickers that remember a coaching style. */
export type CoachPersonaSurface = "ai-coach-feedback" | "team-coach";

/** One picker's saved choice. */
export type CoachPersonaPreference = {
  /** The picker surface; the record's sync id. */
  id: CoachPersonaSurface;
  personaId: CoachPersonaId;
  /** Epoch milliseconds of the last change. */
  updatedAt: number;
};

const SURFACES: ReadonlySet<string> = new Set<CoachPersonaSurface>(["ai-coach-feedback", "team-coach"]);

function isPreference(value: unknown): value is CoachPersonaPreference {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    SURFACES.has(record.id) &&
    isCoachPersonaId(record.personaId) &&
    typeof record.updatedAt === "number" &&
    Number.isFinite(record.updatedAt)
  );
}

/** Every stored record, raw, so an unrecognized one written by a newer client survives a save. */
function readRaw(): unknown[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(COACH_PERSONA_PREFERENCES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Every well-formed saved preference. */
export function listCoachPersonaPreferences(): CoachPersonaPreference[] {
  return readRaw().filter(isPreference);
}

/**
 * The coaching style a picker should start on: its saved choice, or Standard
 * when there is none (or the stored value is unusable).
 */
export function getCoachPersonaPreference(surface: CoachPersonaSurface): CoachPersonaId {
  return listCoachPersonaPreferences().find((p) => p.id === surface)?.personaId ?? DEFAULT_COACH_PERSONA_ID;
}

/**
 * Saves a picker's choice, replacing its earlier one. An unknown persona id is
 * ignored rather than stored. Returns whether anything was written. Picking
 * the style that is already saved writes nothing, so it doesn't trigger a sync.
 */
export function saveCoachPersonaPreference(
  surface: CoachPersonaSurface,
  personaId: unknown,
  now: number = Date.now(),
): boolean {
  if (typeof localStorage === "undefined" || !SURFACES.has(surface) || !isCoachPersonaId(personaId)) return false;
  const records = readRaw();
  const index = records.findIndex((r) => isPreference(r) && r.id === surface);
  if (index !== -1 && (records[index] as CoachPersonaPreference).personaId === personaId) return false;
  const next: CoachPersonaPreference = { id: surface, personaId, updatedAt: now };
  // Drop any malformed copy of this surface so only one record carries its id.
  const kept = records.filter(
    (r, i) => i !== index && !(typeof r === "object" && r !== null && (r as { id?: unknown }).id === surface),
  );
  try {
    localStorage.setItem(COACH_PERSONA_PREFERENCES_STORAGE_KEY, JSON.stringify([...kept, next]));
    return true;
  } catch {
    // Quota or a disabled store: the picker still works for this visit.
    return false;
  }
}

/**
 * Whether a `storage` event may have changed the preferences: an event for
 * this key (another tab, or the account merge's own dispatch) or a `null` key
 * (`localStorage.clear()`).
 */
export function isCoachPersonaPreferencesStorageEvent(event: { key: string | null }): boolean {
  return event.key === null || event.key === COACH_PERSONA_PREFERENCES_STORAGE_KEY;
}
