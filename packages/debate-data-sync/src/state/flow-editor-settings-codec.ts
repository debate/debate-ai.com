/**
 * @fileoverview Adapts the `ebb` flow editor's two single-object settings
 * stores — `ebb-display-settings` and `ebb-keymap-settings`, see
 * `debate-flow`'s `useFlowStore.ts` — to the array-of-records shape
 * `TOOL_RECORD_COLLECTIONS` syncs, so a debater's fonts, zoom, colours and
 * rebound keys follow them to a second device.
 *
 * Each store becomes exactly one record with the fixed {@link FLOW_SETTINGS_RECORD_ID}.
 * Only preferences about *how the user likes to flow* travel. Anything that
 * describes this browser or other people stays put: `flowsDir` is a
 * filesystem path on one machine, `sidebarCollapsed` is a layout state, and
 * the `collab*` fields and `contacts` are peer identities and relay choices.
 * {@link encodeFlowDisplaySettings} writes merged records back *over* the
 * stored object, so those local fields survive an account merge untouched.
 *
 * Pure — no storage or network. Values are only type-checked loosely here;
 * the store re-validates every field when it reads (`resolveFontId`,
 * `resolveZoom`, `resolveColor`, …), which is the single source of truth for
 * what a legal value is.
 *
 * @module state/flow-editor-settings-codec
 */

/** The only record id either store produces. */
export const FLOW_SETTINGS_RECORD_ID = "settings";

/** Display fields that sync. Everything else in the stored object is device-local. */
export const SYNCED_FLOW_DISPLAY_FIELDS = [
  "flowFont",
  "defaultGridZoom",
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

type PlainRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is PlainRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickSyncedDisplayFields(source: PlainRecord): PlainRecord {
  const picked: PlainRecord = {};
  for (const field of SYNCED_FLOW_DISPLAY_FIELDS) {
    if (field in source && source[field] !== undefined) picked[field] = source[field];
  }
  return picked;
}

/**
 * The stored display settings as one record holding only the synced fields.
 * An empty or malformed store yields no record at all (nothing to sync).
 *
 * @param stored - The parsed `ebb-display-settings` value.
 */
export function decodeFlowDisplaySettings(stored: unknown): PlainRecord[] {
  if (!isPlainRecord(stored)) return [];
  const fields = pickSyncedDisplayFields(stored);
  if (Object.keys(fields).length === 0) return [];
  return [{ id: FLOW_SETTINGS_RECORD_ID, ...fields }];
}

/**
 * Folds the merged settings record back into the stored object.
 *
 * @param records - Records merged from the account and this browser.
 * @param existing - The parsed value currently in `localStorage`, whose
 *   device-local fields (`flowsDir`, `collab*`, …) are carried over.
 */
export function encodeFlowDisplaySettings(
  records: readonly unknown[],
  existing?: unknown,
): PlainRecord {
  const base = isPlainRecord(existing) ? existing : {};
  const record = records.find(
    (r): r is PlainRecord => isPlainRecord(r) && r.id === FLOW_SETTINGS_RECORD_ID,
  );
  return record ? { ...base, ...pickSyncedDisplayFields(record) } : { ...base };
}

/** Keeps only `commandId -> chord` pairs where both sides are non-empty strings. */
function cleanOverrides(value: unknown): Record<string, string> {
  const overrides: Record<string, string> = {};
  if (!isPlainRecord(value)) return overrides;
  for (const [commandId, chord] of Object.entries(value)) {
    if (commandId.trim() !== "" && typeof chord === "string" && chord.trim() !== "") {
      overrides[commandId] = chord;
    }
  }
  return overrides;
}

/**
 * The stored keymap as one record. No overrides means no record, so a user who
 * never rebound a key syncs nothing.
 *
 * @param stored - The parsed `ebb-keymap-settings` value (`{ keymapOverrides }`).
 */
export function decodeFlowKeymapSettings(stored: unknown): PlainRecord[] {
  if (!isPlainRecord(stored)) return [];
  const keymapOverrides = cleanOverrides(stored.keymapOverrides);
  if (Object.keys(keymapOverrides).length === 0) return [];
  return [{ id: FLOW_SETTINGS_RECORD_ID, keymapOverrides }];
}

/**
 * Rebuilds the stored keymap object from the merged record.
 *
 * @param records - Records merged from the account and this browser.
 */
export function encodeFlowKeymapSettings(records: readonly unknown[]): {
  keymapOverrides: Record<string, string>;
} {
  const record = records.find(
    (r): r is PlainRecord => isPlainRecord(r) && r.id === FLOW_SETTINGS_RECORD_ID,
  );
  return { keymapOverrides: cleanOverrides(record?.keymapOverrides) };
}
