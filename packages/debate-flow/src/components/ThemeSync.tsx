"use client";

import { useThemeSync } from "../lib/theme/useThemeSync";

/**
 * Mounts the theme sync effect app-wide. Rendered once in the root layout so
 * every page (dashboard, flow screen) gets a consistent dark/light class.
 * Renders nothing.
 */
export default function ThemeSync() {
    useThemeSync();
    return null;
}
