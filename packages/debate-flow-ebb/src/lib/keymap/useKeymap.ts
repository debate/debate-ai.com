"use client";

import { useEffect } from "react";

import { executeCommand } from "../commands/commands";
import { GRID_SCOPED, type CommandId } from "../commands/registry";
import { useFlowStore } from "../store/useFlowStore";

import { effectiveKeymap as computeEffectiveKeymap } from "./effective";
import {
    shouldIntercept,
    isTextEntryFocus,
    isGridEditorFocus,
    isNativeEditingChord,
} from "./intercept";
import { resolveCommand, eventToChord } from "./resolve";
import { withinEbbKeyScope } from "./scope";

/** Returns the keymap currently in effect: flat preset merged with user overrides. */
export function effectiveKeymap() {
    const { keymapOverrides } = useFlowStore.getState();
    return computeEffectiveKeymap(keymapOverrides);
}

// Module-level accumulator - safe because useKeymap is a singleton hook.
let pendingPrefix: string | null = null;

export function useKeymap(): void {
    useEffect(() => {
        /**
         * Capture-phase interceptor. Runs before the browser's shortcut handler
         * and before any bubble-phase listeners, calling preventDefault() so the
         * browser never sees the event.
         *
         * Uses the unified shouldIntercept predicate so both phases agree.
         */
        function onKeyDownCapture(e: KeyboardEvent) {
            if (!withinEbbKeyScope(e.target)) return;
            if (shouldIntercept(e)) {
                // Does not call stopPropagation - the event must continue to the
                // bubble phase so useKeymap's resolver can fire the command.
                e.preventDefault();
            }
        }

        function onKeyDown(e: KeyboardEvent) {
            if (!withinEbbKeyScope(e.target)) return;
            // In a text-entry field (including the grid's cell editor), only
            // intercept modifier chords; everything else is regular typing or
            // a grid-native gesture Handsontable owns.
            const inTextField = isTextEntryFocus(e.target);
            if (inTextField) {
                pendingPrefix = null;
                // Native editing chords (Meta+A/C/V/X/Z, copy, paste, undo, etc.)
                // must pass through to the browser - do not intercept them.
                if (isNativeEditingChord(e)) return;
                if (!(e.metaKey || e.ctrlKey || e.altKey)) return;
            }

            // A chord that lands in chrome - rename, palette, RFD, a settings
            // field - is aimed at that box; the grid behind it is not the
            // target. The grid's own cell editor is the exception.
            const chromeField = inTextField && !isGridEditorFocus(e.target);

            /** Fires a resolved command unless chrome focus makes it a misfire. */
            function run(commandId: CommandId): void {
                if (chromeField && GRID_SCOPED[commandId]) return;
                e.preventDefault();
                executeCommand(commandId);
            }

            const chord = eventToChord({
                key: e.key,
                code: e.code,
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
                altKey: e.altKey,
                shiftKey: e.shiftKey,
            });

            const keymap = effectiveKeymap();

            // -- Two-key chord resolution ------------------------------------
            if (pendingPrefix !== null) {
                const twoKey = `${pendingPrefix} ${chord}`;
                if (twoKey in keymap.bindings) {
                    pendingPrefix = null;
                    run(keymap.bindings[twoKey]!);
                    return;
                }
                // Prefix did not complete - clear and fall through.
                pendingPrefix = null;
            }

            // Check whether this chord is a valid prefix for any two-key sequence.
            const isPrefix = Object.keys(keymap.bindings).some((k) => k.startsWith(`${chord} `));
            if (isPrefix) {
                pendingPrefix = chord;
                e.preventDefault();
                return;
            }

            // -- Single-chord resolution ---------------------------------------
            const commandId = resolveCommand(keymap, {
                key: e.key,
                code: e.code,
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
                altKey: e.altKey,
                shiftKey: e.shiftKey,
            });

            if (!commandId) return;

            run(commandId);
        }

        window.addEventListener("keydown", onKeyDownCapture, { capture: true });
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDownCapture, { capture: true });
            window.removeEventListener("keydown", onKeyDown);
            pendingPrefix = null;
        };
    }, []);
}
