import type { CommandId } from "../commands/registry";

/**
 * Canonical chord string for a key event.
 * Format: "Meta+Ctrl+Alt+Shift+key" (modifiers in that fixed order, only
 * those present), e.g. "Meta+k", "Shift+Tab", "j".
 */
export type Chord = string;

export interface Keymap {
    name: string;
    /** Flat modeless bindings: chord → command. */
    bindings: Record<Chord, CommandId>;
}
