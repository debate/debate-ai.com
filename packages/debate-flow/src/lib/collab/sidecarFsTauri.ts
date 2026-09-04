/**
 * The desktop sidecar adapter: two narrow commands, no path.
 *
 * The shell composes the location from the round id, so this module has
 * nothing to say about where the file lives.
 */

import { invoke } from "@tauri-apps/api/core";

import type { SidecarFs } from "./sidecarFs";

export function createSidecarFs(): SidecarFs {
    return {
        read: (roundId) => invoke<string | null>("read_sidecar", { roundId }),
        write: (roundId, text) => invoke<void>("write_sidecar", { roundId, contents: text }),
    };
}
