// @ts-nocheck
import { saveSettings, selectSettings, withTransaction, type Settings } from './utils/index.js';

import type { Database } from '../data/database.js';
import type { Insertable, Updateable } from 'kysely';
import type { Panel } from '../data/schema.js';

type queryOpts = {
	settings?: boolean | string[];
	round?: number;
}
function buildPanelQuery(db: Database, opts: queryOpts){
	let query  = db.selectFrom('panel')
	.$if(opts.settings !== undefined && opts.settings !== false, (q) => q.select(selectSettings({
		table: 'panel',
		settings: opts.settings ?? false,
	})))

	query = opts.round ? query.where('panel.round', '=', opts.round) : query;

	return query;
}

async function getPanel(db: Database, id: number, opts: queryOpts = {}){
	return await buildPanelQuery(db, opts)
	.where('panel.id', '=', id)
	.selectAll('panel')
	.executeTakeFirst();
}

/**
 * Returns every panel where this panel's two entries met, this one included, with each
 * entry's side and the round number, bye and forfeit flags, one row per ballot.
 * Empty unless the panel has exactly two entries. */
async function getMeetings(db: Database, id: number) {
	const current = await db.selectFrom('ballot')
		.select('ballot.entry')
		.where('ballot.panel', '=', id)
		.distinct()
		.execute();

	const entries = current.map(row => row.entry).filter(entry => entry !== null);
	if (entries.length !== 2) return [];

	const rows = await db.selectFrom('ballot')
		.innerJoin('panel', 'panel.id', 'ballot.panel')
		.innerJoin('round', 'round.id', 'panel.round')
		.select([
			'panel.id as panel',
			'round.name as round',
			'panel.bye as panelBye',
			'ballot.entry',
			'ballot.side',
			'ballot.bye',
			'ballot.forfeit',
		])
		.where('ballot.entry', 'in', entries)
		.execute();

	// Only panels where both entries were there
	const entriesByPanel = new Map<number, Set<number | null>>();
	for (const row of rows) {
		entriesByPanel.set(row.panel, (entriesByPanel.get(row.panel) ?? new Set()).add(row.entry));
	}

	return rows.filter(row => entriesByPanel.get(row.panel)?.size === 2);
}

/**
 * Returns pairs of this panel's entries and the other entries they're doubled with: entries
 * sharing a student that have a ballot in a round whose timeslot overlaps this one, at any
 * tourn (round_doubled.mas). One row per pair. */
async function getDoubledEntries(db: Database, id: number) {
	const timeslot = await db.selectFrom('panel')
		.innerJoin('round', 'round.id', 'panel.round')
		.innerJoin('timeslot', 'timeslot.id', 'round.timeslot')
		.select(['timeslot.start', 'timeslot.end'])
		.where('panel.id', '=', id)
		.executeTakeFirst();
	if (!timeslot?.start || !timeslot.end) return [];

	return await db.selectFrom('ballot')
		.innerJoin('panel', 'panel.id', 'ballot.panel')
		.innerJoin('round', 'round.id', 'panel.round')
		.innerJoin('timeslot', 'timeslot.id', 'round.timeslot')
		.innerJoin('entry_student as es', 'es.entry', 'ballot.entry')
		.innerJoin('entry_student as oes', join => join
			.onRef('oes.student', '=', 'es.student')
			.onRef('oes.entry', '!=', 'es.entry'))
		.innerJoin('ballot as oballot', 'oballot.entry', 'oes.entry')
		.innerJoin('panel as opanel', 'opanel.id', 'oballot.panel')
		.innerJoin('round as oround', 'oround.id', 'opanel.round')
		.innerJoin('timeslot as otimeslot', 'otimeslot.id', 'oround.timeslot')
		.select(['ballot.entry as entry', 'oes.entry as other'])
		.where('ballot.panel', '=', id)
		.where('es.student', '>', 0)
		// Every overlap below falls inside this panel's timeslot. As constants these bounds can
		// use the timeslot indexes, so students with long histories don't join every ballot they've had
		.where('otimeslot.start', '<=', timeslot.end)
		.where('otimeslot.end', '>=', timeslot.start)
		.where(eb => eb.or([
			eb('otimeslot.id', '=', eb.ref('timeslot.id')),
			eb.and([
				eb('otimeslot.start', '<', eb.ref('timeslot.end')),
				eb('otimeslot.end', '>', eb.ref('timeslot.start')),
			]),
			eb.and([
				eb('otimeslot.start', '=', eb.ref('timeslot.end')),
				eb('otimeslot.end', '=', eb.ref('timeslot.start')),
			]),
		]))
		.distinct()
		.execute();
}

/**
 * Returns the judges on a panel with their person's pronoun, one row per judge. chair is 1 when
 * any of the judge's ballots on the panel is the chair's. */
async function getPanelJudges(db: Database, id: number) {
	return await db.selectFrom('ballot')
		.innerJoin('judge', 'judge.id', 'ballot.judge')
		.leftJoin('person', 'person.id', 'judge.person')
		.select(eb => [
			'judge.id',
			'judge.code',
			'judge.first',
			'judge.middle',
			'judge.last',
			'person.pronoun',
			eb.fn.max('ballot.chair').as('chair'),
		])
		.where('ballot.panel', '=', id)
		.groupBy(['judge.id', 'person.pronoun'])
		.execute();
}

async function getPanels(db: Database, opts: queryOpts = {}) {
	return await buildPanelQuery(db, opts).selectAll('panel').execute();
}
async function createPanel(db: Database, data: Insertable<Panel> & { settings?: Settings }){
	const { settings, ...panelData } = data;

	return await withTransaction(db, async (trx) => {
		if (Object.keys(panelData).length === 0) {
			throw new Error('createPanel requires panel data');
		}

		const panel = await trx
			.insertInto('panel')
			.values(panelData)
			.returningAll()
			.executeTakeFirstOrThrow();

		if (settings) {
			await saveSettings({
				db: trx,
				table: 'panel',
				settings,
				ownerId: panel.id,
			});
		}

		return panel;
	});
}

async function updatePanel(db: Database, id: number, data: Updateable<Panel> & { settings?: Settings }){
	const { settings, ...panelData } = data;

	return await withTransaction(db, async (trx) => {
		if (Object.keys(panelData).length > 0) {
			await trx
				.updateTable('panel')
				.set(panelData)
				.where('id', '=', id)
				.executeTakeFirstOrThrow();
		}

		if (settings) {
			await saveSettings({
				db: trx,
				table: 'panel',
				settings,
				ownerId: id,
			});
		}

		return id;
	});
}

// Returns the tournament the panel's round belongs to
async function getPanelTourn(db: Database, id: number) {
	return await db.selectFrom('panel')
		.innerJoin('round', 'round.id', 'panel.round')
		.innerJoin('event', 'event.id', 'round.event')
		.innerJoin('tourn', 'tourn.id', 'event.tourn')
		.selectAll('tourn')
		.where('panel.id', '=', id)
		.executeTakeFirst();
}

async function deletePanel(db: Database, id: number){
	return await db.deleteFrom('panel')
		.where('id', '=', id)
		.executeTakeFirst();
}

async function getCurrentBallots(db: Database, personId: number, tournId: number){
	const rows = await db
		.selectFrom('judge')
		.innerJoin('category', 'category.id', 'judge.category')
		.innerJoin('tourn', 'tourn.id', 'category.tourn')
		.innerJoin('ballot', 'ballot.judge', 'judge.id')
		.innerJoin('entry', 'entry.id', 'ballot.entry')
		.innerJoin('panel', 'panel.id', 'ballot.panel')
		.innerJoin('round', 'round.id', 'panel.round')
		.innerJoin('event', 'event.id', 'round.event')
		.innerJoin('timeslot', 'timeslot.id', 'round.timeslot')
		.innerJoin('person', 'person.id', 'judge.person')
		.leftJoin('school', 'school.id', 'judge.school')
		.leftJoin('permission', (join) => join
			.onRef('permission.person', '=', 'judge.person')
			.on('permission.tag', '=', 'chapter')
			.onRef('permission.chapter', '=', 'school.chapter')
		)
		.leftJoin('category_setting as rounds_per', (join) => join
			.onRef('rounds_per.category', '=', 'category.id')
			.on('rounds_per.tag', '=', 'rounds_per')
		)
		.leftJoin('room', 'room.id', 'panel.room')
		.leftJoin('score', (join) => join
			.onRef('score.ballot', '=', 'ballot.id')
			.on('score.tag', 'in', ['winloss', 'rank', 'point', 'refute'])
		)
		.leftJoin('event_setting as flight_offset', (join) => join
			.onRef('flight_offset.event', '=', 'event.id')
			.on('flight_offset.tag', '=', 'flight_offset')
		)
		.leftJoin('event_setting as sidelock_elims', (join) => join
			.onRef('sidelock_elims.event', '=', 'event.id')
			.on('sidelock_elims.tag', '=', 'sidelock_elims')
		)
		.leftJoin('event_setting as no_side_constraints', (join) => join
			.onRef('no_side_constraints.event', '=', 'event.id')
			.on('no_side_constraints.tag', '=', 'no_side_constraints')
		)
		.leftJoin('round_setting as use_normal_rooms', (join) => join
			.onRef('use_normal_rooms.round', '=', 'round.id')
			.on('use_normal_rooms.tag', '=', 'use_normal_rooms')
		)
		.leftJoin('event_setting as online_mode', (join) => join
			.onRef('online_mode.event', '=', 'event.id')
			.on('online_mode.tag', '=', 'online_mode')
		)
		.leftJoin('event_setting as online_ballots', (join) => join
			.onRef('online_ballots.event', '=', 'event.id')
			.on('online_ballots.tag', '=', 'online_ballots')
		)
		.leftJoin('event_setting as aff_label', (join) => join
			.onRef('aff_label.event', '=', 'event.id')
			.on('aff_label.tag', '=', 'aff_label')
		)
		.leftJoin('event_setting as neg_label', (join) => join
			.onRef('neg_label.event', '=', 'event.id')
			.on('neg_label.tag', '=', 'neg_label')
		)
		.leftJoin('tourn_setting as legion', (join) => join
			.onRef('legion.tourn', '=', 'tourn.id')
			.on('legion.tag', '=', 'legion')
		)
		.leftJoin('tourn_setting as service_project', (join) => join
			.onRef('service_project.tourn', '=', 'tourn.id')
			.on('service_project.tag', '=', 'service_project')
		)
		.leftJoin('tourn_setting as mock_trial', (join) => join
			.onRef('mock_trial.tourn', '=', 'tourn.id')
			.on('mock_trial.tag', '=', 'mock_trial_registration')
		)
		.leftJoin('round_setting as judges_ballots_visible', (join) => join
			.onRef('judges_ballots_visible.round', '=', 'round.id')
			.on('judges_ballots_visible.tag', '=', 'judges_ballots_visible')
		)
		.leftJoin('round_setting as include_room_notes', (join) => join
			.onRef('include_room_notes.round', '=', 'round.id')
			.on('include_room_notes.tag', '=', 'include_room_notes')
		)
		.leftJoin('panel_setting as flip_status', (join) => join
			.onRef('flip_status.panel', '=', 'panel.id')
			.on('flip_status.tag', '=', 'flip_status')
		)
		.leftJoin('panel_setting as async_setting', (join) => join
			.onRef('async_setting.panel', '=', 'panel.id')
			.on('async_setting.tag', '=', 'show_async')
		)
		.select([
			'judge.id as judgeId',
			'judge.code as judgeCode',
			'judge.first as judgeFirst',
			'judge.last as judgeLast',
			'judge.obligation as judgeObligation',
			'judge.hired as judgeHired',
			'category.id as categoryId',
			'category.name as categoryName',
			'category.abbr as categoryAbbr',
			'event.id as eventId',
			'event.name as eventName',
			'event.abbr as eventAbbr',
			'event.type as eventType',
			'round.id as roundId',
			'round.name as roundName',
			'round.label as roundLabel',
			'round.published as roundPublished',
			'round.flighted as roundFlighted',
			'round.type as roundType',
			'round.start_time as roundStart',
			'timeslot.start as timeslotStart',
			'timeslot.end as timeslotEnd',
			'panel.id as panelId',
			'panel.letter as panelLetter',
			'panel.flight as panelFlight',
			'ballot.id as ballotId',
			'ballot.side as ballotSide',
			'ballot.speakerorder as ballotSpeakerOrder',
			'ballot.audit as ballotAudit',
			'ballot.judge_started as ballotJudgeStarted',
			'ballot.chair as ballotChair',
			'entry.id as entryId',
			'entry.code as entryCode',
			'room.id as roomId',
			'room.name as roomName',
			'room.url as roomUrl',
			'room.notes as roomNotes',
			'online_mode.value as onlineMode',
			'use_normal_rooms.value as useNormalRooms',
			'online_ballots.value as onlineBallots',
			'judges_ballots_visible.value as judgesBallotsVisible',
			'aff_label.value as affLabel',
			'neg_label.value as negLabel',
			'legion.value as legion',
			'service_project.value_text as serviceProject',
			'mock_trial.value as mockTrial',
			'include_room_notes.value as includeRoomNotes',
			'flight_offset.value as flightOffset',
			'sidelock_elims.value as sidelockElims',
			'no_side_constraints.value as noSideConstraints',
			'async_setting.value as asyncValue',
			'person.tz as personTz',
			'tourn.id as tournId',
			'tourn.name as tournName',
			'tourn.tz as tournTz',
			'tourn.hidden as tournHidden',
			'tourn.end as tournEnd',
			'score.id as scoreId',
			'permission.chapter as permissionChapter',
			'school.id as schoolId',
			'school.name as schoolName',
			'rounds_per.value as roundsPer',
			'flip_status.value as flipStatus',
		])
		.select((eb) => [
			eb
				.selectFrom('event_setting as es')
				.select('es.value')
				.whereRef('es.event', '=', 'event.id')
				.where('es.tag', '=', 'start_button')
				.limit(1)
				.as('startButton'),
			eb
				.selectFrom('event_setting as es')
				.select('es.value')
				.whereRef('es.event', '=', 'event.id')
				.where('es.tag', '=', 'start_button_text')
				.limit(1)
				.as('startButtonText'),
		])
		.where('judge.person', '=', personId)
		.where('tourn.id', '=', tournId)
		.where('tourn.end', '>=', new Date(Date.now()))
		.where('entry.active', '=', 1)
		.groupBy(['panel.id', 'judge.id', 'ballot.entry'])
		.orderBy('timeslot.start')
		.orderBy('event.abbr')
		.orderBy('round.name')
		.orderBy('panel.flight')
		.orderBy('ballot.audit')
		.execute();

	const panels = new Map();
	rows.forEach((row: typeof rows[number]) => {
		let panel = panels.get(row.panelId);
		if (!panel) {
			panel = {
				id: row.panelId,
				letter: row.panelLetter,
				flight: row.panelFlight,
				scored: row.scoreId != null,
				settings: {
					flip_status: row.flipStatus,
					show_async: row.asyncValue,
				},
				Judge: {
					id: row.judgeId,
					code: row.judgeCode,
					first: row.judgeFirst,
					last: row.judgeLast,
					obligation: row.judgeObligation,
					hired: row.judgeHired,
					Category: {
						id: row.categoryId,
						name: row.categoryName,
						abbr: row.categoryAbbr,
						Tourn: {
							id: row.tournId,
							name: row.tournName,
							tz: row.tournTz,
							hidden: row.tournHidden,
							end: row.tournEnd,
							settings: {
								legion: row.legion,
							},
						},
						Event: {
							id: row.eventId,
							name: row.eventName,
							abbr: row.eventAbbr,
							type: row.eventType,
							settings: {
								online_mode: row.onlineMode,
								start_button: row.startButton,
								start_button_text: row.startButtonText,
								flight_offset: row.flightOffset,
								aff_label: row.affLabel,
								neg_label: row.negLabel,
							},
						},
					},
				},
				Round: {
					id: row.roundId,
					name: row.roundName,
					label: row.roundLabel,
					published: row.roundPublished === 1,
					flighted: row.roundFlighted,
					type: row.roundType,
					start: row.roundStart,
					settings: {
						judges_ballots_visible: row.judgesBallotsVisible === '1',
					},
					Timeslot: {
						start: row.timeslotStart,
						end: row.timeslotEnd,
					},
				},
				Room: {
					id: row.roomId,
					name: row.roomName,
					notes: row.roomNotes,
					url: row.roomUrl,
				},
				Ballots: [],
				Entries: [],
			};
			panels.set(row.panelId, panel);
		};
		panel.Ballots.push({
			id: row.ballotId,
			side: row.ballotSide,
			speakerOrder: row.ballotSpeakerOrder,
			audit: row.ballotAudit,
			judge_started: row.ballotJudgeStarted,
			chair: row.ballotChair,
			entry: row.entryId,
		});
		panel.Entries.push({
			id: row.entryId,
			code: row.entryCode,
		});
	});
	return [...panels.values()];
}
export default {
	getPanel,
	getPanels,
	getMeetings,
	getDoubledEntries,
	getPanelJudges,
	updatePanel,
	getPanelTourn,
	createPanel,
	deletePanel,
	getCurrentBallots,
};
