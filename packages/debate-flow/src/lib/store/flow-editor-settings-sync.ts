/**
 * @fileoverview The account-synced subset of the ebb flow editor's local
 * display and keymap settings (`ebb-display-settings`, `ebb-keymap-settings`).
 * Pure validation/serialization shared by the `/api/settings` route in
 * `apps/debate-ai.com` (one `flow_editor_settings` JSON column on
 * `user_settings`) and the sync client, mirroring the split
 * `research-progress-goal-sync.ts` uses in `debate-team-collaboration`.
 *
 * Deliberately not synced because they describe a device or a peer rather than
 * the user: `flowsDir` (a local path), `contacts` (collab peers), and the
 * collab connection toggles (`collabEnabled`, `collabRelayEnabled`,
 * `collabListenEnabled`). The update-channel config is also device-bound.
 *
 * @module lib/store/flow-editor-settings-sync
 */

import { resolveCardMirrorTextType } from "../bridge/cardmirror";
import { resolveFontId } from "../fonts/registry";
import { resolveThemeMode } from "../theme/mode";

const BOOLEAN_KEYS = [
    "sidebarCollapsed",
    "rfdOpen",
    "rfdVim",
    "insertPaste",
    "appendEdit",
    "scrollZoom",
    "alignSpeeches",
    "tooltips",
    "cardmirrorEnabled",
    "collabShowViewers",
] as const;

/** The display fields that follow the account. */
export interface FlowEditorSyncedDisplay {
    flowFont: string;
    defaultGridZoom: number;
    sidebarCollapsed: boolean;
    rfdOpen: boolean;
    rfdVim: boolean;
    insertPaste: boolean;
    appendEdit: boolean;
    scrollZoom: boolean;
    alignSpeeches: boolean;
    tooltips: boolean;
    cardmirrorEnabled: boolean;
    cardmirrorTextType: string;
    theme: string;
    collabShowViewers: boolean;
    collabName: string;
    affColor: string | null;
    negColor: string | null;
}

export interface FlowEditorSettingsSyncPayload {
    display: Partial<FlowEditorSyncedDisplay>;
    keymapOverrides: Record<string, string>;
}

export interface FlowEditorSettingsPatch {
    /** `null` clears the synced settings; an object replaces them. */
    flowEditorSettings: FlowEditorSettingsSyncPayload | null;
}

export const DEFAULT_FLOW_EDITOR_SETTINGS_SYNC: FlowEditorSettingsPatch = { flowEditorSettings: null };

export const MAX_KEYMAP_OVERRIDES = 200;
const MAX_KEYMAP_STRING_LENGTH = 64;
const MAX_COLLAB_NAME_LENGTH = 80;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const DISPLAY_KEYS = new Set<string>([
    ...BOOLEAN_KEYS,
    "flowFont",
    "defaultGridZoom",
    "cardmirrorTextType",
    "theme",
    "collabName",
    "affColor",
    "negColor",
]);

function isValidDisplayValue(key: string, value: unknown): boolean {
    if ((BOOLEAN_KEYS as readonly string[]).includes(key)) return typeof value === "boolean";
    switch (key) {
        case "flowFont":
            return typeof value === "string" && resolveFontId(value) === value;
        case "defaultGridZoom":
            return typeof value === "number" && Number.isFinite(value) && value >= ZOOM_MIN && value <= ZOOM_MAX;
        case "cardmirrorTextType":
            return typeof value === "string" && resolveCardMirrorTextType(value) === value;
        case "theme":
            return typeof value === "string" && resolveThemeMode(value) === value;
        case "collabName":
            return typeof value === "string" && value.length <= MAX_COLLAB_NAME_LENGTH;
        case "affColor":
        case "negColor":
            return value === null || (typeof value === "string" && HEX_COLOR.test(value));
        default:
            return false;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidFlowEditorSettingsPayload(value: unknown): value is FlowEditorSettingsSyncPayload {
    if (!isRecord(value)) return false;
    if (Object.keys(value).some((k) => k !== "display" && k !== "keymapOverrides")) return false;
    const { display, keymapOverrides } = value;
    if (!isRecord(display)) return false;
    for (const [key, v] of Object.entries(display)) {
        if (!DISPLAY_KEYS.has(key) || !isValidDisplayValue(key, v)) return false;
    }
    if (!isRecord(keymapOverrides)) return false;
    const entries = Object.entries(keymapOverrides);
    if (entries.length > MAX_KEYMAP_OVERRIDES) return false;
    return entries.every(
        ([id, chord]) =>
            id.length > 0 &&
            id.length <= MAX_KEYMAP_STRING_LENGTH &&
            typeof chord === "string" &&
            chord.length > 0 &&
            chord.length <= MAX_KEYMAP_STRING_LENGTH,
    );
}

export interface FlowEditorSettingsPatchResult {
    valid: Partial<FlowEditorSettingsPatch>;
    errors: string[];
}

/** Validates an untrusted request body; `flowEditorSettings` is `null` (clear) or a well-formed payload. */
export function normalizeFlowEditorSettingsPatch(input: unknown): FlowEditorSettingsPatchResult {
    if (!isRecord(input)) return { valid: {}, errors: ["Request body must be a JSON object."] };
    if (!("flowEditorSettings" in input)) return { valid: {}, errors: [] };
    const raw = input.flowEditorSettings;
    if (raw === null || isValidFlowEditorSettingsPayload(raw)) {
        return { valid: { flowEditorSettings: raw }, errors: [] };
    }
    return {
        valid: {},
        errors: [
            `"flowEditorSettings" must be null (to clear) or a { display, keymapOverrides } object with only synced display fields, valid values, and at most ${MAX_KEYMAP_OVERRIDES} keymap overrides.`,
        ],
    };
}

export function serializeFlowEditorSettings(value: FlowEditorSettingsSyncPayload | null): string | null {
    return value === null ? null : JSON.stringify(value);
}

/** Never throws: a null, malformed, or invalid-shape column reads back as `null`. */
export function parseFlowEditorSettings(raw: string | null | undefined): FlowEditorSettingsSyncPayload | null {
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        return isValidFlowEditorSettingsPayload(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

const DISPLAY_KEY_LIST = [...DISPLAY_KEYS];

/** Picks the synced fields out of a full display-settings object (or the store). */
export function pickSyncedDisplay(source: Record<string, unknown>): Partial<FlowEditorSyncedDisplay> {
    const out: Record<string, unknown> = {};
    for (const key of DISPLAY_KEY_LIST) if (key in source) out[key] = source[key];
    return out as Partial<FlowEditorSyncedDisplay>;
}
