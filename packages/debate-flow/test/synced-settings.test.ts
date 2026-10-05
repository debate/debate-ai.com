import { describe, expect, it } from "vitest";
import {
    buildSyncedSettingsRecords,
    DEVICE_ONLY_KEYS,
    parseSyncedSettings,
    pickSyncedDisplay,
    SYNCED_DISPLAY_KEYS,
} from "../src/lib/store/syncedSettings";

describe("synced flow settings", () => {
    it("keeps synced and device-only keys disjoint", () => {
        const device = new Set<string>(DEVICE_ONLY_KEYS);
        expect(SYNCED_DISPLAY_KEYS.filter((k) => device.has(k))).toEqual([]);
    });

    it("never includes device-only values in the display record", () => {
        const [display] = buildSyncedSettingsRecords(
            { flowFont: "x", tooltips: false, flowsDir: "/home/me", collabName: "Sam", rfdOpen: true },
            {},
        );
        expect(display).toEqual({ id: "display", values: { flowFont: "x", tooltips: false } });
    });

    it("round-trips display and keymap records", () => {
        const records = buildSyncedSettingsRecords({ theme: "dark" }, { "sheet.new": "Mod+n" });
        expect(parseSyncedSettings(JSON.parse(JSON.stringify(records)))).toEqual({
            display: { theme: "dark" },
            keymapOverrides: { "sheet.new": "Mod+n" },
        });
    });

    it("drops non-string chords and malformed records", () => {
        expect(
            parseSyncedSettings([
                null,
                "x",
                { id: "keymap", keymapOverrides: { a: "Mod+a", b: 3, c: "" } },
                { id: "display", values: { flowsDir: "/x", scrollZoom: false } },
                { id: "other" },
            ]),
        ).toEqual({ display: { scrollZoom: false }, keymapOverrides: { a: "Mod+a" } });
    });

    it("returns nothing for non-array input", () => {
        expect(parseSyncedSettings({ id: "display" })).toEqual({});
        expect(parseSyncedSettings(null)).toEqual({});
        expect(pickSyncedDisplay({})).toEqual({});
    });
});
