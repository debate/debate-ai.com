// @ts-nocheck
import type { Insertable, Updateable } from 'kysely';
import type { Database } from '../data/database.js';
import type { Score } from '../data/schema.js';


type queryOpts = {
	winloss?: boolean;
	limit?: number;
	offset?: number;
	ballot?: number;
	ballots?: number[];
};
function buildScoreQuery(db: Database, opts: queryOpts = {}) {
	let query = db.selectFrom('score');
	query = opts.ballot ? query.where('ballot', '=', opts.ballot) : query;
	query = opts.ballots ? query.where('ballot', 'in', opts.ballots) : query;
	query = opts.winloss ? query.where('tag', '=', 'winloss') : query;
	query = opts.limit ? query.limit(opts.limit) : query;
	query = opts.offset ? query.offset(opts.offset) : query;

	return query;
}

async function getScore(db: Database, id: number, opts: queryOpts = {}) {
	return await buildScoreQuery(db, opts)
	.where('id', '=', id)
	.selectAll()
	.executeTakeFirst();
}
async function getScores(db: Database, opts: queryOpts = {}) {
	return await buildScoreQuery(db, opts)
	.selectAll()
	.execute();
}
async function createScore(db: Database, data: Insertable<Score>) {
	return await db.insertInto('score')
	.values(data)
	.returningAll()
	.executeTakeFirst();
}

async function updateScore(db: Database, id: number, data: Updateable<Score>) {
	await db.updateTable('score')
	.set(data)
	.where('id', '=', id)
	.execute();
	return id;
}
async function createScores(db: Database, data: Insertable<Score>[]) {
	if (data.length === 0) return [];
	const rows = await db.insertInto('score')
	.values(data)
	.returning('id')
	.execute();
	return rows.map(row => row.id);
}
async function deleteScores(db: Database, opts: { ballots: number[], tags: string[] }) {
	if (opts.ballots.length === 0 || opts.tags.length === 0) return false;
	const result = await db.deleteFrom('score')
	.where('ballot', 'in', opts.ballots)
	.where('tag', 'in', opts.tags)
	.executeTakeFirst();
	return result.numDeletedRows > 0;
}

export default {
	getScore,
	getScores,
	createScore,
	createScores,
	updateScore,
	deleteScores,
};