/**
 * @fileoverview Adapts the flow editor's two single-object `localStorage`
 * settings stores — `ebb-display-settings` (a flat object of display and
 * collaboration toggles) and `ebb-keymap-settings` (`{ keymapOverrides }`) —
 * to the array-of-records shape `TOOL_RECORD_COLLECTIONS` syncs.
 *
 * Each store becomes exactly one record with a fixed id, so a signed-in user's
 * zoom, font, colours and rebound keys follow them to another device. Field
 * validation stays with the flow editor's own loader (`debate-flow`'s
 * `useFlowStore`), which already resolves every field defensively when it
 * reads the store; this module only moves the object in and out of a record.
 *
 * `flowsDir` is a path on one desktop install, so {@link redactFlowEditorDisplay}
 * keeps it out of the account (the merge restores this browser's own value).
 *
 * Pure — no storage or network.
 *
 * @module state/flow-editor-settings-codec
 */

/** Id of the single display-settings record. */
export const FLOW_EDITOR_DISPLAY_RECORD_ID = "display";
/** Id of the single keymap record. */
export const FLOW_EDITOR_KEYMAP_RECORD_ID = "keymap";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The stored display object as a one-record list; empty when the store is
 * absent or malformed.
 *
 * @param raw - The parsed `ebb-display-settings` value.
 */
export function decodeFlowEditorDisplay(raw: unknown): Record<string, unknown>[] {
  if (!isPlainObject(raw)) return [];
  const { id: _ignored, ...fields } = raw;
  return [{ ...fields, id: FLOW_EDITOR_DISPLAY_RECORD_ID }];
}

/**
 * Rebuilds the stored display object from records (inverse of
 * {@link decodeFlowEditorDisplay}); `{}` when there is no display record, which
 * the editor's loader reads as "all defaults".
 *
 * @param records - Records merged from the account and this browser.
 */
export function encodeFlowEditorDisplay(records: readonly unknown[]): Record<string, unknown> {
  const record = records.find(
    (r) => isPlainObject(r) && r.id === FLOW_EDITOR_DISPLAY_RECORD_ID,
  ) as Record<string, unknown> | undefined;
  if (!record) return {};
  const { id: _id, ...fields } = record;
  return fields;
}

/**
 * Drops the per-device desktop folder before a display record is sent to the
 * account.
 *
 * @param record - A display record.
 */
export function redactFlowEditorDisplay(record: unknown): unknown {
  if (!isPlainObject(record)) return record;
  const { flowsDir: _flowsDir, ...rest } = record;
  return rest;
}

/**
 * The stored keymap as a one-record list. Only string-to-string overrides are
 * kept; a store with no overrides yields no record, so a user who never
 * rebound a key pushes nothing.
 *
 * @param raw - The parsed `ebb-keymap-settings` value.
 */
export function decodeFlowEditorKeymap(raw: unknown): Record<string, unknown>[] {
  if (!isPlainObject(raw) || !isPlainObject(raw.keymapOverrides)) return [];
  const keymapOverrides: Record<string, string> = {};
  for (const [action, accelerator] of Object.entries(raw.keymapOverrides)) {
    if (typeof accelerator === "string") keymapOverrides[action] = accelerator;
  }
  if (Object.keys(keymapOverrides).length === 0) return [];
  return [{ id: FLOW_EDITOR_KEYMAP_RECORD_ID, keymapOverrides }];
}

/**
 * Rebuilds the stored keymap object from records (inverse of
 * {@link decodeFlowEditorKeymap}).
 *
 * @param records - Records merged from the account and this browser.
 */
export function encodeFlowEditorKeymap(
  records: readonly unknown[],
): { keymapOverrides: Record<string, string> } {
  const record = decodeFlowEditorKeymap({
    keymapOverrides: (
      records.find((r) => isPlainObject(r) && r.id === FLOW_EDITOR_KEYMAP_RECORD_ID) as
        | Record<string, unknown>
        | undefined
    )?.keymapOverrides,
  });
  return { keymapOverrides: (record[0]?.keymapOverrides as Record<string, string>) ?? {} };
}
