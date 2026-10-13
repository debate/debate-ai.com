// @ts-nocheck
import tournRepo from '../repos/tournRepo.js';
import { NotFound, BadRequest } from '../helpers/problem.js';
import { db } from '../data/database.js';

import type { Request, Response, NextFunction } from '../_shims/express.js';
export async function requirePublicTourn(req: Request, res: Response, next: NextFunction) {

	if (!req.params.tournId) return BadRequest(req,res,'you must provide a tourn ID');

	const tourn = await tournRepo.getTourn(db, req.params.tournId as string);

	if (!tourn?.id || tourn?.hidden) {
		return NotFound(req, res, 'No such tournament found');
	}
	req.tourn = tourn;
	next();
}