// @ts-nocheck
// Loads everything the ballot context needs for one judge's ballot on a panel (ballot.mhtml stage 1).
// All DB reads for the ballot context go here, so ballotRules stays pure.

import type { Database } from '../../data/database.js';
import logger from '../../helpers/logger.js';
import panelRepo from '../../repos/panelRepo.js';
import { getRound } from '../../repos/roundRepo.js';
import timeslotRepo from '../../repos/timeslotRepo.js';
import { getEvent } from '../../repos/eventRepo.js';
import tournRepo from '../../repos/tournRepo.js';
import tabroomRepo from '../../repos/tabroomRepo.js';
import judgeRepo from '../../repos/judgeRepo.js';
import roomRepo from '../../repos/roomRepo.js';
import { getBallots } from '../../repos/ballotRepo.js';
import scoreRepo from '../../repos/scoreRepo.js';
import topicRepo from '../../repos/topicRepo.js';
import { getCategory } from '../../repos/categoryRepo.js';
import entryRepo from '../../repos/entryRepo.js';
import { tiebreakTypes } from '../results/tiebreakTypes.js';
import { dueAff } from '../rounds/dueAff.js';
import { SITE_SETTING_TAGS, type BallotRulesInput, type SiteSettings } from './ballotRules.js';

/**
 * Returns the full rows for a judge's ballot on a panel, which work as the ballotRules input,
 * plus the judge and room, or undefined if the panel doesn't exist.
 * Throws when the judge or the panel's round, timeslot, event, category or tourn is missing. */
export async function loadBallotInputs(db: Database, judgeId: number, panelId: number) {
	const [panel, judge, ballots, meetings] = await Promise.all([
		panelRepo.getPanel(db, panelId, { settings: true }),
		judgeRepo.getJudge(db, judgeId),
		getBallots(db, { judge: judgeId, panel: panelId }),
		panelRepo.getMeetings(db, panelId),
	]);
	if (!panel) return undefined;
	if (!judge) throw new Error(`Judge ${judgeId} not found`);

	const entryIds = ballots.map(ballot => ballot.entry).filter(entry => entry !== null);

	const [scores, entries, students, doubled, panelJudges] = await Promise.all([
		scoreRepo.getScores(db, { ballots: ballots.map(ballot => ballot.id) }),
		entryRepo.getEntries(db, { ids: entryIds, settings: ['ballot_notes', 'positions'] }),
		entryRepo.getEntryStudents(db, entryIds),
		panelRepo.getDoubledEntries(db, panelId),
		panelRepo.getPanelJudges(db, panelId),
	]);

	// Ballots can be entered before the round is published or the tourn is public
	const round = panel.round ? await getRound(db, panel.round, { settings: true, unpublished: true }) : undefined;
	if (!round) throw new Error(`Panel ${panelId} has no round`);

	const [timeslot, event, tbTypes, room] = await Promise.all([
		round.timeslot ? timeslotRepo.getTimeslot(db, round.timeslot) : undefined,
		round.event ? getEvent(db, round.event, { settings: true }) : undefined,
		tiebreakTypes({ roundId: round.id }),
		panel.room ? roomRepo.getRoom(db, panel.room) : undefined,
	]);
	if (!timeslot) throw new Error(`Round ${round.id} has no timeslot`);
	if (!event) throw new Error(`Round ${round.id} has no event`);

	const topicId = Number(event.settings?.topic);

	const [tourn, category, siteRows, topic] = await Promise.all([
		event.tourn ? tournRepo.getTourn(db, event.tourn, { settings: true, unpublished: true }) : undefined,
		event.category ? getCategory(db, event.category, { settings: true }) : undefined,
		tabroomRepo.getSettings(db, [...SITE_SETTING_TAGS]),
		topicId ? topicRepo.getTopic(db, topicId) : undefined,
	]);
	if (!tourn) throw new Error(`Event ${event.id} has no tourn`);
	if (!category) throw new Error(`Event ${event.id} has no category`);

	// Classic crashes here; the ballot falls back to the motion or resolution instead
	if (topicId && !topic) {
		logger.warn('Event topic setting points to a missing topic', { event: event.id, topic: topicId });
	}

	const site: SiteSettings = Object.fromEntries(siteRows.map(row => [row.tag, row.value_text]));

	const inputs = {
		tourn, category, event, round, timeslot, panel, judge, panelJudges, ballots, scores, entries, students, doubled, site, tbTypes,
		topic: topic ?? null,
		dueAff: dueAff(meetings, round.name),
	} satisfies BallotRulesInput;

	// No room assigned, or one that has since been deleted, both show as no room
	return { ...inputs, judge, room: room ?? null };
}
