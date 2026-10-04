/**
 * @fileoverview Keeps the flow editor's synced display/keymap settings in step
 * with the signed-in account: pulls the account copy once on start (adopting
 * it over the local values), seeds the account from local settings when it has
 * none, then pushes debounced changes. Signed out (`fetch` resolves `null`) it
 * does nothing, so localStorage stays the only store.
 *
 * @module lib/store/flow-editor-settings-account-sync
 */

import { fetchFlowEditorSettings, saveFlowEditorSettings } from "./flow-editor-settings-sync-client";
import { pickSyncedDisplay, type FlowEditorSettingsSyncPayload } from "./flow-editor-settings-sync";

/** The slice of the flow store this sync touches. */
export interface FlowSettingsStoreLike {
    getState(): { keymapOverrides: Record<string, string> };
    subscribe(listener: () => void): () => void;
}

export interface FlowSettingsSyncDeps {
    fetchSettings?: typeof fetchFlowEditorSettings;
    saveSettings?: typeof saveFlowEditorSettings;
    /** Writes adopted account values through to localStorage as well as the store. */
    applyRemote: (payload: FlowEditorSettingsSyncPayload) => void;
    debounceMs?: number;
    onError?: (error: unknown) => void;
}

export function snapshotSyncedSettings(state: ReturnType<FlowSettingsStoreLike["getState"]>): FlowEditorSettingsSyncPayload {
    return { display: pickSyncedDisplay(state as unknown as Record<string, unknown>), keymapOverrides: { ...state.keymapOverrides } };
}

/** Starts the sync; the returned function stops it and drops any pending push. */
export function startFlowSettingsAccountSync(store: FlowSettingsStoreLike, deps: FlowSettingsSyncDeps): () => void {
    const fetchSettings = deps.fetchSettings ?? fetchFlowEditorSettings;
    const saveSettings = deps.saveSettings ?? saveFlowEditorSettings;
    const debounceMs = deps.debounceMs ?? 1000;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSynced: string | null = null;
    let unsubscribe: (() => void) | null = null;

    const push = () => {
        timer = null;
        if (stopped) return;
        const snapshot = snapshotSyncedSettings(store.getState());
        const serialized = JSON.stringify(snapshot);
        if (serialized === lastSynced) return;
        lastSynced = serialized;
        saveSettings(snapshot).catch((error) => {
            lastSynced = null; // retry on the next change
            deps.onError?.(error);
        });
    };

    const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(push, debounceMs);
    };

    void (async () => {
        try {
            const remote = await fetchSettings();
            if (stopped || remote === null) return; // signed out
            if (remote.settings) {
                deps.applyRemote(remote.settings);
                lastSynced = JSON.stringify(snapshotSyncedSettings(store.getState()));
            } else {
                push(); // account has nothing yet: seed it from this browser
            }
            if (stopped) return;
            unsubscribe = store.subscribe(schedule);
        } catch (error) {
            deps.onError?.(error);
        }
    })();

    return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        unsubscribe?.();
    };
}
