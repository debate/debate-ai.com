import { describe, expect, it } from "vitest";
import {
    DISPLAY_RECORD_ID,
    KEYMAP_RECORD_ID,
    decodeFlowEditorSettings,
    encodeFlowEditorSettings,
} from "../src/lib/store/syncedSettings";

describe("encodeFlowEditorSettings", () => {
    it("emits one display and one keymap record", () => {
        const records = encodeFlowEditorSettings({ theme: "dark" }, { "cmd.a": "Mod-k" });
        expect(records.map((r) => r.id)).toEqual([DISPLAY_RECORD_ID, KEYMAP_RECORD_ID]);
        expect(records[0]).toMatchObject({ theme: "dark" });
        expect(records[1]).toEqual({ id: "keymap", keymapOverrides: { "cmd.a": "Mod-k" } });
    });

    it("never syncs the device-local flowsDir", () => {
        const [display] = encodeFlowEditorSettings({ theme: "dark", flowsDir: "/home/me/flows" }, {});
        expect(display).not.toHaveProperty("flowsDir");
    });
});

describe("decodeFlowEditorSettings", () => {
    it("round-trips an encoded pair", () => {
        const records = encodeFlowEditorSettings({ theme: "light", tooltips: false }, { "cmd.b": "Alt-b" });
        expect(decodeFlowEditorSettings(records)).toEqual({
            display: { theme: "light", tooltips: false },
            keymapOverrides: { "cmd.b": "Alt-b" },
        });
    });

    it("strips flowsDir from an account row written elsewhere", () => {
        const decoded = decodeFlowEditorSettings([{ id: "display", theme: "dark", flowsDir: "/x" }]);
        expect(decoded.display).toEqual({ theme: "dark" });
    });

    it("returns empty results for malformed input", () => {
        const empty = { display: null, keymapOverrides: null };
        expect(decodeFlowEditorSettings(null)).toEqual(empty);
        expect(decodeFlowEditorSettings({ id: "display" })).toEqual(empty);
        expect(decodeFlowEditorSettings(["x", 3, null])).toEqual(empty);
        expect(decodeFlowEditorSettings([{ id: "other", a: 1 }])).toEqual(empty);
    });

    it("drops non-string chords and a non-object keymap", () => {
        expect(
            decodeFlowEditorSettings([{ id: "keymap", keymapOverrides: { a: "Mod-a", b: 5 } }]).keymapOverrides,
        ).toEqual({ a: "Mod-a" });
        expect(decodeFlowEditorSettings([{ id: "keymap", keymapOverrides: "nope" }]).keymapOverrides).toBeNull();
    });
});
