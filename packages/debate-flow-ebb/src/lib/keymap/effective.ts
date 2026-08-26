/**
 * Effective keymap = flat preset bindings merged with the user's per-command
 * overrides.
 *
 * An override maps a CommandId to a custom chord. Applying it removes any
 * preset chord(s) that currently fire that command and binds the override
 * chord to it instead.
 */

import type { CommandId } from "../commands/registry";

import { getPresetKeymap } from "./presets";
import type { Keymap } from "./types";

export function effectiveKeymap(
    overrides: Record<string, string>, // commandId → chord
): Keymap {
    const preset = getPresetKeymap();
    const bindings = { ...preset.bindings };

    for (const [commandId, overrideChord] of Object.entries(overrides)) {
        if (!overrideChord) continue;
        // Remove existing preset chord(s) bound to this command.
        for (const [chord, cmd] of Object.entries(bindings)) {
            if (cmd === commandId) delete bindings[chord];
        }
        // Bind the override chord.
        bindings[overrideChord] = commandId as CommandId;
    }

    return {
        name: `${preset.name}+overrides`,
        bindings,
    };
}
