/**
 * @fileoverview Adapts the flow editor's two single-object settings stores —
 * `ebb-display-settings` and `ebb-keymap-settings`, see `debate-flow`'s
 * `useFlowStore.ts` — to the array-of-records shape `TOOL_RECORD_COLLECTIONS`
 * syncs, so a signed-in user's flow-editor preferences follow them to a second
 * device without a new column on `user_settings`.
 *
 * Each store becomes one record with a fixed `id`. Only preferences about how
 * the user likes to flow are synced; anything tied to this browser or machine
 * (the desktop flows folder, live-collaboration identity and relay switches,
 * the contact list, sidebar layout) stays local, and {@link
 * encodeFlowDisplaySettings} keeps those fields from the value already stored
 * when the account's copy is written back.
 *
 * Pure — no storage or network.
 *
 * @module state/flow-editor-settings-codec
 */

/** Record id of the display-settings record. */
export const FLOW_DISPLAY_RECORD_ID = "display";
/** Record id of the keymap record. */
export const FLOW_KEYMAP_RECORD_ID = "keymap";

type Primitive = "string" | "number" | "boolean";

/** The display fields that sync, with the primitive type each must have. */
const SYNCED_DISPLAY_FIELDS: Record<string, Primitive> = {
  flowFont: "string",
  defaultGridZoom: "number",
  rfdVim: "boolean",
  insertPaste: "boolean",
  appendEdit: "boolean",
  scrollZoom: "boolean",
  alignSpeeches: "boolean",
  tooltips: "boolean",
  cardmirrorEnabled: "boolean",
  cardmirrorTextType: "string",
  theme: "string",
  affColor: "string",
  negColor: "string",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickSyncedDisplay(source: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const [field, type] of Object.entries(SYNCED_DISPLAY_FIELDS)) {
    const value = source[field];
    if (typeof value === type && (type !== "number" || Number.isFinite(value))) picked[field] = value;
    else if (value === null && (field === "affColor" || field === "negColor")) picked[field] = null;
  }
  return picked;
}

/**
 * The synced slice of the stored display settings as at most one record.
 *
 * @param raw - The parsed `ebb-display-settings` value.
 */
export function decodeFlowDisplaySettings(raw: unknown): unknown[] {
  if (!isPlainObject(raw)) return [];
  const picked = pickSyncedDisplay(raw);
  return Object.keys(picked).length === 0 ? [] : [{ id: FLOW_DISPLAY_RECORD_ID, ...picked }];
}

/**
 * Rebuilds the stored display settings: the account's synced fields laid over
 * whatever is already stored, so device-local fields survive.
 *
 * @param records - Records merged from the account and this browser.
 * @param current - The value currently under `ebb-display-settings`.
 */
export function encodeFlowDisplaySettings(records: readonly unknown[], current?: unknown): unknown {
  const base = isPlainObject(current) ? current : {};
  const record = records.find((r) => isPlainObject(r) && r.id === FLOW_DISPLAY_RECORD_ID);
  return isPlainObject(record) ? { ...base, ...pickSyncedDisplay(record) } : base;
}

function pickOverrides(source: unknown): Record<string, string> {
  const overrides: Record<string, string> = {};
  if (!isPlainObject(source)) return overrides;
  for (const [action, keys] of Object.entries(source)) {
    if (typeof keys === "string") overrides[action] = keys;
  }
  return overrides;
}

/**
 * The stored keymap as at most one record; an empty override map is "nothing
 * to sync".
 *
 * @param raw - The parsed `ebb-keymap-settings` value.
 */
export function decodeFlowKeymapSettings(raw: unknown): unknown[] {
  const keymapOverrides = pickOverrides(isPlainObject(raw) ? raw.keymapOverrides : undefined);
  return Object.keys(keymapOverrides).length === 0 ? [] : [{ id: FLOW_KEYMAP_RECORD_ID, keymapOverrides }];
}

/**
 * Rebuilds the stored keymap (`{ keymapOverrides }`) from records.
 *
 * @param records - Records merged from the account and this browser.
 */
export function encodeFlowKeymapSettings(records: readonly unknown[]): unknown {
  const record = records.find((r) => isPlainObject(r) && r.id === FLOW_KEYMAP_RECORD_ID);
  return { keymapOverrides: pickOverrides(isPlainObject(record) ? record.keymapOverrides : undefined) };
}
