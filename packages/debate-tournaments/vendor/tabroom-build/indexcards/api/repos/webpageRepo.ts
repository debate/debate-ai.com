// @ts-nocheck
import type { Database } from '../data/database.js';
import type { Updateable, Insertable } from 'kysely';
import type { Webpage } from '../data/schema.js';

type QueryOpts = {
	tourn?: number;
	sitewide?: number | boolean;
	slug?: string;
	unpublished?: boolean;
};

function buildWebpageQuery(db: Database, opts: QueryOpts = {}) {
	let query = db.selectFrom('webpage');

	if (!opts.unpublished) {
		query = query.where('published', '=', 1);
	}

	if (opts.tourn !== undefined) {
		query = query.where('tourn', '=', opts.tourn);
	}

	if (opts.sitewide !== undefined) {
		const sitewide = typeof opts.sitewide === 'boolean' ? Number(opts.sitewide) : opts.sitewide;
		query = query.where('sitewide', '=', sitewide);
	}

	if (opts.slug !== undefined) {
		query = query.where('slug', '=', opts.slug);
	}

	return query;
}

async function getWebpage(db: Database, webpageId: number, opts: QueryOpts = {}) {
	let query = buildWebpageQuery(db, opts);

	const res = await query
		.where('id', '=', webpageId)
		.selectAll()
		.executeTakeFirst();

	return res;
}

async function getWebpages(db: Database, opts: QueryOpts = {}) {
	let query = buildWebpageQuery(db, opts);

	const webpages = await query.selectAll().execute();
	return webpages;
};

async function createWebpage(db:Database, data: Insertable<Webpage>) {
	const res = await db.insertInto('webpage')
		.values(data)
		.returning('id')
		.executeTakeFirstOrThrow()
	return res.id;
}
async function updateWebpage(db: Database, webpageId: number, data: Updateable<Webpage>) {
	const res = await db.updateTable('webpage')
		.set(data)
		.where('id', '=', webpageId)
		.executeTakeFirstOrThrow()
	return res.numUpdatedRows > 0;
}

async function deleteWebpage(db: Database, webpageId: number) {
	const res = await db.deleteFrom('webpage')
		.where('id', '=', webpageId)
		.executeTakeFirstOrThrow();
	return res.numDeletedRows > 0;
}

export default {
	getWebpage,
	getWebpages,
	createWebpage,
	updateWebpage,
	deleteWebpage,
};