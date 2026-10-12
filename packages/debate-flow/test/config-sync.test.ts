// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    invoke: vi.fn(),
    listeners: new Map<string, (e: { payload: unknown }) => void>(),
    unlisten: vi.fn(),
    desktop: { value: true },
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: m.invoke }));
vi.mock("@tauri-apps/api/event", () => ({
    listen: vi.fn(async (name: string, cb: (e: { payload: unknown }) => void) => {
        m.listeners.set(name, cb);
        return m.unlisten;
    }),
}));
vi.mock("../src/lib/update/adapter", () => ({ isDesktop: () => m.desktop.value }));

import { startConfigSync } from "../src/lib/config/configFile";
import { useFlowStore } from "../src/lib/store/useFlowStore";

const initial = useFlowStore.getState();
const settle = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
};

beforeEach(() => {
    vi.clearAllMocks();
    m.listeners.clear();
    m.desktop.value = true;
    window.localStorage.clear();
    useFlowStore.setState(initial, true);
});

afterEach(() => vi.useRealTimers());

describe("startConfigSync", () => {
    it("is a no-op on the web", () => {
        m.desktop.value = false;
        const stop = startConfigSync();
        stop();
        expect(m.invoke).not.toHaveBeenCalled();
    });

    it("seeds a missing file from the current settings", async () => {
        m.invoke.mockImplementation(async (cmd: string) => (cmd === "read_config" ? null : undefined));
        const stop = startConfigSync();
        await settle();
        const write = m.invoke.mock.calls.find(([c]) => c === "write_config");
        expect(write?.[1]).toHaveProperty("config");
        stop();
    });

    it("applies the file on boot, writes app edits back debounced, and follows file changes", async () => {
        vi.useFakeTimers();
        m.invoke.mockImplementation(async (cmd: string) => (cmd === "read_config" ? { theme: "dark", rfd_vim: true } : undefined));
        const stop = startConfigSync();
        await vi.advanceTimersByTimeAsync(0);
        expect(useFlowStore.getState()).toMatchObject({ theme: "dark", rfdVim: true });

        useFlowStore.getState().setTheme("light");
        await vi.advanceTimersByTimeAsync(200);
        const writes = m.invoke.mock.calls.filter(([c]) => c === "write_config");
        expect(writes).toHaveLength(1);
        expect((writes[0][1] as { config: Record<string, unknown> }).config.theme).toBe("light");

        // A store change that does not touch the config writes nothing.
        useFlowStore.getState().setInfoOpen(true);
        await vi.advanceTimersByTimeAsync(200);
        expect(m.invoke.mock.calls.filter(([c]) => c === "write_config")).toHaveLength(1);

        // The file changes underneath: applied, not echoed back.
        m.listeners.get("config:changed")!({ payload: { theme: "system", tooltips: false } });
        expect(useFlowStore.getState()).toMatchObject({ theme: "system", tooltips: false });
        await vi.advanceTimersByTimeAsync(200);
        expect(m.invoke.mock.calls.filter(([c]) => c === "write_config")).toHaveLength(1);

        stop();
        expect(m.unlisten).toHaveBeenCalled();
        m.listeners.get("config:changed")!({ payload: { theme: "dark" } });
        expect(useFlowStore.getState().theme).toBe("system");
    });

    it("leaves the store alone when the read fails, and unlistens when stopped early", async () => {
        m.invoke.mockRejectedValue(new Error("no home"));
        const before = useFlowStore.getState().theme;
        const stop = startConfigSync();
        stop();
        await settle();
        expect(useFlowStore.getState().theme).toBe(before);
        expect(m.unlisten).toHaveBeenCalled();
    });
});
