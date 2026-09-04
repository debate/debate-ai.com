/**
 * The one gate every shared editing route passes through.
 *
 * Shared editing is the only feature in ebb that reaches the network, so the
 * switch that turns it off is an invariant rather than a preference: with it
 * off the app binds no endpoint, dials no peer, publishes no discovery record,
 * and contacts no relay. Both halves of the feature ask here rather than
 * testing the conditions apart.
 *
 * Two questions, because they have different answers. `collabLive` is whether
 * this build and this debater have the feature at all, and the build half of
 * that is permanent: a session is an iroh endpoint, which only the desktop
 * shell can bind. `collabSettings` is what the switches say, asked by code
 * that has already been handed a transport and has no business re-deciding
 * where it came from - which is what lets the suite drive the whole protocol
 * against an in-process one.
 */

import { useFlowStore } from "../store/useFlowStore";
import { isDesktop } from "../update/adapter";

export interface CollabSettings {
    enabled: boolean;
    relay: boolean;
    /**
     * Whether an endpoint may stay bound with no round being shared. Its own
     * switch because the master one unlocks routes a debater takes by hand,
     * and this is the only thing that puts ebb on the network without one.
     */
    listen: boolean;
}

/**
 * Whether shared editing is offered here at all: the desktop shell, and the
 * switch on. Every route that can start one asks this before it begins.
 */
export function collabLive(): boolean {
    return isDesktop() && useFlowStore.getState().collabEnabled;
}

/** What the switches say, for code already holding a transport. */
export function collabSettings(): CollabSettings {
    const state = useFlowStore.getState();
    return {
        enabled: state.collabEnabled,
        relay: state.collabRelayEnabled,
        listen: state.collabListenEnabled,
    };
}
