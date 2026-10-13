// @ts-nocheck
import { saveSettings, selectSettings, withTransaction, type Settings } from './utils/index.js';
import type { Insertable, Updateable } from 'kysely';
import type { Database } from '../data/database.js';
import type { School } from '../data/schema.js';

type queryOpts = {
	tourn?: number;
	chapter?: number;
	region?: number;
	district?: number;
	settings?: boolean | string[]
};
function buildSchoolQuery(db: Database, opts: queryOpts = {}){
	let query = db.selectFrom('school')
	.$if(opts.settings !== undefined && opts.settings !== false, (qb) => 
		qb.select(selectSettings({
			table: 'school',
			settings: opts.settings!
		}))
	)
	if (opts.tourn) {
		query = query.where('tourn', '=', opts.tourn);
	}
	if (opts.chapter) {
		query = query.where('chapter', '=', opts.chapter);
	}
	if (opts.region) {
		query = query.where('region', '=', opts.region);
	}
	if (opts.district) {
		query = query.where('district', '=', opts.district);
	}
	return query;
}

async function getSchool(db: Database, id: number, opts: queryOpts = {}) {
	const res = await buildSchoolQuery(db, opts)
	.where('id', '=', id)
	.selectAll('school')
	.executeTakeFirst();
	return res;
}
async function getSchools(db: Database, opts: queryOpts = {}) {
	return await buildSchoolQuery(db, opts)
	.selectAll('school')
	.execute();
}
async function createSchool(db: Database, data: Insertable<School> & { settings?: Settings }) {
	const { settings, ...schoolData } = data;

	return await withTransaction(db, async (trx) => {
		const school = await trx
			.insertInto('school')
			.values(schoolData)
			.returningAll()
			.executeTakeFirstOrThrow();


		if (settings) {
			await saveSettings({
				db: trx,
				table: 'school',
				settings,
				ownerId: school.id,
			});
		}

		return school;
	});
}
async function updateSchool(db: Database, id: number, data: Updateable<School> & { settings?: Settings }) {
	const { settings, ...schoolData } = data;

	return await withTransaction(db, async (trx) => {
		if (Object.keys(schoolData).length > 0) {
			await trx
				.updateTable('school')
				.set(schoolData)
				.where('id', '=', id)
				.executeTakeFirstOrThrow();
		}

		if (settings) {
			await saveSettings({
				db: trx,
				table: 'school',
				settings,
				ownerId: id,
			});
		}

		return id;
	});
}
async function deleteSchool(db: Database, id: number) {
	return await db.deleteFrom('school')
		.where('id', '=', id)
		.executeTakeFirst();
}

export default {
	getSchool,
	getSchools,
	createSchool,
	updateSchool,
	deleteSchool,
};
