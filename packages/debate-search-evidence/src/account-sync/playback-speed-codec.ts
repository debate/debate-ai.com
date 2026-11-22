/**
 * @fileoverview Adapts the speech recorder's playback speed (`@debate-ai/timer`'s
 * `recorder/audio-player.tsx`, key `debate-playback-speed`) — one number, not
 * an array — to the array-of-records shape `TOOL_RECORD_COLLECTIONS` syncs, as
 * a single record with a fixed id.
 *
 * The player writes the speed as `String(rate)` (`"1.5"`), which `JSON.parse`
 * reads as the number `1.5`, so no upgrade step is needed: a value written
 * before this sync existed is read as-is. A merge writes the number back with
 * `JSON.stringify`, which the player's `parseFloat` reads the same way.
 *
 * Only a finite speed within {@link MIN_PLAYBACK_SPEED}–{@link MAX_PLAYBACK_SPEED}
 * is synced or written, so a corrupt or out-of-range value is never pushed to
 * the account and never reaches the `<audio>` element from another device.
 *
 * Pure — no storage or network.
 *
 * @module account-sync/playback-speed-codec
 */

/** The one record's id; there is a single recorder playback speed per account. */
export const PLAYBACK_SPEED_RECORD_ID = "speed";

/** Slowest speed synced; the player's menus offer 0.25× at the lowest. */
export const MIN_PLAYBACK_SPEED = 0.25;

/** Fastest speed synced; the player's menus offer 2× at the highest. */
export const MAX_PLAYBACK_SPEED = 4;

/** Whether `value` is a speed the player can use and the sync may carry. */
export function isSyncablePlaybackSpeed(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_PLAYBACK_SPEED &&
    value <= MAX_PLAYBACK_SPEED
  );
}

/** Wraps the stored speed as one record; a missing, malformed or out-of-range value is no records. */
export function decodePlaybackSpeed(raw: unknown): unknown[] {
  if (!isSyncablePlaybackSpeed(raw)) return [];
  return [{ id: PLAYBACK_SPEED_RECORD_ID, speed: raw }];
}

/**
 * Rebuilds the stored speed from records (the inverse of
 * {@link decodePlaybackSpeed}). No valid record encodes to `null`, which the
 * player reads as "never chosen" (its `initialPlaybackRate`, or 1×).
 */
export function encodePlaybackSpeed(records: readonly unknown[]): unknown {
  for (const record of records) {
    if (typeof record !== "object" || record === null || Array.isArray(record)) continue;
    const { id, speed } = record as { id?: unknown; speed?: unknown };
    if (id === PLAYBACK_SPEED_RECORD_ID && isSyncablePlaybackSpeed(speed)) return speed;
  }
  return null;
}
