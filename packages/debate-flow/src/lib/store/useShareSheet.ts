/**
 * useShareSheet - the code a debater reads out, and the screens around it.
 *
 * The sheet goes up before there is anything on it, because binding an
 * endpoint and homing it on a relay are seconds of real time and a debater
 * with nothing in front of them clicks Share again. No code reaches the screen
 * until it can actually be redeemed: a code that cannot work is worse than a
 * slower one, since the partner types it and then waits out a whole dial
 * deadline.
 *
 * Closing the sheet kills the code. That is one of the four ways a code dies
 * and the only one the debater performs, so the call that takes it off the air
 * is held here beside the screen that shows it.
 *
 * The command layer must not reach for a component, and a dialog must not know
 * what a session is, so the two meet here.
 */

import { create } from "zustand";

import type { Role } from "../collab/types";

export type ShareScreen = "ready" | "code" | "joined" | "failed";

export interface ShareSheetState {
    open: boolean;
    screen: ShareScreen;
    /** What this code grants, which decides what the sheet calls itself. */
    role: Role;
    code: string;
    /** Who redeemed it, once somebody has. */
    guest: string;
    /** Why there is no code, on the failed screen. */
    message: string;
    /** What this share costs before it is made, when it costs something. */
    warning: string;
}

/** The call that takes the code on screen off the air. */
let stopCode: (() => Promise<void>) | null = null;

const CLOSED: ShareSheetState = {
    open: false,
    screen: "ready",
    role: "editor",
    code: "",
    guest: "",
    message: "",
    warning: "",
};

export const useShareSheet = create<ShareSheetState>(() => CLOSED);

/** Ends whatever code is on the air, exactly once. */
function killCode(): void {
    const stop = stopCode;
    stopCode = null;
    // Nothing to report: the endpoint is going away either way, and a debater
    // closing a sheet is not waiting on an answer.
    void stop?.().catch(() => {});
}

export function openShareSheet(role: Role, warning: string): void {
    killCode();
    useShareSheet.setState({ ...CLOSED, open: true, role, warning });
}

export function showShareCode(code: string, stop: () => Promise<void>): void {
    stopCode = stop;
    useShareSheet.setState({ screen: "code", code, guest: "", message: "" });
}

export function showShareGuest(name: string): void {
    useShareSheet.setState({ screen: "joined", guest: name });
}

export function showShareFailure(message: string): void {
    killCode();
    useShareSheet.setState({ screen: "failed", code: "", message });
}

export function closeShareSheet(): void {
    killCode();
    useShareSheet.setState(CLOSED);
}
