/**
 * @fileoverview The flow editor's display and keymap preferences that follow a
 * signed-in user across devices, as pure validate/merge/serialize helpers
 * shared by the `/api/settings` D1 route (`flowEditorSettings` column of
 * `user_settings`) and `useAccountFlowSettingsSync` on the client.
 *
 * Only preferences about *how the editor looks and behaves* sync. Values that
 * describe this device or this person's peers stay in `ebb-display-settings`
 * only: `flowsDir` (a filesystem path), the `collab*` identity/relay toggles,
 * `contacts`, and the sidebar/RFD open state (window layout).
 *
 * Kept free of React, the store and `fetch` so the route can import it without
 * pulling the editor into the Worker bundle.
 *
 * @module lib/config/accountSettings
 */

import { resolveFontId } from "../fonts/registry";
import { resolveThemeMode } from "../theme/mode";

export const ACCOUNT_ZOOM_MIN = 0.5;
export const ACCOUNT_ZOOM_MAX = 3;

const CARDMIRROR_TEXT_TYPES = ["pocket", "hat", "block", "tag", "analytic", "body"] as const;
const MAX_KEYMAP_OVERRIDES = 500;
const MAX_CHORD_LENGTH = 64;
const MAX_COMMAND_ID_LENGTH = 128;

export interface FlowEditorAccountSettings {
    flowFont: string;
    defaultGridZoom: number;
    rfdVim: boolean;
    insertPaste: boolean;
    appendEdit: boolean;
    scrollZoom: boolean;
    alignSpeeches: boolean;
    tooltips: boolean;
    cardmirrorEnabled: boolean;
    cardmirrorTextType: (typeof CARDMIRROR_TEXT_TYPES)[number];
    theme: "light" | "dark" | "system";
    affColor: string | null;
    negColor: string | null;
    keymapOverrides: Record<string, string>;
}

export type FlowEditorAccountSettingsPayload = Partial<FlowEditorAccountSettings>;

const BOOLEAN_KEYS = [
    "rfdVim",
    "insertPaste",
    "appendEdit",
    "scrollZoom",
    "alignSpeeches",
    "tooltips",
    "cardmirrorEnabled",
] as const;

/** Every key a patch may carry; anything else is rejected, not dropped. */
export const FLOW_ACCOUNT_SETTING_KEYS: ReadonlySet<string> = new Set([
    ...BOOLEAN_KEYS,
    "flowFont",
    "defaultGridZoom",
    "cardmirrorTextType",
    "theme",
    "affColor",
    "negColor",
    "keymapOverrides",
]);

function isHexColor(value: unknown): value is string {
    return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function validKeymapOverrides(value: unknown): Record<string, string> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > MAX_KEYMAP_OVERRIDES) return null;
    const out: Record<string, string> = {};
    for (const [commandId, chord] of entries) {
        if (
            commandId.length === 0 ||
            commandId.length > MAX_COMMAND_ID_LENGTH ||
            typeof chord !== "string" ||
            chord.length === 0 ||
            chord.length > MAX_CHORD_LENGTH
        ) {
            return null;
        }
        out[commandId] = chord;
    }
    return out;
}

/**
 * Validates an untrusted patch. Unknown keys and invalid values are reported
 * in `errors` (so a typo or stale client does not lose data quietly) and left
 * out of `valid`.
 */
export function normalizeFlowEditorSettingsPatch(input: unknown): {
    valid: FlowEditorAccountSettingsPayload;
    errors: string[];
} {
    if (input === undefined) return { valid: {}, errors: [] };
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
        return { valid: {}, errors: ['"flowEditorSettings" must be a JSON object.'] };
    }
    const record = input as Record<string, unknown>;
    const valid: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const [key, value] of Object.entries(record)) {
        if (!FLOW_ACCOUNT_SETTING_KEYS.has(key)) {
            errors.push(`"${key}" is not a known flow editor setting.`);
            continue;
        }
        let ok = false;
        if ((BOOLEAN_KEYS as readonly string[]).includes(key)) {
            ok = typeof value === "boolean";
        } else if (key === "flowFont") {
            ok = typeof value === "string" && resolveFontId(value) === value;
        } else if (key === "defaultGridZoom") {
            ok =
                typeof value === "number" &&
                Number.isFinite(value) &&
                value >= ACCOUNT_ZOOM_MIN &&
                value <= ACCOUNT_ZOOM_MAX;
        } else if (key === "cardmirrorTextType") {
            ok = (CARDMIRROR_TEXT_TYPES as readonly unknown[]).includes(value);
        } else if (key === "theme") {
            ok = typeof value === "string" && resolveThemeMode(value) === value;
        } else if (key === "affColor" || key === "negColor") {
            ok = value === null || isHexColor(value);
        } else if (key === "keymapOverrides") {
            const overrides = validKeymapOverrides(value);
            if (overrides) {
                valid[key] = overrides;
                continue;
            }
        }
        if (ok) valid[key] = value;
        else errors.push(`"${key}" has an invalid value.`);
    }
    return { valid: valid as FlowEditorAccountSettingsPayload, errors };
}

/** A patch applied over the stored settings; `keymapOverrides` replaces whole. */
export function mergeFlowEditorSettings(
    current: FlowEditorAccountSettingsPayload,
    patch: FlowEditorAccountSettingsPayload,
): FlowEditorAccountSettingsPayload {
    return { ...current, ...patch };
}

/** `null` when empty, matching the "no saved value yet" semantics of the other columns. */
export function serializeFlowEditorSettings(
    settings: FlowEditorAccountSettingsPayload,
): string | null {
    return Object.keys(settings).length === 0 ? null : JSON.stringify(settings);
}

/** Never throws: null, malformed or wrong-shape values read back as `{}`, and
 *  invalid fields are filtered out individually. */
export function parseFlowEditorSettings(
    raw: string | null | undefined,
): FlowEditorAccountSettingsPayload {
    if (!raw) return {};
    try {
        return normalizeFlowEditorSettingsPatch(JSON.parse(raw)).valid;
    } catch {
        return {};
    }
}
