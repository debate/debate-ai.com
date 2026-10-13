// @ts-nocheck
import quizRepo from '../../repos/quizRepo.js';
import config from '../../config.js';

import { db } from '../../data/database.js';

import type { Request, Response } from '../../_shims/express.js';

async function getQuizzes(req: Request, res: Response) {
	//if a person is requesting, include their PersonQuiz data to determine if they've taken any quizzes or not
	const personId = req.actor?.Person?.id;

	const [ quizzes, personQuizzes ] = await Promise.all([
		quizRepo.getQuizzes(db,{
		limit: req.valid?.query?.limit ?? undefined,
		offset: req.valid?.query?.offset ?? undefined,
		publicOnly: true,
		}),
		 personId ? quizRepo.getPersonQuizzes(db,{
			person: personId,
		}) : null,
	]);
	res.json(quizzes.map(q => ({
		id: q.id,
		tag: q.tag,
		label: q.label,
		description: q.description,
		sitewide: q.sitewide,
		hidden: q.hidden,
		approval: q.approval,
		show_answers: q.show_answers,
		admin_only: q.admin_only,
		circuit: q.circuit === 0 ? null : q.circuit,
		Badge: {
			altText: q.badge_description || null,
			imageUrl: (q.id && q.badge) ? `${config.aws.s3_url}/badges/${q.id}/${q.badge}`
					: null,
			link: q.badge_link || null,
		},
		PersonQuizzes: personQuizzes?.filter(pq => pq.quiz === q.id).map(pq => ({
			id: pq.id,
			person: pq.person,
			quiz: pq.quiz,
			pending: pq.pending,
			approvedBy: pq.approved_by,
			updatedAt: pq.timestamp,
		})) ?? [],
	})));
};

export default {
	getQuizzes,
};
