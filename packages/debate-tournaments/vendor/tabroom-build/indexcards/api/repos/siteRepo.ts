// @ts-nocheck

import type { Database } from '../data/database.js';
import type { Site } from '../data/schema.js';
import type { Insertable, Updateable } from 'kysely';

type queryOpts = {
	circuit?: number,
	tourn?: number,
}
function buildSiteQuery(db: Database, opts: queryOpts = {}) {
	let query = db.selectFrom('site');

	if (opts.circuit) {
		query = query.where('circuit', '=', opts.circuit);
	}

	if (opts.tourn) {
		query = query.innerJoin('tourn_site', 'tourn_site.site', 'site.id')

			.where('tourn_site.tourn', '=', opts.tourn);
	}

	return query;
}

async function getSite(db: Database,id: number, opts: queryOpts = {}) {
	let query = buildSiteQuery(db, opts);
	
	return await query.where('site.id', '=', id)
	.selectAll('site')
	.executeTakeFirst();
}

async function getSites(db: Database, opts: queryOpts = {}) {
	const query = buildSiteQuery(db, opts);
	return await query.selectAll('site').execute();
}

async function createSite(db: Database, data: Insertable<Site>) {
	return await db.insertInto('site')
	.values(data)
	.returningAll().
	executeTakeFirst();
}

async function updateSite(db: Database, siteId: number, data: Updateable<Site>) {
	const result = await db.updateTable('site')
		.set(data)
		.where('site.id', '=', siteId)
		.executeTakeFirst();
	return result.numUpdatedRows > 0;
}

async function deleteSite(db: Database,id: number) {
	return await db.deleteFrom('site')
		.where('site.id', '=', id)
		.executeTakeFirst();
}

export default {
	getSite,
	getSites,
	createSite,
	updateSite,
	deleteSite,
};