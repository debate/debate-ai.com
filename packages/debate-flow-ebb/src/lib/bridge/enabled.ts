/**
 * The one gate every CardMirror feature passes through.
 *
 * The bridge only exists inside the desktop shell, and the user can switch the
 * integration off in Settings then Editor. What the switch gates is the
 * renderer's half: the loopback socket is bound for the whole launch and
 * `ebb.session.json` carries this run's token either way, so a same-user
 * process holding that token still reaches `/ping`, which Rust answers alone.
 * Both halves of the bridge ask here rather than testing the two conditions
 * apart; the settings and cheatsheet UI mirror it with a subscription so they
 * re-render on the toggle.
 */

import { useFlowStore } from "../store/useFlowStore";
import { isDesktop } from "../update/adapter";

export function cardmirrorLive(): boolean {
    return isDesktop() && useFlowStore.getState().cardmirrorEnabled;
}
