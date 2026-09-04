import { parseManifest } from "./policy";
import type { UpdateManifest } from "./types";

/** True when running inside the Tauri desktop shell (vs. the web build). */
export function isDesktop(): boolean {
    if (typeof window === "undefined") return false;
    return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

/**
 * A downloaded, signature-verified update whose install (the rewrite of the
 * app on disk) is deferred until the user confirms it.
 */
export interface StagedUpdate {
    /** Version the download contains, e.g. "0.3.5". */
    version: string;
    /** Rewrites the current install with the downloaded artifact. */
    install(): Promise<void>;
}

/**
 * Fetches and parses the release manifest so the pure policy layer can decide
 * whether to act. Goes through the updater plugin (`check()` runs the fetch on
 * the Rust side) rather than a webview `fetch`: the GitHub release CDN sends no
 * CORS headers, so a cross-origin `fetch` from the `tauri://` origin is blocked
 * and every check silently fails. Returns null when no newer release exists
 * (and always on web); throws when the check itself fails, so callers can tell
 * "up to date" from "couldn't check".
 */
export async function fetchManifest(): Promise<UpdateManifest | null> {
    if (!isDesktop()) return null;
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return null;
    return parseManifest(update.rawJson);
}

/**
 * Downloads (but does not install) the update via Tauri's updater, returning a
 * handle whose `install()` performs the actual rewrite once the user confirms.
 * Tauri verifies the Ed25519 signature internally and hard-fails (discards) on
 * mismatch. Null on web or when no newer release exists.
 */
export async function downloadUpdate(
    onProgress?: (downloaded: number, total: number | null) => void,
): Promise<StagedUpdate | null> {
    if (!isDesktop()) return null;
    const { check } = await import("@tauri-apps/plugin-updater");
    // ponytail: re-checks rather than threading the Update handle out of
    // fetchManifest; it's one small JSON fetch, and the handle is a Resource
    // whose lifecycle isn't worth managing across the React layer.
    const update = await check();
    if (!update) return null;
    let downloaded = 0;
    await update.download((event) => {
        if (event.event === "Started") {
            onProgress?.(0, event.data.contentLength ?? null);
        } else if (event.event === "Progress") {
            downloaded += event.data.chunkLength;
            onProgress?.(downloaded, null);
        }
    });
    return update;
}

/**
 * Applies a staged update - the one step that rewrites the install on disk -
 * then relaunches into the new version. Only ever called from an explicit user
 * confirmation. No-op on web.
 */
export async function installAndRelaunch(staged: StagedUpdate): Promise<void> {
    if (!isDesktop()) return;
    await staged.install();
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
}

/**
 * The running app version, read from the Tauri runtime. Returns "0.0.0" on web
 * or if the runtime can't be reached, which makes the policy treat any real
 * release as not-newer (so nothing happens off-desktop).
 */
export async function getCurrentVersion(): Promise<string> {
    if (!isDesktop()) return "0.0.0";
    try {
        const { getVersion } = await import("@tauri-apps/api/app");
        return await getVersion();
    } catch {
        return "0.0.0";
    }
}

/**
 * `[os, arch]` of the running desktop binary, e.g. `["macos", "aarch64"]`.
 * Null on web or if the runtime can't be reached.
 */
export async function getSystemInfo(): Promise<[string, string] | null> {
    if (!isDesktop()) return null;
    try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke<[string, string]>("system_info");
    } catch {
        return null;
    }
}
