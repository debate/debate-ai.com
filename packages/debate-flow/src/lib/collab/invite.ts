/**
 * Who is allowed to put something on your screen.
 *
 * A saved contact's invite arrives as a corner message with a Join action, and
 * nothing happens until the receiver acts. An invite from anyone else produces
 * no UI at all: not a toast, not a chip flicker. An EndpointId is permanent
 * and every peer you have ever shared with holds yours, so an unknown dialler
 * that could raise a notification would be a way to interrupt a debater
 * mid-speech from across a tournament.
 *
 * Mutual-trust auto-join is deliberately absent. A partner who shares the
 * wrong round could otherwise pull a flow onto your screen mid-speech, and
 * nothing but your own hands changes what is in front of you.
 */

import { contactName, isKnown, type Contacts } from "./contacts";
import { PROTOCOL_MAJOR, type WireMessage } from "./peerLink";

/**
 * The refusal a dialler gets when the far side heard the invite but does not
 * hold the round. It is not an error: the notice landed, and joining is the
 * receiver's move to make.
 */
export const INVITED = "invited";

/**
 * What a round label is worth showing. A contact chooses this string and the
 * corner renders it, so the corner decides how much of one it will take.
 */
const MAX_LABEL = 120;

export interface InviteNotice {
    /** The dialler, who is holding the round. */
    endpointId: string;
    roundId: string;
    /** What they call it, which may be nothing at all. */
    label: string;
}

/**
 * The invite in a hello this side cannot admit, or null when there is none.
 *
 * Membership in the contact table is the whole test, and it is applied to the
 * endpoint the transport authenticated rather than the one the hello names.
 * An unknown dialler is refused in silence, which is what keeps an EndpointId
 * from being a way to put a notification on a debater's screen mid-speech.
 */
export function inviteFrom(
    msg: WireMessage,
    contacts: Contacts,
    ownRoundId: string | null,
    remoteId: string,
): InviteNotice | null {
    if (msg.type !== "hello") return null;
    if (msg.protocol !== PROTOCOL_MAJOR) return null;
    if (msg.roundId === ownRoundId) return null;
    if (msg.endpointId !== remoteId) return null;
    if (!isKnown(contacts, remoteId)) return null;
    return {
        endpointId: remoteId,
        roundId: msg.roundId,
        label: typeof msg.label === "string" ? msg.label.slice(0, MAX_LABEL) : "",
    };
}

/** Whether this dialler has earned a corner message. */
export function shouldAnnounceInvite(contacts: Contacts, endpointId: string): boolean {
    return isKnown(contacts, endpointId);
}

/** What the corner says. Naming the round is what makes it actionable. */
export function inviteToastFor(contacts: Contacts, endpointId: string, roundLabel: string): string {
    const who = contactName(contacts, endpointId);
    return roundLabel.trim() ? `${who} shared ${roundLabel}` : `${who} shared a round`;
}
