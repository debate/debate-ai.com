/**
 * @fileoverview Adapts the video watch page's remembered choices
 * (`@debate-ai/videos`'s `lib/watch-preferences.ts`, key
 * `debate-videos:watch-preferences`) — one JSON object, not an array — to the
 * array-of-records shape `TOOL_RECORD_COLLECTIONS` syncs, as a single record
 * with a fixed id.
 *
 * The valid values are repeated here rather than imported: this package is a
 * leaf the videos package depends on, not the other way round. Only a known
 * copy format and real booleans pass, in both directions, so a corrupt or
 * future field is never pushed to the account nor written back to a browser.
 *
 * Merging keeps a choice made on only one device: both copies' fields are
 * combined, and where both carry a field the account's value wins, as it does
 * for every other collection.
 *
 * Pure — no storage or network.
 *
 * @module account-sync/watch-preferences-codec
 */

/** The one record's id; there is a single set of watch-page choices per account. */
export const WATCH_PREFERENCES_RECORD_ID = "preferences";

/** Mirrors `CopyFormat` in `@debate-ai/videos`'s `lib/copy-format.ts`. */
const COPY_FORMATS: ReadonlySet<unknown> = new Set(["url", "url-title", "citation"]);

/** Mirrors the boolean fields of `WatchPreferences`. */
const BOOLEAN_FIELDS = ["autoScroll", "skipBreaks", "liveCaption"] as const;

/** The valid choices of an untrusted value; `{}` for anything that isn't an object. */
function validChoices(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  if (COPY_FORMATS.has(source.copyFormat)) clean.copyFormat = source.copyFormat;
  for (const field of BOOLEAN_FIELDS) {
    if (typeof source[field] === "boolean") clean[field] = source[field];
  }
  return clean;
}

/** Wraps the stored choices as one record; a store with no valid choice is no records. */
export function decodeWatchPreferences(stored: unknown): unknown[] {
  const choices = validChoices(stored);
  if (Object.keys(choices).length === 0) return [];
  return [{ id: WATCH_PREFERENCES_RECORD_ID, ...choices }];
}

/**
 * Rebuilds the stored object from records (the inverse of
 * {@link decodeWatchPreferences}). No valid record encodes to `null`, which
 * the videos package reads as "never chosen" (its defaults).
 */
export function encodeWatchPreferences(records: readonly unknown[]): unknown {
  for (const record of records) {
    if (typeof record !== "object" || record === null || Array.isArray(record)) continue;
    if ((record as { id?: unknown }).id !== WATCH_PREFERENCES_RECORD_ID) continue;
    const choices = validChoices(record);
    if (Object.keys(choices).length > 0) return choices;
  }
  return null;
}

/**
 * Combines this browser's record with the account's, field by field: a choice
 * only one side made is kept, and the account's value wins where both made one.
 */
export function mergeWatchPreferences(local: unknown, remote: unknown): unknown {
  return { id: WATCH_PREFERENCES_RECORD_ID, ...validChoices(local), ...validChoices(remote) };
}
