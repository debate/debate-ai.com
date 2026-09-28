// @ts-nocheck
import circuitRepo from '../../repos/circuitRepo.js';
import { schoolYearDateRange } from '../../helpers/dateTime.js';
import { NotFound } from '../../helpers/problem.js';
import { db } from '../../data/database.js'; 

import type { Request, Response } from '../../_shims/express.js';

export async function getCircuit(req: Request, res: Response) {
	const circuit = await circuitRepo.getCircuit(db, Number(req.params.circuitId), {
		active: true,
	});
	if (!circuit) return NotFound(req, res, 'No such circuit found');
	return res.json(circuit);
}

export async function activeCircuits(req: Request, res: Response) {
	const { state, country, limit, offset } = req.valid.query;
	const { start, end } = schoolYearDateRange();
	const circuits = await circuitRepo.getActiveCircuits(db,{
		startDate: start,
		endDate: end,
		state,
		country,
		limit,
		offset,
	});

	return res.json(circuits.map(c => {
		return {
			id: c.id,
			name: c.name,
			abbr: c.abbr,
			state: c.state,
			country: c.country,
			tournCount: c.tourns,
		};
	}));
}