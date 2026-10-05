import { describe, expect, it } from "vitest";
import {
    FLOW_ACCOUNT_SETTING_KEYS,
    mergeFlowEditorSettings,
    normalizeFlowEditorSettingsPatch,
    parseFlowEditorSettings,
    serializeFlowEditorSettings,
} from "../src/lib/config/accountSettings";
import { changedAccountSettings } from "../src/lib/config/useAccountFlowSettingsSync";

describe("normalizeFlowEditorSettingsPatch", () => {
    it("accepts valid values for every kind of field", () => {
        const { valid, errors } = normalizeFlowEditorSettingsPatch({
            rfdVim: true,
            defaultGridZoom: 1.5,
            theme: "dark",
            cardmirrorTextType: "tag",
            affColor: "#112233",
            negColor: null,
            keymapOverrides: { "flow.undo": "Mod-z" },
        });
        expect(errors).toEqual([]);
        expect(valid).toMatchObject({ rfdVim: true, theme: "dark", negColor: null });
    });

    it("treats an absent patch as empty and rejects non-objects", () => {
        expect(normalizeFlowEditorSettingsPatch(undefined)).toEqual({ valid: {}, errors: [] });
        for (const bad of [null, [], "x", 3]) {
            expect(normalizeFlowEditorSettingsPatch(bad).errors).toHaveLength(1);
        }
    });

    it("rejects unknown keys, including device-specific ones", () => {
        const { valid, errors } = normalizeFlowEditorSettingsPatch({ flowsDir: "/home/x", collabName: "me", tooltips: false });
        expect(valid).toEqual({ tooltips: false });
        expect(errors).toHaveLength(2);
        expect(FLOW_ACCOUNT_SETTING_KEYS.has("flowsDir")).toBe(false);
        expect(FLOW_ACCOUNT_SETTING_KEYS.has("contacts")).toBe(false);
    });

    it("rejects invalid values without clamping", () => {
        const { valid, errors } = normalizeFlowEditorSettingsPatch({
            rfdVim: "yes",
            defaultGridZoom: 9,
            theme: "neon",
            flowFont: "comic-nope",
            affColor: "red",
            cardmirrorTextType: "x",
            keymapOverrides: { a: "" },
        });
        expect(valid).toEqual({});
        expect(errors).toHaveLength(7);
    });

    it("bounds the keymap override map", () => {
        const big: Record<string, string> = {};
        for (let i = 0; i < 501; i++) big[`cmd${i}`] = "Mod-x";
        expect(normalizeFlowEditorSettingsPatch({ keymapOverrides: big }).errors).toHaveLength(1);
    });
});

describe("merge / serialize / parse", () => {
    it("merges a patch over current values, replacing keymapOverrides whole", () => {
        const merged = mergeFlowEditorSettings(
            { tooltips: true, keymapOverrides: { a: "x", b: "y" } },
            { keymapOverrides: { a: "z" } },
        );
        expect(merged).toEqual({ tooltips: true, keymapOverrides: { a: "z" } });
    });

    it("serializes empty to null and round-trips", () => {
        expect(serializeFlowEditorSettings({})).toBeNull();
        const raw = serializeFlowEditorSettings({ theme: "light", scrollZoom: false });
        expect(parseFlowEditorSettings(raw)).toEqual({ theme: "light", scrollZoom: false });
    });

    it("never throws on malformed stored values and drops invalid fields", () => {
        expect(parseFlowEditorSettings(null)).toEqual({});
        expect(parseFlowEditorSettings("{not json")).toEqual({});
        expect(parseFlowEditorSettings("[1]")).toEqual({});
        expect(parseFlowEditorSettings(JSON.stringify({ theme: "bad", tooltips: true, flowsDir: "/x" }))).toEqual({
            tooltips: true,
        });
    });
});

describe("changedAccountSettings", () => {
    it("returns only differing keys, comparing nested values by content", () => {
        const prev = { tooltips: true, keymapOverrides: { a: "x" } };
        const next = { tooltips: false, keymapOverrides: { a: "x" } };
        expect(changedAccountSettings(prev, next)).toEqual({ tooltips: false });
        expect(changedAccountSettings(next, next)).toEqual({});
    });
});

describe("store.applyAccountSettings", () => {
    it("applies a validated patch, clamping zoom and leaving device-only settings alone", async () => {
        const { accountSettingsOf, useFlowStore } = await import("../src/lib/store/useFlowStore");
        const before = useFlowStore.getState();
        before.applyAccountSettings({
            theme: "dark",
            tooltips: false,
            defaultGridZoom: 2,
            keymapOverrides: { "flow.undo": "Mod-u" },
        });
        const after = useFlowStore.getState();
        expect(after.theme).toBe("dark");
        expect(after.tooltips).toBe(false);
        expect(after.gridZoom).toBe(2);
        expect(after.flowsDir).toBe(before.flowsDir);
        expect(accountSettingsOf(after).keymapOverrides).toEqual({ "flow.undo": "Mod-u" });
    });
});
