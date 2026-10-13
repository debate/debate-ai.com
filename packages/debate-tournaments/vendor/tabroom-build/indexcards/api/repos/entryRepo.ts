// @ts-nocheck
import { saveSettings, selectSettings, type Settings } from './utils/index.js';
import type { Insertable } from 'kysely';
import type { Entry } from '../data/schema.js';

import type { Database } from '../data/database.js';

type entryOpts = {
	limit?: number,
	offset?: number,
	settings?: boolean | string[],
	ids?: number[],
}
function buildEntryQuery(db: Database, opts: entryOpts = {}) {
	let query = db.selectFrom('entry')
	.$if(opts.settings !== undefined && opts.settings !== false, (qb) => qb.select(selectSettings({
			table: 'entry',
			settings: opts.settings ?? false,
		}
	)))

	query = opts.ids
		? query.where('entry.id', 'in', opts.ids)
		: query;

	query = opts.limit
		? query.limit(opts.limit)
		: query;

	query = opts.offset
		? query.offset(opts.offset)
		: query;

	return query;
}

async function getEntry(db: Database,id: number, opts: entryOpts = {}) {
	const query = buildEntryQuery(db,opts)
	.selectAll('entry')
	.where('entry.id', '=', id);

	const row = await query.executeTakeFirst();

	if (!row) {
		return undefined;
	}

	return row;
}

async function getEntries(db: Database, opts: entryOpts = {}) {
	return await buildEntryQuery(db, opts)
		.selectAll('entry')
		.execute();
}

/**
 * Returns the students on these entries, with each student's pronoun from their person
 * (null when the student has no person). */
async function getEntryStudents(db: Database, entryIds: number[]) {
	return await db.selectFrom('entry_student')
		.innerJoin('student', 'student.id', 'entry_student.student')
		.leftJoin('person', 'person.id', 'student.person')
		.select([
			'entry_student.entry',
			'student.id',
			'student.first',
			'student.middle',
			'student.last',
			'person.pronoun',
		])
		.where('entry_student.entry', 'in', entryIds)
		.execute();
}

async function createEntry(db: Database, data: Insertable<Entry> & { settings?: Settings }) {
	const { settings, ...entryData } = data;
	const res =  await db.insertInto('entry')
		.values(entryData)
		.returningAll()
		.executeTakeFirstOrThrow();

	if (settings) {
		await saveSettings({db, table: 'entry', ownerId: res.id, settings});
		return {
			...res,
			settings,
		};
	}

	return res;
}

export default {
	getEntry,
	getEntries,
	getEntryStudents,
	createEntry,
};
