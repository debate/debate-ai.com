import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncSettingsFromStorage, useFlowStore } from "../src/lib/store/useFlowStore";

/** The account sync adopts settings by rewriting these localStorage keys. */
describe("syncSettingsFromStorage", () => {
    beforeEach(() => {
        const data = new Map<string, string>();
        vi.stubGlobal("window", {});
        vi.stubGlobal("localStorage", {
            getItem: (k: string) => data.get(k) ?? null,
            setItem: (k: string, v: string) => void data.set(k, v),
        });
        // The store reads through `window.localStorage`.
        (globalThis as { window: { localStorage: unknown } }).window.localStorage = localStorage;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("applies adopted display settings, keeping this device's flowsDir", () => {
        useFlowStore.setState({ flowsDir: "/local/flows", theme: "system" });
        localStorage.setItem(
            "ebb-display-settings",
            JSON.stringify({ theme: "dark", flowsDir: "/other/device", tooltips: false }),
        );
        syncSettingsFromStorage("ebb-display-settings");
        const s = useFlowStore.getState();
        expect(s.theme).toBe("dark");
        expect(s.tooltips).toBe(false);
        expect(s.flowsDir).toBe("/local/flows");
    });

    it("applies adopted keymap overrides", () => {
        localStorage.setItem("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { save: "Mod-s" } }));
        syncSettingsFromStorage("ebb-keymap-settings");
        expect(useFlowStore.getState().keymapOverrides).toEqual({ save: "Mod-s" });
    });

    it("falls back to defaults for a corrupt stored value", () => {
        localStorage.setItem("ebb-display-settings", "{nope");
        syncSettingsFromStorage("ebb-display-settings");
        expect(useFlowStore.getState().theme).toBe("system");
    });
});
