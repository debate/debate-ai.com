"use client";

import { useEffect } from "react";

import { executeCommand } from "../commands/commands";
import { useFlowStore } from "../store/useFlowStore";

import { effectiveKeymap } from "./effective";
import { isTextEntryFocus } from "./intercept";
import { resolveCommand } from "./resolve";

/**
 * Resolves the settings chord (Meta+, by default) on every screen, including
 * the dashboard and trash, which never mount the full `useKeymap` - the rest of
 * the keymap addresses a flow that isn't loaded there. Firing alongside
 * `useKeymap` on the flow screen is harmless: opening settings is idempotent.
 */
export function useSettingsShortcut(): void {
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            // A bare chord (if the user rebinds settings to one) is just typing
            // inside a text field; a modifier chord is never ambiguous.
            if (isTextEntryFocus(e.target) && !(e.metaKey || e.ctrlKey || e.altKey)) return;

            const keymap = effectiveKeymap(useFlowStore.getState().keymapOverrides);
            const commandId = resolveCommand(keymap, {
                key: e.key,
                code: e.code,
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
                altKey: e.altKey,
                shiftKey: e.shiftKey,
            });
            if (commandId !== "settings.open") return;

            e.preventDefault();
            executeCommand(commandId);
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);
}
