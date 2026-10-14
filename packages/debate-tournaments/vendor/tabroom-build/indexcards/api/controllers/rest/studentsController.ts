// @ts-nocheck
import changeLogRepo from '../../repos/changeLogRepo.js';
import studentRepo from '../../repos/studentRepo.js';
import logger from '../../helpers/logger.js';
import personRepo from '../../repos/personRepo.js';
import { RateLimitExceeded } from '../../helpers/problem.js';

import type { Response } from '../../_shims/express.js';
import type { ValidatedRequest } from '../../middleware/validation.js';
import type { AuthInfo, SessionPerson } from '../../middleware/auth/types.js';
import { getPerson } from '../../middleware/auth/authorization.js';

import { db } from '../../data/database.js';

const STUDENT_SEARCH_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const STUDENT_SEARCH_LIMIT_MAX = 9;

export async function unlinkedSearch(req: ValidatedRequest, res: Response) {
	const person = getPerson(req);
	let { first, last, limit, offset } = req.query;

	if (!first || !last) {
		first = person.first;
		last = person.last;
	}
	// log access to student search to the change log
	logStudentSearch(req.auth, person, first, last).catch(err => {
		logger.error('Failed to log student search usage to changeLog:', err);
	});

	// if person is not site admin, apply rate limiting logic via person settings
	if (!person.site_admin) {
		const Person = await personRepo.getPerson(db,person.id, {
			settings: ['last_student_search', 'student_search_count'],
		});

		const lastSearch = Person?.settings?.last_student_search ? new Date(Person.settings.last_student_search) : null;
		const studentSearchCount = Number(Person?.settings?.student_search_count || 0);
		const now = new Date();
		const then = new Date(now.getTime() - STUDENT_SEARCH_LIMIT_WINDOW_MS);

		if (
			lastSearch
      && !Number.isNaN(lastSearch.getTime())
      && lastSearch > then
      && studentSearchCount > STUDENT_SEARCH_LIMIT_MAX
		) {
			return RateLimitExceeded(req, res,
				'Due to privacy concerns, you may only search for student records a few times every 24 hours.',
				{ validate: { trustProxy: false } }
			);
		}

		const nextStudentSearchCount = studentSearchCount + 1

		await personRepo.updatePerson(db, person.id, {
			settings: {
				student_search_count: nextStudentSearchCount,
				last_student_search: now,
			}
		});
	}

	const results = await studentRepo.unlinkedSearch(db,{ first, last }, { limit, offset });

	res.json(results.map(s => ({
		id: s.id,
		first: s.first,
		middle: s.middle,
		last: s.last,
		gradYear: s.grad_year ?? null,
		Chapter: {
			name: s.chapter_name,
			state: s.chapter_state,
		},
		tournCount: s.tourn_count,
	})));
}

async function logStudentSearch(auth: AuthInfo, person: SessionPerson, first: string, last: string) {
	let description = `Searched for student records ${first} ${last}`;

	if (auth.su) {
		description += ` by ${auth.su.email} while su'd as ${person.email}`;
	}

	description += ` from session ID ${auth.sessionId}`;

	await changeLogRepo.createChangeLog(db,{
		tag: 'student_search',
		person: person.id,
		description,
	});
}
