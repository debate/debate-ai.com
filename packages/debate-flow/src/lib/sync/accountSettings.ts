/**
 * Account-linked flow-editor settings: the ebb display preferences and keymap
 * overrides a signed-in user carries between devices through the
 * `user_settings.flow_editor_settings` column (`GET`/`PUT /api/settings`).
 *
 * Deliberately a leaf module: no store, no DOM and no other ebb import, so
 * `apps/debate-ai.com`'s settings route can validate a patch with the very
 * code the client builds one with, and the tests need no mocks.
 *
 * Only preferences that mean the same thing on every device sync. Layout that
 * is per-session (`sidebarCollapsed`, `rfdOpen`), a filesystem path
 * (`flowsDir`) and the collaboration identity (`collab*`, `contacts` - other
 * people's details) stay in this browser's localStorage.
 */

/** Boolean display preferences that sync. */
export const SYNCED_BOOLEAN_KEYS = [
    "rfdVim",
    "insertPaste",
    "appendEdit",
    "scrollZoom",
    "alignSpeeches",
    "tooltips",
    "cardmirrorEnabled",
] as const;

/** Every top-level key a patch may carry. */
export const FLOW_EDITOR_SETTING_KEYS: ReadonlySet<string> = new Set([
    ...SYNCED_BOOLEAN_KEYS,
    "flowFont",
    "defaultGridZoom",
    "cardmirrorTextType",
    "theme",
    "affColor",
    "negColor",
    "keymapOverrides",
]);

export type FlowEditorSettings = Record<string, unknown>;

export interface FlowEditorSettingsPatchResult {
    valid: FlowEditorSettings;
    errors: string[];
}

const MAX_KEYMAP_ENTRIES = 500;
const MAX_TOKEN_LENGTH = 100;
const THEMES = ["light", "dark", "system"];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isToken(value: unknown): value is string {
    return typeof value === "string" && value.length > 0 && value.length <= MAX_TOKEN_LENGTH;
}

/** Returns an error message for an invalid value, or `null` when it is acceptable. */
function checkValue(key: string, value: unknown): string | null {
    if ((SYNCED_BOOLEAN_KEYS as readonly string[]).includes(key)) {
        return typeof value === "boolean" ? null : `"${key}" must be a boolean.`;
    }
    switch (key) {
        case "defaultGridZoom":
            return typeof value === "number" && Number.isFinite(value) && value >= 0.5 && value <= 3
                ? null
                : '"defaultGridZoom" must be a number between 0.5 and 3.';
        case "theme":
            return THEMES.includes(value as string) ? null : '"theme" must be light, dark or system.';
        case "flowFont":
        case "cardmirrorTextType":
            return isToken(value) ? null : `"${key}" must be a short string.`;
        case "affColor":
        case "negColor":
            return value === null || (typeof value === "string" && HEX_COLOR.test(value))
                ? null
                : `"${key}" must be a #rrggbb color or null.`;
        case "keymapOverrides": {
            if (!isRecord(value)) return '"keymapOverrides" must be an object.';
            const entries = Object.entries(value);
            if (entries.length > MAX_KEYMAP_ENTRIES) return '"keymapOverrides" has too many entries.';
            return entries.every(([id, chord]) => isToken(id) && isToken(chord))
                ? null
                : '"keymapOverrides" must map command ids to chord strings.';
        }
        default:
            return `"${key}" is not a known flow editor setting.`;
    }
}

/**
 * Validates an untrusted patch. Unknown keys and bad values are reported
 * rather than dropped silently, so a stale client does not lose data quietly.
 */
export function normalizeFlowEditorSettingsPatch(input: unknown): FlowEditorSettingsPatchResult {
    if (input === undefined) return { valid: {}, errors: [] };
    if (!isRecord(input)) return { valid: {}, errors: ['"flowEditorSettings" must be a JSON object.'] };
    const valid: FlowEditorSettings = {};
    const errors: string[] = [];
    for (const [key, value] of Object.entries(input)) {
        const error = checkValue(key, value);
        if (error) errors.push(error);
        else valid[key] = value;
    }
    return { valid, errors };
}

/** The stored map with `patch` applied; each patched key replaces its old value. */
export function mergeFlowEditorSettings(
    current: FlowEditorSettings,
    patch: FlowEditorSettings,
): FlowEditorSettings {
    return { ...current, ...patch };
}

/** `null` when empty, matching every other nullable `user_settings` column. */
export function serializeFlowEditorSettings(settings: FlowEditorSettings): string | null {
    return Object.keys(settings).length === 0 ? null : JSON.stringify(settings);
}

/** Never throws: a null, malformed or mis-shaped column reads back as `{}`; invalid entries are dropped. */
export function parseFlowEditorSettings(raw: string | null | undefined): FlowEditorSettings {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return {};
        const out: FlowEditorSettings = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (FLOW_EDITOR_SETTING_KEYS.has(key) && checkValue(key, value) === null) out[key] = value;
        }
        return out;
    } catch {
        return {};
    }
}

/** The synced subset of a full settings object (display fields plus `keymapOverrides`). */
export function pickSyncedSettings(state: object): FlowEditorSettings {
    const source = state as Record<string, unknown>;
    const out: FlowEditorSettings = {};
    for (const key of FLOW_EDITOR_SETTING_KEYS) {
        if (key in source && checkValue(key, source[key]) === null) out[key] = source[key];
    }
    return out;
}

/** Keys whose value differs between two settings objects, as a patch of `next`'s values. */
export function diffSyncedSettings(prev: FlowEditorSettings, next: FlowEditorSettings): FlowEditorSettings {
    const patch: FlowEditorSettings = {};
    for (const key of Object.keys(next)) {
        if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) patch[key] = next[key];
    }
    return patch;
}
