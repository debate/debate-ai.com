import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyStoredSettingsChange, useFlowStore } from "../src/lib/store/useFlowStore";

const backing = new Map<string, string>();

beforeEach(() => {
    backing.clear();
    vi.stubGlobal("window", {
        localStorage: {
            getItem: (k: string) => backing.get(k) ?? null,
            setItem: (k: string, v: string) => void backing.set(k, v),
        },
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("applyStoredSettingsChange", () => {
    it("adopts synced display preferences but not device-local ones", () => {
        useFlowStore.setState({ flowsDir: "/home/me/flows", theme: "system", tooltips: true });
        backing.set(
            "ebb-display-settings",
            JSON.stringify({ theme: "dark", tooltips: false, flowsDir: "/other" }),
        );
        applyStoredSettingsChange("ebb-display-settings");
        const s = useFlowStore.getState();
        expect(s.theme).toBe("dark");
        expect(s.tooltips).toBe(false);
        expect(s.flowsDir).toBe("/home/me/flows");
    });

    it("moves the live zoom with the default only when it was at the default", () => {
        useFlowStore.setState({ defaultGridZoom: 1, gridZoom: 1 });
        backing.set("ebb-display-settings", JSON.stringify({ defaultGridZoom: 1.5 }));
        applyStoredSettingsChange("ebb-display-settings");
        expect(useFlowStore.getState().gridZoom).toBe(1.5);

        useFlowStore.setState({ gridZoom: 2 });
        backing.set("ebb-display-settings", JSON.stringify({ defaultGridZoom: 1.2 }));
        applyStoredSettingsChange("ebb-display-settings");
        expect(useFlowStore.getState().gridZoom).toBe(2);
    });

    it("adopts keymap overrides and ignores unrelated keys", () => {
        useFlowStore.setState({ keymapOverrides: {} });
        backing.set("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { "sheet.new": "Mod-n" } }));
        applyStoredSettingsChange("something-else");
        expect(useFlowStore.getState().keymapOverrides).toEqual({});
        applyStoredSettingsChange("ebb-keymap-settings");
        expect(useFlowStore.getState().keymapOverrides).toEqual({ "sheet.new": "Mod-n" });
    });
});
