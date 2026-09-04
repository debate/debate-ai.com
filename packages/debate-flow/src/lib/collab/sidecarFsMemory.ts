/**
 * The sidecar adapter for the browser and the suite.
 *
 * A sidecar only ever accelerates a restart, and the browser build is a
 * development target rather than a product surface, so an in-process map that
 * dies with the tab is the whole implementation.
 */

import type { SidecarFs } from "./sidecarFs";

export function createSidecarFs(): SidecarFs {
    const files = new Map<string, string>();
    return {
        async read(roundId) {
            return files.get(roundId) ?? null;
        },
        async write(roundId, text) {
            files.set(roundId, text);
        },
    };
}
