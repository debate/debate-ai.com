/**
 * @fileoverview Adapts the UI sound-effect level (`@debate-ai/timer`'s
 * `audio/sound-effect-preferences.ts`, key `sound-effect-level`) — one JSON
 * string, not an array — to the array-of-records shape
 * `TOOL_RECORD_COLLECTIONS` syncs, as a single record with a fixed id.
 *
 * The three levels are repeated here rather than imported: this package is a
 * leaf the timer package depends on, not the other way round. A stored value
 * that isn't one of them is no records, so a corrupt or future value is never
 * pushed to the account, and a record that isn't one of them is never written.
 *
 * Pure — no storage or network.
 *
 * @module account-sync/sound-effect-level-codec
 */

/** The one record's id; there is a single sound-effect level per account. */
export const SOUND_EFFECT_LEVEL_RECORD_ID = "level";

/** Mirrors `SoundEffectLevel` in `@debate-ai/timer`. */
const LEVELS: ReadonlySet<unknown> = new Set(["all", "minimal", "off"]);

/** Wraps the stored level as one record; a missing or unknown value is no records. */
export function decodeSoundEffectLevel(raw: unknown): unknown[] {
  if (!LEVELS.has(raw)) return [];
  return [{ id: SOUND_EFFECT_LEVEL_RECORD_ID, level: raw }];
}

/**
 * Rebuilds the stored level from records (the inverse of
 * {@link decodeSoundEffectLevel}). No valid record encodes to `null`, which
 * the timer package reads as "never chosen" (the default level).
 */
export function encodeSoundEffectLevel(records: readonly unknown[]): unknown {
  for (const record of records) {
    if (typeof record !== "object" || record === null || Array.isArray(record)) continue;
    const { id, level } = record as { id?: unknown; level?: unknown };
    if (id === SOUND_EFFECT_LEVEL_RECORD_ID && LEVELS.has(level)) return level;
  }
  return null;
}
