/**
 * @fileoverview Adapts the speech recorder's playback speed (`@debate-ai/timer`'s
 * `recorder/audio-player.tsx`, key `debate-playback-speed`) — one number, not
 * an array — to the array-of-records shape `TOOL_RECORD_COLLECTIONS` syncs, as
 * a single record with a fixed id.
 *
 * The player stores `{"speed":1.5,"chosenAt":<Unix ms>}`. Values it wrote
 * before `chosenAt` existed are a bare number (`"1.5"`), which `JSON.parse`
 * reads as the number `1.5`, so no upgrade step is needed: either form is read
 * as-is, and a record with no time is written back as the bare number.
 *
 * `chosenAt` decides a conflict ({@link preferPlaybackSpeed}): the speed
 * picked most recently wins, rather than the account's copy always replacing
 * this browser's.
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

/** Whether `value` is a usable "chosen at" time: a positive whole number of Unix milliseconds. */
export function isPlaybackSpeedChosenAt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** The one record this collection syncs. `chosenAt` is absent on a speed stored before it existed. */
export interface PlaybackSpeedRecord {
  id: typeof PLAYBACK_SPEED_RECORD_ID;
  speed: number;
  chosenAt?: number;
}

/** Reads `{ speed, chosenAt }` off an object, dropping a speed that can't be used and a malformed time. */
function readSpeedAndTime(value: unknown): { speed: number; chosenAt?: number } | null {
  if (isSyncablePlaybackSpeed(value)) return { speed: value };
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { speed, chosenAt } = value as { speed?: unknown; chosenAt?: unknown };
  if (!isSyncablePlaybackSpeed(speed)) return null;
  return isPlaybackSpeedChosenAt(chosenAt) ? { speed, chosenAt } : { speed };
}

/**
 * Wraps the stored speed as one record. The player stores `{ speed, chosenAt }`;
 * a bare number (written before `chosenAt` existed) becomes a record with no
 * time. A missing, malformed or out-of-range value is no records.
 */
export function decodePlaybackSpeed(raw: unknown): unknown[] {
  const parsed = readSpeedAndTime(raw);
  if (!parsed) return [];
  const record: PlaybackSpeedRecord = { id: PLAYBACK_SPEED_RECORD_ID, ...parsed };
  return [record];
}

/**
 * Rebuilds the stored speed from records (the inverse of
 * {@link decodePlaybackSpeed}): `{ speed, chosenAt }` for a record that carries
 * a time, the bare number for one that doesn't. No valid record encodes to
 * `null`, which the player reads as "never chosen" (its `initialPlaybackRate`,
 * or 1×).
 */
export function encodePlaybackSpeed(records: readonly unknown[]): unknown {
  for (const record of records) {
    if (typeof record !== "object" || record === null || Array.isArray(record)) continue;
    if ((record as { id?: unknown }).id !== PLAYBACK_SPEED_RECORD_ID) continue;
    const parsed = readSpeedAndTime(record);
    if (!parsed) continue;
    return parsed.chosenAt === undefined ? parsed.speed : parsed;
  }
  return null;
}

/**
 * Which copy of the speed wins a merge: this browser's only when it was chosen
 * later than the account's, or the account's copy carries no time (it was
 * stored before `chosenAt` existed, so this browser's timed pick is newer).
 * A tie, or a local copy with no time, keeps the account's — the account
 * stays the shared truth whenever the times can't tell the two apart.
 *
 * Times come from each device's clock, so a device whose clock runs far ahead
 * can win a pick made later elsewhere; that is recorded as a Known gap.
 */
export function preferPlaybackSpeed(local: unknown, remote: unknown): "local" | "remote" {
  const localAt = readSpeedAndTime(local)?.chosenAt;
  if (localAt === undefined) return "remote";
  const remoteParsed = readSpeedAndTime(remote);
  if (!remoteParsed) return "local";
  if (remoteParsed.chosenAt === undefined) return "local";
  return localAt > remoteParsed.chosenAt ? "local" : "remote";
}
