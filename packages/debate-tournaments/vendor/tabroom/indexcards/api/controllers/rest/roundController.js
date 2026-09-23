import { NotFound } from '../../helpers/problem.js';
import roundRepo from '../../repos/roundRepo.js';
import { entryWins } from '../../services/results/entryWins.js';
import { getSchematic } from '../pages/invite/schematController.js';
import { db } from '../../data/database.js';

export async function getPublishedRounds(req, res) {

	const rounds = await db
		.selectFrom('round')
		.innerJoin('event', 'round.event', 'event.id')
		.innerJoin('tourn', 'event.tourn', 'tourn.id')
		.selectAll('round')
		.select([
			'event.id as eventId',
			'event.name as eventName',
			'event.abbr as eventAbbr',
			'event.type as eventType',
			'event.level as eventLevel',
			'event.nsda_category as nsdaCategory',
		])
		.select((eb) => eb
			.selectFrom('event_setting as jpr')
			.select('jpr.value')
			.where('jpr.tag', '=', 'judge_publish_results')
			.whereRef('jpr.event', '=', 'round.event')
			.as('publishResults')
		)
		.where('round.published', '=', 1)
		.where('tourn.hidden', '!=', 1)
		.where('tourn.id', '=', req.params.tournId)
		.where(({ exists, selectFrom }) => exists(
			selectFrom('panel')
				.innerJoin('ballot', 'panel.id', 'ballot.panel')
				.select('panel.id')
				.whereRef('panel.round', '=', 'round.id')
				.where('ballot.entry', 'is not', null)
		))
		.execute();

	const mappedRounds = rounds.map( (round) => {
		return {
			'id'               : round.id,
			'type'             : round.type,
			'name'             : round.name,
			'label'            : round.label,
			'flighted'         : round.flighted,
			'postPrimary'      : round.post_primary,
			'postSecondary'    : round.post_secondary,
			'postFeedback'     : round.post_feedback,
			'published'        : round.published,
			'eventId'          : round.event,
			'protocolId'       : round.protocol_id,
			Event              : {
				'id'           : round.eventId,
				'name'         : round.eventName,
				'abbr'         : round.eventAbbr,
				'type'         : round.eventType,
				'level'        : round.eventLevel,
				'nsdaCategory' : round.nsdaCategory,
				Settings: {
					publishResults : round.publishResults,
				},
			},
		};
	});

	return res.status(200).json(mappedRounds);
};

export async function getPublishedRound(req,res) {

	const round = await roundRepo.getRound(db, req.params.roundId);

	if (!round) {
		return NotFound(req, res, `No round found with ID ${req.params.roundId}`);
	}

	// getRound() does not select the tournament, so look it up via the event.
	const roundEvent = await db
		.selectFrom('event')
		.select('event.tourn')
		.where('event.id', '=', round.event)
		.executeTakeFirst();

	if (Number(roundEvent?.tourn) !== Number(req.params.tournId)) {
		return NotFound(req, res,
			`No round found with ID ${req.params.roundId} belonging to tournament ${req.params.tournId}`
		);
	}

	delete round.tournId;
	delete round.pods;
	delete round.noJudgeCodes;
	delete round.sidelockElims;
	delete round.noSideConstraints;
	delete round.affLabel;
	delete round.negLabel;
	delete round.showSectionLetters;
	delete round.includeRoomNotes;
	delete round.useNormalRooms;

	return res.status(200).json(round);
}

export async function getPublishedSchematic(req,res) {
	return getSchematic(req,res);
}

export async function getPublishedBrackets(req, res) {
	const records = await entryWins({
		...req.params,
	});
	console.log(records);
	console.log('end of records');
	return res.status(200).json(records);
}

export async function getPublishedResults(req, res) {

}
