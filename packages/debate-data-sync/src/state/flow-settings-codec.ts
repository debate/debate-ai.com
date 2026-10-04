/**
 * @fileoverview Adapts the Flow editor's two single-object settings stores —
 * `ebb-display-settings` and `ebb-keymap-settings`, see `debate-flow`'s
 * `useFlowStore.ts` — to the array-of-records shape `TOOL_RECORD_COLLECTIONS`
 * syncs, so a debater's font, zoom, theme, side colors and rebound keys follow
 * them to a second device.
 *
 * Display settings become one record (`id: "display"`) holding only the
 * preferences that describe the *user*. Device- and people-specific fields stay
 * out of the account: `flowsDir` is a filesystem path, the `collab*` fields
 * configure this machine's live-collaboration relay, and `contacts` holds other
 * people's details. `encodeDisplaySettings` receives the stored value so that
 * writing an account record back never erases those local-only fields.
 *
 * Keymap overrides become one record per rebound action (`id` = action id,
 * `key` = the binding), so rebinding one action on one device only touches
 * that action's row.
 *
 * Pure — no storage or network.
 *
 * @module state/flow-settings-codec
 */

/** The display preferences that sync; everything else in the store stays local. */
export const SYNCED_DISPLAY_FIELDS = [
  "flowFont",
  "defaultGridZoom",
  "sidebarCollapsed",
  "rfdOpen",
  "rfdVim",
  "insertPaste",
  "appendEdit",
  "scrollZoom",
  "alignSpeeches",
  "tooltips",
  "cardmirrorEnabled",
  "cardmirrorTextType",
  "theme",
  "affColor",
  "negColor",
] as const;

/** The single record id display settings sync under. */
export const DISPLAY_SETTINGS_RECORD_ID = "display";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The stored display settings as one record, or none when the store is absent
 * or malformed. Only {@link SYNCED_DISPLAY_FIELDS} are carried.
 *
 * @param raw - The parsed `ebb-display-settings` value.
 */
export function decodeDisplaySettings(raw: unknown): Array<Record<string, unknown>> {
  if (!isPlainObject(raw)) return [];
  const record: Record<string, unknown> = { id: DISPLAY_SETTINGS_RECORD_ID };
  for (const field of SYNCED_DISPLAY_FIELDS) {
    if (field in raw) record[field] = raw[field];
  }
  return [record];
}

/**
 * Rebuilds the stored display settings: the account's synced fields laid over
 * whatever this browser already has, so local-only fields survive.
 *
 * @param records - Records merged from the account and this browser.
 * @param existing - The parsed value currently in `localStorage`, if any.
 */
export function encodeDisplaySettings(
  records: readonly unknown[],
  existing?: unknown,
): Record<string, unknown> {
  const next: Record<string, unknown> = isPlainObject(existing) ? { ...existing } : {};
  const record = records.find(
    (r): r is Record<string, unknown> =>
      isPlainObject(r) && r.id === DISPLAY_SETTINGS_RECORD_ID,
  );
  if (!record) return next;
  for (const field of SYNCED_DISPLAY_FIELDS) {
    if (field in record) next[field] = record[field];
  }
  return next;
}

/**
 * One record per rebound action; entries whose binding isn't a non-empty
 * string are skipped.
 *
 * @param raw - The parsed `ebb-keymap-settings` value (`{ keymapOverrides }`).
 */
export function decodeKeymapSettings(raw: unknown): Array<{ id: string; key: string }> {
  if (!isPlainObject(raw) || !isPlainObject(raw.keymapOverrides)) return [];
  const records: Array<{ id: string; key: string }> = [];
  for (const [id, key] of Object.entries(raw.keymapOverrides)) {
    if (id.trim().length > 0 && typeof key === "string" && key.length > 0) {
      records.push({ id, key });
    }
  }
  return records;
}

/**
 * Rebuilds `{ keymapOverrides }` from records (the inverse of
 * {@link decodeKeymapSettings}).
 *
 * @param records - Records merged from the account and this browser.
 */
export function encodeKeymapSettings(records: readonly unknown[]): {
  keymapOverrides: Record<string, string>;
} {
  const keymapOverrides: Record<string, string> = {};
  for (const record of records) {
    if (!isPlainObject(record)) continue;
    const { id, key } = record;
    if (typeof id === "string" && id.length > 0 && typeof key === "string" && key.length > 0) {
      keymapOverrides[id] = key;
    }
  }
  return { keymapOverrides };
}
