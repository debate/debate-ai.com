/**
 * useCollabStore - what a shared session shows on screen.
 *
 * Kept separate from `useFlowStore` on purpose: a presence update must never
 * re-render the grid. The session layer writes here; <SessionChip /> reads.
 */

import { create } from "zustand";

import type { InviteNotice } from "../collab/invite";
import type { Role } from "../collab/types";

export type CollabStatus = "off" | "connecting" | "connected" | "reconnecting";

export interface CollabPeerView {
    endpointId: string;
    /** Display name when a contact is known, else a short form of the id. */
    name: string;
    role: Role;
    connectionType: "direct" | "relayed";
}

/** A peer a dial is still out for, and why it has not landed. */
export interface CollabPendingView {
    endpointId: string;
    name: string;
    unreachable: boolean;
}

export interface CollabUiState {
    status: CollabStatus;
    peers: CollabPeerView[];
    /** Peers the session expects and does not have. */
    pending: CollabPendingView[];
    /**
     * What this side was admitted as. Partner unless a host granted a
     * view-only ticket, which is the one thing that makes the surfaces stop
     * offering an edit. Off the wire, so it stands at partner with no session:
     * a debater flowing alone answers to nobody.
     */
    selfRole: Role;
    /**
     * This install's own EndpointId, once an endpoint has bound one. Stable
     * for the life of the identity file, so it is learned and never cleared:
     * a partner can be handed it whether or not anything is bound right now.
     */
    endpointId: string | null;
    /** Rounds saved contacts have offered and nobody has acted on yet. */
    invites: readonly InviteNotice[];
    setStatus(status: CollabStatus): void;
    setPeers(peers: CollabPeerView[]): void;
    setPending(pending: CollabPendingView[]): void;
    setSelfRole(role: Role): void;
    setEndpointId(endpointId: string): void;
    pushInvite(invite: InviteNotice): void;
    dismissInvite(endpointId: string, roundId: string): void;
    reset(): void;
}

/** One array backs every empty list, so a reset changes no identity. */
const NO_PEERS: CollabPeerView[] = [];
const NO_PENDING: CollabPendingView[] = [];

const NO_INVITES: readonly InviteNotice[] = [];

/**
 * How many invitations are held at once.
 *
 * A roundId arrives off the wire and a saved contact can mint as many as they
 * like, so the list is bounded rather than trusted. Twenty is past anything a
 * tournament produces and still fits a column a debater reads down; the oldest
 * is the one dropped, because the newest offer is the one whose sender is
 * still holding the round up.
 */
const MAX_INVITES = 20;

export const useCollabStore = create<CollabUiState>((set) => ({
    status: "off",
    peers: NO_PEERS,
    pending: NO_PENDING,
    selfRole: "editor",
    endpointId: null,
    invites: NO_INVITES,
    setStatus: (status) => set({ status }),
    setPeers: (peers) => set({ peers }),
    setPending: (pending) => set({ pending }),
    setSelfRole: (selfRole) => set({ selfRole }),
    setEndpointId: (endpointId) => set({ endpointId }),
    // A partner who dials twice about one round is one invitation, not two.
    pushInvite: (invite) =>
        set((s) => {
            if (
                s.invites.some(
                    (i) => i.endpointId === invite.endpointId && i.roundId === invite.roundId,
                )
            ) {
                return s;
            }
            const next = [...s.invites, invite];
            return { invites: next.slice(Math.max(0, next.length - MAX_INVITES)) };
        }),
    dismissInvite: (endpointId, roundId) =>
        set((s) => ({
            invites: s.invites.filter((i) => i.endpointId !== endpointId || i.roundId !== roundId),
        })),
    // An offer is only actionable while shared editing is running: with no
    // session, joining answers "turn on shared editing" and the sender has
    // long since moved on. Nothing survives a teardown that cannot be acted on.
    reset: () =>
        set({
            status: "off",
            peers: NO_PEERS,
            pending: NO_PENDING,
            selfRole: "editor",
            invites: NO_INVITES,
        }),
}));
