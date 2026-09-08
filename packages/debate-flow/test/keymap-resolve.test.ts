import { describe, expect, it } from "vitest";
import { eventToChord, resolveCommand } from "../src/lib/keymap/resolve";
import { prettyChord } from "../src/lib/keymap/displayChord";
import { effectiveKeymap } from "../src/lib/keymap/effective";
import { FLAT_KEYMAP, RETIRED_DEFAULTS, getPresetKeymap } from "../src/lib/keymap/presets";
import { reservedChords } from "../src/lib/keymap/reserved";
import type { Keymap } from "../src/lib/keymap/types";

const ev = (over: Partial<Parameters<typeof eventToChord>[0]> = {}) => ({
    key: "a",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...over,
});

describe("eventToChord", () => {
    it("names a bare printable as itself", () => {
        expect(eventToChord(ev({ key: "a" }))).toBe("a");
        expect(eventToChord(ev({ key: "?" }))).toBe("?");
    });

    it("orders the modifiers Meta, Ctrl, Alt, Shift", () => {
        expect(
            eventToChord(ev({ key: "Enter", metaKey: true, ctrlKey: true, altKey: true, shiftKey: true })),
        ).toBe("Meta+Ctrl+Alt+Shift+Enter");
    });

    it("encodes shift in a letter's case rather than as a modifier", () => {
        expect(eventToChord(ev({ key: "p", metaKey: true, shiftKey: true }))).toBe("Meta+P");
        expect(eventToChord(ev({ key: "p", metaKey: true }))).toBe("Meta+p");
    });

    it("trusts shiftKey over the case macOS reports under Meta", () => {
        // macOS reports the letter lowercase while Meta is held, even with Shift.
        expect(eventToChord(ev({ key: "p", metaKey: true, shiftKey: true }))).toBe("Meta+P");
        // And uppercase without shift is still the unshifted chord.
        expect(eventToChord(ev({ key: "P", metaKey: true }))).toBe("Meta+p");
    });

    it("adds an explicit Shift for a named key, which has no case", () => {
        expect(eventToChord(ev({ key: "Tab", shiftKey: true }))).toBe("Shift+Tab");
        expect(eventToChord(ev({ key: "ArrowUp", shiftKey: true, altKey: true }))).toBe(
            "Alt+Shift+ArrowUp",
        );
    });

    it("never adds an explicit Shift for a symbol that already carries it", () => {
        expect(eventToChord(ev({ key: "?", shiftKey: true }))).toBe("?");
    });

    it("shifts the bound brackets, so one physical chord reads alike on both platforms", () => {
        expect(eventToChord(ev({ key: "[", metaKey: true, shiftKey: true }))).toBe("Meta+{");
        expect(eventToChord(ev({ key: "]", metaKey: true, shiftKey: true }))).toBe("Meta+}");
        expect(eventToChord(ev({ key: "[", metaKey: true }))).toBe("Meta+[");
    });

    it("derives an Alt chord from the physical code, which macOS composes away", () => {
        // Option+H reports "˙" as the key.
        expect(eventToChord(ev({ key: "˙", code: "KeyH", altKey: true }))).toBe("Alt+h");
    });

    it("derives the Alt bracket and backslash chords from their codes", () => {
        expect(eventToChord(ev({ key: "«", code: "Backslash", altKey: true }))).toBe("Alt+\\");
        expect(eventToChord(ev({ key: "“", code: "BracketLeft", altKey: true }))).toBe("Alt+[");
        expect(eventToChord(ev({ key: "‘", code: "BracketRight", altKey: true }))).toBe("Alt+]");
    });

    it("shifts an Alt bracket after deriving it, so Alt+Shift+[ is Alt+{", () => {
        expect(eventToChord(ev({ key: "”", code: "BracketLeft", altKey: true, shiftKey: true }))).toBe(
            "Alt+{",
        );
    });

    it("leaves a composed Alt key alone when no code names a base key", () => {
        expect(eventToChord(ev({ key: "π", code: "F13", altKey: true }))).toBe("Alt+π");
    });
});

describe("resolveCommand", () => {
    const keymap: Keymap = { name: "test", bindings: { "Meta+s": "flow.save", "?": "help.open" } };

    it("finds the command a chord is bound to", () => {
        expect(resolveCommand(keymap, ev({ key: "s", metaKey: true }))).toBe("flow.save");
        expect(resolveCommand(keymap, ev({ key: "?" }))).toBe("help.open");
    });

    it("is null for an unbound chord", () => {
        expect(resolveCommand(keymap, ev({ key: "q", metaKey: true }))).toBeNull();
    });

    it("resolves the chord the event names, not the raw key", () => {
        // Shift rides in the letter's case, so the shifted chord is a miss here.
        expect(resolveCommand(keymap, ev({ key: "s", metaKey: true, shiftKey: true }))).toBeNull();
    });
});

describe("prettyChord", () => {
    it("spells the platform modifier out", () => {
        expect(prettyChord("Meta+s")).toBe("Cmd-s");
        expect(prettyChord("Ctrl+s")).toBe("Ctrl-s");
        expect(prettyChord("Alt+l")).toBe("Alt-l");
    });

    it("spells out the shift an uppercase letter encodes", () => {
        expect(prettyChord("Meta+P")).toBe("Cmd-Shift-P");
    });

    it("labels the named keys", () => {
        expect(prettyChord("Escape")).toBe("Esc");
        expect(prettyChord("Meta+Backspace")).toBe("Cmd-Backspace");
        expect(prettyChord("Shift+ArrowUp")).toBe("Shift-Up");
        expect(prettyChord("Delete")).toBe("Del");
    });

    it("passes a symbol through unchanged", () => {
        expect(prettyChord("Meta+\\")).toBe("Cmd-\\");
        expect(prettyChord("?")).toBe("?");
    });
});

describe("the preset keymap", () => {
    it("binds every chord to exactly one command", () => {
        const map = getPresetKeymap();
        expect(map).toBe(FLAT_KEYMAP);
        expect(Object.values(map.bindings).every(Boolean)).toBe(true);
    });

    it("leaves the grid's own gestures unbound", () => {
        for (const gesture of ["Enter", "Alt+Enter", "Tab", "Escape", "ArrowUp", "ArrowDown"]) {
            expect(FLAT_KEYMAP.bindings[gesture]).toBeUndefined();
        }
    });

    it("puts every sheet jump on the platform modifier, never on a bare digit", () => {
        for (let i = 1; i <= 9; i++) {
            expect(FLAT_KEYMAP.bindings[String(i)]).toBeUndefined();
            expect(Object.values(FLAT_KEYMAP.bindings)).toContain(`sheet.jump${i}`);
        }
    });

    it("keeps the split and selection chords on Alt", () => {
        expect(FLAT_KEYMAP.bindings["Alt+\\"]).toBe("split.toggle");
        expect(FLAT_KEYMAP.bindings["Alt+h"]).toBe("split.focusLeft");
        expect(FLAT_KEYMAP.bindings["Alt+l"]).toBe("split.focusRight");
        expect(FLAT_KEYMAP.bindings["Alt+["]).toBe("sheet.extendUp");
        expect(FLAT_KEYMAP.bindings["Alt+]"]).toBe("sheet.extendDown");
    });

    it("keeps the move chord shifted, since bare Meta+m is the window's minimize", () => {
        expect(Object.entries(FLAT_KEYMAP.bindings).find(([, c]) => c === "cell.move")?.[0]).toMatch(
            /\+M$/,
        );
    });

    it("names the defaults an earlier version carried, so a stale override is dropped", () => {
        expect(RETIRED_DEFAULTS["flow.new"]).toEqual(["Meta+n", "Ctrl+n"]);
        expect(RETIRED_DEFAULTS["sheet.next"]).toEqual(["]"]);
        expect(RETIRED_DEFAULTS["sheet.prev"]).toEqual(["["]);
    });
});

describe("effectiveKeymap", () => {
    it("is the preset when nothing is overridden", () => {
        expect(effectiveKeymap({}).bindings).toEqual(FLAT_KEYMAP.bindings);
    });

    it("binds an override chord to its command", () => {
        expect(effectiveKeymap({ "flow.save": "Meta+q" }).bindings["Meta+q"]).toBe("flow.save");
    });

    it("frees the preset chord the overridden command held", () => {
        const preset = Object.entries(FLAT_KEYMAP.bindings).find(([, c]) => c === "flow.save")![0];
        expect(effectiveKeymap({ "flow.save": "Meta+q" }).bindings[preset]).toBeUndefined();
    });

    it("ignores an empty override rather than binding the empty chord", () => {
        const map = effectiveKeymap({ "flow.save": "" });
        expect(map.bindings[""]).toBeUndefined();
        expect(Object.values(map.bindings)).toContain("flow.save");
    });

    it("lets an override take a chord the preset gave another command", () => {
        const map = effectiveKeymap({ "help.open": "Meta+b" });
        expect(map.bindings["Meta+b"]).toBe("help.open");
    });

    it("names itself after the preset it extends", () => {
        expect(effectiveKeymap({}).name).toBe("default+overrides");
    });

    it("applies several overrides at once", () => {
        const map = effectiveKeymap({ "flow.save": "F5", "help.open": "F6" });
        expect(map.bindings.F5).toBe("flow.save");
        expect(map.bindings.F6).toBe("help.open");
    });
});

describe("reservedChords", () => {
    const chords = reservedChords();

    it("reserves the chords a browser would otherwise swallow", () => {
        for (const key of ["s", "p", "o", "b", "["]) {
            expect(chords.has(`Ctrl+${key}`) || chords.has(`Meta+${key}`)).toBe(true);
        }
    });

    it("reserves redo, whose shift rides in the uppercase key", () => {
        expect(chords.has("Ctrl+Z") || chords.has("Meta+Z")).toBe(true);
    });

    it("reserves every sheet jump digit", () => {
        for (let i = 1; i <= 9; i++) {
            expect(chords.has(`Ctrl+${i}`) || chords.has(`Meta+${i}`)).toBe(true);
        }
    });

    it("reserves the horizontal cursor jumps the browser owns, not the vertical pair", () => {
        const has = (k: string) => chords.has(`Ctrl+${k}`) || chords.has(`Meta+${k}`);
        expect(has("ArrowLeft")).toBe(true);
        expect(has("ArrowRight")).toBe(true);
        expect(has("ArrowUp")).toBe(false);
        expect(has("ArrowDown")).toBe(false);
    });

    it("puts every chord on one modifier, the platform's own", () => {
        const mods = new Set([...chords].map((c) => c.split("+")[0]));
        expect(mods.size).toBe(1);
        expect(["Meta", "Ctrl"]).toContain([...mods][0]);
    });

    it("reserves nothing the preset does not bind on that modifier", () => {
        const mod = [...chords][0].split("+")[0];
        // Every reserved chord answers to a real binding, bar the two Chrome
        // never delivers and the arrow jumps the grid owns.
        const unbound = [...chords].filter((c) => !FLAT_KEYMAP.bindings[c]);
        expect(unbound.sort()).toEqual(
            [`${mod}+ArrowLeft`, `${mod}+ArrowRight`, `${mod}+a`].sort(),
        );
    });
});
