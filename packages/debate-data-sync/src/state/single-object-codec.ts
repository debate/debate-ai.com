/**
 * @fileoverview Adapts a tool store that is one settings object — the flow
 * editor's `ebb-display-settings` and `ebb-keymap-settings` — to the
 * array-of-records shape `TOOL_RECORD_COLLECTIONS` syncs.
 *
 * The object becomes a single record whose `id` is the fixed
 * {@link SETTINGS_RECORD_ID}, so the account holds one row per user and
 * collection and the usual replace-by-id merge makes the account's copy the
 * shared truth across devices.
 *
 * Pure — no storage or network.
 *
 * @module state/single-object-codec
 */

/** The one record id a single-object store syncs under. */
export const SETTINGS_RECORD_ID = "settings";

/**
 * Wraps a stored settings object as a one-record list; anything that is not a
 * non-empty plain object (missing, a hand-edited array or scalar) yields none.
 *
 * @param stored - The parsed `localStorage` value.
 */
export function decodeSingleObject(stored: unknown): Record<string, unknown>[] {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return [];
  if (Object.keys(stored).length === 0) return [];
  return [{ ...(stored as Record<string, unknown>), id: SETTINGS_RECORD_ID }];
}

/**
 * Rebuilds the stored object from merged records (the inverse of
 * {@link decodeSingleObject}): the settings record minus its `id`.
 *
 * @param records - Records merged from the account and this browser.
 * @returns The object to store, or `{}` when no settings record is present.
 */
export function encodeSingleObject(records: readonly unknown[]): Record<string, unknown> {
  for (const record of records) {
    if (typeof record !== "object" || record === null || Array.isArray(record)) continue;
    const { id, ...settings } = record as Record<string, unknown>;
    if (id === SETTINGS_RECORD_ID) return settings;
  }
  return {};
}

/**
 * Drops `flowsDir` — the desktop app's on-disk flows folder, a path that
 * means nothing on another device — before the display settings leave this
 * browser. The merge restores it locally from the browser's own copy.
 *
 * @param record - A display-settings record.
 */
export function redactFlowDisplaySettings(record: unknown): unknown {
  if (typeof record !== "object" || record === null || Array.isArray(record)) return record;
  const { flowsDir: _flowsDir, ...rest } = record as Record<string, unknown>;
  return rest;
}
