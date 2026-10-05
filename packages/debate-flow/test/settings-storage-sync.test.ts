// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { reloadSettingsFromStorage, useFlowStore } from "../src/lib/store/useFlowStore";

describe("following storage written by the account sync", () => {
    beforeEach(() => localStorage.clear());

    it("adopts display settings written to localStorage", () => {
        localStorage.setItem("ebb-display-settings", JSON.stringify({ rfdVim: true, defaultGridZoom: 1.5 }));
        reloadSettingsFromStorage();
        const state = useFlowStore.getState();
        expect(state.rfdVim).toBe(true);
        expect(state.defaultGridZoom).toBe(1.5);
    });

    it("adopts keymap overrides and reacts to a storage event", () => {
        localStorage.setItem("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { "x.y": "Ctrl+K" } }));
        window.dispatchEvent(new StorageEvent("storage", { key: "ebb-keymap-settings" }));
        expect(useFlowStore.getState().keymapOverrides).toEqual({ "x.y": "Ctrl+K" });
    });

    it("ignores unrelated storage keys", () => {
        useFlowStore.setState({ rfdVim: false });
        localStorage.setItem("ebb-display-settings", JSON.stringify({ rfdVim: true }));
        window.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));
        expect(useFlowStore.getState().rfdVim).toBe(false);
    });

    it("never writes back to storage while following it", () => {
        localStorage.setItem("ebb-display-settings", JSON.stringify({ rfdVim: true, flowsDir: "/a" }));
        const before = localStorage.getItem("ebb-display-settings");
        reloadSettingsFromStorage();
        expect(localStorage.getItem("ebb-display-settings")).toBe(before);
    });
});
