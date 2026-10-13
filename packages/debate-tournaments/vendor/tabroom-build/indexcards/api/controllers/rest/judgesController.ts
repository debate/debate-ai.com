// @ts-nocheck
import judgeRepo from '../../repos/judgeRepo.js';
import chapterJudgeRepo from '../../repos/chapterJudgeRepo.js';
import { db } from '../../data/database.js';

import type { Request, Response } from '../../_shims/express.js';

async function unlinkedSearch(req: Request, res: Response) {
	let { first, last, limit, offset } = req.valid.query;

	if (!first || !last) {
		first = req.actor.Person?.first;
		last = req.actor.Person?.last;
	}

	const [unlinkedJudges, unlinkedChapterJudges] = await Promise.all([
		judgeRepo.unlinkedSearch(db,{ first, last },{ limit, offset }),
		chapterJudgeRepo.unlinkedSearch(db,{ first, last },{ limit, offset}),
	]);

	let results = [
	...unlinkedJudges.map(j => ({
		id: j.id,
		type: 'judge',
		first: j.first,
		last: j.last,
		tournName: j.tourn_name || null,
		schoolName: j.school_name || null,
	})),
	...unlinkedChapterJudges.map(cj => ({
		id: cj.id,
		type: 'chapter_judge',
		first: cj.first,
		last: cj.last,
		tournCount: Number(cj.tourn_count ?? 0),
		schoolName: cj.chapter_name || null,
	})),
	];
	return res.status(200).json(results);
}

export default {
	unlinkedSearch,
};