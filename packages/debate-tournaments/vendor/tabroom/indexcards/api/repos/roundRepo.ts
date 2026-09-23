// @ts-nocheck
import { saveSettings, selectSettings } from './utils/settings.js';

import type { Database } from '../data/database.js';
import type { Round } from '../data/schema.js';
import type { Insertable } from 'kysely';
import type { Settings } from './utils/settings.js';

type queryOpts = {
	settings?: boolean | string[];
	fields?: string[];
	unpublished?: boolean;
	publicPrimaryResults?: boolean;
};

type RoundScope = {
	tournId?: number;
};

function buildRoundQuery(db: Database, opts: queryOpts) {
	let query = db.selectFrom('round')
	.$if(opts.settings !== undefined && opts.settings !== false, (q) => q.select(selectSettings({
		table: 'round',
		settings: opts.settings ?? false,
	})))

	if (!opts.unpublished) {
		query = query.where('round.published', '=', 1);
	}

	if (opts.publicPrimaryResults) {
		query = query
			.where('round.post_primary', '>=', 3)
			.where('round.published', '>', 0);
	}

	return query;
}

export async function getRound(
	db: Database,
	roundId: number,
	opts: queryOpts = {},
) {
	return await buildRoundQuery(db, opts)
		.where('round.id', '=', roundId)
		.selectAll('round')
		.executeTakeFirst();
}

export async function getRounds(
	db: Database,
	scope: RoundScope = {},
	opts: queryOpts = {},
) {
	let query = buildRoundQuery(db, opts);

	if (scope.tournId) {
		query = query
			.innerJoin('event', 'event.id', 'round.event')
			.where('event.tourn', '=', scope.tournId);
	}

	return await query.selectAll('round').execute();
}

export async function createRound(db: Database, data: Insertable<Round> & { settings?: Settings }) {
	const { settings, ...roundData } = data;

	return await db.transaction().execute(async (trx) => {
		if (Object.keys(roundData).length === 0) {
			throw new Error('createRound requires round data');
		}

		const round = await trx
			.insertInto('round')
			.values(roundData)
			.returningAll()
			.executeTakeFirstOrThrow();

		if (settings) {
			await saveSettings({
				db: trx,
				table: 'round',
				settings,
				ownerId: round.id,
			});
		}

		return round;
	});
}

export default {
	getRound,
	getRounds,
	createRound,
};
