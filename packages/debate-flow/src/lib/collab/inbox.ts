/**
 * An invitation, from the corner it arrives in to the Join that acts on it.
 *
 * Nothing here happens on its own. A notice is shown and remembered, and the
 * round only lands on this machine when the debater says so, because a partner
 * sharing the wrong round must never be able to pull a flow onto a screen
 * mid-speech.
 */

import { toast } from "sonner";

import { navigateToFlow } from "../commands/flowNav";
import { useCollabStore } from "../store/useCollabStore";
import { useFlowStore } from "../store/useFlowStore";
import { getCurrentVersion } from "../update/adapter";

import { collabLive } from "./enabled";
import { inviteToastFor, shouldAnnounceInvite, type InviteNotice } from "./invite";
import { joinRound } from "./join";
import { createPeerLinkFor } from "./peerLink";
import { resumeJoined } from "./runtime";

/** How long an invitation stays in the corner. Long enough to act on between speeches. */
const INVITE_TOAST_MS = 30_000;

/**
 * The longest roundId this side will act on. A round this app mints names
 * itself in about twenty characters, and the field arrives off the wire where
 * a contact can put anything in it. Refused rather than cut: a roundId is an
 * identity, and a shortened one would ask the host for a round nobody holds.
 */
const MAX_ROUND_ID = 128;

/**
 * The longest label a notice carries. Purely what the corner and the sidebar
 * say, so an oversized one is cut to fit rather than refused: the offer is
 * still real, and the round is still joinable under a shortened name.
 */
const MAX_LABEL = 80;

export function announceInvite(notice: InviteNotice): void {
    const contacts = useFlowStore.getState().contacts;
    // The transport already refuses a stranger, and this refuses one again
    // rather than trusting a single gate with what reaches the screen.
    if (!shouldAnnounceInvite(contacts, notice.endpointId)) return;
    if (!notice.roundId || notice.roundId.length > MAX_ROUND_ID) return;
    const bounded: InviteNotice = { ...notice, label: notice.label.slice(0, MAX_LABEL) };
    useCollabStore.getState().pushInvite(bounded);
    toast(inviteToastFor(contacts, bounded.endpointId, bounded.label), {
        // Addressed by the round it offers, so a contact whose dial reaches
        // this machine twice refreshes one message rather than stacking a
        // second copy of the same invitation beside it.
        id: `collab-invite-${bounded.endpointId}-${bounded.roundId}`,
        duration: INVITE_TOAST_MS,
        action: { label: "Join", onClick: () => void acceptInvite(bounded) },
    });
}

/**
 * Takes the round the notice named: fetches it from the host, writes it as a
 * real `.ebb`, and opens it. The round's own session re-dials from there, so
 * this is the same path a pasted ticket takes minus the ticket.
 */
export async function acceptInvite(notice: InviteNotice): Promise<void> {
    try {
        const joined = await joinRound({
            invite: { endpointId: notice.endpointId, roundId: notice.roundId },
            createLink: createPeerLinkFor,
            appVersion: await getCurrentVersion(),
        });
        if (!joined) {
            // Either the switch went off behind the corner message, or the
            // debater declined to admit this contact to a round they already
            // hold. The second has had its dialog and wants no second message.
            if (!collabLive()) toast.error("Turn on shared editing in Settings first");
            return;
        }
        useCollabStore.getState().dismissInvite(notice.endpointId, notice.roundId);
        // Started before the route is asked, so the check reads the flow this
        // window is holding rather than the one it is about to.
        const resuming = resumeJoined(joined.path);
        toast.success(joined.created ? "Joined. The round is yours to keep." : "Joined.");
        navigateToFlow(joined.path);
        await resuming;
    } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not join that round");
    }
}
