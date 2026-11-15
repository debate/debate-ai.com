"use client";

/**
 * Applies flow editor settings that change in `localStorage` underneath an
 * open editor, so a shortcut rebound or a display preference changed on
 * another device (or in another tab) takes effect without a reload.
 *
 * Two stores carry them: `ebb-keymap-settings` (the `flowKeymap` tool-record
 * collection) and `ebbSyncedSettings` (the `display` / `keymap` records of the
 * `ebbSyncedSettings` collection). When the account sync adopts records it
 * writes them back and dispatches a synthetic `storage` event in this tab; the
 * browser fires a real one in other tabs. Either way the value is untrusted -
 * it came from another device - so it goes through the same validation as the
 * `/api/settings` route before reaching the store.
 *
 * A removed key or a `localStorage.clear()` is ignored: losing the stored copy
 * is not a request to reset the open editor's settings.
 *
 * @module lib/config/settingsLiveUpdate
 */

import { useEffect } from "react";

import { accountSettingsOf, KEYMAP_SETTINGS_KEY, useFlowStore } from "../store/useFlowStore";
import { parseSyncedSettings, SYNCED_SETTINGS_KEY } from "../store/syncedSettings";
import { normalizeFlowEditorSettingsPatch, type FlowEditorAccountSettingsPayload } from "./accountSettings";

/** The keys whose change the open editor follows. */
export const LIVE_SETTINGS_KEYS: ReadonlySet<string> = new Set([KEYMAP_SETTINGS_KEY, SYNCED_SETTINGS_KEY]);

/**
 * The validated settings a stored value carries, or `null` when the key is
 * not a flow settings key or the value is absent / unreadable.
 */
export function settingsFromStoredValue(
    key: string | null,
    newValue: string | null,
): FlowEditorAccountSettingsPayload | null {
    if (key === null || newValue === null || !LIVE_SETTINGS_KEYS.has(key)) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(newValue);
    } catch {
        return null;
    }
    let candidate: Record<string, unknown>;
    if (key === KEYMAP_SETTINGS_KEY) {
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
        const overrides = (parsed as { keymapOverrides?: unknown }).keymapOverrides;
        if (overrides === undefined) return null;
        candidate = { keymapOverrides: overrides };
    } else {
        const synced = parseSyncedSettings(parsed);
        candidate = { ...synced.display };
        if (synced.keymapOverrides) candidate.keymapOverrides = synced.keymapOverrides;
    }
    // Invalid fields are dropped one by one; the valid rest still applies.
    return normalizeFlowEditorSettingsPatch(candidate).valid;
}

/**
 * Applies a stored-settings change to the store when it differs from what the
 * editor already shows. Returns the fields that were applied (empty when
 * nothing changed or the change was not a flow settings key).
 */
export function applyStoredSettingsChange(key: string | null, newValue: string | null): FlowEditorAccountSettingsPayload {
    const incoming = settingsFromStoredValue(key, newValue);
    if (!incoming) return {};
    const current = accountSettingsOf(useFlowStore.getState()) as Record<string, unknown>;
    const changed: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(incoming)) {
        if (JSON.stringify(current[field]) !== JSON.stringify(value)) changed[field] = value;
    }
    if (Object.keys(changed).length === 0) return {};
    useFlowStore.getState().applyAccountSettings(changed as FlowEditorAccountSettingsPayload);
    return changed as FlowEditorAccountSettingsPayload;
}

/** Follows `storage` events for the flow settings keys while mounted. */
export function useFlowSettingsLiveUpdate(): void {
    useEffect(() => {
        if (typeof window === "undefined") return;
        const onStorage = (event: StorageEvent) => {
            if (event.storageArea !== null && event.storageArea !== window.localStorage) return;
            applyStoredSettingsChange(event.key, event.newValue);
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);
}
