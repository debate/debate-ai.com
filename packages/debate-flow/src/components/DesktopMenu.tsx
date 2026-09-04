"use client";

import { useDesktopMenu } from "../lib/keymap/useDesktopMenu";

/**
 * Mounts the native-menu bridge once, app-wide. The menu's accelerators fire
 * on every route (macOS consumes them before the webview), so the
 * menu:command listener must live in the root layout, not just the flow
 * screen.
 */
export function DesktopMenu(): null {
    useDesktopMenu();
    return null;
}
