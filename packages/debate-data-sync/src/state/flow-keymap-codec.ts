/**
 * @fileoverview Adapts the flow editor's `ebb-keymap-settings` store — an
 * object `{ keymapOverrides: { [actionId]: keyCombo } }`, see `debate-flow`'s
 * `useFlowStore` — to the array-of-records shape `TOOL_RECORD_COLLECTIONS`
 * syncs.
 *
 * Each rebound action becomes one record whose `id` is the action id, so a
 * rebinding made on one device reaches the account row-by-row and a rebinding
 * on another only touches its own action. Only the keymap is carried: the
 * sibling `ebb-display-settings` mixes portable preferences with device-local
 * ones (`flowsDir` is a filesystem path), so it stays out of this sync.
 *
 * Pure — no storage or network.
 *
 * @module state/flow-keymap-codec
 */

/** One synced rebinding: the action id as `id`, plus its key combo. */
export interface FlowKeymapRecord {
  id: string;
  key: string;
}

/** Flattens the stored overrides into records, dropping malformed entries. */
export function decodeFlowKeymap(raw: unknown): FlowKeymapRecord[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
  const overrides = (raw as { keymapOverrides?: unknown }).keymapOverrides;
  if (typeof overrides !== "object" || overrides === null || Array.isArray(overrides)) return [];
  const records: FlowKeymapRecord[] = [];
  for (const [id, key] of Object.entries(overrides)) {
    if (id.trim().length === 0 || typeof key !== "string" || key.length === 0) continue;
    records.push({ id, key });
  }
  return records;
}

/** Rebuilds the stored shape from records (inverse of {@link decodeFlowKeymap}). */
export function encodeFlowKeymap(records: readonly unknown[]): {
  keymapOverrides: Record<string, string>;
} {
  const keymapOverrides: Record<string, string> = {};
  for (const record of records) {
    if (typeof record !== "object" || record === null) continue;
    const { id, key } = record as Record<string, unknown>;
    if (typeof id === "string" && id.trim() && typeof key === "string" && key) {
      keymapOverrides[id] = key;
    }
  }
  return { keymapOverrides };
}
