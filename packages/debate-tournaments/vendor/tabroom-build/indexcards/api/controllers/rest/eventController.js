import { sql } from 'kysely';
import { db } from '../../data/database.js';
import { NotImplemented, NotFound } from '../../helpers/problem.js';
import { entryWins } from '../../services/results/entryWins.js';

export async function getEvents(req, res) {
	return NotImplemented(req,res,'Not implemented');
};

export async function getResults(req, res) {
	return NotImplemented(req,res,'Not implemented');
};

export async function getEntryWinsByEvent(req, res) {
	// This is public only for now but at some point needs to be auth informed
	// so that coaches, entries, and admins get the full shebang as outlined in
	// the service function.
	const records = await entryWins({ ...req.params });
	return res.status(200).json(records);
};

export async function getField(req,res) {

	const { rows: events } = await sql`
		select
			event.*,
            field_waitlist.value fieldWaitlist,
            field_report.value fieldReport
		from event

            left join event_setting field_report
                on field_report.event = event.id
                and field_report.tag = 'field_report'

            left join event_setting field_waitlist
                on field_waitlist.event = event.id
                and field_waitlist.tag = 'field_waitlist'
		where 1=1
            and event.tourn = ${req.params.tournId}
            and event.abbr  = ${req.params.eventAbbr}
		limit 1
	`.execute(db);

	if (!events || events.length < 1) {
		return NotFound(req, res, `No valid event abbreviation sent`);
	}

	if (!events[0].fieldReport) {
		return NotFound(req, res, `Tournament has not posted that event field report`);
	}

	const event = {
		name       : events[0].name,
		id         : events[0].id,
		abbr       : events[0].abbr,
		type       : events[0].type,
		category   : events[0].category,
		tourn      : events[0].tourn,
		settings   : {
			fieldWaitlist: events[0].fieldWaitlist,
			fieldReport: events[0].fieldReport,
		},
		Entries    : [],
	};

	const { rows: entries } = await sql`
        SELECT
            entry.id, entry.code, entry.name,
            entry.active, entry.waitlist,
			school.id schoolId,
				school.name schoolName,
				school.code schoolCode,
			student.id studentId,
				student.first studentFirst,
				student.middle studentMiddle,
				student.last studentLast,
				student.chapter chapterId
        from (entry, event)
            left join school on school.id = entry.school
            left join entry_student es on es.entry = entry.id
            left join student on student.id = es.student
        where 1=1
            and event.id = ${event.id}
			and event.id = entry.event
            and exists (
                select fr.id
                from event_setting fr
                where 1=1
                    and fr.event = event.id
                    and fr.tag = 'field_report'
            )
            and (entry.active = 1 OR entry.waitlist = 1)
        group by entry.id
        order by entry.code, entry.name
    `.execute(db);

	const entryById = {};

	entries.forEach( (entry) => {
		if (!event.settings.fieldWaitlist && entry.waitlist) return;
		if (!entryById[entry.id]) {
			entryById[entry.id] = {
				id       : entry.id,
				name     : entry.name,
				code     : entry.code,
				active   : entry.active,
				waitlist : entry.waitlist,
				School   : {
					id   : entry.schoolId,
					name : entry.schoolName,
					code : entry.schoolCode,
				},
				Students : [],
			};
		}

		if (!entry.studentId) return;

		entryById[entry.id].Students.push({
			id      : entry.studentId,
			first   : entry.studentFirst,
			middle  : entry.studentMiddle,
			last    : entry.studentLast,
			chapter : entry.chapterId,
		});
	});

	event.Entries = Object.keys(entryById).map( (entryId) => {
		return entryById[entryId];
	});

	return res.status(200).json(event);
};

export async function getEventByAbbr(req, res) {

	if (!req.params.eventAbbr) {
		return NotFound(req, res, `No valid event abbreviation sent`);
	}

	const eventData = await db
		.selectFrom('event')
		.select(['event.id', 'event.name', 'event.type', 'event.code_style'])
		.where('event.tourn', '=', req.params.tournId)
		.where('event.abbr', '=', req.params.eventAbbr)
		.execute();

	if (!eventData || eventData.length !== 1) {
		return NotFound(
			req,
			res,
			`No event ${req.params.eventAbbr} found in tournament ${req.params.tournId}`
		);
	}

	// Latch to the one event
	const event = eventData[0];

	event.rounds = await db
		.selectFrom('round')
		.select(['round.id', 'round.name', 'round.label', 'round.type', 'round.published'])
		.where('round.event', '=', event.id)
		.where('round.published', '!=', 0)
		.orderBy('round.name')
		.execute();

	return res.status(200).json(event);
};
