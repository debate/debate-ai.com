/**
 * @fileoverview The flow store follows account-sync writes to its two settings
 * keys, and leaves device-only display state alone while doing so.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

function stubWindow(initial: Record<string, string>) {
    const data = new Map(Object.entries(initial));
    const target = new EventTarget();
    const win = {
        localStorage: {
            getItem: (k: string) => data.get(k) ?? null,
            setItem: (k: string, v: string) => void data.set(k, v),
        },
        addEventListener: target.addEventListener.bind(target),
        dispatch(key: string) {
            const e = new Event("storage") as Event & { key: string };
            e.key = key;
            target.dispatchEvent(e);
        },
    };
    vi.stubGlobal("window", win);
    return { data, win };
}

describe("flow store account-sync follow", () => {
    beforeEach(() => vi.resetModules());
    afterEach(() => vi.unstubAllGlobals());

    it("applies synced display fields but keeps device-only state", async () => {
        const { data, win } = stubWindow({
            "ebb-display-settings": JSON.stringify({ theme: "light", sidebarCollapsed: true }),
        });
        const { useFlowStore } = await import("../src/lib/store/useFlowStore");
        expect(useFlowStore.getState().theme).toBe("light");
        expect(useFlowStore.getState().sidebarCollapsed).toBe(true);

        // What the account merge writes: synced fields changed, local layout intact.
        data.set(
            "ebb-display-settings",
            JSON.stringify({ theme: "dark", tooltips: false, sidebarCollapsed: true }),
        );
        useFlowStore.setState({ sidebarCollapsed: false });
        win.dispatch("ebb-display-settings");

        expect(useFlowStore.getState().theme).toBe("dark");
        expect(useFlowStore.getState().tooltips).toBe(false);
        expect(useFlowStore.getState().sidebarCollapsed).toBe(false);
    });

    it("applies synced keymap overrides and ignores unrelated keys", async () => {
        const { data, win } = stubWindow({});
        const { useFlowStore } = await import("../src/lib/store/useFlowStore");
        expect(useFlowStore.getState().keymapOverrides).toEqual({});

        data.set("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { "cell.next": "Ctrl+J" } }));
        win.dispatch("some-other-key");
        expect(useFlowStore.getState().keymapOverrides).toEqual({});

        win.dispatch("ebb-keymap-settings");
        expect(useFlowStore.getState().keymapOverrides).toEqual({ "cell.next": "Ctrl+J" });
    });
});
