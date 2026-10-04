import { describe, expect, it, vi } from "vitest";
import {
    MAX_KEYMAP_OVERRIDES,
    normalizeFlowEditorSettingsPatch,
    parseFlowEditorSettings,
    pickSyncedDisplay,
    serializeFlowEditorSettings,
} from "../src/lib/store/flow-editor-settings-sync";
import {
    snapshotSyncedSettings,
    startFlowSettingsAccountSync,
    type FlowSettingsStoreLike,
} from "../src/lib/store/flow-editor-settings-account-sync";

const payload = { display: { rfdVim: true, defaultGridZoom: 1.5, affColor: "#aabbcc" }, keymapOverrides: { "tab.new": "Mod+T" } };

describe("normalizeFlowEditorSettingsPatch", () => {
    it("accepts a valid payload and null", () => {
        expect(normalizeFlowEditorSettingsPatch({ flowEditorSettings: payload })).toEqual({
            valid: { flowEditorSettings: payload },
            errors: [],
        });
        expect(normalizeFlowEditorSettingsPatch({ flowEditorSettings: null }).valid).toEqual({ flowEditorSettings: null });
    });

    it("ignores bodies without the field and rejects non-objects", () => {
        expect(normalizeFlowEditorSettingsPatch({ fontSize: 3 })).toEqual({ valid: {}, errors: [] });
        expect(normalizeFlowEditorSettingsPatch([]).errors).toHaveLength(1);
    });

    it.each([
        ["device-bound field", { display: { flowsDir: "/tmp" }, keymapOverrides: {} }],
        ["bad boolean", { display: { rfdVim: "yes" }, keymapOverrides: {} }],
        ["out-of-range zoom", { display: { defaultGridZoom: 9 }, keymapOverrides: {} }],
        ["bad color", { display: { affColor: "red" }, keymapOverrides: {} }],
        ["unknown theme", { display: { theme: "neon" }, keymapOverrides: {} }],
        ["non-string chord", { display: {}, keymapOverrides: { a: 1 } }],
        ["extra key", { display: {}, keymapOverrides: {}, extra: 1 }],
        ["missing keymap", { display: {} }],
    ])("rejects %s", (_name, value) => {
        expect(normalizeFlowEditorSettingsPatch({ flowEditorSettings: value }).errors).toHaveLength(1);
    });

    it("caps the number of keymap overrides", () => {
        const keymapOverrides = Object.fromEntries(Array.from({ length: MAX_KEYMAP_OVERRIDES + 1 }, (_, i) => [`c${i}`, "x"]));
        expect(normalizeFlowEditorSettingsPatch({ flowEditorSettings: { display: {}, keymapOverrides } }).errors).toHaveLength(1);
    });
});

describe("serialize / parse", () => {
    it("round-trips and tolerates garbage", () => {
        expect(parseFlowEditorSettings(serializeFlowEditorSettings(payload))).toEqual(payload);
        expect(serializeFlowEditorSettings(null)).toBeNull();
        expect(parseFlowEditorSettings("{nope")).toBeNull();
        expect(parseFlowEditorSettings('{"display":{"flowsDir":"/x"},"keymapOverrides":{}}')).toBeNull();
        expect(parseFlowEditorSettings(null)).toBeNull();
    });
});

describe("pickSyncedDisplay", () => {
    it("drops device-bound fields", () => {
        expect(pickSyncedDisplay({ rfdVim: true, flowsDir: "/x", contacts: {}, collabEnabled: true })).toEqual({ rfdVim: true });
    });
});

function fakeStore(initial: Record<string, unknown>) {
    let state = { keymapOverrides: {}, ...initial } as ReturnType<FlowSettingsStoreLike["getState"]> & Record<string, unknown>;
    const listeners = new Set<() => void>();
    return {
        getState: () => state,
        setState: (p: Record<string, unknown>) => void (state = { ...state, ...p }),
        subscribe: (l) => (listeners.add(l), () => listeners.delete(l)),
        emit: () => listeners.forEach((l) => l()),
    };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("startFlowSettingsAccountSync", () => {
    it("does nothing when signed out", async () => {
        const save = vi.fn();
        const applyRemote = vi.fn();
        const store = fakeStore({ rfdVim: false });
        const stop = startFlowSettingsAccountSync(store, { fetchSettings: async () => null, saveSettings: save, applyRemote });
        await flush();
        store.emit();
        await flush();
        expect(save).not.toHaveBeenCalled();
        expect(applyRemote).not.toHaveBeenCalled();
        stop();
    });

    it("adopts the account copy without echoing it back", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const store = fakeStore({ rfdVim: false });
        const applyRemote = vi.fn((p) => store.setState({ ...p.display, keymapOverrides: p.keymapOverrides }));
        const stop = startFlowSettingsAccountSync(store, {
            fetchSettings: async () => ({ settings: payload }),
            saveSettings: save,
            applyRemote,
            debounceMs: 0,
        });
        await flush();
        expect(applyRemote).toHaveBeenCalledWith(payload);
        store.emit();
        await flush();
        expect(save).not.toHaveBeenCalled();
        stop();
    });

    it("seeds an empty account, then pushes debounced changes", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const store = fakeStore({ rfdVim: false });
        const stop = startFlowSettingsAccountSync(store, {
            fetchSettings: async () => ({ settings: null }),
            saveSettings: save,
            applyRemote: vi.fn(),
            debounceMs: 0,
        });
        await flush();
        expect(save).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenLastCalledWith(snapshotSyncedSettings(store.getState()));
        store.setState({ rfdVim: true });
        store.emit();
        store.emit();
        await flush();
        expect(save).toHaveBeenCalledTimes(2);
        expect(save.mock.calls[1][0].display.rfdVim).toBe(true);
        stop();
    });

    it("reports a failed save and retries on the next change", async () => {
        const save = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
        const onError = vi.fn();
        const store = fakeStore({ rfdVim: false });
        const stop = startFlowSettingsAccountSync(store, {
            fetchSettings: async () => ({ settings: null }),
            saveSettings: save,
            applyRemote: vi.fn(),
            debounceMs: 0,
            onError,
        });
        await flush();
        expect(onError).toHaveBeenCalledTimes(1);
        store.emit();
        await flush();
        expect(save).toHaveBeenCalledTimes(2);
        stop();
    });
});
