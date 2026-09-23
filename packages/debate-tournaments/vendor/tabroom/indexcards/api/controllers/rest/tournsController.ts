// @ts-nocheck
import { NotFound } from '../../helpers/problem.js';
import tournRepo from '../../repos/tournRepo.js';
import eventRepo from '../../repos/eventRepo.js';
import webpageRepo from '../../repos/webpageRepo.js';
import fileRepo from '../../repos/fileRepo.js';

//TODO remove all references
import { db }  from '../../data/database.js';
import type { Request, Response } from '../../_shims/express.js';

export async function getTourn(req: Request, res: Response) {
	var tourn = req.tourn;
	return res.status(200).json(tourn);
};

export async function getTourns(req: Request, res: Response) {

	const query = req.valid.query;

	const tourns = await tournRepo.getTourns(db,{
		hasPublishedResults: query.publishedResults,
		circuit: query.circuit,
		startBefore: query.startBefore,
		startAfter: query.startAfter,
		limit: query.limit,
		offset: query.offset,
	});

	return res.json(tourns);
}

export async function getTournInvite(req: Request, res: Response) {

	let invite = await tournRepo.getTourn(db, Number(req.params.tournId));

	if (!invite?.id || invite?.hidden) {
		return NotFound(req, res, 'No such tournament found');
	}

	const [Files, Webpages, Events, Contacts] = await Promise.all([
		fileRepo.getFiles(db, { tourn: invite.id }),
		webpageRepo.getWebpages(db, { tourn: invite.id }),
		eventRepo.getEventsForInvite(db,invite.id),
		tournRepo.getContacts(db, invite.id),
	]);
	
	const response = {
		...invite,
		Files,
		Webpages,
		Events,
		Contacts,
	};
	return res.status(200).json(response);
};

export async function getSchedule(req: Request, res: Response){
	const schedule = await tournRepo.getSchedule(db, Number(req.params.tournId));
	return res.status(200).json(schedule);
};

export async function getPublishedFiles(req: Request, res: Response) {
	const files = await fileRepo.getFiles(db, { tourn: Number(req.valid.params.tournId) });
	return res.status(200).json(files);
};

export async function getTournPublishedResults(req: Request, res: Response) {
	const results = await db
	.selectFrom('result_set')
	.innerJoin('tourn', 'tourn.id', 'result_set.tourn')
	.leftJoin('event', join =>
		join
			.onRef('result_set.event', '=', 'event.id')
			.on('event.type', '!=', 'attendee')
	)
	.leftJoin('sweep_set', 'result_set.sweep_set', 'sweep_set.id')
	.leftJoin('sweep_award', 'sweep_award.id', 'sweep_set.sweep_award')
	.select([
		'result_set.id',
		'result_set.label as name',
		'result_set.bracket',
		'result_set.generated',
		'result_set.published',
		'result_set.coach',

		'event.id as eventId',
		'event.name as eventName',
		'event.abbr as eventAbbr',
		'event.type as eventType',

		'sweep_set.id as sweepSetId',
		'sweep_set.name as sweepSetName',

		'sweep_award.id as sweepAwardId',
		'sweep_award.name as sweepAwardName',
	])
	.where('result_set.tourn', '=', Number(req.params.tournId))
	.where('result_set.published', '=', 1)
	.where('tourn.hidden', '=', 0)
	.execute();

	res.status(200).json(results);
};