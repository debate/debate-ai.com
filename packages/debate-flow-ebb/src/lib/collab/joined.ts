/**
 * The rounds this window took by hand.
 *
 * Opening a flow is not consent to be reachable, so a round with remembered
 * peers is only re-dialled while Listen for invites is on. A join is a
 * different gesture and gets a different answer: the debater typed a code or
 * pressed Join on an invitation, which is them asking for this round to be
 * live now. That switch does not speak to it - it governs being reachable with
 * no round in hand - so a round recorded here comes up whatever it says.
 *
 * Held for as long as the window holds the round and no longer: it is a record
 * of a gesture, not a property of the file, so a later launch that finds the
 * same `.ebb` on disk is back to the ordinary rule.
 */

const joined = new Set<string>();

/** Records that this window joined the round, rather than merely opening it. */
export function markJoined(roundId: string): void {
    joined.add(roundId);
}

export function joinedHere(roundId: string): boolean {
    return joined.has(roundId);
}

/** Drops every mark, for a debater back at the start screen with nothing open. */
export function forgetJoined(): void {
    joined.clear();
}
