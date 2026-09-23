// @ts-nocheck
import personRepo from '../../repos/personRepo.js';
import { getJudgesForPersons } from '../../repos/judgeRepo.js';
import { NotFound } from '../../helpers/problem.js';
import config from '../../config.js';
import { judgeRecord } from '../../services/results/judgeRecords.js';
import { db } from '../../data/database.js';
import type { Request, Response } from '../../_shims/express.js';

async function getParadigms(req: Request, res: Response) {
	//get the search query from the query params
	const { search, limit = 50, offset = 0 } = req.valid.query;

	const paradigms = await personRepo.personSearch(db, search ?? '', {
		excludeBanned: true,
		excludeUnconfirmedEmail: true,
		hasValidParadigm: true,
		hasJudged: true,
		limit: limit,
		offset: offset,
	});
	if (!paradigms || paradigms.length === 0) {
		return res.json([]);
	}
	const Judges = await getJudgesForPersons(db, paradigms.map(p => p.id));
	const results = paradigms.map(p => {
		const nameParts = [p.first, p.middle, p.last].filter(Boolean);
		const judges = Judges[p.id] ?? [];
	
		// Only judges from the last five years with a school
		const fiveYearsAgo = new Date();
		fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
	
		const schools = judges
		//TODO remove when the judgeRepo is ts
		// oxlint-disable-next-line typescript/no-explicit-any
			.filter((j: any) =>
				j.School &&
				j.created_at &&
				new Date(j.created_at) >= fiveYearsAgo
			)
			//TODO remove when the judgeRepo is ts
			// oxlint-disable-next-line typescript/no-explicit-any
			.map((j: any) => ({
				id: j.School.id,
				name: j.School.name,
			}));
	
		// Deduplicate schools by name
		const distinctSchools = Array.from(
			//TODO remove when the judgeRepo is ts
			// oxlint-disable-next-line typescript/no-explicit-any
			new Map(schools.map((s: any) => [s.name, s])).values()
		);
	
		return {
			id: p.id,
			name: nameParts.join(' '),
			tournJudged: judges.length,
			schools: distinctSchools,
		};
	});
	res.json(results);
};

async function getParadigmByPersonId(req: Request, res: Response) {
	const { personId } = req.valid.params;
	const person = await personRepo.getPerson(db, personId, {
		excludeBanned: true,
		excludeUnconfirmedEmail: true,
		hasValidParadigm: true,
		settings: ['paradigm'],
	});
	
	if (!person) {
		return NotFound(req, res, 'Person not found or does not have a valid paradigm');
	}
	
	const certifications = await db
		.selectFrom('person_quiz')
		.innerJoin('quiz', 'quiz.id', 'person_quiz.quiz')
		.select([
			'person_quiz.id',
			'person_quiz.person',
			'person_quiz.quiz',
			'person_quiz.pending',
			'person_quiz.approved_by',
			'person_quiz.updated_at',
	
			'quiz.id as quizId',
			'quiz.tag',
			'quiz.label',
			'quiz.description',
			'quiz.badge_description',
			'quiz.badge',
			'quiz.badge_link',
			'quiz.circuit',
		])
		.where('person_quiz.person', '=', personId)
		.where('person_quiz.hidden', '=', 0)
		.where('person_quiz.pending', '=', 0)
		.execute();

		res.json({
			id: person.id,
			name: [person.first, person.middle, person.last]
				.filter(Boolean)
				.join(' '),
		
			lastReviewed: person.settingsTimestamps?.paradigm.timestamp
				? new Date(person.settingsTimestamps?.paradigm.timestamp).toISOString()
				: null,
		
			paradigm: person.settings?.paradigm || null,
		
			certifications: certifications.map((cert) => ({
				id: cert.quizId,
				tag: cert.tag,
				label: cert.label,
				description: cert.description,
				circuit: cert.circuit,
		
				Badge: {
					altText: cert.badge_description || null,
					imageUrl: cert.quizId && cert.badge
						? `${config.aws.s3_url}/badges/${cert.quizId}/${cert.badge}`
						: null,
					link: cert.badge_link || null,
				},
		
				PersonQuizzes: [{
					id: cert.id,
					person: cert.person,
					quiz: cert.quiz,
					pending: cert.pending,
					approvedBy: cert.approved_by,
					updatedAt: cert.updated_at,
				}],
			})),
		});
};
/**
 *  Get a judges public debate judging record to display on the paradigm details page
 */
async function getJudgingRecord(req: Request, res: Response) {
	const { personId } = req.valid.params;

	const record = await judgeRecord(personId);

	let response = record.map(r =>
		Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? '']))
	);
	response = record.map(r => r);

	res.json(response);
}

export default {
	getParadigms,
	getParadigmByPersonId,
	getJudgingRecord,
};
