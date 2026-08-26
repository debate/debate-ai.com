/**
 * useContactPicker - the invite picker's open state, and the promise behind it.
 *
 * The command layer must not reach for a component, and a dialog must not know
 * what a session is, so the two meet here: `chooseContact` opens the picker and
 * settles once the user picks a peer or backs out.
 */

import { create } from "zustand";

import type { Contacts } from "../collab/contacts";
import type { Role } from "../collab/types";

export interface ContactPickerState {
    /** What to pick from, and null whenever the picker is closed. */
    contacts: Contacts | null;
    /** What the pick will grant, chosen before the picker opened. */
    role: Role;
    resolve: ((endpointId: string | null) => void) | null;
    /** Settles the open request and closes the picker. null is a cancel. */
    pick(endpointId: string | null): void;
    cancel(): void;
}

export const useContactPicker = create<ContactPickerState>((set, get) => ({
    contacts: null,
    role: "editor",
    resolve: null,
    pick(endpointId) {
        const { resolve } = get();
        // Closed before the caller resumes, so a picker reopened from inside
        // the continuation is not torn down by this one.
        set({ contacts: null, resolve: null });
        resolve?.(endpointId);
    },
    cancel() {
        get().pick(null);
    },
}));

/**
 * Opens the picker on one grant and waits for the peer. A request still
 * pending is cancelled first, so no caller is left holding a promise that
 * never settles.
 */
export function chooseContact(contacts: Contacts, role: Role): Promise<string | null> {
    useContactPicker.getState().cancel();
    return new Promise((resolve) => {
        useContactPicker.setState({ contacts, role, resolve });
    });
}
