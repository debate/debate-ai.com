/**
 * useJoinDialog - the one field a guest types a code into.
 *
 * It takes the code however it was read out: any case, with or without the
 * dash the sheet shows it with. What it hands back is the eight characters
 * alone, because that is what the shell derives from.
 *
 * The command layer must not reach for a component, and a dialog must not know
 * what a session is, so the two meet here.
 */

import { create } from "zustand";

export interface JoinDialogState {
    open: boolean;
    ask(): void;
    /** Settles the question with the code, or with null for backing out. */
    submit(code: string | null): void;
    close(): void;
}

let pending: ((code: string | null) => void) | null = null;

function settle(code: string | null): void {
    const waiting = pending;
    pending = null;
    waiting?.(code);
}

export const useJoinDialog = create<JoinDialogState>((set) => ({
    open: false,
    ask: () => set({ open: true }),
    submit: (code) => {
        set({ open: false });
        settle(code);
    },
    close: () => {
        set({ open: false });
        settle(null);
    },
}));

/**
 * Asks for a code and waits for the answer. A request still pending is
 * cancelled first, so no caller is left holding a promise that never settles.
 */
export function askForCode(): Promise<string | null> {
    settle(null);
    return new Promise<string | null>((resolve) => {
        pending = resolve;
        useJoinDialog.getState().ask();
    });
}
