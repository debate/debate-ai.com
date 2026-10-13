// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';
import * as utils from './utils.js';

export const TournSchema = z.object({
	id: utils.id,
	name: z.string().max(63),
	city: z.string().max(31).nullable(),
	state: z.string().max(6).nullable(),
	country: z.string().max(4).nullable(),
	tz: z.string().max(31),
	webname: z.string(),
	hidden: z.int(),
	start: z.iso.datetime(),
	end: z.iso.datetime(),
	reg_start: z.iso.datetime(),
	reg_end: z.iso.datetime(),
	timestamp: z.iso.datetime(),
	settings: utils.settings,
	settingsTimestamps: utils.settingsTimestamps,
}).strict().meta({
	id: 'Tourn',
}) satisfies ZodOpenApiSchemaObject;

export const PersonTournSummarySchema = z.object({
	id: TournSchema.shape.id,
	roles: z.array(z.enum(['student','coach','judge'])),
	livedocs: z.array(z.object({
		categoryId: utils.id,
		categoryName: z.string().nullable(),
		url: z.string(),
		caption: z.string().nullable(),
	})),
}).meta({
	id: 'PersonTournSummary',
	description: 'A summary of a tourn and a persons role in it for the user homepage'
}) satisfies ZodOpenApiSchemaObject;

export type PersonTournSummary = z.infer<typeof PersonTournSummarySchema>;

const idList = z.array(utils.id);

export const PersonTournPresenceSchema = z.object({
	me: z.object({
		entries: idList,
		events: idList,
		judges: idList,
		categories: idList,
		rounds: idList,
	}).strict().meta({ description: 'Ids the person is directly involved in as a competitor or judge' }),
	mine: z.object({
		entries: idList,
		events: idList,
		judges: idList,
		categories: idList,
	}).strict().meta({ description: 'Ids at schools the person coaches or is a contact for, excluding those in me' }),
}).strict().meta({
	id: 'PersonTournPresence',
	description: 'The entities a person is connected to at a tournament',
}) satisfies ZodOpenApiSchemaObject;

export type PersonTournPresence = z.infer<typeof PersonTournPresenceSchema>;

export type Tourn = z.infer<typeof TournSchema>;

export const TournByWebnameSchema = TournSchema.omit({
	settingsTimestamps: true,
}).extend({
	webname: z.union([TournSchema.shape.webname, TournSchema.shape.id]).meta({
		description: 'The tournament webname, or the tournament id when a newer tournament shares the webname',
	}),
	settings: z.object({
		multiYear: z.boolean().meta({ description: 'Whether other tournaments share this webname' }),
		notCurrent: z.boolean().optional().meta({ description: 'Present when a newer tournament shares this webname' }),
	}),
}).meta({
	id: 'TournByWebname',
	description: 'A tournament looked up by webname or id for the public invite pages',
}) satisfies ZodOpenApiSchemaObject;

export type TournByWebname = z.infer<typeof TournByWebnameSchema>;

export const UpcomingSchema = z.object({
	id: z.string().meta({ description: 'Composite key of tournId-weekendId. weekendId is 0 for non-district tournaments' }),
	tournId: TournSchema.shape.id,
	webname: TournSchema.shape.webname,
	name: TournSchema.shape.name,
	tz: TournSchema.shape.tz,
	tzCode: z.string().meta({ description: 'Short timezone code, e.g. CDT' }),
	districts: z.enum(['Yes', 'No']),
	weekendId: z.number().int().optional().meta({ description: 'Only present for district weekends' }),
	weekendName: z.string().optional().meta({ description: 'Only present for district weekends' }),
	site: z.string().nullable().optional().meta({ description: 'Only present for district weekends' }),
	location: z.string().nullable(),
	state: TournSchema.shape.state,
	country: TournSchema.shape.country,
	start: z.iso.datetime(),
	end: z.iso.datetime(),
	regStart: z.iso.datetime().nullable(),
	regEnd: z.iso.datetime().nullable(),
	year: z.number().int(),
	week: z.number().int(),
	sortnumeric: z.number().int(),
	dates: z.string().meta({ description: 'Short date range, e.g. 5/24-5/26' }),
	fullDates: z.string().meta({ description: 'Long date range, e.g. Fri, May 24, 2024 - Sun, May 26, 2024' }),
	closed: z.string().nullable().optional(),
	special: z.string().nullable().optional(),
	circuits: z.string().nullable().optional().meta({ description: 'Comma separated circuit abbreviations' }),
	schoolCount: z.number().int(),
	nsdaCategories: z.string().meta({ description: 'Comma separated NSDA category names' }),
	eventTypes: z.string().meta({ description: 'Comma separated display names of event types' }),
	events: z.string().meta({ description: 'Comma separated event abbreviations' }),
	signup: z.string().nullable().meta({ description: 'Comma separated abbreviations of categories with open public judge signups' }),
	modes: z.string(),
	online: z.number().int(),
	inPerson: z.number().int(),
	hybrid: z.number().int(),
}).meta({
	id: 'Upcoming',
	description: 'An upcoming tournament, or a district weekend, for the public tournament listing',
}) satisfies ZodOpenApiSchemaObject;

export type Upcoming = z.infer<typeof UpcomingSchema>;

export const TournRequestSchema = z.object({
		name: TournSchema.shape.name,
		city: TournSchema.shape.city,
		state: TournSchema.shape.state,
		country: TournSchema.shape.country,
		tz: TournSchema.shape.tz,
		webname: TournSchema.shape.webname,
		// Request dates are parsed to Date objects so they can be saved directly
		start: utils.datetime(),
		end: utils.datetime(),
		reg_start: utils.datetime().optional(),
		reg_end: utils.datetime().optional(),
	}).strict().meta({
	id: 'TournRequest',
}) satisfies ZodOpenApiSchemaObject;

export const TournContactSchema = z.object({
	id: z.number().int(),
	first: z.string(),
	middle: z.string().nullable(),
	last: z.string(),
	email: z.email(),
}).meta({
	id: 'TournContact',
	description: 'A tournament contact person',
}).strict() satisfies ZodOpenApiSchemaObject;

export const BackupRequestSchema = z.object({
	scope: z.object({
		type: z.enum(['tournament', 'category', 'event', 'school']),
		id: z.number().int().optional(),
	}).strict(),
	options: z.object({
		ignoreComments: z.boolean().optional(),
		ignoreBallots: z.boolean().optional(),
	}).strict().optional(),
}).strict().meta({
	id: 'BackupRequest',
	description: 'A request to create a backup for a tournament or part of a tournament',
}) satisfies ZodOpenApiSchemaObject;