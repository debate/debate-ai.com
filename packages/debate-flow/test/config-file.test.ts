import { describe, expect, it } from "vitest";
import { configFromState, toAppConfig } from "../src/lib/config/configFile";
import { resolveCardMirrorTextType } from "../src/lib/bridge/cardmirror";
import { COMMANDS } from "../src/lib/commands/registry";
import { DEFAULT_FONT_ID, fontLabel, resolveFontName } from "../src/lib/fonts/registry";
import { getPresetKeymap, RETIRED_DEFAULTS } from "../src/lib/keymap/presets";
import { resolveThemeMode, resolveMode } from "../src/lib/theme/mode";
import { DEFAULT_UPDATE_CONFIG } from "../src/lib/update/types";
import { bool, clampZoom, resolveColor, resolveZoom, ZOOM_MAX, ZOOM_MIN } from "../src/lib/store/useFlowStore";

/** The defaults an empty config file resolves to, as the store's vocabulary. */
const defaults = toAppConfig({});

describe("toAppConfig", () => {
    it("degrades a file that is not an object to the defaults", () => {
        expect(toAppConfig(null)).toEqual(defaults);
        expect(toAppConfig("theme = 'dark'")).toEqual(defaults);
        expect(toAppConfig(undefined)).toEqual(defaults);
    });

    it("reads each boolean setting through, falling back when it is not one", () => {
        expect(toAppConfig({ sidebar_collapsed: true }).sidebarCollapsed).toBe(true);
        expect(toAppConfig({ sidebar_collapsed: "yes" }).sidebarCollapsed).toBe(false);
        expect(toAppConfig({ append_edit: false }).appendEdit).toBe(false);
        expect(toAppConfig({ append_edit: 0 }).appendEdit).toBe(true);
    });

    it("keeps the collab switches off, on and off by default", () => {
        expect(defaults.collabEnabled).toBe(false);
        expect(defaults.collabRelayEnabled).toBe(true);
        expect(defaults.collabListenEnabled).toBe(false);
        expect(defaults.collabShowViewers).toBe(true);
    });

    it("reads the shared-round name as text, else as empty", () => {
        expect(toAppConfig({ collab_name: "Ada" }).collabName).toBe("Ada");
        expect(toAppConfig({ collab_name: 7 }).collabName).toBe("");
        expect(defaults.collabName).toBe("");
    });

    it("trims the flows folder and reads a blank one as the platform default", () => {
        expect(toAppConfig({ flows_dir: "  /flows " }).flowsDir).toBe("/flows");
        expect(toAppConfig({ flows_dir: "   " }).flowsDir).toBeNull();
        expect(toAppConfig({ flows_dir: 3 }).flowsDir).toBeNull();
    });

    it("reads the side colours only in the form the picker writes", () => {
        expect(toAppConfig({ aff_color: "#1a2B3c" }).affColor).toBe("#1a2B3c");
        expect(toAppConfig({ aff_color: "red" }).affColor).toBeNull();
        expect(toAppConfig({ neg_color: "#abc" }).negColor).toBeNull();
    });

    it("reads the font by its human name and by the id older files stored", () => {
        expect(toAppConfig({ flow_font: "DM Sans" }).flowFont).toBe("dm-sans");
        expect(toAppConfig({ flow_font: "dm-sans" }).flowFont).toBe("dm-sans");
        expect(toAppConfig({ flow_font: "Comic Sans" }).flowFont).toBe(DEFAULT_FONT_ID);
    });

    it("clamps a hand-edited zoom rather than resetting it", () => {
        expect(toAppConfig({ default_zoom: 5 }).defaultGridZoom).toBe(ZOOM_MAX);
        expect(toAppConfig({ default_zoom: 0.1 }).defaultGridZoom).toBe(ZOOM_MIN);
        expect(toAppConfig({ default_zoom: "big" }).defaultGridZoom).toBe(1);
    });

    it("reads the theme mode, falling back to following the system", () => {
        expect(toAppConfig({ theme: "dark" }).theme).toBe("dark");
        expect(toAppConfig({ theme: "sepia" }).theme).toBe("system");
    });

    it("reads the auto-update switch out of its own table", () => {
        expect(toAppConfig({ update: { auto_check_enabled: false } }).updateConfig).toEqual({
            autoCheckEnabled: false,
        });
        expect(toAppConfig({ update: "on" }).updateConfig.autoCheckEnabled).toBe(
            DEFAULT_UPDATE_CONFIG.autoCheckEnabled,
        );
    });

    it("validates the contact table rather than trusting the file", () => {
        const id = "a".repeat(64);
        expect(toAppConfig({ contacts: { [id]: { name: "Ada" } } }).contacts[id]).toEqual({
            name: "Ada",
        });
        expect(toAppConfig({ contacts: { nope: { name: "Ada" } } }).contacts).toEqual({});
    });
});

describe("toAppConfig on the keymap table", () => {
    it("reads a real rebind as an override", () => {
        const config = toAppConfig({ keymap: { flow: { save: "Meta+F9" } } });
        expect(config.keymapOverrides).toEqual({ "flow.save": "Meta+F9" });
    });

    it("reads a shipped default file as no customization at all", () => {
        const state = configFromState(defaults);
        expect(toAppConfig(state).keymapOverrides).toEqual({});
    });

    it("drops an unbound entry, which the file ships so it is editable in place", () => {
        expect(toAppConfig({ keymap: { flow: { open: "" } } }).keymapOverrides).toEqual({});
    });

    it("drops an entry naming a command this build no longer has", () => {
        expect(toAppConfig({ keymap: { flow: { teleport: "Meta+F9" } } }).keymapOverrides).toEqual(
            {},
        );
    });

    it("does not read a prototype key as a command", () => {
        const config = toAppConfig({ keymap: { constructor: "Meta+F9", toString: "Meta+F8" } });
        expect(config.keymapOverrides).toEqual({});
    });

    it("drops a chord that only restates a default the preset has retired", () => {
        for (const [commandId, chords] of Object.entries(RETIRED_DEFAULTS)) {
            const [namespace, leaf] = commandId.split(".");
            const config = toAppConfig({ keymap: { [namespace]: { [leaf]: chords[0] } } });
            expect(config.keymapOverrides[commandId]).toBeUndefined();
        }
    });

    it("keeps a real rebind of a command that has a retired default", () => {
        const config = toAppConfig({ keymap: { flow: { new: "Meta+F7" } } });
        expect(config.keymapOverrides["flow.new"]).toBe("Meta+F7");
    });

    it("reads a deeply nested namespace back to its dotted command id", () => {
        const config = toAppConfig({ keymap: { format: { toggleBold: "Meta+F9" } } });
        expect(config.keymapOverrides).toEqual({ "format.toggleBold": "Meta+F9" });
    });

    it("ignores a keymap table that is not one", () => {
        expect(toAppConfig({ keymap: "Meta+s" }).keymapOverrides).toEqual({});
        expect(toAppConfig({ keymap: null }).keymapOverrides).toEqual({});
    });
});

describe("configFromState", () => {
    const file = configFromState(defaults);

    it("writes the font under its human name, which is what the file exposes", () => {
        expect(file.flow_font).toBe(fontLabel(defaults.flowFont));
    });

    it("ships every configurable command, unbound ones as an empty chord", () => {
        const flat: Record<string, string> = {};
        const walk = (node: unknown, prefix: string) => {
            for (const [seg, val] of Object.entries(node as Record<string, unknown>)) {
                const id = prefix ? `${prefix}.${seg}` : seg;
                if (typeof val === "string") flat[id] = val;
                else walk(val, id);
            }
        };
        walk(file.keymap, "");
        expect(Object.keys(flat).sort()).toEqual(Object.keys(COMMANDS).sort());
        expect(flat["flow.open"]).toBe("");
    });

    it("nests a dotted command into real TOML tables", () => {
        const format = file.keymap.format as Record<string, string>;
        expect(typeof format).toBe("object");
        expect(Object.values(getPresetKeymap().bindings)).toContain("format.toggleBold");
        expect(format.toggleBold.length).toBeGreaterThan(0);
    });

    it("round-trips the settings through the file shape", () => {
        expect(toAppConfig(configFromState(defaults))).toEqual(defaults);
    });

    it("round-trips a customized set of settings", () => {
        const custom = {
            ...defaults,
            theme: "dark" as const,
            sidebarCollapsed: true,
            collabName: "Ada",
            affColor: "#112233",
            flowsDir: "/flows",
            defaultGridZoom: 1.5,
            keymapOverrides: { "flow.save": "Meta+F9" },
        };
        expect(toAppConfig(configFromState(custom))).toEqual(custom);
    });

    it("writes the auto-update switch into its own table", () => {
        expect(file.update).toEqual({ auto_check_enabled: defaults.updateConfig.autoCheckEnabled });
    });
});

describe("the settings resolvers", () => {
    it("clamps a zoom to the bounds and snaps it to whole percents", () => {
        expect(clampZoom(1.234)).toBe(1.23);
        expect(clampZoom(99)).toBe(ZOOM_MAX);
        expect(clampZoom(0)).toBe(ZOOM_MIN);
    });

    it("reads a zoom the file cannot hold as one hundred percent", () => {
        expect(resolveZoom(NaN)).toBe(1);
        expect(resolveZoom(Infinity)).toBe(1);
        expect(resolveZoom(null)).toBe(1);
        expect(resolveZoom("1.5")).toBe(1);
    });

    it("takes a boolean and nothing else", () => {
        expect(bool(true, false)).toBe(true);
        expect(bool(false, true)).toBe(false);
        expect(bool("true", false)).toBe(false);
        expect(bool(undefined, true)).toBe(true);
        expect(bool(1, false)).toBe(false);
    });

    it("takes a colour only in the six-digit form the picker writes", () => {
        expect(resolveColor("#ABCDEF")).toBe("#ABCDEF");
        expect(resolveColor("#abc")).toBeNull();
        expect(resolveColor("#abcdeg")).toBeNull();
        expect(resolveColor(null)).toBeNull();
    });

    it("resolves a font name case-insensitively and around whitespace", () => {
        expect(resolveFontName("  dm sans  ")).toBe("dm-sans");
        expect(resolveFontName("IBM PLEX MONO")).toBe("plex-mono");
        expect(resolveFontName(7)).toBe(DEFAULT_FONT_ID);
    });

    it("resolves the CardMirror text type against the levels it accepts", () => {
        expect(resolveCardMirrorTextType("tag")).toBe("tag");
        expect(resolveCardMirrorTextType("body")).toBe("body");
        expect(resolveCardMirrorTextType("heading")).toBe("analytic");
        expect(resolveCardMirrorTextType(null)).toBe("analytic");
    });

    it("resolves the theme mode against the system preference", () => {
        expect(resolveThemeMode("light")).toBe("light");
        expect(resolveThemeMode(null)).toBe("system");
        expect(resolveMode("dark", false)).toBe("dark");
        expect(resolveMode("light", true)).toBe("light");
        expect(resolveMode("system", true)).toBe("dark");
        expect(resolveMode("system", false)).toBe("light");
    });
});
