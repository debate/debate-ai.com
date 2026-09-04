/**
 * useCollabConsent - the one question asked before ebb first reaches a peer.
 *
 * Asked here rather than left to a switch in Settings, because this is the
 * moment a debater has said what they want: they clicked Share or Join, and
 * the question is about the thing they are already doing. A switch three panes
 * deep is consent nobody read.
 *
 * The switch it sets is the master switch, and that still gates every route.
 * Answering yes turns sharing on for good rather than for one round: the
 * debater has said this install may reach a partner, and asking again on every
 * share is a dialog they learn to dismiss without reading.
 *
 * The command layer must not reach for a component, and a dialog must not know
 * what a session is, so the two meet here, as they do for the contact picker.
 */

import { create } from "zustand";

import { isDesktop } from "../update/adapter";

import { useFlowStore } from "./useFlowStore";

export interface CollabConsentState {
    open: boolean;
    ask(): void;
    /** Settles the question. Turning sharing on is the caller's to do. */
    answer(yes: boolean): void;
    /** Dismissal, which is the same answer as Not now. */
    close(): void;
}

let pending: ((yes: boolean) => void) | null = null;

function settle(yes: boolean): void {
    const waiting = pending;
    pending = null;
    waiting?.(yes);
}

export const useCollabConsent = create<CollabConsentState>((set) => ({
    open: false,
    ask: () => set({ open: true }),
    answer: (yes) => {
        set({ open: false });
        settle(yes);
    },
    close: () => {
        set({ open: false });
        settle(false);
    },
}));

/**
 * Whether this install may reach a peer, asking once if it has not been
 * settled.
 *
 * False off the desktop with nothing asked: a browser cannot bind an endpoint,
 * so the question would offer something that does not exist here.
 */
export async function askToShare(): Promise<boolean> {
    if (!isDesktop()) return false;
    if (useFlowStore.getState().collabEnabled) return true;
    // A question still open is answered no first, so no caller is left holding
    // a promise that never settles.
    settle(false);
    const answered = await new Promise<boolean>((resolve) => {
        pending = resolve;
        useCollabConsent.getState().ask();
    });
    if (answered) useFlowStore.getState().setCollabEnabled(true);
    return answered;
}
