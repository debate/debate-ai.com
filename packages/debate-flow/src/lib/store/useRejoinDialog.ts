/**
 * useRejoinDialog - the one question a join asks after the code.
 *
 * An invitation naming a round already on this disk wants a place in it, and
 * admitting the issuer to a round the debater already holds is theirs to
 * grant, not something a code settles.
 *
 * The command layer must not reach for a component, and a dialog must not know
 * what a session is, so the two meet here, as they do for the contact picker.
 */

import { create } from "zustand";

/** What a rejoin confirmation names: the round on this disk, and who wants in. */
export interface RejoinAsk {
    /** The round as the debater knows it, taken from their own copy of it. */
    round: string;
    /** The peer asking. Shown under the name saved for them, when there is one. */
    endpointId: string;
}

export interface RejoinDialogState {
    open: boolean;
    /**
     * What the last question asked about. Survives a close, because the dialog
     * stays mounted while it animates out and an emptied slot would blank the
     * text mid-exit.
     */
    ask: RejoinAsk | null;
    /** Settles a pending question and closes. true grants; null is a cancel. */
    answer(granted: true | null): void;
    close(): void;
}

let pending: ((granted: true | null) => void) | null = null;

function settle(granted: true | null): void {
    const waiting = pending;
    pending = null;
    waiting?.(granted);
}

export const useRejoinDialog = create<RejoinDialogState>((set) => ({
    open: false,
    ask: null,
    answer: (granted) => {
        set({ open: false });
        settle(granted);
    },
    close: () => {
        set({ open: false });
        settle(null);
    },
}));

/**
 * Asks whether a peer belongs in a round this install already holds, and waits
 * for the answer. Anything still pending is cancelled first, so no caller is
 * left holding a promise that never settles.
 *
 * Only the grant adds the peer, so a cancel, a dismissal, and the dialog
 * leaving the tree all leave the round as it was.
 */
export function askToRejoin(ask: RejoinAsk): Promise<boolean> {
    settle(null);
    return new Promise<true | null>((resolve) => {
        pending = resolve;
        useRejoinDialog.setState({ open: true, ask });
    }).then((granted) => granted === true);
}
