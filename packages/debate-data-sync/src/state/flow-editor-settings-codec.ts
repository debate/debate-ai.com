/**
 * @fileoverview Adapts the ebb flow editor's two single-object settings stores
 * — `ebb-display-settings` (a flat object of display/behaviour toggles) and
 * `ebb-keymap-settings` (`{ keymapOverrides }`, see `debate-flow`'s
 * `useFlowStore.ts`) — to the array-of-records shape `TOOL_RECORD_COLLECTIONS`
 * syncs.
 *
 * Each setting becomes one record `{ id: <field>, value }`, so changing the
 * font on one device and a keybinding on another merge instead of one
 * overwriting the other. Fields that describe *this browser* rather than this
 * user (`flowsDir`, a desktop folder path; `sidebarCollapsed` and `rfdOpen`,
 * panel layout) never leave it, and `encode` keeps whatever is already stored
 * for them rather than resetting them to defaults.
 *
 * Values are validated per field on the way in, so a corrupted account row
 * cannot put a nonsense value in the editor's own store.
 *
 * @module state/flow-editor-settings-codec
 */

/** One synced setting: the field name as `id`, plus its value. */
export interface FlowEditorSettingRecord {
  id: string;
  value: unknown;
}

type Validator = (value: unknown) => boolean;

const isBool: Validator = (v) => typeof v === "boolean";
const isHexColor: Validator = (v) => v === null || (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v));
const isShortString =
  (max: number): Validator =>
  (v) =>
    typeof v === "string" && v.length <= max;

/** Display fields that follow the user across devices, with their validators. */
export const SYNCED_DISPLAY_FIELDS: Readonly<Record<string, Validator>> = {
  flowFont: isShortString(64),
  defaultGridZoom: (v) => typeof v === "number" && Number.isFinite(v) && v >= 0.5 && v <= 3,
  rfdVim: isBool,
  insertPaste: isBool,
  appendEdit: isBool,
  scrollZoom: isBool,
  alignSpeeches: isBool,
  tooltips: isBool,
  cardmirrorEnabled: isBool,
  cardmirrorTextType: isShortString(32),
  theme: isShortString(16),
  affColor: isHexColor,
  negColor: isHexColor,
};

const MAX_KEYMAP_ENTRIES = 500;

function parseObject(raw: unknown): Record<string, unknown> | null {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

/** Reads the object currently stored under `storageKey`, so local-only fields survive an encode. */
function readStoredObject(storageKey: string): Record<string, unknown> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey);
    return (raw ? parseObject(JSON.parse(raw)) : null) ?? {};
  } catch {
    return {};
  }
}

function toRecords(records: readonly unknown[]): FlowEditorSettingRecord[] {
  const out: FlowEditorSettingRecord[] = [];
  for (const record of records) {
    const obj = parseObject(record);
    if (obj && typeof obj.id === "string" && "value" in obj) {
      out.push({ id: obj.id, value: obj.value });
    }
  }
  return out;
}

/**
 * Flattens the stored display settings into one record per synced field,
 * skipping local-only fields and any value that fails its validator.
 *
 * @param raw - The parsed `ebb-display-settings` value.
 */
export function decodeFlowDisplaySettings(raw: unknown): FlowEditorSettingRecord[] {
  const stored = parseObject(raw);
  if (!stored) return [];
  const records: FlowEditorSettingRecord[] = [];
  for (const [id, isValid] of Object.entries(SYNCED_DISPLAY_FIELDS)) {
    if (id in stored && isValid(stored[id])) records.push({ id, value: stored[id] });
  }
  return records;
}

/**
 * Rebuilds the stored display object from records (the inverse of
 * {@link decodeFlowDisplaySettings}), laid over what is already stored so the
 * local-only fields keep their values. Unknown or invalid records are dropped.
 *
 * @param records - Records merged from the account and this browser.
 */
export function encodeFlowDisplaySettings(records: readonly unknown[]): Record<string, unknown> {
  const next = readStoredObject("ebb-display-settings");
  for (const { id, value } of toRecords(records)) {
    const isValid = SYNCED_DISPLAY_FIELDS[id];
    if (isValid && isValid(value)) next[id] = value;
  }
  return next;
}

/**
 * Flattens `{ keymapOverrides: { action: keys } }` into one record per rebound
 * action. Non-string bindings are dropped.
 *
 * @param raw - The parsed `ebb-keymap-settings` value.
 */
export function decodeFlowKeymap(raw: unknown): FlowEditorSettingRecord[] {
  const overrides = parseObject(parseObject(raw)?.keymapOverrides);
  if (!overrides) return [];
  const records: FlowEditorSettingRecord[] = [];
  for (const [id, value] of Object.entries(overrides)) {
    if (id.trim() && typeof value === "string" && value.length <= 64) records.push({ id, value });
    if (records.length >= MAX_KEYMAP_ENTRIES) break;
  }
  return records;
}

/**
 * Rebuilds `{ keymapOverrides }` from records (the inverse of
 * {@link decodeFlowKeymap}).
 *
 * @param records - Records merged from the account and this browser.
 */
export function encodeFlowKeymap(records: readonly unknown[]): { keymapOverrides: Record<string, string> } {
  const keymapOverrides: Record<string, string> = {};
  for (const { id, value } of toRecords(records)) {
    if (id.trim() && typeof value === "string" && value.length <= 64) keymapOverrides[id] = value;
  }
  return { keymapOverrides };
}
