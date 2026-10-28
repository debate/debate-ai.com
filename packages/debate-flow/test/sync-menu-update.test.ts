// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    executeCommand: vi.fn(),
    check: vi.fn(),
    relaunch: vi.fn(async () => {}),
    getVersion: vi.fn(async () => "1.0.0"),
    invoke: vi.fn(),
    saveOpenFlow: vi.fn(async () => true),
}));

vi.mock("../src/lib/commands/commands", () => ({ executeCommand: m.executeCommand }));
vi.mock("../src/lib/commands/fileCommands", () => ({ saveOpenFlow: m.saveOpenFlow }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: m.check }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: m.relaunch }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: m.getVersion }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: m.invoke }));

import { dispatchMenuCommand, SELECT_ALL_MENU_ID } from "../src/lib/keymap/menuDispatch";
import { useFlowStore } from "../src/lib/store/useFlowStore";
import {
    diffSyncedSettings,
    mergeFlowEditorSettings,
    normalizeFlowEditorSettingsPatch,
    parseFlowEditorSettings,
    pickSyncedSettings,
    serializeFlowEditorSettings,
} from "../src/lib/sync/accountSettings";
import {
    fetchFlowEditorSettings,
    saveFlowEditorSettings,
    startFlowSettingsSync,
} from "../src/lib/sync/accountSettingsClient";
import {
    downloadUpdate,
    fetchManifest,
    getCurrentVersion,
    getSystemInfo,
    installAndRelaunch,
    invokeSystemInfo,
    isDesktop,
} from "../src/lib/update/adapter";
import { useAutoUpdate, type AutoUpdate } from "../src/lib/update/useAutoUpdate";

import { flush, mount } from "./helpers/mount";

const manifest = { version: "2.0.0", platforms: { "linux-x86_64": { signature: "s", url: "https://x" } } };

function setDesktop(on: boolean) {
    const w = window as unknown as Record<string, unknown>;
    if (on) {
        w.__TAURI_INTERNALS__ = {};
        w.__EBB_DESKTOP__ = true;
    } else {
        delete w.__TAURI_INTERNALS__;
        delete w.__EBB_DESKTOP__;
    }
}

const initial = useFlowStore.getState();

beforeEach(() => {
    vi.clearAllMocks();
    setDesktop(false);
    window.localStorage.clear();
    useFlowStore.setState(initial, true);
});

afterEach(() => {
    setDesktop(false);
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("account settings validation", () => {
    it("normalizes a patch, keeping valid keys and listing errors", () => {
        expect(normalizeFlowEditorSettingsPatch(undefined)).toEqual({ valid: {}, errors: [] });
        expect(normalizeFlowEditorSettingsPatch([]).errors).toHaveLength(1);
        const res = normalizeFlowEditorSettingsPatch({
            rfdVim: true,
            tooltips: "yes",
            defaultGridZoom: 2,
            theme: "dark",
            flowFont: "inter",
            affColor: null,
            negColor: "#zzzzzz",
            keymapOverrides: { a: "Mod+A" },
            bogus: 1,
        });
        expect(res.valid).toEqual({
            rfdVim: true,
            defaultGridZoom: 2,
            theme: "dark",
            flowFont: "inter",
            affColor: null,
            keymapOverrides: { a: "Mod+A" },
        });
        expect(res.errors).toHaveLength(3);
        expect(normalizeFlowEditorSettingsPatch({ theme: "neon", defaultGridZoom: 9, cardmirrorTextType: "" }).errors).toHaveLength(3);
        expect(normalizeFlowEditorSettingsPatch({ keymapOverrides: [] }).errors[0]).toMatch(/object/);
        expect(normalizeFlowEditorSettingsPatch({ keymapOverrides: { a: 1 } }).errors[0]).toMatch(/chord/);
        const many = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`c${i}`, "x"]));
        expect(normalizeFlowEditorSettingsPatch({ keymapOverrides: many }).errors[0]).toMatch(/too many/);
    });

    it("serializes, parses, picks and diffs", () => {
        expect(serializeFlowEditorSettings({})).toBeNull();
        expect(serializeFlowEditorSettings({ rfdVim: true })).toBe('{"rfdVim":true}');
        expect(parseFlowEditorSettings(null)).toEqual({});
        expect(parseFlowEditorSettings("{bad")).toEqual({});
        expect(parseFlowEditorSettings("[1]")).toEqual({});
        expect(parseFlowEditorSettings('{"rfdVim":true,"tooltips":3,"x":1}')).toEqual({ rfdVim: true });
        expect(mergeFlowEditorSettings({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
        expect(pickSyncedSettings({ rfdVim: false, theme: "bad", collabName: "x" })).toEqual({ rfdVim: false });
        expect(diffSyncedSettings({ rfdVim: false, theme: "dark" }, { rfdVim: true, theme: "dark" })).toEqual({ rfdVim: true });
    });
});

describe("account settings client", () => {
    function store(initialState: Record<string, unknown>) {
        let state = { ...initialState, applyAccountSettings: vi.fn((p: Record<string, unknown>) => { state = { ...state, ...p }; }) };
        const listeners = new Set<() => void>();
        return {
            getState: () => state,
            set(patch: Record<string, unknown>) {
                state = { ...state, ...patch };
                for (const l of listeners) l();
            },
            subscribe(l: () => void) {
                listeners.add(l);
                return () => listeners.delete(l);
            },
        };
    }

    it("fetches and saves settings", async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ flowEditorSettings: { rfdVim: true, bad: 1 } }) }));
        vi.stubGlobal("fetch", fetchMock);
        expect(await fetchFlowEditorSettings()).toEqual({ rfdVim: true });
        fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
        expect(await fetchFlowEditorSettings()).toBeNull();
        expect(await saveFlowEditorSettings({ rfdVim: true }, "/s")).toBe(true);
        expect(fetchMock).toHaveBeenLastCalledWith("/s", expect.objectContaining({ method: "PUT", body: '{"flowEditorSettings":{"rfdVim":true}}' }));
        fetchMock.mockRejectedValueOnce(new Error("offline"));
        expect(await saveFlowEditorSettings({})).toBe(false);
    });

    it("applies account settings on start and pushes debounced changes", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
            init ? { ok: true } : { ok: true, json: async () => ({ flowEditorSettings: { theme: "dark" } }) },
        );
        vi.stubGlobal("fetch", fetchMock);
        const s = store({ theme: "light", rfdVim: false });
        const stop = startFlowSettingsSync(s as never);
        await vi.advanceTimersByTimeAsync(0);
        expect(s.getState().applyAccountSettings).toHaveBeenCalledWith({ theme: "dark" });
        s.set({ rfdVim: true });
        await vi.advanceTimersByTimeAsync(1000);
        const put = fetchMock.mock.calls.find((c) => c[1]);
        expect(put?.[1]?.body).toBe('{"flowEditorSettings":{"rfdVim":true}}');
        // No change, no push.
        s.set({});
        await vi.advanceTimersByTimeAsync(1000);
        expect(fetchMock.mock.calls.filter((c) => c[1])).toHaveLength(1);
        stop();
        s.set({ rfdVim: false });
        await vi.advanceTimersByTimeAsync(1000);
        expect(fetchMock.mock.calls.filter((c) => c[1])).toHaveLength(1);
    });

    it("seeds an empty account and rolls back a failed push", async () => {
        vi.useFakeTimers();
        let putOk = true;
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
            init ? { ok: putOk } : { ok: true, json: async () => ({}) },
        );
        vi.stubGlobal("fetch", fetchMock);
        const s = store({ rfdVim: false });
        const stop = startFlowSettingsSync(s as never);
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchMock.mock.calls.find((c) => c[1])?.[1]?.body).toBe('{"flowEditorSettings":{"rfdVim":false}}');
        putOk = false;
        s.set({ rfdVim: true, theme: "dark" });
        await vi.advanceTimersByTimeAsync(1000);
        putOk = true;
        // The failed keys are offered again on the next change.
        s.set({ tooltips: true });
        await vi.advanceTimersByTimeAsync(1000);
        const last = fetchMock.mock.calls.filter((c) => c[1]).pop()![1]!.body as string;
        expect(JSON.parse(last).flowEditorSettings).toEqual({ rfdVim: true, theme: "dark", tooltips: true });
        stop();
    });
});

describe("menu dispatch", () => {
    beforeEach(() => {
        Object.defineProperty(document, "execCommand", { value: vi.fn(), configurable: true });
        window.history.pushState({}, "", "/flow");
    });

    afterEach(() => {
        (document.activeElement as HTMLElement | null)?.blur?.();
        document.body.innerHTML = "";
    });

    it("runs a known command on the flow route and ignores unknown ids", () => {
        dispatchMenuCommand("nope");
        dispatchMenuCommand("sheet.next");
        expect(m.executeCommand).toHaveBeenCalledWith("sheet.next");
    });

    it("blocks flow-only commands off the flow route but lets global ones through", () => {
        window.history.pushState({}, "", "/");
        dispatchMenuCommand("sheet.next");
        dispatchMenuCommand("flow.open");
        expect(m.executeCommand.mock.calls).toEqual([["flow.open"]]);
    });

    it("hands edit chords to a focused text field", () => {
        const input = document.createElement("input");
        input.value = "hello";
        document.body.append(input);
        input.focus();
        dispatchMenuCommand("edit.undo");
        dispatchMenuCommand("edit.redo");
        expect(document.execCommand).toHaveBeenCalledWith("undo");
        expect(document.execCommand).toHaveBeenCalledWith("redo");
        input.setSelectionRange(5, 5);
        dispatchMenuCommand("row.delete");
        expect(input.selectionStart).toBe(0);
        expect(document.execCommand).toHaveBeenCalledWith("delete");
        dispatchMenuCommand(SELECT_ALL_MENU_ID);
        expect(input.selectionEnd).toBe(5);
        // A grid-scoped command does not reach the grid from a chrome field.
        dispatchMenuCommand("format.toggleBold");
        expect(m.executeCommand).not.toHaveBeenCalled();
        // But from the grid's own editor it does.
        input.classList.add("handsontableInput");
        dispatchMenuCommand("format.toggleBold");
        expect(m.executeCommand).toHaveBeenCalledWith("format.toggleBold");
    });

    it("deletes to line start in a contentEditable and skips an empty line start", () => {
        const ta = document.createElement("textarea");
        ta.value = "ab\ncd";
        document.body.append(ta);
        ta.focus();
        ta.setSelectionRange(3, 3);
        dispatchMenuCommand("row.delete");
        expect(document.execCommand).not.toHaveBeenCalled();

        const div = document.createElement("div");
        div.contentEditable = "true";
        Object.defineProperty(div, "isContentEditable", { value: true });
        div.textContent = "text";
        div.tabIndex = 0;
        document.body.append(div);
        div.focus();
        const range = document.createRange();
        range.selectNodeContents(div);
        window.getSelection()!.removeAllRanges();
        window.getSelection()!.addRange(range);
        dispatchMenuCommand("row.delete");
        expect(document.execCommand).toHaveBeenCalledWith("delete");
    });
});

describe("update adapter", () => {
    it("is inert off desktop", async () => {
        expect(isDesktop()).toBe(false);
        expect(await fetchManifest()).toBeNull();
        expect(await downloadUpdate()).toBeNull();
        expect(await getCurrentVersion()).toBe("0.0.0");
        expect(await invokeSystemInfo()).toBeNull();
        expect(await getSystemInfo()).toBeNull();
        await installAndRelaunch({ version: "1", install: vi.fn() });
        expect(m.relaunch).not.toHaveBeenCalled();
    });

    it("treats a host Tauri window without ebb's shell as web", async () => {
        // The debate-ai.com native wrapper exposes Tauri's globals but none of
        // ebb's commands; calling them fails with "not allowed by ACL".
        (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
        expect(isDesktop()).toBe(false);
        expect(await fetchManifest()).toBeNull();
        expect(m.check).not.toHaveBeenCalled();
    });

    it("talks to the plugins on desktop", async () => {
        setDesktop(true);
        expect(isDesktop()).toBe(true);
        m.check.mockResolvedValueOnce(null);
        expect(await fetchManifest()).toBeNull();
        m.check.mockResolvedValueOnce({ rawJson: manifest });
        expect(await fetchManifest()).toMatchObject({ version: "2.0.0" });

        m.check.mockResolvedValueOnce(null);
        expect(await downloadUpdate()).toBeNull();
        const update = {
            version: "2.0.0",
            install: vi.fn(async () => {}),
            download: vi.fn(async (cb: (e: unknown) => void) => {
                cb({ event: "Started", data: { contentLength: 10 } });
                cb({ event: "Progress", data: { chunkLength: 4 } });
                cb({ event: "Progress", data: { chunkLength: 6 } });
                cb({ event: "Finished", data: {} });
            }),
        };
        m.check.mockResolvedValueOnce(update);
        const progress: [number, number | null][] = [];
        expect(await downloadUpdate((d, t) => progress.push([d, t]))).toBe(update);
        expect(progress).toEqual([
            [0, 10],
            [4, null],
            [10, null],
        ]);
        await installAndRelaunch(update);
        expect(update.install).toHaveBeenCalled();
        expect(m.relaunch).toHaveBeenCalled();

        expect(await getCurrentVersion()).toBe("1.0.0");
        m.getVersion.mockRejectedValueOnce(new Error("x"));
        expect(await getCurrentVersion()).toBe("0.0.0");
        m.invoke.mockResolvedValueOnce({ os: "linux", arch: "x86_64" });
        expect(await getSystemInfo()).toEqual(["linux", "x86_64"]);
        m.invoke.mockRejectedValueOnce(new Error("x"));
        expect(await invokeSystemInfo()).toBeNull();
    });
});

describe("useAutoUpdate", () => {
    let api: AutoUpdate;
    function Probe() {
        api = useAutoUpdate();
        return createElement("span", null, api.state.status);
    }

    it("does nothing on the web", async () => {
        const view = await mount(createElement(Probe));
        await flush(() => api.checkNow());
        expect(view.container.textContent).toBe("idle");
        await view.unmount();
    });

    it("reports up to date, errors and a staged download on a manual check", async () => {
        setDesktop(true);
        const view = await mount(createElement(Probe));
        m.check.mockResolvedValueOnce(null);
        await flush(() => api.checkNow());
        expect(api.state.status).toBe("upToDate");

        m.check.mockRejectedValueOnce(new Error("offline"));
        await flush(() => api.checkNow());
        expect(api.state).toEqual({ status: "error", message: "Couldn't check for updates." });

        // Same version: nothing to do.
        m.check.mockResolvedValueOnce({ rawJson: { ...manifest, version: "1.0.0" } });
        await flush(() => api.checkNow());
        expect(api.state.status).toBe("idle");

        // Newer: download fails, then disappears, then succeeds.
        m.check.mockResolvedValueOnce({ rawJson: manifest }).mockRejectedValueOnce(new Error("dl"));
        await flush(() => api.checkNow());
        expect(api.state).toEqual({ status: "error", message: "Couldn't download the update." });
        m.check.mockResolvedValueOnce({ rawJson: manifest }).mockResolvedValueOnce(null);
        await flush(() => api.checkNow());
        expect(api.state.status).toBe("upToDate");

        const update = { version: "2.0.0", install: vi.fn(async () => {}), download: vi.fn(async () => {}) };
        m.check.mockResolvedValueOnce({ rawJson: manifest }).mockResolvedValueOnce(update);
        await flush(() => api.checkNow());
        expect(api.state.status).toBe("ready");
        // Already staged: straight to ready without another download.
        m.check.mockResolvedValueOnce({ rawJson: manifest });
        await flush(() => api.checkNow());
        expect(api.state.status).toBe("ready");
        expect(update.download).toHaveBeenCalledTimes(1);

        // Install: a failed save blocks it.
        m.saveOpenFlow.mockResolvedValueOnce(false);
        await flush(() => api.installAndRestart());
        expect(api.state).toMatchObject({ status: "error", message: expect.stringMatching(/save your flow/) });
        await flush(() => api.installAndRestart());
        expect(update.install).toHaveBeenCalled();
        expect(m.relaunch).toHaveBeenCalled();

        update.install.mockRejectedValueOnce(new Error("bad"));
        await flush(() => api.installAndRestart());
        expect(api.state).toEqual({ status: "error", message: "Couldn't install the update." });
        // Nothing staged any more.
        m.saveOpenFlow.mockClear();
        await flush(() => api.installAndRestart());
        expect(m.saveOpenFlow).not.toHaveBeenCalled();
        await view.unmount();
    });

    it("checks in the background when auto-check is on, staying quiet on failure", async () => {
        setDesktop(true);
        useFlowStore.setState({ updateConfig: { autoCheckEnabled: true } });
        m.check.mockRejectedValueOnce(new Error("offline"));
        const view = await mount(createElement(Probe));
        await flush();
        expect(m.check).toHaveBeenCalled();
        expect(api.state.status).toBe("idle");
        m.check.mockResolvedValueOnce(null);
        await flush(() => api.checkNow());
        await view.unmount();
    });
});
