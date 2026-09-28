// @ts-nocheck
import { saveSettings, selectSettings, type Settings } from './utils/settings.js';
import type { Database } from '../data/database.js';
import type { Insertable, Updateable } from 'kysely';
import type { Tourn } from '../data/schema.js';

type queryOpts = {
	limit?: number;
	offset?: number;
	unpublished?: boolean;
	hasPublishedResults?: boolean;
	settings?: boolean;
	circuit?: number;
	startBefore?: Date;
	endBefore?: Date;
	startAfter?: Date;
	endAfter?: Date;
};

function buildTournQuery(db: Database, opts: queryOpts = {}) {
	let query = db.selectFrom('tourn')
	.$if(opts.settings !== undefined && opts.settings !== false, (qb) =>
		qb.select(selectSettings({
			table: 'tourn',
			settings: opts.settings ?? false,
		}))
	);
	if(opts.limit) query = query.limit(opts.limit);
	if(opts.offset) query = query.offset(opts.offset);
	if (!opts.unpublished) query = query.where('tourn.hidden', '=', 0);
	if (opts.startAfter) query = query.where('tourn.start', '>', opts.startAfter);
	if (opts.endAfter) query = query.where('tourn.end', '>', opts.endAfter);
	if (opts.startBefore) query = query.where('tourn.start', '<', opts.startBefore);
	if (opts.endBefore) query = query.where('tourn.end', '<', opts.endBefore);
	if (opts.circuit) {
		query = query
			.innerJoin('tourn_circuit', 'tourn_circuit.tourn', 'tourn.id')
			.where('tourn_circuit.circuit', '=', opts.circuit)
			.where('tourn_circuit.approved', '=', 1);
	}
	if (opts.hasPublishedResults) {
		query = query.where(({ or, exists, selectFrom }) => or([
			exists(
				selectFrom('event')
					.innerJoin('round', 'round.event', 'event.id')
					.select('event.id')
					.whereRef('event.tourn', '=', 'tourn.id')
					.where('round.post_primary', '>', 2)
			),
			exists(
				selectFrom('result_set')
					.select('result_set.id')
					.whereRef('result_set.tourn', '=', 'tourn.id')
					.where('result_set.published', '=', 1)
			),
		]));
	}
	return query;
}

/**
 * Fetch a single tournament by ID or webname.	
 */
async function getTourn(db: Database, id: number| string,opts = {}) {
	let query = buildTournQuery(db, opts);

	// ---- ID vs webname ----
	if (typeof id === 'number' || !isNaN(parseInt(id))) {
		query = query.where('id','=', parseInt(id as string));
	} else {
		query = query.where('webname','=', id);
	}

	return await query
	.selectAll('tourn')
	.executeTakeFirst();

}
async function getTourns(db: Database, opts: queryOpts = {}) {
	return await buildTournQuery(db, opts)
		.selectAll('tourn')
		.execute();
}

async function createTourn(db: Database, data: Insertable<Tourn> & { settings?: Settings } = {}) {
	const { settings, ...tournData } = data;

	return await db.transaction().execute(async (trx) => {
		if (Object.keys(tournData).length === 0) {
			throw new Error('createTourn requires tourn data');
		}

		const tourn = await trx
			.insertInto('tourn')
			.values(tournData)
			.returningAll()
			.executeTakeFirstOrThrow();

		if (settings) {
			await saveSettings({
				db: trx,
				table: 'tourn',
				settings,
				ownerId: tourn.id,
			});
		}

		return tourn;
	});
}

			async function updateTourn(db: Database, id: number, data: Updateable<Tourn> & { settings?: Settings }) {
				const { settings, ...tournData } = data;

	return await db.transaction().execute(async (trx) => {
		if (Object.keys(tournData).length > 0) {
			await trx
				.updateTable('tourn')
				.set(tournData)
				.where('id', '=', id)
				.executeTakeFirstOrThrow();
		}

		if (settings) {
			await saveSettings({
				db: trx,
				table: 'tourn',
				settings,
				ownerId: id,
			});
		}

		return id;
	});
}
async function deleteTourn(db: Database, id: number) {
	const res = await db.deleteFrom('tourn')
		.where('id', '=', id)
		.executeTakeFirst();
	return Number(res.numDeletedRows);
}

async function addSite(db: Database, tournId: number, siteId: number) {
	if (!tournId) throw new Error('addSite: tournId is required');
	if (!siteId) throw new Error('addSite: siteId is required');
	await db.insertInto('tourn_site')
		.values({
			tourn: tournId,
			site: siteId,
		})
		.executeTakeFirstOrThrow();
	return true;
}
export async function getSchedule(db: Database, id: number){
	const schedule = await db.selectFrom('round')
		.innerJoin('event', 'event.id', 'round.event')
		.innerJoin('timeslot', 'timeslot.id', 'round.timeslot')
		.where('event.tourn', '=', id)
		.where('event.type', '!=', 'attendee')
		.select([
			'round.id as id',
			'round.name as name',
			'round.label as label',
			'round.type as type',
			'round.start_time',
			'round.published',
			'round.post_primary',
			'event.id as eventId',
			'event.name as eventName',
			'event.abbr as eventAbbr',
			'event.type as eventType',
			'event.nsda_category',
			'timeslot.id as timeslotId',
			'timeslot.start as timeslotStart',
			'timeslot.end as timeslotEnd',
		])
		.orderBy('event.abbr')
		.orderBy('round.name')
		.orderBy('timeslot.start')
		.execute();

	return schedule.map( (round) => {
		return {
			id          : round.id,
			type        : round.type,
			name        : round.name,
			label       : round.label,
			published   : round.published,
			postPrimary : round.post_primary,
			startTime   : round.start_time,
			Event: {
				id           : round.eventId,
				name         : round.eventName,
				abbr         : round.eventAbbr,
				type         : round.eventType,
				nsdaCategory : round.nsda_category,
			},
			Timeslot  : {
				id    : round.timeslotId,
				start : round.timeslotStart,
				end   : round.timeslotEnd,
			},
		};
	});
};

export async function getContacts(db: Database, tournId: number) {
	return await db.selectFrom('person')
		.innerJoin('permission', 'permission.person', 'person.id')
		.where('permission.tourn', '=', tournId)
		.where('permission.tag', '=', 'contact')
		.select([
			'person.id',
			'person.first',
			'person.middle',
			'person.last',
			'person.email',
		])
		.execute();
};

async function getPersonTourns(db: Database, personId: number, opts: queryOpts = {}) {
	const query = buildTournQuery(db, opts);

	const data = await query
		.selectAll('tourn')
		.where(({ or, exists, selectFrom }) => or([
			// Person is a student in an entry at this tournament
			exists(
				selectFrom('student')
					.innerJoin('entry_student', 'entry_student.student', 'student.id')
					.innerJoin('entry', 'entry.id', 'entry_student.entry')
					.innerJoin('event as e', 'e.id', 'entry.event')
					.select('student.id')
					.where('student.person', '=', personId)
					.where('student.retired', '!=', 1)
					.whereRef('e.tourn', '=', 'tourn.id')
			),
			// Person is a judge in a category at this tournament
			exists(
				selectFrom('judge')
					.innerJoin('category', 'category.id', 'judge.category')
					.select('judge.id')
					.where('judge.person', '=', personId)
					.whereRef('category.tourn', '=', 'tourn.id')
			),
			// Person has permission/chapter/school at this tournament
			exists(
				selectFrom('permission')
					.innerJoin('chapter', 'chapter.id', 'permission.chapter')
					.innerJoin('school', 'school.chapter', 'chapter.id')
					.select('permission.id')
					.where('permission.person', '=', personId)
					.whereRef('school.tourn', '=', 'tourn.id')
			),
		]))
		.orderBy('tourn.start')
		.execute();

	return data;
}

async function getPersonTournSummary(db: Database, person: number, tourn: number){
	// Fetch all judges for this person at this tournament
	const judges = await db
		.selectFrom('judge')
		.innerJoin('category', 'category.id', 'judge.category')
		.select([
			'judge.id as id',
			'category.id as category_id',
			'category.name as category_name',
		])
		.select((eb) => [
			eb
				.selectFrom('category_setting as cs')
				.select('cs.value_text')
				.whereRef('cs.category', '=', 'category.id')
				.where('cs.tag', '=', 'livedoc_url')
				.limit(1)
				.as('livedoc_url'),
			eb
				.selectFrom('category_setting as cs')
				.select('cs.value')
				.whereRef('cs.category', '=', 'category.id')
				.where('cs.tag', '=', 'livedoc_caption')
				.limit(1)
				.as('livedoc_caption'),
		])
		.where('judge.person', '=', person)
		.where('category.tourn', '=', tourn)
		.execute();

	// Fetch all entries for this person at this tournament
	const entries = await db
		.selectFrom('student')
		.innerJoin('entry_student', 'entry_student.student', 'student.id')
		.innerJoin('entry', 'entry.id', 'entry_student.entry')
		.innerJoin('event', 'event.id', 'entry.event')
		.select('entry.id as id')
		.where('student.person', '=', person)
		.where('student.retired', '!=', 1)
		.where('event.tourn', '=', tourn)
		.execute();

	// Fetch all schools/coaching roles for this person at this tournament
	const coaches = await db
		.selectFrom('permission')
		.innerJoin('chapter', 'chapter.id', 'permission.chapter')
		.innerJoin('school', 'school.chapter', 'chapter.id')
		.select([
			'school.id as id',
			'school.name as name',
		])
		.where('permission.person', '=', person)
		.where('school.tourn', '=', tourn)
		.execute();

	const result = {
		tourn_id: tourn,
		judges: judges.map(j => ({
			id: j.id,
			category_id: j.category_id,
			category_name: j.category_name,
			livedoc_url: j.livedoc_url,
			livedoc_caption: j.livedoc_caption,
		})),
		entries: entries.map(e => ({
			id: e.id,
		})),
		coaches: coaches.map(c => ({
			id: c.id,
			name: c.name,
		})),
	};

	return result.judges.length === 0 && result.entries.length === 0 && result.coaches.length === 0 
		? null 
		: result;
}
export default {
	getTourn,
	getTourns,
	createTourn,
	updateTourn,
	deleteTourn,
	addSite,
	getSchedule,
	getContacts,
	getPersonTourns,
	getPersonTournSummary,
};
