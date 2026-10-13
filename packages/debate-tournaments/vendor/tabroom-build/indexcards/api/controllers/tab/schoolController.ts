// @ts-nocheck
import { NotFound, NotImplemented } from '../../helpers/problem.js';
import schoolRepo from '../../repos/schoolRepo.js';
import { db } from '../../data/database.js';

import type { Request, Response } from '../../_shims/express.js';

export async function getSchool(req: Request, res: Response) {
	const tournId = Number(req.params.tournId);
	const schoolId = Number(req.params.schoolId);

	const school = await schoolRepo.getSchool(db, schoolId, { tourn: tournId });
	if (!school) {
		return NotFound(req, res, `School with id ${schoolId} not found in tournament ${tournId}.`);
	}
	return res.json(school);
}

export async function getSchools(req: Request, res: Response) {
	const tournId = Number(req.params.tournId);

	const schools = await schoolRepo.getSchools(db, { tourn: tournId });
	return res.json(schools);
}

export async function createSchool(req: Request, res: Response) {
	return NotImplemented(req, res);
}

export async function updateSchool(req: Request, res: Response) {
	return NotImplemented(req, res);
}

export async function deleteSchool(req: Request, res: Response) {
	return NotImplemented(req, res);
}