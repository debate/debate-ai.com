/**
 * @fileoverview The flow editor settings that follow a signed-in user across
 * devices, as the array-of-records shape `debate-data-sync`'s tool-record
 * catalog (`ebbSyncedSettings`) syncs.
 *
 * The editor keeps its display and keymap settings as single objects in
 * `ebb-display-settings` / `ebb-keymap-settings`, which cannot be keyed, and
 * mixes in values that describe this machine rather than this user
 * ({@link DEVICE_ONLY_KEYS}). So the synced copy lives under its own key as two
 * records: `display` (only {@link SYNCED_DISPLAY_KEYS}) and `keymap`.
 * Hydration replaces a record wholesale, so keeping the device-only values out
 * of it is what stops a sign-in on a second machine from clobbering its
 * folder or panel layout.
 *
 * Pure - no storage or store access - so the store and the tests share it.
 *
 * @module lib/store/syncedSettings
 */

/** `localStorage` key of the synced records. Matches the catalog's `storageKey`. */
export const SYNCED_SETTINGS_KEY = "ebbSyncedSettings";

/** Display settings that describe the user's preferences and travel with them. */
export const SYNCED_DISPLAY_KEYS = [
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

/**
 * Display settings that stay on this machine: a folder path, panel layout, and
 * the live-collab toggles, name and contacts, which are session/identity
 * choices made per device.
 */
export const DEVICE_ONLY_KEYS = [
    "flowsDir",
    "sidebarCollapsed",
    "rfdOpen",
    "collabEnabled",
    "collabRelayEnabled",
    "collabListenEnabled",
    "collabShowViewers",
    "collabName",
    "contacts",
] as const;

export type SyncedDisplayKey = (typeof SYNCED_DISPLAY_KEYS)[number];

export interface SyncedDisplayRecord {
    id: "display";
    values: Record<string, unknown>;
}

export interface SyncedKeymapRecord {
    id: "keymap";
    keymapOverrides: Record<string, string>;
}

export type SyncedSettingsRecord = SyncedDisplayRecord | SyncedKeymapRecord;

/** The synced subset of a display-settings object. */
export function pickSyncedDisplay(display: Record<string, unknown>): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const key of SYNCED_DISPLAY_KEYS) {
        if (key in display) values[key] = display[key];
    }
    return values;
}

/** A string-to-string map, dropping anything else; `{}` for a non-object. */
function cleanOverrides(value: unknown): Record<string, string> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    const out: Record<string, string> = {};
    for (const [command, chord] of Object.entries(value)) {
        if (typeof chord === "string" && chord) out[command] = chord;
    }
    return out;
}

/** The two records to store for the given settings. */
export function buildSyncedSettingsRecords(
    display: Record<string, unknown>,
    keymapOverrides: Record<string, string>,
): SyncedSettingsRecord[] {
    return [
        { id: "display", values: pickSyncedDisplay(display) },
        { id: "keymap", keymapOverrides: cleanOverrides(keymapOverrides) },
    ];
}

export interface ParsedSyncedSettings {
    /** Present only when a `display` record exists; holds synced keys only. */
    display?: Record<string, unknown>;
    /** Present only when a `keymap` record exists. */
    keymapOverrides?: Record<string, string>;
}

/** Reads stored (or hydrated) records defensively; unknown shapes are ignored. */
export function parseSyncedSettings(stored: unknown): ParsedSyncedSettings {
    const out: ParsedSyncedSettings = {};
    if (!Array.isArray(stored)) return out;
    for (const record of stored) {
        if (typeof record !== "object" || record === null) continue;
        const r = record as Record<string, unknown>;
        if (r.id === "display" && typeof r.values === "object" && r.values !== null) {
            out.display = pickSyncedDisplay(r.values as Record<string, unknown>);
        } else if (r.id === "keymap") {
            out.keymapOverrides = cleanOverrides(r.keymapOverrides);
        }
    }
    return out;
}
