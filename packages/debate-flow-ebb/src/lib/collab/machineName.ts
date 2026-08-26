/**
 * What this install can say about itself, asked of the shell once per run.
 *
 * Neither the identity nor the hostname can change while the app is open, so
 * each answer is held after the first ask. Both are reads off the disk: no
 * endpoint is bound, no peer is dialled, and no discovery record is published
 * to answer either of them.
 */

import { useFlowStore } from "../store/useFlowStore";
import { isDesktop } from "../update/adapter";

/** The shell's answer, or "" when there is no shell to ask. */
async function shellString(command: string): Promise<string> {
    if (!isDesktop()) return "";
    // Dynamic because the settings pane that reads these is in the web bundle
    // too, where Tauri's API does not exist.
    try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke<string>(command);
    } catch {
        return "";
    }
}

let id: Promise<string> | null = null;
let hostname: Promise<string> | null = null;

/** Forgets the cached answers. For tests, which drive more than one shell. */
export function clearShellStrings(): void {
    id = null;
    hostname = null;
}

/**
 * This install's own EndpointId, without binding anything.
 *
 * The id is the public half of the key in the identity file, so the shell can
 * answer it off the disk. Settings shows it so a partner can save this machine
 * as a contact before either side has a round to share, and that must not be a
 * reason to put a socket on the network: reading it touches nothing.
 */
export function myEndpointId(): Promise<string> {
    return (id ??= shellString("collab_endpoint_id"));
}

/**
 * The hostname, or "" when the shell cannot say and on web.
 *
 * It is the one name a debater has already set and a partner would recognise,
 * so it is the default rather than a blank field or a short EndpointId. It is
 * deliberately never written into the config file: that file syncs between
 * machines, and a baked-in hostname would follow one laptop's name onto
 * another. So the setting stays empty until someone types over it, and the
 * hostname is resolved at the moment a session needs a name.
 */
export function machineName(): Promise<string> {
    return (hostname ??= shellString("machine_name"));
}

/**
 * The name a session carries: what the debater typed, or the machine's own
 * name when they typed nothing. Empty when there is neither, which greets a
 * peer with no name at all rather than with a placeholder they might save.
 */
export async function broadcastName(): Promise<string> {
    const chosen = useFlowStore.getState().collabName.trim();
    return chosen || (await machineName());
}
