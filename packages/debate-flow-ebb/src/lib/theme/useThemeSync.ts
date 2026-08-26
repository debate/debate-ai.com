"use client";

import { useEffect } from "react";

import { useFlowStore } from "../store/useFlowStore";

import { resolveMode } from "./mode";
import { ebbThemeScopeEl } from "./themeScope";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

/**
 * Keeps the "dark" class on <html> in sync with the store's theme setting,
 * including live OS appearance changes while the mode is "system". The
 * layout also inlines a synchronous bootstrap script so the class is
 * already correct before this effect ever runs, avoiding a flash on load.
 */
export function useThemeSync(): void {
    const theme = useFlowStore((s) => s.theme);

    useEffect(() => {
        const media = window.matchMedia(DARK_MEDIA_QUERY);

        function apply() {
            ebbThemeScopeEl().classList.toggle(
                "dark",
                resolveMode(theme, media.matches) === "dark",
            );
        }

        apply();
        media.addEventListener("change", apply);
        return () => media.removeEventListener("change", apply);
    }, [theme]);
}
