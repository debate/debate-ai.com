import { describe, expect, it } from "vitest";
import {
    MENU_COMMAND_IDS,
    chordForCommand,
    chordToAccelerator,
    menuAccelerators,
} from "../src/lib/keymap/accelerator";
import { FLAT_KEYMAP } from "../src/lib/keymap/presets";
import type { Keymap } from "../src/lib/keymap/types";

describe("chordToAccelerator", () => {
    it("spells the platform modifier the way the native menu wants it", () => {
        expect(chordToAccelerator("Meta+s")).toBe("Cmd+S");
        expect(chordToAccelerator("Ctrl+s")).toBe("Ctrl+S");
    });

    it("puts the shift an uppercase letter encodes back as a modifier", () => {
        expect(chordToAccelerator("Meta+S")).toBe("Cmd+Shift+S");
    });

    it("keeps an explicit Shift on a named key", () => {
        expect(chordToAccelerator("Meta+Shift+Enter")).toBe("Cmd+Shift+Enter");
    });

    it("orders the modifiers Cmd, Ctrl, Alt, Shift", () => {
        expect(chordToAccelerator("Meta+Ctrl+Alt+Shift+Enter")).toBe("Cmd+Ctrl+Alt+Shift+Enter");
    });

    it("names the punctuation keys by their tokens", () => {
        expect(chordToAccelerator("Meta+,")).toBe("Cmd+Comma");
        expect(chordToAccelerator("Meta+\\")).toBe("Cmd+Backslash");
        expect(chordToAccelerator("Meta+[")).toBe("Cmd+BracketLeft");
        expect(chordToAccelerator("Meta+]")).toBe("Cmd+BracketRight");
        expect(chordToAccelerator("Meta+/")).toBe("Cmd+Slash");
        expect(chordToAccelerator("Meta+.")).toBe("Cmd+Period");
    });

    it("puts back the shift a shifted bracket carries in its character", () => {
        expect(chordToAccelerator("Meta+{")).toBe("Cmd+Shift+BracketLeft");
        expect(chordToAccelerator("Meta+}")).toBe("Cmd+Shift+BracketRight");
    });

    it("names the named keys", () => {
        expect(chordToAccelerator("Meta+Backspace")).toBe("Cmd+Backspace");
        expect(chordToAccelerator("Meta+ArrowUp")).toBe("Cmd+Up");
        expect(chordToAccelerator("Meta+Escape")).toBe("Cmd+Escape");
        expect(chordToAccelerator("Meta+PageDown")).toBe("Cmd+PageDown");
    });

    it("passes a digit through", () => {
        expect(chordToAccelerator("Meta+1")).toBe("Cmd+1");
    });

    it("reads a literal plus as the key, not as a separator", () => {
        // "+" has no unshifted token of its own, so the accelerator is withheld
        // rather than guessed - but the chord is not misread as a bare "Meta".
        expect(chordToAccelerator("Meta++")).toBeNull();
        expect(chordToAccelerator("Meta+=")).toBe("Cmd+Equal");
    });

    it("handles the space key, which appears only right after a plus", () => {
        expect(chordToAccelerator("Meta+ ")).toBe("Cmd+Space");
    });

    it("withholds an accelerator from a bare printable, which types text", () => {
        expect(chordToAccelerator("a")).toBeNull();
        expect(chordToAccelerator("?")).toBeNull();
    });

    it("withholds one from an Alt-only chord, which fires while typing", () => {
        expect(chordToAccelerator("Alt+h")).toBeNull();
        expect(chordToAccelerator("Alt+\\")).toBeNull();
    });

    it("withholds one from a bare named key, which is a grid gesture", () => {
        expect(chordToAccelerator("Enter")).toBeNull();
        expect(chordToAccelerator("Tab")).toBeNull();
        expect(chordToAccelerator("ArrowUp")).toBeNull();
    });

    it("lets a bare function key through, since it types nothing", () => {
        expect(chordToAccelerator("F5")).toBe("F5");
        expect(chordToAccelerator("F12")).toBe("F12");
        expect(chordToAccelerator("F24")).toBe("F24");
        expect(chordToAccelerator("Meta+F1")).toBe("Cmd+F1");
    });

    it("does not read F25 as a function key", () => {
        expect(chordToAccelerator("F25")).toBeNull();
    });

    it("withholds one from a two-key sequence", () => {
        expect(chordToAccelerator("Meta+k Meta+s")).toBeNull();
    });

    it("withholds one from a shifted symbol with no unshifted token", () => {
        expect(chordToAccelerator("Meta+?")).toBeNull();
        expect(chordToAccelerator("Meta+~")).toBeNull();
    });

    it("refuses a chord naming something that is not a modifier", () => {
        expect(chordToAccelerator("Hyper+s")).toBeNull();
    });

    it("refuses an empty chord and a trailing modifier", () => {
        expect(chordToAccelerator("")).toBeNull();
        expect(chordToAccelerator("Meta+")).toBeNull();
    });
});

describe("chordForCommand", () => {
    const keymap: Keymap = {
        name: "t",
        bindings: { "Meta+s": "flow.save", "Meta+S": "flow.saveAs", F5: "flow.save" },
    };

    it("returns the first chord bound to the command, in binding order", () => {
        expect(chordForCommand(keymap, "flow.save")).toBe("Meta+s");
    });

    it("is null for a command nothing is bound to", () => {
        expect(chordForCommand(keymap, "help.open")).toBeNull();
    });
});

describe("menuAccelerators", () => {
    const accels = menuAccelerators(FLAT_KEYMAP);

    it("has an entry for every menu command", () => {
        expect(Object.keys(accels).sort()).toEqual([...MENU_COMMAND_IDS].sort());
    });

    it("gives the save command the accelerator its chord derives", () => {
        expect(accels["flow.save"]).toMatch(/^(Cmd|Ctrl)\+S$/);
    });

    it("leaves a command with no accelerator click-only rather than absent", () => {
        // Open and New Flow are deliberately unbound in the flat preset.
        expect(accels["flow.open"]).toBe("");
        expect(accels["flow.new"]).toBe("");
    });

    it("leaves an Alt-only chord's command click-only", () => {
        const alt = menuAccelerators({ name: "t", bindings: { "Alt+h": "flow.save" } });
        expect(alt["flow.save"]).toBe("");
    });

    it("never returns a null, so the shell always has a string", () => {
        expect(Object.values(accels).every((v) => typeof v === "string")).toBe(true);
    });

    it("follows a rebind", () => {
        const custom = menuAccelerators({ name: "t", bindings: { "Meta+F9": "flow.save" } });
        expect(custom["flow.save"]).toBe("Cmd+F9");
    });
});
