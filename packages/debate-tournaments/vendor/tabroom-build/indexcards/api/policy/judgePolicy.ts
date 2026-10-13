// @ts-nocheck
import ballotRepo from '../repos/ballotRepo.js';
import { NotFound } from '../helpers/problem.js';

import type { Request, Response, NextFunction } from '../_shims/express.js';

/**
 * 404 unless the :judgeId judge has a ballot on the :panelId panel.
 * expects both params to be validated already by their auth context loaders
 */
export async function requireJudgeOnPanel(req: Request, res: Response, next: NextFunction) {
	// anonymous callers get their 401 from the route rather than learning which ballots exist
	if (req.actor.type === 'anonymous') return next();

	const judgeId = Number(req.params.judgeId);
	const panelId = Number(req.params.panelId);

	try {
		const ballots = await ballotRepo.getBallots(req.db, { judge: judgeId, panel: panelId });
		if (ballots.length === 0) {
			return NotFound(req, res, `Judge ${judgeId} has no ballot on panel ${panelId}`);
		}
		next();
	} catch (err) {
		next(err);
	}
}
