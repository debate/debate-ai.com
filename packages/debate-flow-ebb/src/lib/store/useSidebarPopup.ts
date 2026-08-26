/**
 * useSidebarPopup - which of the sidebar's collaboration popups is open.
 *
 * The invitations chip, the session chip and the Invite menu all sit in the
 * same corner and all draw upward over the sheet, so two of them open at once
 * is two panels stacked on one another. One slot rather than a flag each: the
 * store holds at most one name, and opening any of them closes whichever was
 * open.
 */

import { useEffect } from "react";
import { create } from "zustand";

export type SidebarPopup = "invites" | "session" | "share";

interface SidebarPopupStore {
    /** The popup showing, or null when the corner is quiet. */
    open: SidebarPopup | null;
    /** Open `popup`, closing any other; `null` closes everything. */
    show: (popup: SidebarPopup | null) => void;
    /** Close `popup`, leaving another one alone if it has since opened. */
    close: (popup: SidebarPopup) => void;
}

export const useSidebarPopup = create<SidebarPopupStore>((set) => ({
    open: null,
    show: (popup) => set({ open: popup }),
    close: (popup) => set((s) => (s.open === popup ? { open: null } : s)),
}));

/**
 * Hold `popup`'s slot only while this component is drawing it.
 *
 * The corner is the sidebar's, so whatever draws a popup takes it away again:
 * the flow closing, the rail collapsing, the round changing. Without the
 * release the store keeps the name after the component has gone, the next
 * sidebar draws that popup already open, and the first click on its trigger
 * closes something nobody opened.
 */
export function useReleasePopupOnUnmount(popup: SidebarPopup): void {
    useEffect(() => () => useSidebarPopup.getState().close(popup), [popup]);
}
