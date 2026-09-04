import { useFlowStore } from "../store/useFlowStore";

import type { FlowFs } from "./flowFs";

/**
 * The folder new flows are filed in: the Settings override when set, otherwise
 * the platform default the shell resolves.
 *
 * This is the one seam between the setting and the filesystem, so nothing below
 * it has to know a setting exists - `flowSession` takes a directory and writes
 * there.
 */
export async function resolveFlowsDir(fs: FlowFs): Promise<string> {
    const configured = useFlowStore.getState().flowsDir?.trim();
    return configured || (await fs.locations()).flowsDir;
}
