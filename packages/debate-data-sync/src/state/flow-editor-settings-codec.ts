/**
 * @fileoverview Adapts the Ebb flow editor's two single-object settings
 * stores — `ebb-display-settings` and `ebb-keymap-settings`, see
 * `debate-flow`'s `useFlowStore.ts` — to the array-of-records shape
 * `TOOL_RECORD_COLLECTIONS` syncs.
 *
 * Each store is one object, so each becomes a one-record collection whose
 * `id` is {@link FLOW_EDITOR_SETTINGS_RECORD_ID}. `debate-flow` keeps reading
 * and writing its own object untouched; the sync only wraps it.
 *
 * Not every display field belongs to the account. {@link redactFlowDisplaySettings}
 * holds back what describes *this device* — the flows folder path, panel
 * open/closed state — and the live-collaboration switches and contact list,
 * which turn networking on or name peers and should be opted into per device.
 * The merge restores those fields from this browser's copy (see
 * `restoreRedactedFields`), so a pull never resets them.
 *
 * Pure — no storage or network.
 *
 * @module state/flow-editor-settings-codec
 */

/** The one record each settings collection holds. */
export const FLOW_EDITOR_SETTINGS_RECORD_ID = "settings";

/** The display fields that follow the user to every device. */
export const SYNCED_FLOW_DISPLAY_FIELDS: readonly string[] = [
  "flowFont",
  "defaultGridZoom",
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
];

/** Wraps a stored settings object as its single record; anything else syncs nothing. */
export function decodeFlowEditorSettings(raw: unknown): Record<string, unknown>[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
  return [{ id: FLOW_EDITOR_SETTINGS_RECORD_ID, ...(raw as Record<string, unknown>) }];
}

/**
 * Unwraps the merged records back to the stored object (the inverse of
 * {@link decodeFlowEditorSettings}). An empty list encodes to `{}`, which
 * `debate-flow` reads as "all defaults".
 */
export function encodeFlowEditorSettings(records: readonly unknown[]): Record<string, unknown> {
  for (const record of records) {
    if (typeof record !== "object" || record === null || Array.isArray(record)) continue;
    const { id, ...settings } = record as Record<string, unknown>;
    if (id === FLOW_EDITOR_SETTINGS_RECORD_ID) return settings;
  }
  return {};
}

/**
 * A `ToolRecordCollection.redact` for `ebb-display-settings`: keeps only
 * {@link SYNCED_FLOW_DISPLAY_FIELDS}, so a field added to the store later stays
 * on-device until it is listed here on purpose.
 */
export function redactFlowDisplaySettings(record: unknown): unknown {
  if (typeof record !== "object" || record === null || Array.isArray(record)) return record;
  const source = record as Record<string, unknown>;
  const kept: Record<string, unknown> = { id: source.id };
  for (const field of SYNCED_FLOW_DISPLAY_FIELDS) {
    if (field in source) kept[field] = source[field];
  }
  return kept;
}
