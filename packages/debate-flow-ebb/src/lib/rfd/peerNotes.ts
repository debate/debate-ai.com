/**
 * Authored RFD sections, shared by the preview pane, the print view, and the
 * Excel export so all three list the same peers in the same order.
 *
 * `decision.rfd` is this machine owner's notes; every other author's notes
 * arrive under their EndpointId in `decision.peerNotes`. Reading is the only
 * thing that happens here: the wire owns `peerNotes`, the UI never writes it.
 */

import { contactName, type Contacts } from "../collab/contacts";
import type { Decision } from "../model/types";

/** One peer's notes, labeled with whatever their EndpointId is called. */
export interface AuthoredNote {
    endpointId: string;
    /** Contact name, or the short EndpointId when the peer is unknown. */
    author: string;
    text: string;
}

/**
 * Every peer's notes, blank entries dropped, ordered by EndpointId.
 *
 * The key orders rather than the display name so the sequence is identical on
 * every machine and survives a contact rename, which lets print and export
 * match the preview exactly.
 */
export function authoredPeerNotes(
    decision: Decision | undefined,
    contacts: Contacts,
): AuthoredNote[] {
    const notes = decision?.peerNotes;
    if (!notes) return [];
    const out: AuthoredNote[] = [];
    for (const endpointId of Object.keys(notes).sort()) {
        // A hand-edited .ebb reaches here unvalidated, so a non-string entry
        // is skipped rather than allowed to throw the whole RFD away.
        const text: unknown = notes[endpointId];
        if (typeof text !== "string" || !text.trim()) continue;
        out.push({ endpointId, author: contactName(contacts, endpointId), text });
    }
    return out;
}
