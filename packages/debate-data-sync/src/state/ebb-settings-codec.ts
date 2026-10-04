/**
 * @fileoverview Adapts the `ebb` flow editor's two single-object settings
 * stores — `ebb-display-settings` (`@debate/flow-ebb`'s `useFlowStore`) and
 * `ebb-keymap-settings` — to the array-of-records shape
 * `TOOL_RECORD_COLLECTIONS` syncs.
 *
 * Each store becomes **one** record with a fixed `id`, so the whole preference
 * set reaches the account as a single row and the newest device's choice wins
 * on the next hydrate (the catalog's usual "account is the shared truth"
 * merge).
 *
 * Only an allowlist of portable fields leaves the browser. Display settings
 * also hold per-device state — the desktop flows folder, whether the sidebar or
 * RFD drawer is open — and collaboration identity (`collabName`, `contacts`);
 * those stay local. `encode` therefore layers the account's fields over what
 * this browser already stores, so applying the account's copy never resets a
 * device-only field.
 *
 * Pure apart from that one guarded `localStorage` read in `encode`, so the
 * catalog test and the route's tests can import it.
 *
 * @module state/ebb-settings-codec
 */

/** The single record's id in both collections. */
export const EBB_SETTINGS_RECORD_ID = "settings";

/** Display fields that follow the user across devices. */
export const EBB_SYNCED_DISPLAY_FIELDS = [
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
] as const;

/** Keymap fields that follow the user across devices. */
export const EBB_SYNCED_KEYMAP_FIELDS = ["keymapOverrides"] as const;

type Codec = {
  decode: (stored: unknown) => unknown[];
  encode: (records: readonly unknown[]) => unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(source: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in source && source[field] !== undefined) out[field] = source[field];
  }
  return out;
}

function readStoredObject(storageKey: string): Record<string, unknown> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Builds a codec for one single-object settings store.
 *
 * @param storageKey - The `localStorage` key the store lives under; `encode`
 *   reads it to keep the fields that are not synced.
 * @param fields - The allowlist of fields that reach the account.
 * @param isValidField - Rejects a malformed value for a field, so a hand-edited
 *   or stale row is dropped instead of being written into the editor's store.
 */
function createSettingsCodec(
  storageKey: string,
  fields: readonly string[],
  isValidField: (field: string, value: unknown) => boolean,
): Codec {
  const sanitize = (source: Record<string, unknown>): Record<string, unknown> => {
    const picked = pick(source, fields);
    for (const field of Object.keys(picked)) {
      if (!isValidField(field, picked[field])) delete picked[field];
    }
    return picked;
  };

  return {
    decode(stored) {
      if (!isPlainObject(stored)) return [];
      const synced = sanitize(stored);
      if (Object.keys(synced).length === 0) return [];
      return [{ id: EBB_SETTINGS_RECORD_ID, ...synced }];
    },
    encode(records) {
      const local = readStoredObject(storageKey);
      for (const record of records) {
        if (!isPlainObject(record) || record.id !== EBB_SETTINGS_RECORD_ID) continue;
        const { id: _id, ...rest } = record;
        return { ...local, ...sanitize(rest) };
      }
      return local;
    },
  };
}

const BOOLEAN_DISPLAY_FIELDS = new Set([
  "rfdVim",
  "insertPaste",
  "appendEdit",
  "scrollZoom",
  "alignSpeeches",
  "tooltips",
  "cardmirrorEnabled",
]);

function isValidDisplayField(field: string, value: unknown): boolean {
  if (BOOLEAN_DISPLAY_FIELDS.has(field)) return typeof value === "boolean";
  switch (field) {
    case "defaultGridZoom":
      return typeof value === "number" && Number.isFinite(value);
    case "flowFont":
    case "cardmirrorTextType":
    case "theme":
      return typeof value === "string" && value.length > 0 && value.length <= 64;
    case "affColor":
    case "negColor":
      return value === null || (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value));
    default:
      return false;
  }
}

function isValidKeymapField(field: string, value: unknown): boolean {
  if (field !== "keymapOverrides" || !isPlainObject(value)) return false;
  return Object.values(value).every((binding) => typeof binding === "string");
}

/** Codec for `ebb-display-settings`. */
export const ebbDisplaySettingsCodec: Codec = createSettingsCodec(
  "ebb-display-settings",
  EBB_SYNCED_DISPLAY_FIELDS,
  isValidDisplayField,
);

/** Codec for `ebb-keymap-settings`. */
export const ebbKeymapSettingsCodec: Codec = createSettingsCodec(
  "ebb-keymap-settings",
  EBB_SYNCED_KEYMAP_FIELDS,
  isValidKeymapField,
);
