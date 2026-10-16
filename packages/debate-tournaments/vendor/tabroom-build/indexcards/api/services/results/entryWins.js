/* Record Service calculates the win/loss record of entries given an eventID and and
 * optional round name delimiter (up to and including Round 4, eg).  It returns
 * an object of entryID keyed entry records. */
import roundRepo from '../../repos/roundRepo.js';
import { db } from '../../data/database.js';

export const entryWins = async ({eventId, roundId, ...options}) => {

	const replacements = {};

	// This has to be filled in by whatever convoluted bullshit RT did to auth :)
	replacements.postLevel = '3';
	if (options.isCoach) replacements.postLevel = 1;
	if (options.isEntry) replacements.postLevel = 2;

	if (roundId) {
		const round = await roundRepo.getRound(db, roundId);

		if (!round) return {error: 'No such round found'};

		replacements.eventId   = eventId || round.Event?.id;
		replacements.roundName = round.name;
		if (options.includePresent) replacements.roundName = parseInt(round.name) + 1;

	} else if (eventId) {
		replacements.eventId   = eventId;
	} else {
		return {error: 'Improper parameters sent so I cannot find results for you.'};
	}

	let resultsQuery = db
		.selectFrom('entry')
		.innerJoin('ballot', 'ballot.entry', 'entry.id')
		.innerJoin('panel', 'panel.id', 'ballot.panel')
		.innerJoin('round', 'round.id', 'panel.round')
		.leftJoin('score as winloss', (join) => join
			.onRef('winloss.ballot', '=', 'ballot.id')
			.on('winloss.tag', '=', 'winloss')
		)
		.select([
			'entry.id as id',
			'entry.code as code',
			'round.id as roundId',
			'round.type as roundType',
			'round.name as roundName',
			'panel.bye as panelBye',
			'ballot.bye as bye',
			'ballot.forfeit as forfeit',
			'ballot.chair as chair',
			'winloss.id as winlossExists',
			'winloss.value as winloss',
		])
		.select((eb) => eb
			.selectFrom('event_setting as bb')
			.select('bb.value')
			.whereRef('bb.event', '=', 'round.event')
			.where('bb.tag', '=', 'bracket_by_ballots')
			.as('byBallots')
		)
		.where('round.event', '=', replacements.eventId)
		.where('round.post_primary', '=', replacements.postLevel)
		.where(({ not, exists, selectFrom }) => not(exists(
			selectFrom('round_setting as rs')
				.select('rs.id')
				.where('rs.tag', '=', 'ignore_results')
				.whereRef('rs.round', '=', 'round.id')
		)));

	if (replacements.roundName !== undefined) {
		resultsQuery = resultsQuery.where('round.name', '<', replacements.roundName);
	}

	const resultsData = await resultsQuery.execute();
	const byBallots = resultsData.some((row) => {
		const value = row.byBallots;
		return value === true || value === 'true' || Number(value) > 0;
	});

	// First aggregate the ballots by round so we can tell who won or lost a
	// given round because their ballot count is higher.  this is a silly step
	// for the ordinary case where there's just one judge, but necessary if
	// there is more than one.
	const recordByRound = {};

	resultsData.forEach( (entry) => {

		if (!recordByRound[entry.id]) {
			recordByRound[entry.id] = {
				code: entry.code,
				rounds: {},
			};
		}

		let record = recordByRound[entry.id].rounds[entry.roundId];

		if (!record) {
			record = {
				name         : entry.roundName,
				type         : entry.roundType,
				ballotWins   : 0,
				ballotLosses : 0,
				record       : '',
			};
		}

		// The affirmative existence of a score overrides even a bye/forfeit
		if (entry.winlossExists) {

			if (entry.winloss) {
				record.ballotWins++;
			} else {
				record.ballotLosses++;
			}

			if (entry.panelBye || entry.bye) record.bye = true;
			if (entry.forfeit) record.forfeit = true;

		} else {
			if (entry.panelBye || entry.bye) {
				record.bye = true;
				record.ballotWins++;
			} else {
				record.forfeit = true;
				record.ballotLosses++;
			}
		}

		recordByRound[entry.id].rounds[entry.roundId] = { ...record };
	});

	// Now process the aggregated per-round data into meaningful results for
	// the end users. It used to be options would give back different answers
	// but I think moving to a full object that can be parsed later is
	// healthier now.
	const entries = {};
	let splits = false;

	Object.keys(recordByRound).forEach( (entryId) => {

		const records = recordByRound[entryId];
		let entry = entries[entryId];

		if (!entry) {
			entry = {
				code         : records.code,
				wins         : 0,
				losses       : 0,
				splits       : 0,
				byes         : 0,
				forfeits     : 0,
				ballotWins   : 0,
				ballotLosses : 0,
				record       : '',  // 3-0, 4-2, etc
				rounds       : records.rounds,
			};
		}

		Object.keys(records.rounds).forEach((entryRoundId) => {

			const round = records.rounds[entryRoundId];
			let roundType = 'prelim';
			if (['final', 'elim', 'runoff'].includes(round.type)) roundType = 'elim';

			if (!entry[roundType] || !entry[roundType].wins) {
				entry[roundType] = {
					wins         : 0,
					losses       : 0,
					splits       : 0,
					ballotWins   : 0,
					ballotLosses : 0,
					record       : '',  // 3-0, 4-2, etc
				};
			};

			if (byBallots) {

				entry.wins += round.ballotWins;
				entry.losses += round.ballotLosses;
				entry.ballotWins += round.ballotWins;
				entry.ballotLosses += round.ballotLosses;

				entry[roundType].wins += round.ballotWins;
				entry[roundType].losses += round.ballotLosses;
				entry[roundType].ballotWins += round.ballotWins;
				entry[roundType].ballotLosses += round.ballotLosses;

			} else {

				if (round.ballotWins > round.ballotLosses) {
					entry[roundType].wins++;
					entry.wins++;
					round.record = `${round.ballotWins}-${round.ballotLosses}`;
				} else if (round.ballotWins === round.ballotLosses) {
					entry[roundType].splits++;
					entry.splits++;
					splits = true;
				} else {
					entry.losses++;
					entry[roundType].losses++;
				}

				if (round.bye) entry.bye++;
				if (round.forfeit) entry.forfeit++;

				entry.ballotWins += round.ballotWins;
				entry.ballotLosses += round.ballotLosses;
				entry[roundType].ballotWins += round.ballotWins;
				entry[roundType].ballotLosses += round.ballotLosses;
			}

		});
		// not necessary but makes it clearer this was intended
		entries[entryId] = entry;
	});

	// A bit stupid but I'd rather do this once here than sixty eight times in
	// front end code.

	Object.keys(recordByRound).forEach( (entryId) => {
		const entry = entries[entryId];

		entry.record = `${entry.wins}-`;
		entry.record += `${entry.losses}`;
		if (splits) entry.record += `-${entry.splits}`;

		if (entry.prelim) {
			entry.prelim.record = `${entry.prelim.wins}-`;
			entry.prelim.record += `${entry.prelim.losses}`;
			if (splits) entry.prelim.record += `-${entry.prelim.splits}`;
		}

		if (entry.elim) {
			entry.elim.record = `${entry.elim.wins}-`;
			entry.elim.record += `${entry.elim.losses}`;
			if (splits) entry.elim.record += `-${entry.elim.splits}`;
		}

		// not necessary but makes it clearer this was intended
		entries[entryId] = entry;
	});

	return entries;
};

export default {
	entryWins,
};
