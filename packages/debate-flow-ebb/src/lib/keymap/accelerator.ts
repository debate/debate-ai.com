/**
 * Converts canonical keymap chords (see resolve.ts) into Tauri accelerator
 * strings for the native menu.
 *
 * Returns null for chords that can never be accelerators: bare printables
 * and Alt-only chords would fire while typing text, bare named keys (Enter,
 * Tab, arrows) are grid gestures, and two-key sequences have no accelerator
 * equivalent. Bare function keys are the exception: they type nothing, so
 * the OS can own them safely.
 */

import type { CommandId } from "../commands/registry";

import type { Keymap } from "./types";

const MODIFIERS = new Set(["Meta", "Ctrl", "Alt", "Shift"]);

/** Canonical chord key -> muda key token, for non-letter keys. */
const KEY_TOKENS: Record<string, string> = {
    ",": "Comma",
    ".": "Period",
    "/": "Slash",
    "\\": "Backslash",
    "[": "BracketLeft",
    "]": "BracketRight",
    ";": "Semicolon",
    "'": "Quote",
    "-": "Minus",
    "=": "Equal",
    "`": "Backquote",
    " ": "Space",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Escape: "Escape",
    Enter: "Enter",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
};

/**
 * Shifted characters with an unshifted muda token, and the token they carry.
 * Shift rides inside the character (see eventToChord), so it has to be put
 * back explicitly - the same treatment an uppercase letter gets below.
 */
const SHIFTED_KEY_TOKENS: Record<string, string> = { "{": "BracketLeft", "}": "BracketRight" };

const FUNCTION_KEY = /^F([1-9]|1[0-9]|2[0-4])$/;

/** Splits a chord on "+", keeping a literal "+" key intact ("Meta++"). */
function splitChord(chord: string): string[] {
    const parts = chord.split("+");
    if (parts.length >= 2 && parts[parts.length - 1] === "" && parts[parts.length - 2] === "") {
        return [...parts.slice(0, -2), "+"];
    }
    return parts;
}

export function chordToAccelerator(chord: string): string | null {
    // Two-key sequences are two space-joined chords; a space *key* appears
    // only right after a "+" ("Meta+ ").
    const spaceIdx = chord.indexOf(" ");
    if (spaceIdx !== -1 && chord[spaceIdx - 1] !== "+") return null;

    const parts = splitChord(chord);
    const key = parts[parts.length - 1] ?? "";
    const mods = parts.slice(0, -1);
    if (key === "" || mods.some((m) => !MODIFIERS.has(m))) return null;

    const hasPrimary = mods.includes("Meta") || mods.includes("Ctrl");
    if (!hasPrimary && !FUNCTION_KEY.test(key)) return null;

    let shift = mods.includes("Shift");
    let token: string;
    if (/^[a-z]$/.test(key)) {
        token = key.toUpperCase();
    } else if (/^[A-Z]$/.test(key)) {
        // Shift rides in the letter's case (see eventToChord).
        shift = true;
        token = key;
    } else if (/^[0-9]$/.test(key) || FUNCTION_KEY.test(key)) {
        token = key;
    } else if (key in KEY_TOKENS) {
        token = KEY_TOKENS[key]!;
    } else if (key in SHIFTED_KEY_TOKENS) {
        shift = true;
        token = SHIFTED_KEY_TOKENS[key]!;
    } else {
        // Other shifted symbols ("?") carry shift inside the character and have
        // no unshifted muda token; withhold the accelerator rather than guess.
        return null;
    }

    const accel: string[] = [];
    if (mods.includes("Meta")) accel.push("Cmd");
    if (mods.includes("Ctrl")) accel.push("Ctrl");
    if (mods.includes("Alt")) accel.push("Alt");
    if (shift) accel.push("Shift");
    accel.push(token);
    return accel.join("+");
}

/** The menu commands whose accelerators follow the effective keymap. */
export const MENU_COMMAND_IDS = [
    "window.new",
    "window.close",
    "flow.new",
    "flow.open",
    "flow.save",
    "flow.saveAs",
    "flow.reveal",
    "flow.close",
    "settings.open",
    "sheet.newAff",
    "sheet.newNeg",
    "sheet.rename",
    "info.open",
    "edit.undo",
    "edit.redo",
    "format.toggleBold",
    "format.toggleHighlight",
    "format.toggleCard",
    "format.toggleGroup",
    "format.toggleKicked",
    "row.insertAbove",
    "cell.insert",
    "row.delete",
    "sheet.next",
    "sheet.prev",
    "sheet.moveUp",
    "sheet.moveDown",
    "sheet.quickSwitch",
    "palette.open",
    "sidebar.toggle",
    "rfd.toggle",
    "help.open",
] as const satisfies readonly CommandId[];

/** First chord bound to the command, in binding order; null when unbound. */
export function chordForCommand(keymap: Keymap, id: CommandId): string | null {
    for (const [chord, cmd] of Object.entries(keymap.bindings)) {
        if (cmd === id) return chord;
    }
    return null;
}

/**
 * commandId -> Tauri accelerator for every menu command. An empty string
 * means "no accelerator" (unbound, or the chord cannot be one); the Rust
 * side treats it as click-only.
 */
export function menuAccelerators(keymap: Keymap): Record<string, string> {
    const accels: Record<string, string> = {};
    for (const id of MENU_COMMAND_IDS) {
        const chord = chordForCommand(keymap, id);
        accels[id] = (chord && chordToAccelerator(chord)) || "";
    }
    return accels;
}
