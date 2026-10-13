// @ts-nocheck
import type { Database } from '../data/database.js';
import { sql, type Insertable, type Updateable } from 'kysely';
import type { Ballot } from '../data/schema.js';

type queryOpts = {
	winnerBallot?: boolean;
	panel?: number;
	judge?: number;
	// Locks the rows until the transaction ends. Only use inside a transaction
	forUpdate?: boolean;
};
function buildBallotQuery(db: Database, opts: queryOpts = {}){
	let query  = db.selectFrom('ballot');

	query = opts.panel ? query.where('panel', '=', opts.panel) : query;
	query = opts.judge ? query.where('judge', '=', opts.judge) : query;
	query = opts.forUpdate ? query.forUpdate() : query;
	if (opts.winnerBallot) {
		query = query.innerJoin('score', 'ballot.id', 'score.ballot')
		.where('score.tag', '=', 'winloss')
		.where('score.value', '=', 1);
	}
	return query;
}

export async function getBallot(db: Database, id: number, opts: queryOpts = {}) {
	return await buildBallotQuery(db, opts)
	.selectAll('ballot')
	.where('ballot.id', '=', id)
	.executeTakeFirst();
}

export async function getBallots(db: Database, opts: queryOpts = {}) {
	return await buildBallotQuery(db, opts)
	.selectAll('ballot')
	.execute();
}
export async function createBallot(db: Database, data: Insertable<Ballot> = {}){
	return await db.insertInto('ballot')
	.values(data)
	.returningAll()
	.executeTakeFirstOrThrow();
}

export async function updateBallots(db: Database, ids: number[], data: Updateable<Ballot>) {
	if (ids.length === 0) return ids;
	await db.updateTable('ballot')
	.set(data)
	.where('id', 'in', ids)
	.execute();
	return ids;
}

// Sets who started the judge's ballot rows on the panel and when, on rows not started yet.
// Returns whether any row changed
export async function markBallotsStarted(db: Database, opts: { judge: number, panel: number, person: number }) {
	const result = await db.updateTable('ballot')
	.set({ started_by: opts.person, judge_started: sql<Date>`NOW()` })
	.where('judge', '=', opts.judge)
	.where('panel', '=', opts.panel)
	.where('judge_started', 'is', null)
	.executeTakeFirst();
	return result.numUpdatedRows > 0;
}

export async function deleteBallots(db: Database, ids: number[]) {
	if (ids.length === 0) return false;
	const result = await db.deleteFrom('ballot')
	.where('id', 'in', ids)
	.executeTakeFirst();
	return result.numDeletedRows > 0;
}

export default {
	getBallot,
	getBallots,
	createBallot,
	updateBallots,
	markBallotsStarted,
	deleteBallots,
};