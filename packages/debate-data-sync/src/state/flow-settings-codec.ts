/**
 * @fileoverview Adapts the `ebb` flow editor's two single-object settings
 * stores — `ebb-display-settings` and `ebb-keymap-settings`, see
 * `debate-flow`'s `useFlowStore.ts` — to the array-of-records shape
 * `TOOL_RECORD_COLLECTIONS` syncs.
 *
 * Each store becomes exactly one record with the fixed id
 * {@link FLOW_SETTINGS_RECORD_ID}, so the account holds one row per user per
 * store. Only fields that describe how the user likes to flow travel: the
 * font, zoom, theme, side colours, editing toggles and key bindings. Fields
 * that describe *this device* — the desktop flows folder, collaboration
 * relay/listen switches, contacts, panel open state — stay local, and
 * {@link encodeFlowDisplaySettings} / {@link encodeFlowKeymapSettings} merge
 * adopted values over the stored object so a sync never erases them.
 *
 * Pure — no storage or network — so the sync and the tests can import it.
 *
 * @module state/flow-settings-codec
 */

/** The id of the single record each flow-settings collection holds. */
export const FLOW_SETTINGS_RECORD_ID = "settings";

const STRING_FIELDS = ["flowFont", "cardmirrorTextType", "theme"] as const;
const BOOLEAN_FIELDS = [
  "rfdVim",
  "insertPaste",
  "appendEdit",
  "scrollZoom",
  "alignSpeeches",
  "tooltips",
  "cardmirrorEnabled",
] as const;
const COLOR_FIELDS = ["affColor", "negColor"] as const;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The syncable subset of a display-settings object, dropping malformed values. */
function pickDisplayFields(source: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of STRING_FIELDS) {
    if (typeof source[key] === "string" && source[key] !== "") picked[key] = source[key];
  }
  for (const key of BOOLEAN_FIELDS) {
    if (typeof source[key] === "boolean") picked[key] = source[key];
  }
  for (const key of COLOR_FIELDS) {
    const value = source[key];
    if (value === null || (typeof value === "string" && HEX_COLOR.test(value))) picked[key] = value;
  }
  const zoom = source.defaultGridZoom;
  if (typeof zoom === "number" && Number.isFinite(zoom) && zoom >= ZOOM_MIN && zoom <= ZOOM_MAX) {
    picked.defaultGridZoom = zoom;
  }
  return picked;
}

/**
 * Turns the stored display settings into its one syncable record.
 *
 * @param stored - The parsed `ebb-display-settings` value.
 * @returns `[]` when there is nothing valid to sync.
 */
export function decodeFlowDisplaySettings(stored: unknown): unknown[] {
  if (!isObject(stored)) return [];
  const fields = pickDisplayFields(stored);
  return Object.keys(fields).length === 0 ? [] : [{ id: FLOW_SETTINGS_RECORD_ID, ...fields }];
}

/**
 * Merges the synced record over the stored display settings, leaving every
 * device-local field in `current` untouched.
 *
 * @param records - Records merged from the account and this browser.
 * @param current - The parsed `ebb-display-settings` currently in storage.
 */
export function encodeFlowDisplaySettings(records: readonly unknown[], current?: unknown): unknown {
  const base = isObject(current) ? current : {};
  const record = records.find((r) => isObject(r) && r.id === FLOW_SETTINGS_RECORD_ID);
  if (!isObject(record)) return base;
  return { ...base, ...pickDisplayFields(record) };
}

/** Only entries mapping a command id to a non-empty key-binding string. */
function pickKeymapOverrides(value: unknown): Record<string, string> {
  const overrides: Record<string, string> = {};
  if (!isObject(value)) return overrides;
  for (const [command, binding] of Object.entries(value)) {
    if (command !== "" && typeof binding === "string" && binding !== "") overrides[command] = binding;
  }
  return overrides;
}

/**
 * Turns the stored keymap settings into its one syncable record.
 *
 * @param stored - The parsed `ebb-keymap-settings` value.
 * @returns `[]` when no binding is overridden (the default keymap needs no row).
 */
export function decodeFlowKeymapSettings(stored: unknown): unknown[] {
  if (!isObject(stored)) return [];
  const keymapOverrides = pickKeymapOverrides(stored.keymapOverrides);
  return Object.keys(keymapOverrides).length === 0
    ? []
    : [{ id: FLOW_SETTINGS_RECORD_ID, keymapOverrides }];
}

/**
 * Rebuilds the stored keymap settings from the synced record.
 *
 * @param records - Records merged from the account and this browser.
 * @param current - The parsed `ebb-keymap-settings` currently in storage.
 */
export function encodeFlowKeymapSettings(records: readonly unknown[], current?: unknown): unknown {
  const base = isObject(current) ? current : {};
  const record = records.find((r) => isObject(r) && r.id === FLOW_SETTINGS_RECORD_ID);
  if (!isObject(record)) return base;
  return { ...base, keymapOverrides: pickKeymapOverrides(record.keymapOverrides) };
}
