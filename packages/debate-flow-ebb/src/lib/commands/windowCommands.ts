/**
 * Window-level commands: everything a window does to itself and its
 * siblings, as opposed to a document open inside one (see fileCommands.ts).
 */

import { isDesktop } from "../update/adapter";

/**
 * Opens a new window on the dashboard. A no-op on the web build, where
 * there is no window manager to ask - Tauri owns the whole concept.
 */
export async function openNewWindow(): Promise<void> {
    if (!isDesktop()) return;
    try {
        // Platform-only module: a static import would pull Tauri's IPC
        // bridge into the web bundle, which has no window manager to ask.
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("new_window");
    } catch {
        // A window that fails to open is cosmetic, not fatal; nothing here
        // is worth interrupting the user's current window over.
    }
}

/**
 * Closes this window, through Rust so the flush handshake runs and the last
 * open window closing quits instead. A no-op on the web build, where a tab
 * cannot close itself.
 */
export async function closeCurrentWindow(): Promise<void> {
    if (!isDesktop()) return;
    try {
        // Platform-only module: a static import would pull Tauri's IPC
        // bridge into the web bundle, which has no window manager to ask.
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("close_window");
    } catch {
        // A window that fails to close is still open with the round intact,
        // which is the safe outcome; nothing here is worth a toast.
    }
}

/**
 * Tells Rust which flow this window currently shows (`null` for none), so a
 * later "Open With" for the same path focuses this window instead of
 * opening a duplicate. A no-op on the web build.
 */
export async function reportOpenPath(path: string | null): Promise<void> {
    if (!isDesktop()) return;
    try {
        // Platform-only module: a static import would pull Tauri's IPC
        // bridge into the web bundle, which has no window manager to ask.
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("report_open_path", { path });
    } catch {
        // Best-effort bookkeeping: a window that fails to report its path is
        // still open and working, just not focusable by a later duplicate.
    }
}
