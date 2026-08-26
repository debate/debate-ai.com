/**
 * Unified key-interception predicate.
 *
 * The capture-phase and bubble-phase listeners in useKeymap both call
 * `shouldIntercept`, so they can never diverge (the root cause of the
 * Meta+A-in-text-box bug).
 *
 * Rule:
 *   - If the chord is a native editing chord (Meta/Ctrl+A, C, V, X, Z, Shift+Z,
 *     Backspace) AND focus is in a text box, do NOT intercept (let the
 *     browser handle it).
 *   - Otherwise, if the chord is in reservedChords, intercept.
 *   - Otherwise, do not intercept.
 */

import { isMacPlatform } from "../platform";

import { reservedChords } from "./reserved";
import { eventToChord } from "./resolve";

/**
 * Native editing chords that must pass through to the browser when the user
 * is typing in a text box. These are the chords that the OS reserves for
 * text editing: select-all, copy, paste, cut, undo, delete word/line back,
 * and the arrow jumps that walk the caret to a line or document boundary.
 *
 * On macOS these are Meta+; on Windows/Linux they are Ctrl+.
 *
 * In the Tauri desktop shell every native editing chord reaches the field
 * via an Edit-menu accelerator (see menu.rs): Cut/Copy/Paste route natively
 * through their PredefinedMenuItems, and Select All / Undo / Redo /
 * Delete Row are re-dispatched by dispatchMenuCommand.
 */
const NATIVE_EDITING_KEYS = [
    "a", // select all
    "c", // copy
    "v", // paste
    "x", // cut
    "z", // undo
    "Backspace", // delete to line start (mac) / delete previous word (win/linux)
] as const;

/**
 * Arrow chords the caret owns inside a text box: the plain form walks to the
 * line's end (mac) or the document's (win/linux), and the Shift form extends
 * the selection to the same boundary. Over cells the grid and the keymap own
 * them, so a command bound to one stops at the edge of a field.
 */
const NATIVE_EDITING_ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;

let cachedNativeEditingChords: Set<string> | null = null;

/**
 * Returns the set of native editing chords for the current platform.
 * Includes both Meta+Z (undo) and Meta+Shift+Z / Meta+Z (redo, shift variant),
 * and the Shift+ form of each arrow, which extends the selection to the same
 * boundary the plain chord moves the caret to.
 */
function nativeEditingChords(): Set<string> {
    const mod = isMacPlatform() ? "Meta" : "Ctrl";
    const chords = new Set<string>();
    for (const key of [...NATIVE_EDITING_KEYS, ...NATIVE_EDITING_ARROWS]) {
        chords.add(`${mod}+${key}`);
    }
    // Redo: Meta+Shift+Z on Mac, Ctrl+Shift+Z on Windows/Linux.
    // eventToChord encodes shift in the case of single printables (Z, not z),
    // so the redo chord is Meta+Z / Ctrl+Z (uppercase), matching eventToChord output.
    // We don't add a Shift+ prefix here.
    chords.add(`${mod}+Z`);
    for (const arrow of NATIVE_EDITING_ARROWS) {
        chords.add(`${mod}+Shift+${arrow}`);
    }
    return chords;
}

/**
 * Returns true if the given key event is a native editing chord
 * (select-all, copy, paste, cut, undo, redo, delete word/line back, caret
 * jump) on the current platform.
 * Does NOT consider focus; the caller must check isTextEntryFocus separately.
 */
export function isNativeEditingChord(e: KeyboardEvent): boolean {
    if (!cachedNativeEditingChords) {
        cachedNativeEditingChords = nativeEditingChords();
    }
    const chord = eventToChord({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
    });
    return cachedNativeEditingChords.has(chord);
}

/**
 * Returns true if the event target is a text-entry field where native
 * editing chords should pass through.
 *
 * Text-entry focus = a chrome <input>, any <textarea> (including the grid's
 * cell-input), or a contentEditable element. The optional `data-native-keys`
 * attribute is an escape hatch for any future chrome element that needs full
 * native key behavior.
 */
export function isTextEntryFocus(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return true;
    if (target.isContentEditable) return true;
    // Escape hatch: explicit opt-in for any element.
    if (target.dataset.nativeKeys === "true") return true;
    return false;
}

/**
 * Returns true if the event target is the grid's own cell editor.
 *
 * It is the one text field where a chord aimed at cells is aimed at the cell
 * the debater is typing in, so formatting still belongs to it; every other
 * text box (rename, palette, RFD, settings) sits in front of a grid it must
 * not reach. Handsontable's TextEditor is a `textarea.handsontableInput`
 * parked over the active cell.
 */
export function isGridEditorFocus(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.classList.contains("handsontableInput");
}

/**
 * Selects all text in a text-entry element and reports whether it did.
 *
 * Serves the Edit menu's Select All item via dispatchMenuCommand: on macOS
 * the item's real Meta+A accelerator is consumed before the webview's
 * keydown, so the selection is re-created here in JS. Returns false when
 * there is nothing selectable.
 */
export function selectAllInElement(element: HTMLElement | null): boolean {
    if (!element) return false;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.select();
        return true;
    }
    if (element.isContentEditable) {
        const selection = window.getSelection();
        if (!selection) return false;
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
    }
    return false;
}

/**
 * The unified interception predicate. Both the capture-phase and
 * bubble-phase listeners call this so they can never disagree.
 *
 * Returns true if the event should be intercepted (preventDefault + handled
 * by the app's keymap). Returns false if the event should be left alone.
 */
export function shouldIntercept(e: KeyboardEvent): boolean {
    // If it's a native editing chord and the user is typing in a text box,
    // let the browser handle it (select-all, copy, paste, cut, undo, redo, delete word/line back).
    if (isNativeEditingChord(e) && isTextEntryFocus(e.target)) {
        return false;
    }

    // Otherwise, intercept if it's a reserved chord.
    const chord = eventToChord({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
    });
    return reservedChords().has(chord);
}
