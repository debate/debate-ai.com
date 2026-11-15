// @vitest-environment jsdom
/**
 * @fileoverview `settingsLiveUpdate` — a shortcut or display preference the
 * account sync (or another tab) writes to `localStorage` while the flow editor
 * is open reaches the store without a reload, validated like `/api/settings`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { flush, mount } from "./helpers/mount";

type LiveModule = typeof import("../src/lib/config/settingsLiveUpdate");
type StoreModule = typeof import("../src/lib/store/useFlowStore");

let live: LiveModule;
let store: StoreModule;

beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    store = await import("../src/lib/store/useFlowStore");
    live = await import("../src/lib/config/settingsLiveUpdate");
});

const state = () => store.useFlowStore.getState();

/** Writes a value and dispatches the `storage` event the tool-record mirror sends. */
function adopt(key: string, value: unknown): void {
    const newValue = JSON.stringify(value);
    localStorage.setItem(key, newValue);
    window.dispatchEvent(new StorageEvent("storage", { key, newValue, storageArea: localStorage }));
}

describe("settingsFromStoredValue", () => {
    it("reads keymap overrides from ebb-keymap-settings", () => {
        expect(
            live.settingsFromStoredValue("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { "sheet.next": "Mod+j" } })),
        ).toEqual({ keymapOverrides: { "sheet.next": "Mod+j" } });
    });

    it("reads display and keymap records from ebbSyncedSettings, dropping device-only keys", () => {
        const value = JSON.stringify([
            { id: "display", values: { tooltips: false, theme: "dark", flowsDir: "/home/me" } },
            { id: "keymap", keymapOverrides: { "sheet.next": "Mod+j" } },
        ]);
        expect(live.settingsFromStoredValue("ebbSyncedSettings", value)).toEqual({
            tooltips: false,
            theme: "dark",
            keymapOverrides: { "sheet.next": "Mod+j" },
        });
    });

    it("drops invalid fields but keeps the valid rest", () => {
        const value = JSON.stringify([{ id: "display", values: { tooltips: "no", defaultGridZoom: 9, scrollZoom: false } }]);
        expect(live.settingsFromStoredValue("ebbSyncedSettings", value)).toEqual({ scrollZoom: false });
    });

    it("ignores other keys, removals and unreadable values", () => {
        expect(live.settingsFromStoredValue("flows", "[]")).toBeNull();
        expect(live.settingsFromStoredValue(null, null)).toBeNull();
        expect(live.settingsFromStoredValue("ebb-keymap-settings", null)).toBeNull();
        expect(live.settingsFromStoredValue("ebb-keymap-settings", "{not json")).toBeNull();
        expect(live.settingsFromStoredValue("ebb-keymap-settings", "[]")).toBeNull();
        expect(live.settingsFromStoredValue("ebb-keymap-settings", JSON.stringify({}))).toBeNull();
    });
});

describe("applyStoredSettingsChange", () => {
    it("applies only the fields that differ from the open editor", () => {
        expect(state().tooltips).toBe(true);
        const applied = live.applyStoredSettingsChange(
            "ebbSyncedSettings",
            JSON.stringify([{ id: "display", values: { tooltips: false, theme: state().theme } }]),
        );
        expect(applied).toEqual({ tooltips: false });
        expect(state().tooltips).toBe(false);
    });

    it("does nothing when the stored value matches the store", () => {
        const spy = vi.spyOn(state(), "applyAccountSettings");
        expect(
            live.applyStoredSettingsChange("ebb-keymap-settings", JSON.stringify({ keymapOverrides: {} })),
        ).toEqual({});
        expect(spy).not.toHaveBeenCalled();
    });

    it("rejects a keymap with an invalid chord without touching the store", () => {
        live.applyStoredSettingsChange("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { "sheet.next": "" } }));
        expect(state().keymapOverrides).toEqual({});
    });
});

describe("useFlowSettingsLiveUpdate", () => {
    function Host() {
        live.useFlowSettingsLiveUpdate();
        return null;
    }

    it("applies a rebinding adopted from the account while mounted", async () => {
        const host = await mount(<Host />);
        await flush(() => adopt("ebb-keymap-settings", { keymapOverrides: { "sheet.next": "Mod+j" } }));
        expect(state().keymapOverrides).toEqual({ "sheet.next": "Mod+j" });
        // Persisted into the synced record too, so the two stores agree.
        expect(JSON.parse(localStorage.getItem("ebbSyncedSettings") ?? "[]")).toContainEqual({
            id: "keymap",
            keymapOverrides: { "sheet.next": "Mod+j" },
        });
        await host.unmount();
    });

    it("ignores a removed key and stops listening on unmount", async () => {
        const host = await mount(<Host />);
        await flush(() => {
            localStorage.removeItem("ebb-keymap-settings");
            window.dispatchEvent(
                new StorageEvent("storage", { key: "ebb-keymap-settings", newValue: null, storageArea: localStorage }),
            );
        });
        expect(state().keymapOverrides).toEqual({});
        await host.unmount();
        await flush(() => adopt("ebb-keymap-settings", { keymapOverrides: { "sheet.next": "Mod+j" } }));
        expect(state().keymapOverrides).toEqual({});
    });

    it("ignores sessionStorage events", async () => {
        const host = await mount(<Host />);
        await flush(() => {
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: "ebb-keymap-settings",
                    newValue: JSON.stringify({ keymapOverrides: { "sheet.next": "Mod+j" } }),
                    storageArea: sessionStorage,
                }),
            );
        });
        expect(state().keymapOverrides).toEqual({});
        await host.unmount();
    });
});
