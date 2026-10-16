// @ts-nocheck
import type { Database } from '../data/database.js';
import type { Quiz } from '../data/schema.js';
import type { Insertable } from 'kysely';

type queryOpts = {
	limit?: number;
	offset?: number;
	/** returns only quizzes with hidden: false, sitewide: true, and admin_only: false */
	publicOnly?: boolean;
};
function buildQuizQuery(db: Database, opts: queryOpts = {}) {
	let query = db.selectFrom('quiz');

	if (opts.limit) query = query.limit(Number(opts.limit));
	if (opts.offset) query = query.offset(Number(opts.offset));
	if (opts.publicOnly) {
		query = query.where('hidden', '=', 0)
			.where('sitewide', '=', 1)
			.where('admin_only', '=', 0);
	}

	return query;
}

async function getQuizzes(db: Database, opts: queryOpts = {}) {
	return await buildQuizQuery(db,opts)
	.selectAll('quiz')
	.execute();
}

async function createQuiz(db: Database, data: Insertable<Quiz>) {
	return await db.insertInto('quiz')
	.values(data)
	.returningAll()
	.executeTakeFirstOrThrow();
} 
async function getPersonQuizzes(db: Database, opts: { person: number }) {
	return await db.selectFrom('person_quiz')
	.where('person', '=', opts.person)
	.selectAll()
	.execute();
}

export default {
	getQuizzes,
	createQuiz,
	getPersonQuizzes,
};