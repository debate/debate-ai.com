// @ts-nocheck
import type { Insertable } from 'kysely';
import type { Database } from '../data/database.js';
import type { File } from '../data/schema.js';


type queryOpts = {
	tourn?: number;
	unpublished?: boolean;
};
function buildFileQuery(db: Database, opts: queryOpts = {}) {
	let query = db.selectFrom('file');
	if (!opts.unpublished) {
		query = query.where('published', '=', 1);
	}
	if (opts.tourn !== undefined) {
		query = query.where('tourn', '=', opts.tourn);
	}

	return query;
}

export async function getFile(db: Database, id: number, opts = {}) {
	return await buildFileQuery(db, opts)
		.where('id', '=', id)
		.selectAll()
		.executeTakeFirst();
}

export async function getFiles(db: Database, opts: queryOpts = {}) {
	return await buildFileQuery(db, opts)
	.selectAll()
	.execute();
}

async function createFile(db: Database, data: Insertable<File>) {
	return await db.insertInto('file')
	.values(data)
	.returningAll()
	.executeTakeFirstOrThrow();
}

export default {
	getFile,
	getFiles,
	createFile,
};
