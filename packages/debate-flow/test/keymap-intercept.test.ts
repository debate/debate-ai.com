// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
    isGridEditorFocus,
    isNativeEditingChord,
    isTextEntryFocus,
    selectAllInElement,
    shouldIntercept,
} from "../src/lib/keymap/intercept";

/** A KeyboardEvent the predicates read, dispatched from `target`. */
function key(
    init: Partial<KeyboardEventInit> & { key: string },
    target?: HTMLElement,
): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { bubbles: true, ...init });
    if (target) {
        document.body.appendChild(target);
        Object.defineProperty(event, "target", { value: target });
    }
    return event;
}

/** The primary modifier this platform's chords carry, as jsdom reports it. */
const mod = { ctrlKey: true } as const;

const input = () => document.createElement("input");
const textarea = () => document.createElement("textarea");

describe("isNativeEditingChord", () => {
    it("names the clipboard and select-all chords", () => {
        for (const k of ["a", "c", "v", "x"]) {
            expect(isNativeEditingChord(key({ key: k, ...mod }))).toBe(true);
        }
    });

    it("names undo and redo, redo's shift riding in the uppercase key", () => {
        expect(isNativeEditingChord(key({ key: "z", ...mod }))).toBe(true);
        expect(isNativeEditingChord(key({ key: "z", ...mod, shiftKey: true }))).toBe(true);
    });

    it("names the delete-back chord", () => {
        expect(isNativeEditingChord(key({ key: "Backspace", ...mod }))).toBe(true);
    });

    it("names the caret jumps and their selection-extending forms", () => {
        for (const arrow of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
            expect(isNativeEditingChord(key({ key: arrow, ...mod }))).toBe(true);
            expect(isNativeEditingChord(key({ key: arrow, ...mod, shiftKey: true }))).toBe(true);
        }
    });

    it("does not name an app chord", () => {
        expect(isNativeEditingChord(key({ key: "b", ...mod }))).toBe(false);
        expect(isNativeEditingChord(key({ key: "s", ...mod }))).toBe(false);
    });

    it("does not name a bare printable", () => {
        expect(isNativeEditingChord(key({ key: "a" }))).toBe(false);
    });
});

describe("isTextEntryFocus", () => {
    it("names an input and a textarea", () => {
        expect(isTextEntryFocus(input())).toBe(true);
        expect(isTextEntryFocus(textarea())).toBe(true);
    });

    it("names a contentEditable element", () => {
        const el = document.createElement("div");
        Object.defineProperty(el, "isContentEditable", { value: true });
        expect(isTextEntryFocus(el)).toBe(true);
    });

    it("honours the explicit opt-in attribute", () => {
        const el = document.createElement("div");
        el.dataset.nativeKeys = "true";
        expect(isTextEntryFocus(el)).toBe(true);
        el.dataset.nativeKeys = "false";
        expect(isTextEntryFocus(el)).toBe(false);
    });

    it("does not name a plain element or a missing target", () => {
        expect(isTextEntryFocus(document.createElement("div"))).toBe(false);
        expect(isTextEntryFocus(null)).toBe(false);
        expect(isTextEntryFocus(new EventTarget())).toBe(false);
    });
});

describe("isGridEditorFocus", () => {
    it("names the grid's own cell editor", () => {
        const el = textarea();
        el.classList.add("handsontableInput");
        expect(isGridEditorFocus(el)).toBe(true);
    });

    it("does not name another text box sitting in front of the grid", () => {
        expect(isGridEditorFocus(input())).toBe(false);
        expect(isGridEditorFocus(null)).toBe(false);
    });
});

describe("selectAllInElement", () => {
    it("selects an input's whole value", () => {
        const el = input();
        el.value = "extend warming";
        document.body.appendChild(el);
        expect(selectAllInElement(el)).toBe(true);
        expect(el.selectionStart).toBe(0);
        expect(el.selectionEnd).toBe("extend warming".length);
    });

    it("selects a textarea's whole value", () => {
        const el = textarea();
        el.value = "a card";
        document.body.appendChild(el);
        expect(selectAllInElement(el)).toBe(true);
        expect(el.selectionEnd).toBe("a card".length);
    });

    it("selects a contentEditable element's contents", () => {
        const el = document.createElement("div");
        Object.defineProperty(el, "isContentEditable", { value: true });
        el.textContent = "notes";
        document.body.appendChild(el);
        expect(selectAllInElement(el)).toBe(true);
        expect(window.getSelection()?.toString()).toBe("notes");
    });

    it("reports nothing selectable for a plain element or no element", () => {
        expect(selectAllInElement(document.createElement("div"))).toBe(false);
        expect(selectAllInElement(null)).toBe(false);
    });
});

describe("shouldIntercept", () => {
    it("intercepts a reserved chord over the grid", () => {
        expect(shouldIntercept(key({ key: "s", ...mod }, document.createElement("div")))).toBe(true);
    });

    it("lets a native editing chord through inside a text box", () => {
        expect(shouldIntercept(key({ key: "a", ...mod }, input()))).toBe(false);
        expect(shouldIntercept(key({ key: "z", ...mod }, textarea()))).toBe(false);
    });

    it("still intercepts a native editing chord outside a text box", () => {
        const div = document.createElement("div");
        expect(shouldIntercept(key({ key: "z", ...mod }, div))).toBe(true);
    });

    it("still intercepts an app chord inside a text box", () => {
        expect(shouldIntercept(key({ key: "s", ...mod }, input()))).toBe(true);
        expect(shouldIntercept(key({ key: "b", ...mod }, input()))).toBe(true);
    });

    it("leaves an unreserved chord alone", () => {
        expect(shouldIntercept(key({ key: "q", ...mod }, document.createElement("div")))).toBe(
            false,
        );
        expect(shouldIntercept(key({ key: "a" }, document.createElement("div")))).toBe(false);
    });

    it("lets the caret jumps through inside a text box and reserves them outside", () => {
        expect(shouldIntercept(key({ key: "ArrowLeft", ...mod }, input()))).toBe(false);
        expect(shouldIntercept(key({ key: "ArrowLeft", ...mod }, document.createElement("div")))).toBe(
            true,
        );
    });

    it("agrees with itself, so the capture and bubble listeners cannot diverge", () => {
        const event = key({ key: "s", ...mod }, document.createElement("div"));
        expect(shouldIntercept(event)).toBe(shouldIntercept(event));
    });
});
