// @ts-nocheck
// Translation of the tb_types.mas from legacy.  When given the ID of a round,
// this service delivers all of the various tiebreaker type that round's
// tiebreakers require to figure, telling us what to ask for on ballots etc.

// TODO: this one is going to need some pretty extensive testing because it's a
// big ol' logic bomb in the middle of tabroom for a bunch of functions.

import { db } from '../../data/database.js';
//import { db as kyselyDb } from '../../data/database.js';
import { getRound } from '../../repos/roundRepo.js';
import { getProtocol, getProtocols } from '../../repos/protocolRepo.js';

export type Counted = {
	tv?: boolean,
	rank?: boolean,
	entryWinloss?: boolean,
	entryRank?: boolean,
	bestPO?: boolean,
	winloss?: boolean,
	point?: boolean,
	refute?: boolean,
};

export const tiebreakTypes = async ({roundId, protocolId = false}: {
	roundId: number,
	protocolId?: number | false,
}) => {

	// Ballots and results can be entered before a round is published
	const round = await getRound(db, roundId, { unpublished: true });

	if(!round){
		throw new Error(`Round with ID ${roundId} not found`);
	}

	if ( ['highlow', 'highhigh', 'snaked_prelim'].includes(round.type ?? '')) {
		round.type = 'prelim';
	}

	const eventDetails = await db
		.selectFrom('round')
		.innerJoin('event', 'event.id', 'round.event')
		.leftJoin('event_setting as es', (join) => join
			.onRef('es.event', '=', 'event.id')
			.on('es.tag', 'in', [
				'leadership_protocol',
				'final_bowl_protocol',
				'po_protocol',
				'speaker_protocol',
			])
		)
		.select([
			'round.id as roundId',
			'es.tag as protocolType',
			'es.value as protocolId',
		])
		.select((eb) => [
			eb
				.selectFrom('event_setting as wsdc')
				.select('wsdc.value')
				.whereRef('wsdc.event', '=', 'event.id')
				.where('wsdc.tag', '=', 'wsdc_ballot')
				.as('wsdc'),
			eb
				.selectFrom('round_setting as rs')
				.select('rs.value')
				.whereRef('rs.round', '=', 'round.id')
				.where('rs.tag', '=', 'leadership_protocol')
				.as('roundLeadership'),
		])
		.selectAll('event')
		.where('round.id', '=', roundId)
		.executeTakeFirstOrThrow();

	let protocols: NonNullable<Awaited<ReturnType<typeof getProtocol>>>[] = [];

	if (protocolId) {
		const specifiedProtocol = await getProtocol(db, protocolId);
		protocols = specifiedProtocol ? [specifiedProtocol] : [];
		protocols = protocols.filter(Boolean);
	} else {

		protocols = await getProtocols(db, {roundId});
		let roundLeadDone = false;

		for (const event of [eventDetails]) {

			if (event.roundLeadership && !roundLeadDone) {
				const roundProtocol = await getProtocol(db, Number(event.roundLeadership));
				if(roundProtocol) protocols.push(roundProtocol);
				roundLeadDone = true;
			}

			if (
				event.protocolId
				&& (event.protocolType !== 'speaker_protocol' || round.type === 'prelim')
			) {
				const specialProtocol = await getProtocol(db, Number(event.protocolId));
				if(specialProtocol) protocols.push(specialProtocol);
			}
		};
	}

	const counted: Counted = {};

	//const Tiebreaks = await getTiebreaks(db, { protocols: protocols.map(p => p.id) });

	for (const protocol of protocols) {

		for (const tiebreak of protocol.Tiebreaks ?? []) {

			if (
				tiebreak.count !== 'all'
				&& tiebreak.count !== 'previous'
				&& tiebreak.count !== round.type
				&& !(tiebreak.count === 'specific' && tiebreak.count_round === round.name)
			) {
				continue;
			};

			if (['ranks',
				'reciprocals',
				'opp_ranks',
				'chair_ranks',
				'non_chair_ranks',
				'downs',
				'preponderance',
				'judgepref',
			].includes(tiebreak.name ?? '')
			) {
				counted.rank = true;
			}

			if (['entry_vote_one', 'entry_vote_all'].includes(tiebreak.name ?? '')) {
				counted.entryWinloss = true;
			}

			if (['student_rank', 'student_recip'].includes(tiebreak.name ?? '')) {
				counted.entryRank = true;
			}

			if (['best_po'].includes(tiebreak.name ?? '')) {
				counted.bestPO = true;
			}

			if (['opp_wins', 'opp_ballots', 'winloss', 'ballots', 'losses', 'headtohead'].includes(tiebreak.name ?? '')) {
				counted.winloss = true;
			}

			if (['points',
				'opp_points',
				'po_points',
				'three_way_point',
				'judgevar',
				'judgevar2',
				'refute',
			].includes(tiebreak.name ?? '')) {
				counted.point = true;

				if (eventDetails.type === 'wsdc') {
					counted.refute = true;
				}
			}
		}
	}

	// TODO: port tv (time violations) from tiebreak_types.mas. Stubbed off until then
	counted.tv = false;

	return counted;
};
