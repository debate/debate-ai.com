// @ts-nocheck
import judgeRepo from '../../../repos/judgeRepo.js';
import chapterJudgeRepo from '../../../repos/chapterJudgeRepo.js';
import { db } from '../../../data/database.js';

import type { Response } from '../../../_shims/express.js';
import type { ValidatedRequest } from '../../../middleware/validation.js';
import { getPerson } from '../../../middleware/auth/authorization.js';

async function unlinkedSearch(req: ValidatedRequest, res: Response) {
	const person = getPerson(req);
	let { first, last, limit, offset } = req.query;

	if (!first || !last) {
		first = person.first;
		last = person.last;
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