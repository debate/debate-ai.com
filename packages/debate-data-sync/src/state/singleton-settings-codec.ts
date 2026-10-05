/**
 * @fileoverview Adapts a single-object settings store — one JSON object under
 * one `localStorage` key, such as the flow editor's `ebb-display-settings` —
 * to the array-of-records shape `TOOL_RECORD_COLLECTIONS` syncs.
 *
 * The object becomes exactly one record with the fixed id
 * {@link SETTINGS_RECORD_ID}, so a setting changed on one device reaches the
 * account as one row and is adopted whole on the next.
 *
 * Some fields describe the device rather than the user (a desktop flows
 * folder path, a peer contact list). Those `localOnlyKeys` are dropped on
 * decode, so they never leave the browser, and carried over from whatever is
 * already stored when records are encoded back, so adopting the account's
 * copy never wipes them.
 *
 * Pure apart from the one `localStorage` read `encode` needs to preserve the
 * local-only keys; a missing or unreadable store simply preserves nothing.
 *
 * @module state/singleton-settings-codec
 */

/** The id of the one record a singleton settings store becomes. */
export const SETTINGS_RECORD_ID = "settings";

/** Options for {@link createSingletonSettingsCodec}. */
export interface SingletonSettingsCodecOptions {
  /** The `localStorage` key the settings object lives under. */
  storageKey: string;
  /** Top-level fields that describe this device and are held back from the account. */
  localOnlyKeys?: readonly string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
 * Builds the `codec` for a catalog entry whose store is one settings object.
 *
 * @param options - The store's key and any device-only fields.
 * @returns A `decode`/`encode` pair for `ToolRecordCollection.codec`.
 */
export function createSingletonSettingsCodec(options: SingletonSettingsCodecOptions): {
  decode: (stored: unknown) => unknown[];
  encode: (records: readonly unknown[]) => unknown;
} {
  const localOnly = new Set(options.localOnlyKeys ?? []);

  return {
    decode(stored) {
      if (!isPlainObject(stored)) return [];
      const record: Record<string, unknown> = { id: SETTINGS_RECORD_ID };
      for (const [key, value] of Object.entries(stored)) {
        if (key === "id" || localOnly.has(key)) continue;
        record[key] = value;
      }
      return Object.keys(record).length > 1 ? [record] : [];
    },

    encode(records) {
      const settings = records.find(
        (record): record is Record<string, unknown> =>
          isPlainObject(record) && record.id === SETTINGS_RECORD_ID,
      );
      const current = readStoredObject(options.storageKey);
      const result: Record<string, unknown> = {};
      if (settings) {
        for (const [key, value] of Object.entries(settings)) {
          if (key !== "id" && !localOnly.has(key)) result[key] = value;
        }
      } else {
        // Nothing from the account or this browser: leave the store as it was.
        return current;
      }
      for (const key of localOnly) {
        if (key in current) result[key] = current[key];
      }
      return result;
    },
  };
}
