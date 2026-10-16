// @ts-nocheck
import type { Insertable, Updateable } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../data/database.js';
import type { ChapterJudge } from '../data/schema.js';

type queryOpts = {
	limit?: number;
	offset?: number;
	person?: number;
	person_request?: number;
};

function buildChapterJudgeQuery(db: Database, opts: queryOpts = {}) {
	let query = db.selectFrom('chapter_judge');

	if (opts.limit) query = query.limit(opts.limit);
	if (opts.offset) query = query.offset(opts.offset);
	if (opts.person) query = query.where('chapter_judge.person', '=', opts.person);
	if (opts.person_request) query = query.where('chapter_judge.person_request', '=', opts.person_request);

	return query;
}

async function getChapterJudge(db: Database, id: number, opts: queryOpts = {}) {
	return await buildChapterJudgeQuery(db, opts)
	.where('id', '=', id)
	.selectAll('chapter_judge')
	.executeTakeFirst();
}
async function getChapterJudges(db: Database, opts: queryOpts = {}) {
	return await buildChapterJudgeQuery(db, opts)
	.selectAll('chapter_judge')
	.execute();
}

async function createChapterJudge(db: Database, data: Insertable<ChapterJudge>) {
	return await db.insertInto('chapter_judge')
	.values(data)
	.returningAll()
	.executeTakeFirstOrThrow();
}
async function updateChapterJudge(db: Database, id: number, data: Updateable<ChapterJudge>) {
	return await db.updateTable('chapter_judge')
	.set(data)
	.where('id', '=', id)
	.executeTakeFirstOrThrow();
}
async function unlinkedSearch(db: Database, { first, last }: { first?: string | null; last?: string | null }, opts: queryOpts & { notRequestedBy?: number | null } = {}) {
	return await buildChapterJudgeQuery(db, opts)
		.leftJoin('chapter', 'chapter_judge.chapter', 'chapter.id')
		.leftJoin('judge', 'judge.chapter_judge', 'chapter_judge.id')
		.leftJoin('category', 'judge.category', 'category.id')
		.select([
			'chapter_judge.id',
			'chapter_judge.first',
			'chapter_judge.middle',
			'chapter_judge.last',
			sql<string>`chapter.name`.as('chapter_name'),
			sql<number>`COUNT(DISTINCT category.tourn)`.as('tourn_count')
		])
		.where((eb) => {
			const conditions = [
				eb.or([
					eb('chapter_judge.person', '=', 0),
					eb('chapter_judge.person', 'is', null)
				]),
				eb.or([
					eb('chapter_judge.person_request', 'is', null),
					eb('chapter_judge.person_request', '!=', opts.notRequestedBy ?? null)
				])
			];

			if (first) {
				conditions.push(eb('chapter_judge.first', 'like', `${first}%`));
			}
			if (last) {
				conditions.push(eb('chapter_judge.last', 'like', `${last}%`));
			}

			return eb.and(conditions);
		})
		.groupBy([
			'chapter_judge.id',
			'chapter_judge.first',
			'chapter_judge.middle',
			'chapter_judge.last',
			sql.ref('chapter.name')
		])
		.orderBy('chapter_judge.last', 'asc')
		.orderBy('chapter_judge.first', 'asc')
		.execute();
};

export default {
	getChapterJudge,
	getChapterJudges,
	createChapterJudge,
	updateChapterJudge,
	unlinkedSearch,
};
