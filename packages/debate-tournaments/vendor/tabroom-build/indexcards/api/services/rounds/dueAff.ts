// @ts-nocheck
// Which entry is due to be Aff when two entries meet again (round_elim_dueaff.mas).
// Pairing uses it to set elim sides, and ballots use it to know those sides are locked.

type Meeting = {
	panel: number;
	round: number | null;
	panelBye: number;
	entry: number | null;
	side: number;
	bye: number;
	forfeit: number;
};

/**
 * Returns the entry that was Neg more often when the two entries met in earlier rounds, so
 * is due to be Aff, or null if they never met or were Neg equally often. Byes and forfeits
 * don't count. Takes the rows from panelRepo.getMeetings and the current round's number. */
export function dueAff(meetings: Meeting[], roundName: number | null): number | null {
	if (roundName === null) return null;

	// A bye or forfeit on any ballot rules out the whole panel
	const skipped = new Set(meetings
		.filter(meeting => meeting.panelBye || meeting.bye || meeting.forfeit)
		.map(meeting => meeting.panel));

	const negCount = new Map<number, number>();
	const counted = new Set<number>();

	for (const { panel, round, entry, side } of meetings) {
		if (round === null || round >= roundName || skipped.has(panel)) continue;

		// One Neg per earlier panel, even when it had several judges
		if (side !== 2 || entry === null || counted.has(panel)) continue;
		counted.add(panel);
		negCount.set(entry, (negCount.get(entry) ?? 0) + 1);
	}

	const [first, second] = [...negCount.entries()].sort((a, b) => b[1] - a[1]);
	if (!first) return null;
	if (second && second[1] === first[1]) return null;
	return first[0];
}
