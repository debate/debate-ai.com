/**
 * Pure codec between the flow editor's two settings blobs (display settings and
 * keymap overrides, kept in `ebb-display-settings` / `ebb-keymap-settings`) and
 * the id-keyed record array the account sync carries.
 *
 * The data-sync catalog (`flowEditorSettings` in `toolRecordCollections.ts`)
 * watches {@link FLOW_EDITOR_SETTINGS_KEY} and syncs it row by row, so this
 * package only has to keep that key current — it never talks to the network.
 * Two fixed ids, so each blob is one account row and a change on one device
 * replaces only its own row on another.
 *
 * `flowsDir` is deliberately left out: it is a path on this machine's disk.
 */

/** localStorage key the data-sync catalog's `flowEditorSettings` entry watches. */
export const FLOW_EDITOR_SETTINGS_KEY = "flowEditorSettings";

export const DISPLAY_RECORD_ID = "display";
export const KEYMAP_RECORD_ID = "keymap";

/** Device-local display fields that never leave this browser or machine. */
const DEVICE_LOCAL_FIELDS = ["flowsDir"] as const;

export interface FlowEditorSettingsRecords {
    /** The display blob without device-local fields, or `null` when absent. */
    display: Record<string, unknown> | null;
    /** The keymap overrides (command id to chord), or `null` when absent. */
    keymapOverrides: Record<string, string> | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Builds the synced record array from the current settings. */
export function encodeFlowEditorSettings(
    display: Record<string, unknown>,
    keymapOverrides: Record<string, string>,
): Array<Record<string, unknown>> {
    const synced: Record<string, unknown> = { ...display };
    for (const field of DEVICE_LOCAL_FIELDS) delete synced[field];
    return [
        { id: DISPLAY_RECORD_ID, ...synced },
        { id: KEYMAP_RECORD_ID, keymapOverrides: { ...keymapOverrides } },
    ];
}

/**
 * Reads the record array back. Anything malformed (not an array, wrong ids,
 * non-string chords) is dropped rather than thrown, so a hand-edited or
 * half-synced value degrades to "use the legacy keys".
 */
export function decodeFlowEditorSettings(raw: unknown): FlowEditorSettingsRecords {
    const out: FlowEditorSettingsRecords = { display: null, keymapOverrides: null };
    if (!Array.isArray(raw)) return out;
    for (const record of raw) {
        if (!isPlainObject(record)) continue;
        const { id, ...rest } = record;
        if (id === DISPLAY_RECORD_ID) {
            for (const field of DEVICE_LOCAL_FIELDS) delete rest[field];
            out.display = rest;
        } else if (id === KEYMAP_RECORD_ID && isPlainObject(rest.keymapOverrides)) {
            const chords: Record<string, string> = {};
            for (const [commandId, chord] of Object.entries(rest.keymapOverrides)) {
                if (typeof chord === "string") chords[commandId] = chord;
            }
            out.keymapOverrides = chords;
        }
    }
    return out;
}
