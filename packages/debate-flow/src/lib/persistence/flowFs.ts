/**
 * The filesystem ebb reads and writes flows through.
 *
 * One port, two adapters: Tauri on the desktop, and an in-memory map for
 * `npm run dev` in a browser and for the test suite. Everything above this line
 * - the session, the recents list, the start screen, the migration - is written
 * against the port, which is what lets the whole stack be tested without
 * mocking Tauri's IPC.
 */

import { isDesktop } from "../update/adapter";

export interface FlowLocations {
    /** Where new flows are filed. Created on first write, not on read. */
    flowsDir: string;
    /** Home directory, used only to shorten paths for display. */
    home: string;
}

/** A flow's contents plus the stamp identifying the version read. */
export interface FlowSnapshot {
    text: string;
    /** Modification time in epoch ms, carried back on the next write. */
    mtimeMs: number;
}

export interface FlowFs {
    locations(): Promise<FlowLocations>;
    /** Native open picker. Null when the user cancels. */
    pickOpenPath(): Promise<string | null>;
    /** Native folder picker for the flows directory. Null when cancelled. */
    pickDirectory(): Promise<string | null>;
    /** Native save picker seeded with a filename. Null when the user cancels. */
    pickSavePath(suggested: string): Promise<string | null>;
    /** Create without ever overwriting; resolves to the path actually used. */
    createFlow(dir: string, name: string, text: string): Promise<string>;
    /** Null when the file no longer exists, which callers treat as ordinary. */
    readFlow(path: string): Promise<FlowSnapshot | null>;
    /**
     * Write, refusing when the file changed since `expectedMtimeMs`. Pass null
     * to force. Resolves to the new stamp.
     */
    writeFlow(path: string, text: string, expectedMtimeMs?: number | null): Promise<number>;
    readRecents(): Promise<string | null>;
    writeRecents(text: string): Promise<void>;
    /** Show the file in Finder or the system file manager. */
    reveal(path: string): Promise<void>;
}

let cached: FlowFs | null = null;

/** The adapter for this runtime, resolved once. */
export async function getFlowFs(): Promise<FlowFs> {
    if (cached) return cached;
    // Dynamic on both branches so the browser bundle never pulls in Tauri's JS
    // API, matching how every other desktop touchpoint is gated.
    const mod = isDesktop() ? await import("./flowFsTauri") : await import("./flowFsMemory");
    cached = mod.createFlowFs();
    return cached;
}

/** Test seam: swap in a fixture adapter, or reset with null. */
export function setFlowFs(fs: FlowFs | null): void {
    cached = fs;
}
