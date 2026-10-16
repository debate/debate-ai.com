import { sql } from 'kysely';
import { db } from '../../../data/database.js';
import { parseDateTime } from '../../../helpers/dateTime.js';
import { NotFound } from '../../../helpers/problem.js';
import { publishLevel, snakeToCamel } from '../../../helpers/text.js';
import { selectSettings } from '../../../repos/utils/index.js';
import { entryWins } from '../../../services/results/entryWins.js';

export async function getSchematic (req,res) {

	const finders = [];

	if (req.params.eventId) finders.push(sql` and event.id = ${req.params.eventId} `);
	if (req.params.eventAbbr) finders.push(sql` and event.abbr = ${req.params.eventAbbr} `);
	if (req.params.roundId) finders.push(sql` and round.id = ${req.params.roundId} `);
	if (req.params.roundName) finders.push(sql` and round.name = ${req.params.roundName} `);

	if (finders.length < 1) {
		return NotFound(req, res, 'No parameters for retrieval sent');
	}

	const { rows: roundData } = await sql`
		select
			event.id eventId, event.name eventName, event.abbr eventAbbr, event.type eventType,
			event.nsda_category nsdaCategory,
			round.id, round.name, round.label, round.start_time startTime, round.flighted,
			round.type,
			round.published, round.post_primary postPrimary,
			timeslot.start timeslotStart, tourn.tz,

			(select motion.value_text
				from round_setting motion
				where motion.tag = 'motion'
				and motion.round = round.id
				and EXISTS (
					select published.id
					from round_setting published
					where published.tag = 'motion_publish'
					and published.round = round.id
					and published.value = 1
				)
			) as motion,

			(select notes.value
				from round_setting notes
				where notes.tag = 'notes'
				and notes.round = round.id
			) as notes,

			( select include_room_notes.value
				from round_setting include_room_notes
				where include_room_notes.tag = 'include_room_notes'
				and include_room_notes.round = round.id
			) as includeRoomNotes,

			( select use_normal_rooms.value
				from round_setting use_normal_rooms
				where use_normal_rooms.tag = 'use_normal_rooms'
				and use_normal_rooms.round = round.id
			) as useNormalRooms

		from (event, round, timeslot, tourn)

		where 1=1
			and event.tourn = ${req.params.tournId}
			and tourn.id    = event.tourn
			${sql.join(finders, sql` `)}
			and event.id    = round.event
			and round.published > 0
			and round.timeslot = timeslot.id
			and exists (
				select panel.id
				from panel, ballot
				where panel.round = round.id
				and panel.id = ballot.panel
				and ballot.entry > 0
			)
	`.execute(db);

	const rounds = roundData.map( (round) => {

		const startTime = new Date(round.startTime || round.timeslotStart);

		const Settings = {};
		if (round.includeRoomNotes) Settings.includeRoomNotes = true;
		if (round.useNormalRooms) Settings.useNormalRooms = true;

		const parsedRound = {
			id          : round.id,
			name        : round.name,
			type        : snakeToCamel(round.type),
			label       : round.label,
			tz          : round.tz,
			motion      : round.motion,
			message     : round.notes,
			published   : publishLevel(round.published),
			postPrimary : round.postPrimary,
			flighted    : round.flighted || 1,
			startTime,
			Settings,
			Event    : {
				id           : round.eventId,
				name         : round.eventName,
				abbr         : round.eventAbbr,
				type         : round.eventType,
				nsdaCategory : round.nsdaCategory,
				Settings     : {},
			},
		};

		Object.keys(parsedRound).forEach( (key) => {
			if (parsedRound[key] === null)  delete parsedRound[key];
		});

		return parsedRound;
	});

	if (!rounds?.length) {
		return NotFound(req, res,
			`Round ${req.params.roundName} of ${req.params.eventAbbr} either does not exist or is not yet published.`
		);
	};

	const round = rounds[0];

	const { settings: eventSettings } = await db
		.selectFrom('event')
		.innerJoin('round', 'round.event', 'event.id')
		.select(selectSettings({
			table: 'event',
			settings: [
				'anonymous_public',
				'pods',
				'no_side_constraints',
				'not_nats',
				'elim_decision_deadline',
				'prelim_decision_deadline',
				'online_mode',
				'online_hybrid',
				'online_public',
				'flight_offset',
				'aff_label',
				'neg_label',
				'prep_offset',
			],
		}))
		.where('round.id', '=', round.id)
		.executeTakeFirstOrThrow();

	round.Event.Settings = eventSettings ?? {};

	// Mapping start times and decision deadlines. Doing it here and not on the
	// front end because syncing up this logic together with reactivity is a
	// right royal nightmare, and I don't trust other frontends to do it
	// properly either because localization can lie.

	round.times = showFlightTimes(round, req.person?.tz || 'UTC');

	// Now the publication level determines what the person gets back.  Entry
	// List is the easiest.

	if (round.published === 'entryList' || round.published === 'prelimChambers') {

		const { rows: rawEntries } = await sql`
			select
				entry.id, entry.code,
				section.bye, section.letter chamber
			from (panel section, ballot, entry)
			where 1=1
				and section.round = ${round.id}
				and section.id = ballot.panel
				and ballot.entry = entry.id
			order by entry.code
		`.execute(db);

		round.Entries = rawEntries.map( (entry) => {
			const e = { ...entry };
			if (!entry.bye)  delete e.bye;
			if (round.published !== 'prelimChambers') delete e.chamber;
			return e;
		});

	} else if (round.published === 'full' || round.published === 'noJudges') {

		const { rows: rawPanels } = await sql`
			select panel.id,
				panel.letter, panel.flight, panel.bye,
				room.id roomId, room.name as roomName,
				room.notes as roomNotes, room.url as roomUrl,
				ps.value as hybrid
			from panel

				left join panel_setting ps
					on ps.panel = panel.id
					and ps.tag = 'online_hybrid'

				left join room on panel.room = room.id

			where panel.round = ${round.id}
				order by panel.bye, room.name, panel.flight
		`.execute(db);

		round.Sections = rawPanels.reduce((acc, section) => {

			Object.keys(section).forEach( (key) => {
				if (section[key] === null)  delete section[key];
				if (section[key] === '')  delete section[key];
				if (section[key] === 0)  delete section[key];
			});

			section.Room = {
				id: section.roomId,
				name: section.roomName,
			};

			if (section.roomUrl) 	section.Room.url = section.roomUrl;
			if (round.includeRoomNotes && section.roomNotes) {
				section.Room.notes = section.roomNotes;
			}

			delete section.roomId;
			delete section.roomName;
			delete section.roomUrl;
			delete section.roomNotes;

			acc[section.id] = section;
			return acc;
		}, {});

		const { rows: rawBallots } = await sql`
			select
				section.id sectionId,
				ballot.side, ballot.speakerorder, ballot.chair,
				entry.id entryId, entry.code entryCode,
				judge.id judgeId, judge.first judgeFirst, judge.last judgeLast,
				judge.code judgeCode, judge.person judgePerson,
				( select paradigm.person
						from person_setting paradigm
					where 1=1
						and paradigm.person > 0
						and paradigm.person = judge.person
						and paradigm.tag = 'paradigm'
				) as judgeParadigm

			from (ballot, panel section, entry)
				left join judge on judge.id = ballot.judge
				left join entry_setting pod
					on pod.entry = ballot.entry
					and pod.tag = 'pod'

			where 1=1
				and section.round = ${round.id}
				and section.id = ballot.panel
				and ballot.entry = entry.id

			order by ballot.chair, ballot.judge, ballot.side
		`.execute(db);

		rawBallots.forEach( (ballot) => {

			let orderKey = ballot.side || ballot.speakerorder;

			if (!round.Sections[ballot.sectionId].Entries) {
				round.Sections[ballot.sectionId].Entries  = {};
				round.Sections[ballot.sectionId].Judges   = {};
			}

			if (!round.Sections[ballot.sectionId].Entries[orderKey]) {
				round.Sections[ballot.sectionId].Entries[orderKey] = {
					id           : ballot.entryId,
					code         : ballot.entryCode,
					speakerorder : ballot.speakerorder,
				};
			}

			if (round.published === 'full' && ballot.judgeId) {
				if (!round.Sections[ballot.sectionId].Judges[ballot.judgeId]) {

					const judge = {
						id     : ballot.judgeId,
						first  : ballot.judgeFirst,
						last   : ballot.judgeLast,
					};

					if (ballot.judgeParadigm) judge.paradigm = ballot.judgeParadigm;
					if (ballot.chair) judge.chair = ballot.chair;
					if (ballot.judgeCode) judge.code = ballot.judgeCode;

					if (round.Event.Settings.anonymous_public) {
						delete ballot.judgeFirst;
						delete ballot.judgeLast;
						delete judge.first;
						delete judge.last;
						delete judge.paradigm;
					}
					round.Sections[ballot.sectionId].Judges[ballot.judgeId] = judge;
				}
			}
		});

		if (round.postPrimary && round.Event) {

			const brackets = await entryWins({
				roundId: round.id,
				eventId: round.Event.id
			});

			Object.keys(round.Sections).forEach( (sectionId) => {

				const section = round.Sections[sectionId];
				section.bracket = 0;

				Object.keys(section.Entries).forEach( (entryOrder) => {
					const entryId = section.Entries[entryOrder].id;
					if (!brackets[entryId]) return;
					section.Entries[entryOrder].record = brackets[entryId].record;
					section.Entries[entryOrder].wins = brackets[entryId].wins;
					if (section.bracket < brackets[entryId].wins) {
						section.bracket = brackets[entryId].wins;
					}
				});

				Object.keys(section.Entries).forEach( (entryOrder) => {
					const entryId = section.Entries[entryOrder].id;
					if (!brackets[entryId]) return;
					if (section.bracket > brackets[entryId].wins) {
						section.Entries[entryOrder].pullup = section.bracket - brackets[entryId].wins;
					}
				});
			});
		}
	}

	return res.status(200).json(round);
}

const showFlightTimes = (round, personTz = undefined) => {

	const times = {};
	let tick = 0;

	while (tick < round.flighted) {

		const flightTimes = {};

		// Start Time
		const offset = {};
		if (round.Event.Settings?.flight_offset && tick > 0) {
			offset.minutes = tick * parseInt(round.Event.Settings.flight_offset);
		} else if (tick > 0) {
			// Do not display flight differentials unless there's an offset;
			break;
		}

		flightTimes.start= parseDateTime({
			dt : round.startTime,
			offset,
		});

		// Prep Room Draw time offset for Extemp.
		if (round.Event.Settings.prep_offset) {
			offset.minutes = -1 * round.Event.Settings.prep_offset;
			if (round.Event.Settings.flight_offset && tick > 0) {
				offset.minutes += tick * parseInt(round.Event.Settings.flight_offset);
			}

			flightTimes.draw = parseDateTime({
				dt : round.startTime,
				offset,
			});
		}

		// Timezones.  For online tournaments show both user and tournament.
		// Frontend handles translation here, just need to tag which ones to
		// show.

		flightTimes.tz = [round.tz];

		if ( round.Event.Settings.online_mode
			&& personTz
			&& personTz !== round.tz
		) {
			flightTimes.tz.push(personTz);
		}

		// Decision deadlines only get populated if there is an appropriate
		// offset.  If there is no special elim offset, the prelim offset
		// applies.  Same rules for flights

		offset.minutes = 0;

		if (['prelim', 'highhigh', 'highlow', 'snaked_prelim'].includes(round.type)) {
			if (round.Event.Settings.prelim_decision_deadline) {
				offset.minutes = parseInt(round.Event.Settings.prelim_decision_deadline);
			}
		} else {
			if (round.Event.Settings.elim_decision_deadline) {
				offset.minutes = parseInt(round.Event.Settings.elim_decision_deadline);
			} else if (round.Event.Settings.prelim_decision_deadline) {
				offset.minutes = parseInt(round.Event.Settings.prelim_decision_deadline);
			}
		}

		if (offset.minutes > 0) {
			if (round.Event.Settings.flight_offset && tick > 0) {
				offset.minutes += tick * parseInt(round.Event.Settings.flight_offset);
			}

			flightTimes.deadline = parseDateTime({
				dt : round.startTime,
				offset,
			});
		}

		tick++;
		times[tick] = flightTimes;
	}

	return times;
};
