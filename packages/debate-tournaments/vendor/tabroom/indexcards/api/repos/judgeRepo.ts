// @ts-nocheck
import { saveSettings, selectSettings, type Settings } from './utils/settings.js';
import type { Database } from '../data/database.js'
import type { Insertable } from 'kysely';
import { sql } from 'kysely';
import type { Judge } from '../data/schema.js';

type queryOpts = {
	limit?: number;
	offset?: number;
	person?: number;
	person_request?: number;
	settings?: boolean | string[]
}
function buildJudgeQuery(db: Database, opts: queryOpts = {}) {
	let query = db.selectFrom('judge')
	.$if(opts.settings !== undefined && opts.settings !== false, (qb) => qb.select(selectSettings({
			table: 'judge',
			settings: opts.settings ?? false,
		}
	)))
	if(opts.limit) query = query.limit(opts.limit);
	if(opts.offset) query = query.offset(opts.offset);
	if(opts.person) query = query.where('judge.person', '=', opts.person);
	if(opts.person_request) query = query.where('judge.person_request', '=', opts.person_request);

	return query;
}

async function getJudge(db: Database, id: number, opts: queryOpts = {}){
	return await buildJudgeQuery(db, opts)
	.selectAll('judge')
	.where('judge.id', '=', id)
	.executeTakeFirst();
}

async function getJudges(db: Database, opts: queryOpts = {}) {
	return await buildJudgeQuery(db, opts)
	.selectAll('judge')
	.execute();
}

async function createJudge(db: Database, data: Insertable<Judge> & { settings?: Settings}){
	const { settings, ...judgeData } = data;

	return await db.transaction().execute(async (trx) => {
		const judge = await trx
			.insertInto('judge')
			.values(judgeData)
			.returningAll()
			.executeTakeFirstOrThrow();

		if (settings) {
			await saveSettings({
				db: trx,
				table: 'judge',
				settings,
				ownerId: judge.id,
			});
		}

		return judge;
	});
}

async function updateJudge(db: Database, id: number, data: Insertable<Judge> & { settings?: Settings}) {
	const { settings, ...judgeData } = data;

	await db.transaction().execute(async (trx) => {
		await trx
			.updateTable('judge')
			.set(judgeData)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();

		if (settings) {
			await saveSettings({
				db: trx,
				table: 'judge',
				settings,
				ownerId: id,
			});
		}
	});

	return getJudge(db, id);
}

async function unlinkedSearch(
	db: Database,
	{ first, last }: { first?: string; last?: string },
	opts: queryOpts & { notRequestedBy?: number } = {}
) {
	if (!first || !last) {
		throw new Error('unlinkedSearch requires first and last parameters');
	}

	return await buildJudgeQuery(db, opts)
	.leftJoin('category', 'judge.category', 'category.id')
	.leftJoin('tourn', 'category.tourn', 'tourn.id')
	.leftJoin('school', 'judge.school', 'school.id')
	.select(['judge.id', 'judge.first', 'judge.middle', 'judge.last'])
	.select('tourn.name as tourn_name')
	.select('school.name as school_name')
	.where('judge.first', 'like', `${first}%`)
	.where('judge.last', 'like', `${last}%`)
	.where(eb => eb('judge.person', '=', 0).or('judge.person', 'is', null))
	.where(eb => eb('tourn.end', 'is', null).or('tourn.end', '>', new Date()))
	.where(eb => eb('judge.person_request', 'is', null).or('judge.person_request', '!=', opts.notRequestedBy ?? null))
	.orderBy('tourn.start')
	.orderBy('judge.last', 'asc')
	.orderBy('judge.first', 'asc')
	.execute();
}

async function getJudgeHistory(db: Database, personId: number, opts: queryOpts = {}) {

	let query = buildJudgeQuery(db, opts)
	.innerJoin('category', 'judge.category', 'category.id')
	.innerJoin('tourn', 'category.tourn', 'tourn.id')
	.leftJoin('event', 'event.category', 'category.id')
	.leftJoin('event_setting as es', (join) =>
		join
			.onRef('es.event', '=', 'event.id')
			.on('es.tag', '=', 'weekend'),
	)
	.leftJoin('weekend', 'weekend.id', 'es.value')
	.leftJoin('ballot', 'ballot.judge', 'judge.id')
	.leftJoin('panel', 'ballot.panel', 'panel.id')
	.leftJoin('round', (join) =>
		join
			.onRef('round.id', '=', 'panel.round')
			.on('round.published', '=', 1),
	)
	.select([
		'judge.id',
		'judge.first',
		'judge.last',
		'judge.code',
		'judge.obligation',
		'judge.hired',

		'category.id as category_id',
		'category.name as category_name',
		'category.abbr as category_abbr',

		'tourn.id as tourn_id',
		'tourn.name as tourn_name',
		'tourn.city as tourn_city',
		'tourn.state as tourn_state',

		// Converted timezone values
		sql<Date>`CONVERT_TZ(tourn.start, '+00:00', tourn.tz)`.as('tourn_start'),
		sql<Date>`CONVERT_TZ(tourn.end, '+00:00', tourn.tz)`.as('tourn_end'),
		sql<Date>`CONVERT_TZ(weekend.start, '+00:00', tourn.tz)`.as(
			'weekend_start',
		),
		sql<Date>`CONVERT_TZ(weekend.end, '+00:00', tourn.tz)`.as(
			'weekend_end',
		),

		sql<number>`COUNT(DISTINCT round.id)`.as('round_count'),
	])

	.where('judge.person', '=', personId)
	.where('tourn.start', '<', new Date())
	.where('tourn.hidden', '!=', 1)

	.groupBy('judge.id')
	.orderBy('tourn.start', 'desc');
	const result = await query.execute();
	return result.map(row => ({
		id: row.id,
		first: row.first,
		last: row.last,
		code: row.code,
		obligation: row.obligation,
		hired: row.hired,
		Category: {
			id: row.category_id,
			name: row.category_name,
			abbr: row.category_abbr,
		},
		Tourn: {
			id: row.tourn_id,
			name: row.tourn_name,
			city: row.tourn_city,
			state: row.tourn_state,
			start: row.tourn_start,
			end: row.tourn_end,
		},
		Weekend: {
			start: row.weekend_start,
			end: row.weekend_end,
		},
		roundCount: row.round_count,
	}));
}

async function getLiveDocs(db: Database, personId: number){
	return db
		.selectFrom('judge')
		.innerJoin('category', 'category.id', 'judge.category')
		.innerJoin('tourn', 'tourn.id', 'category.tourn')
		.innerJoin('category_setting as livedoc_url', (join) =>
			join
				.onRef('livedoc_url.category', '=', 'category.id')
				.on('livedoc_url.tag', '=', 'livedoc_url'),
		)
		.leftJoin('category_setting as livedoc_caption', (join) =>
			join
				.onRef('livedoc_caption.category', '=', 'category.id')
				.on('livedoc_caption.tag', '=', 'livedoc_caption'),
		)
		.select([
			'judge.id as judgeId',
			'category.abbr as categoryAbbr',
			'tourn.name as tournName',
			'tourn.end as tournEnd',
			'tourn.tz as tournTz',
			'livedoc_url.value_text as url',
			'livedoc_caption.value as caption',
		])
		.where('judge.person', '=', personId)
		.where('tourn.end', '>', sql<Date>`NOW()`)
		.where(
			'tourn.start',
			'>',
			sql<Date>`DATE_SUB(NOW(), INTERVAL 7 DAY)`,
		)
		.where('tourn.hidden', '!=', 1)
		.execute();
}

export async function getJudgesForPersons(db: Database, personIds: number[]) {
		const rows = await db.selectFrom('judge')
			.where('judge.person', 'in', personIds)
			.where('judge.person', 'is not', null)
			.leftJoin('school', 'school.id', 'judge.school')
			.selectAll('judge')
			.select(['school.id as schoolId', 'school.name as schoolName'])
			.execute();

			type JudgeForPerson = {
				id: number;
				person: number | null;
				created_at: Date | null;
				School: {
					id: number;
					name: string | null;
				} | null;
			};

			return rows.reduce<Record<number, JudgeForPerson[]>>((acc, row) => {
				(acc[row.person!] ??= []).push({
					id: row.id,
					person: row.person,
					created_at: row.created_at,
					School: row.schoolId
						? {
								id: row.schoolId,
								name: row.schoolName,
							}
						: null,
				});
			
				return acc;
			}, {});
}
export default {
	getJudge,
	getJudges,
	createJudge,
	updateJudge,
	unlinkedSearch,
	getJudgeHistory,
	getLiveDocs,
};
