/**
 * Telling a debater about the one loss they cannot see.
 *
 * A delete wins unconditionally, so a partner removing a row buries a write
 * made at the same moment on the same row. Nothing on the grid marks the
 * absence: the row is simply gone, and the text that was in it never appears.
 * Every other outcome of a merge is visible in the cells themselves.
 *
 * Only text that was on this machine's grid is reported: what the user typed
 * this session, and what came in from the file, which carries no author. A
 * cell one partner buried out from under another is their business, and
 * interrupting a debater mid-speech over someone else's evidence would train
 * them to dismiss the message.
 */

import { contactName, type Contacts } from "./contacts";
import type { DroppedCell } from "./merge";

/** Long enough to recognize the cell, short enough to stay one line. */
const QUOTE_MAX = 40;

function shorten(text: string): string {
    return text.length <= QUOTE_MAX ? text : `${text.slice(0, QUOTE_MAX - 3)}...`;
}

/**
 * What to put in the corner, or null when this merge cost the user nothing.
 *
 * `mine` is this machine's actor id, which is what marks a buried cell as the
 * user's own work rather than a partner's.
 */
export function lossMessage(
    contacts: Contacts,
    dropped: readonly DroppedCell[],
    mine: string,
): string | null {
    // A cell seeded from the file has no author and belongs to both peers who
    // opened it, so its loss is this user's loss too.
    const ours = dropped.filter(
        (cell) => (cell.writtenBy === mine || cell.writtenBy === "") && cell.text !== "",
    );
    if (ours.length === 0) return null;

    const who = contactName(contacts, ours[0].deletedBy);
    if (ours.length === 1) return `${who} deleted a row over your "${shorten(ours[0].text)}"`;
    return `${who} deleted a row over ${ours.length} of your cells`;
}
