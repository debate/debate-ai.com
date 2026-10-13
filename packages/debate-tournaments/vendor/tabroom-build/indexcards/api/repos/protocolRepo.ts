// @ts-nocheck
import type { Database } from '../data/database.js';
import type { Tiebreak } from '../data/schema.js';
import type { Selectable } from 'kysely';

type queryOpts = {
	noTiebreaks?: boolean;
};

type scopeOpts = {
	protocolId?: number;
	roundId?: number;
	tiebreakId?: number;
};

const buildProtocolQuery = (db: Database,opts = {}) => {
	let query = db.selectFrom('protocol');
	return query;
};

/*
 * Special case of returning just one
*/

export async function getProtocol(db: Database, protocolId: number, opts = {}) {
	const rsen = await getProtocols(db, { protocolId }, {...opts});
	if (rsen.length) return rsen[0];
	return;
};

/**
 * Fetches protocols from the database with optional filters and tiebreak
 * information.
 **/

export async function getProtocols(db: Database, scope: scopeOpts = {}, opts: queryOpts = {}) {

	type Protocol = {
		id: number;
		name: string;
		tourn: number;
		Tiebreaks?: Selectable<Tiebreak>[];
	};

	let query =  buildProtocolQuery(db, opts);

	if(scope.protocolId) {
		query = query.where('protocol.id', '=', scope.protocolId);
	}
	if(scope.roundId) {
		query = query
			.innerJoin('round', 'round.protocol', 'protocol.id')
		    .where('round.id', '=', scope.roundId);
	}
	if(scope.tiebreakId) {
		query = query
			.innerJoin('tiebreak', 'tiebreak.protocol', 'protocol.id')
			.where('tiebreak.id', '=', scope.tiebreakId);
	}

	const protocols = await query
		.select(['protocol.id', 'protocol.name', 'protocol.tourn'])
		.execute();

	if(!opts?.noTiebreaks) {

		let query =  db.selectFrom('tiebreak')
		.innerJoin('protocol', 'protocol.id', 'tiebreak.protocol');

		if(scope.protocolId) {
			query = query.where('protocol.id', '=', scope.protocolId);
		}
		if(scope.roundId) {
			query = query
				.innerJoin('round', 'round.protocol', 'protocol.id')
				.where('round.id', '=', scope.roundId);
		}
		if(scope.tiebreakId) {
			query = query
				.innerJoin('tiebreak', 'tiebreak.protocol', 'protocol.id')
				.where('tiebreak.id', '=', scope.tiebreakId);
		}

		const tiebreaks = await query
			.orderBy('protocol.id')
			.orderBy('tiebreak.priority')
			.selectAll('tiebreak')
			.execute();
		

		const tbs = tiebreaks.map( (tb) => {
			const booleanFields = ['truncate_smallest', 'violation'] as const;

			const numericFields = [
				'truncate',
				'count_round',
				'multiplier',
				'priority',
				'highlow_count',
				'highlow_threshold',
				'highlow_target',
				'child',
			] as const;

			const transformed = {
				...tb,
			};

			for (const tag of booleanFields) {
				if (tb[tag]) {
					transformed[tag] = 1;
				} else {
					delete transformed[tag];
				}
			}

			for (const tag of numericFields) {
				const value = tb[tag];

				if (value) {
					const parsed = Number(value);

					if (tag === 'count_round') {
						transformed.count_round = parsed;
					} else if (tag === 'highlow_count') {
						transformed.highlow_count = parsed;
					} else if (tag === 'highlow_threshold') {
						transformed.highlow_threshold = parsed;
					} else if (tag === 'highlow_target') {
						transformed.highlow_target = parsed;
					} else {
						transformed[tag] = parsed;
					}
				} else {
					delete transformed[tag];
				}
			}
			return transformed;
		});

		const protocolsWithTiebreaks = protocols?.map((protocol) => ({
			...protocol,
			Tiebreaks: tbs.filter(tb => tb.protocol === protocol.id) ?? [],
		}));
		return protocolsWithTiebreaks as Protocol[];
	}
	return protocols as Protocol[];
};

export default {
	getProtocol,
	getProtocols,
};