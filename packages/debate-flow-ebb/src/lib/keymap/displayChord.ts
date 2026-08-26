/**
 * displayChord: turns a CommandId into a human-readable key hint.
 *
 * Single source of truth for key rendering, shared by the keybindings
 * cheatsheet and the Guide. Reads the live keymap so hints reflect user remaps.
 */

import type { CommandId } from "../commands/registry";

import { effectiveKeymap } from "./useKeymap";

const KEY_LABELS: Record<string, string> = {
    Escape: "Esc",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Enter: "Enter",
    Delete: "Del",
    Backspace: "Backspace",
    Tab: "Tab",
};

export function prettyChord(chord: string): string {
    return chord
        .split("+")
        .map((part) => {
            if (part === "Meta") return "Cmd";
            if (part === "Ctrl") return "Ctrl";
            if (part === "Alt") return "Alt";
            if (part === "Shift") return "Shift";
            // A single uppercase letter encodes Shift (eventToChord never adds an
            // explicit Shift+ for printables), so spell it out: "X" -> "Shift-X".
            if (/^[A-Z]$/.test(part)) return `Shift-${part}`;
            return KEY_LABELS[part] ?? part;
        })
        .join("-");
}

/** CommandId -> first bound chord. */
export function buildChordMap(): Partial<Record<CommandId, string>> {
    const keymap = effectiveKeymap();
    const map: Partial<Record<CommandId, string>> = {};
    for (const [chord, cmd] of Object.entries(keymap.bindings)) {
        if (!map[cmd as CommandId]) map[cmd as CommandId] = chord;
    }
    return map;
}

/** Pretty key hint for a command, or null when the command is unbound. */
export function keyHintFor(commandId: CommandId): string | null {
    const chord = buildChordMap()[commandId];
    return chord ? prettyChord(chord) : null;
}
