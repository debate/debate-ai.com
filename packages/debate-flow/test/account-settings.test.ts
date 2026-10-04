import { describe, expect, it, vi, afterEach } from "vitest";
import {
    diffSyncedSettings,
    mergeFlowEditorSettings,
    normalizeFlowEditorSettingsPatch,
    parseFlowEditorSettings,
    pickSyncedSettings,
    serializeFlowEditorSettings,
} from "../src/lib/sync/accountSettings";
import { startFlowSettingsSync } from "../src/lib/sync/accountSettingsClient";

describe("normalizeFlowEditorSettingsPatch", () => {
    it("accepts known keys with valid values", () => {
        const r = normalizeFlowEditorSettingsPatch({
            rfdVim: true,
            defaultGridZoom: 1.5,
            theme: "dark",
            affColor: "#112233",
            negColor: null,
            keymapOverrides: { "cmd.save": "Mod-s" },
        });
        expect(r.errors).toEqual([]);
        expect(Object.keys(r.valid)).toHaveLength(6);
    });

    it("reports unknown keys and bad values instead of dropping them silently", () => {
        const r = normalizeFlowEditorSettingsPatch({
            flowsDir: "/home/me",
            rfdVim: "yes",
            defaultGridZoom: 9,
            theme: "neon",
            affColor: "red",
            keymapOverrides: { a: 5 },
        });
        expect(r.valid).toEqual({});
        expect(r.errors).toHaveLength(6);
    });

    it("treats undefined as no patch and non-objects as an error", () => {
        expect(normalizeFlowEditorSettingsPatch(undefined)).toEqual({ valid: {}, errors: [] });
        expect(normalizeFlowEditorSettingsPatch([]).errors).toHaveLength(1);
        expect(normalizeFlowEditorSettingsPatch("x").errors).toHaveLength(1);
    });

    it("rejects an oversized keymap", () => {
        const big = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`c${i}`, "k"]));
        expect(normalizeFlowEditorSettingsPatch({ keymapOverrides: big }).errors).toHaveLength(1);
    });
});

describe("serialize / parse / merge", () => {
    it("round-trips and serializes empty as null", () => {
        expect(serializeFlowEditorSettings({})).toBeNull();
        const raw = serializeFlowEditorSettings({ tooltips: false });
        expect(parseFlowEditorSettings(raw)).toEqual({ tooltips: false });
    });

    it("never throws on malformed storage and drops invalid entries", () => {
        expect(parseFlowEditorSettings(null)).toEqual({});
        expect(parseFlowEditorSettings("{nope")).toEqual({});
        expect(parseFlowEditorSettings("[1]")).toEqual({});
        expect(parseFlowEditorSettings('{"tooltips":1,"theme":"dark","evil":true}')).toEqual({ theme: "dark" });
    });

    it("replaces patched keys wholesale, including keymapOverrides", () => {
        const merged = mergeFlowEditorSettings(
            { theme: "dark", keymapOverrides: { a: "x", b: "y" } },
            { keymapOverrides: { a: "x" } },
        );
        expect(merged).toEqual({ theme: "dark", keymapOverrides: { a: "x" } });
    });
});

describe("pickSyncedSettings / diffSyncedSettings", () => {
    it("keeps machine-local fields out", () => {
        const picked = pickSyncedSettings({
            theme: "light",
            flowsDir: "/x",
            collabName: "me",
            contacts: { a: 1 },
            sidebarCollapsed: true,
            rfdOpen: true,
        });
        expect(picked).toEqual({ theme: "light" });
    });

    it("returns only changed keys", () => {
        expect(diffSyncedSettings({ a: 1, k: { x: "1" } }, { a: 1, k: { x: "2" } })).toEqual({ k: { x: "2" } });
        expect(diffSyncedSettings({ theme: "dark" }, { theme: "dark" })).toEqual({});
    });
});

describe("startFlowSettingsSync", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    function makeStore(initial: Record<string, unknown>) {
        let state: Record<string, unknown> = { ...initial };
        const listeners = new Set<() => void>();
        const applyAccountSettings = vi.fn((patch: Record<string, unknown>) => {
            state = { ...state, ...patch };
        });
        return {
            store: {
                getState: () => ({ ...state, applyAccountSettings }),
                subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
            },
            set(patch: Record<string, unknown>) {
                state = { ...state, ...patch };
                listeners.forEach((l) => l());
            },
            applyAccountSettings,
        };
    }

    const flush = () => new Promise((r) => setTimeout(r, 0));

    it("applies account settings when present", async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ flowEditorSettings: { theme: "dark" } }) }));
        vi.stubGlobal("fetch", fetchMock);
        const s = makeStore({ theme: "light" });
        const stop = startFlowSettingsSync(s.store);
        await flush();
        expect(s.applyAccountSettings).toHaveBeenCalledWith({ theme: "dark" });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        stop();
    });

    it("seeds an empty account from local settings", async () => {
        const fetchMock = vi.fn(async (_u: string, init?: { method?: string; body?: string }) =>
            init?.method === "PUT"
                ? { ok: true }
                : { ok: true, json: async () => ({ flowEditorSettings: {} }) },
        );
        vi.stubGlobal("fetch", fetchMock);
        const s = makeStore({ theme: "light", flowsDir: "/x" });
        const stop = startFlowSettingsSync(s.store);
        await flush();
        const put = fetchMock.mock.calls.find((c) => c[1]?.method === "PUT");
        expect(JSON.parse(put![1]!.body!)).toEqual({ flowEditorSettings: { theme: "light" } });
        stop();
    });

    it("stays local when signed out (401)", async () => {
        const fetchMock = vi.fn(async () => ({ ok: false, status: 401 }));
        vi.stubGlobal("fetch", fetchMock);
        const s = makeStore({ theme: "light" });
        const stop = startFlowSettingsSync(s.store);
        await flush();
        expect(s.applyAccountSettings).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        stop();
    });

    it("debounces pushes of changed keys and stops after cleanup", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn(async (_u: string, init?: { method?: string; body?: string }) =>
            init?.method === "PUT"
                ? { ok: true }
                : { ok: true, json: async () => ({ flowEditorSettings: { theme: "light" } }) },
        );
        vi.stubGlobal("fetch", fetchMock);
        const s = makeStore({ theme: "light", tooltips: true });
        const stop = startFlowSettingsSync(s.store);
        await vi.advanceTimersByTimeAsync(0);
        s.set({ tooltips: false });
        s.set({ tooltips: true });
        s.set({ tooltips: false });
        await vi.advanceTimersByTimeAsync(1100);
        const puts = fetchMock.mock.calls.filter((c) => c[1]?.method === "PUT");
        expect(puts).toHaveLength(1);
        expect(JSON.parse(puts[0][1]!.body!)).toEqual({ flowEditorSettings: { tooltips: false } });
        stop();
        s.set({ tooltips: true });
        await vi.advanceTimersByTimeAsync(2000);
        expect(fetchMock.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
    });
});

describe("useFlowStore.applyAccountSettings", () => {
    it("validates, persists and applies only the keys present", async () => {
        const mem = new Map<string, string>();
        vi.stubGlobal("window", {
            localStorage: {
                getItem: (k: string) => mem.get(k) ?? null,
                setItem: (k: string, v: string) => void mem.set(k, v),
                removeItem: (k: string) => void mem.delete(k),
            },
        });
        vi.resetModules();
        const { useFlowStore } = await import("../src/lib/store/useFlowStore");
        const before = useFlowStore.getState();
        useFlowStore.getState().applyAccountSettings({
            theme: "dark",
            defaultGridZoom: 9,
            tooltips: "nope",
            keymapOverrides: { "cmd.x": "Mod-x", bad: 1 },
        });
        const after = useFlowStore.getState();
        expect(after.theme).toBe("dark");
        expect(after.defaultGridZoom).toBe(3);
        expect(after.gridZoom).toBe(3);
        expect(after.tooltips).toBe(before.tooltips);
        expect(after.rfdVim).toBe(before.rfdVim);
        expect(after.keymapOverrides).toEqual({ "cmd.x": "Mod-x" });
        expect(JSON.parse(mem.get("ebb-display-settings")!).theme).toBe("dark");
        expect(JSON.parse(mem.get("ebb-keymap-settings")!)).toEqual({ keymapOverrides: { "cmd.x": "Mod-x" } });
        vi.unstubAllGlobals();
    });
});
