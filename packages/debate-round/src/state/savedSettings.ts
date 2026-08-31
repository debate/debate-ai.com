/**
 * @fileoverview Account-sync validation for `state/settings.ts`'s
 * `Settings` registry (today `debateStyle`/`fontSize`, see `settingsGroups`) —
 * lets a signed-in user's chosen values follow them across devices instead
 * of staying stuck in one browser's `localStorage`. Only each setting's
 * primitive `value` is synced, not the whole `Setting` metadata object
 * (name/options/etc.), since that's static, code-defined registry data, not
 * per-user state.
 *
 * @module state/savedSettings
 */

/** A setting key mapped to its current primitive value, e.g. `{ fontSize: 14 }`. */
export type SettingsSyncData = Record<string, string | number | boolean>;

/** Generous cap for a JSON-stringified `SettingsSyncData` map — this registry is small. */
export const MAX_SAVED_SETTINGS_BYTES = 8192;

/**
 * True when `value` is a plain object whose every key is a non-empty string
 * and every value is a string, number, or boolean, and the whole thing
 * serializes under {@link MAX_SAVED_SETTINGS_BYTES}. Used to validate a PUT
 * body before it's written to the database, and a GET response before it's
 * merged into the local `Settings` registry.
 */
export function isValidSettingsData(value: unknown): value is SettingsSyncData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof key !== "string" || key.length === 0) return false;
    if (
      typeof entryValue !== "string" &&
      typeof entryValue !== "number" &&
      typeof entryValue !== "boolean"
    ) {
      return false;
    }
  }

  return JSON.stringify(value).length <= MAX_SAVED_SETTINGS_BYTES;
}
