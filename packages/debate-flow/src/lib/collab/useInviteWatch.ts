import { useEffect } from "react";

import { useFlowStore } from "../store/useFlowStore";
import { isDesktop } from "../update/adapter";

import { endSession, syncInviteWatch } from "./runtime";

/**
 * Keeps shared editing's network state in step with the three switches that
 * govern it, for the app's lifetime. Those moving are the only thing this
 * watches; what a live session does with the endpoint it holds is the
 * runtime's own business.
 *
 * The master switch is the control the product presents as the kill switch, so
 * off ends a running session rather than only closing the routes into a new
 * one: a debater who realises mid-round that a scout is in the room must not
 * keep sending keystrokes to them while Settings reads off.
 *
 * Relay is read at bind time, so it is watched too: an idle endpoint bound
 * through a relay keeps that relay until a change here rebinds it.
 *
 * The mount call binds nothing on its own: Listen for invites is off by
 * default, so a cold launch reaches the sync and stops there.
 *
 * No-op on web, where there is no transport to bind.
 */
export function useInviteWatch(): void {
    useEffect(() => {
        if (!isDesktop()) return;
        const wanted = () => {
            const s = useFlowStore.getState();
            return `${s.collabEnabled}/${s.collabListenEnabled}/${s.collabRelayEnabled}`;
        };
        let last = wanted();
        let live = useFlowStore.getState().collabEnabled;
        void syncInviteWatch();
        return useFlowStore.subscribe(() => {
            const enabled = useFlowStore.getState().collabEnabled;
            const now = wanted();
            if (now === last) return;
            last = now;
            if (live && !enabled) {
                live = false;
                // Ending the session releases the endpoint and syncs the
                // listener on its way out, so nothing else is needed here.
                void endSession();
                return;
            }
            live = enabled;
            void syncInviteWatch();
        });
    }, []);
}
