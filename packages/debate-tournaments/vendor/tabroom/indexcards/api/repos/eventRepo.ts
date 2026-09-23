// @ts-nocheck

import type { Insertable } from 'kysely';
import { sql } from 'kysely';
import { snakeToCamel } from '../helpers/text.js';
import type { Database } from '../data/database.js';
import type { Event } from '../data/schema.js';
import { saveSettings, type Settings } from './utils/settings.js';

type queryOpts = {
	ids?: number[];
	tourn?: number;
};

function buildEventQuery(db:Database, opts: queryOpts = {}) {
	let query = db.selectFrom('event');
	if (opts.tourn) query = query.where('event.tourn', '=', opts.tourn);
	if (opts.ids && opts.ids.length > 0) query = query.where('event.id', 'in', opts.ids);
	return query;
}

/**
 *  One of palmers creations to get event invite data for a tournament
 * @param {*} tournId the tournament id to get event invites for
 * @returns an array of Event objects populated with settings appropriate for public consumption.
 */
export async function getEventsForInvite(db: Database, tournId: number) {
	const events = await db
		.selectFrom('event')
		.innerJoin('category', 'category.id', 'event.category')
		.leftJoin('entry', (join) =>
			join
				.onRef('entry.event', '=', 'event.id')
				.on('entry.active', '=', 1)
		)
		.leftJoin('tourn_setting as currency', (join) =>
			join
				.onRef('currency.tourn', '=', 'event.tourn')
				.on('currency.tag', '=', 'currency')
		)
		.leftJoin('nsda_category', 'nsda_category.id', 'event.nsda_category')
		.leftJoin('event_setting as cap', (join) =>
			join
				.onRef('cap.event', '=', 'event.id')
				.on('cap.tag', '=', 'cap')
		)
		.leftJoin('event_setting as school_cap', (join) =>
			join
				.onRef('school_cap.event', '=', 'event.id')
				.on('school_cap.tag', '=', 'school_cap')
		)
		.leftJoin('category_setting as judge_field_report', (join) =>
			join
				.onRef(
					'judge_field_report.category',
					'=',
					'category.id',
				)
				.on('judge_field_report.tag', '=', 'field_report')
		)
		.leftJoin('event_setting as field_report', (join) =>
			join
				.onRef('field_report.event', '=', 'event.id')
				.on('field_report.tag', '=', 'field_report')
		)
		.leftJoin('event_setting as live_updates', (join) =>
			join
				.onRef('live_updates.event', '=', 'event.id')
				.on('live_updates.tag', '=', 'live_updates')
		)
		.leftJoin('event_setting as anonymous_public', (join) =>
			join
				.onRef('anonymous_public.event', '=', 'event.id')
				.on('anonymous_public.tag', '=', 'anonymous_public')
		)
		.leftJoin('event_setting as description', (join) =>
			join
				.onRef('description.event', '=', 'event.id')
				.on('description.tag', '=', 'description')
		)
		.leftJoin('event_setting as topic_id', (join) =>
			join
				.onRef('topic_id.event', '=', 'event.id')
				.on('topic_id.tag', '=', 'topic')
		)
		.leftJoin('topic', 'topic.id', 'topic_id.value')
		.select([
			'event.id',
			'event.abbr',
			'event.name',
			'event.fee',
			'event.type',
			'event.nsda_category as nsdaCategory',

			'nsda_category.name as nsdaCategoryName',

			'category.id as categoryId',
			'category.name as categoryName',
			'category.abbr as categoryAbbr',

			'judge_field_report.value as judgeFieldReport',
			'cap.value as cap',
			'school_cap.value as schoolCap',

			'topic.id as topicId',
			'topic.source as topicSource',
			'topic.event_type as topicEventType',
			'topic.tag as topicTag',
			'topic.topic_text as topicText',

			'field_report.value as fieldReport',
			'anonymous_public.value as anonymousPublic',
			'live_updates.value as liveUpdates',
			'description.value_text as description',
			'currency.value as currency',

			sql<number>`count(entry.id)`.as('entryCount'),
		])
		.where('event.tourn', '=', tournId)
		.where('event.type', '!=', 'attendee')
		.groupBy('event.id')
		.execute();

	return events.map((event) => ({
		id: event.id,
		abbr: event.abbr,
		name: event.name,
		fee: event.fee,
		type: snakeToCamel(event.type),

		NSDACategory: {
			id: event.nsdaCategory,
			name: event.nsdaCategoryName,
			code: event.nsdaCategory,
		},

		Category: {
			id: event.categoryId,
			abbr: event.categoryAbbr,
			name: event.categoryName,
			settings: {
				judgeFieldReport: event.judgeFieldReport,
			},
		},

		Topic: {
			id: event.topicId,
			source: event.topicSource,
			eventType: event.topicEventType,
			tag: event.topicTag,
			text: event.topicText,
		},

		settings: {
			cap: event.cap,
			schoolCap: event.schoolCap,
			fieldReport: event.fieldReport,
			anonymousPublic: event.anonymousPublic,
			live_updates: event.liveUpdates,
			description: event.description,
			currency: event.currency,
		},

		metadata: {
			entryCount: event.entryCount,
		},
	}));
}

export function getEvent(db:Database, id: number, opts = {}) {
	const query = buildEventQuery(db, opts)
		.where('id','=', id)
	
	return query.selectAll().executeTakeFirst();
}

export async function getEvents(db: Database, opts: queryOpts = {}){
	return await buildEventQuery(db, opts)
		.selectAll()
		.execute();
}

async function createEvent(db: Database, data: Insertable<Event> & { settings?: Settings }) {
	const { settings, ...categoryData } = data;

	return await db.transaction().execute(async (trx) => {
		if (Object.keys(categoryData).length === 0) {
			throw new Error('createEvent requires event data');
		}

		const event = await trx
			.insertInto('event')
			.values(categoryData)
			.returningAll()
			.executeTakeFirstOrThrow();

		if (settings) {
			await saveSettings({
				db: trx,
				table: 'event',
				settings,
				ownerId: event.id,
			});
		}

		return event;
	});
}

export default {
	getEvent,
	getEvents,
	getEventsForInvite,
	createEvent,
};
