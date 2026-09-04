/**
 * Where the sidecar is kept.
 *
 * One port, two adapters, in the shape `FlowFs` already uses: Tauri on the
 * desktop, and an in-memory map everywhere else. The port takes a round id and
 * never a path, so the webview cannot steer where this writes; the shell
 * resolves the location itself.
 *
 * A sidecar only exists for a round that is shared, and sharing is desktop
 * only, so the in-memory adapter is reached by the suite and by nothing a
 * debater runs. It stays because the suite needs somewhere for a sidecar to
 * land, not because the browser has any use for one.
 */

import { isDesktop } from "../update/adapter";

export interface SidecarFs {
    /** Null when this round has no sidecar, which callers treat as ordinary. */
    read(roundId: string): Promise<string | null>;
    write(roundId: string, text: string): Promise<void>;
}

let cached: SidecarFs | null = null;

export async function getSidecarFs(): Promise<SidecarFs> {
    if (cached) return cached;
    // Dynamic on both branches so the browser bundle never pulls in Tauri's JS
    // API, matching how every other desktop touchpoint is gated.
    const mod = isDesktop() ? await import("./sidecarFsTauri") : await import("./sidecarFsMemory");
    cached = mod.createSidecarFs();
    return cached;
}

/** Test seam: swap in a fixture adapter, or reset with null. */
export function setSidecarFs(fs: SidecarFs | null): void {
    cached = fs;
}
