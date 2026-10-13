// @ts-nocheck
import { z } from 'zod';
import * as utils from './utils.js';
import { EventSchema } from './Event.js';
import type { ZodOpenApiSchemaObject } from 'zod-openapi';

export const RoundSchema = z.object({
	id: utils.id,
	type: z.string().max(15).nullable(),
	name: z.int().nullable(),
	label: z.string().max(31).nullable(),
	flighted: z.boolean().nullable(),
}).strict().meta({
	id: 'Round',
}) satisfies ZodOpenApiSchemaObject;

export type Round = z.infer<typeof RoundSchema>;

export const PublishedRoundSchema = z.object({
	id: RoundSchema.shape.id,
	type: RoundSchema.shape.type,
	name: RoundSchema.shape.name,
	label: RoundSchema.shape.label,
	flighted: z.int().nullable(),
	post_primary: z.int().nullable(),
	post_secondary: z.int().nullable(),
	post_feedback: z.int().nullable(),
	published: z.int().nullable(),
	event: utils.id,
	protocol: utils.id.nullable(),
	Event: z.object({
		id: utils.id,
		name: z.string().nullable(),
		abbr: z.string().nullable(),
		type: EventSchema.shape.type,
		level: z.enum(['champ', 'es-novice', 'es-open', 'jv', 'middle', 'novice', 'open']),
		nsda_category: z.int().nullable(),
		Settings: z.object({
			publishResults: z.string().nullable(),
		}),
	}),
}).strict().meta({
	id: 'PublishedRound',
	description: 'A published round with its event, for the public rounds listing',
}) satisfies ZodOpenApiSchemaObject;

export type PublishedRound = z.infer<typeof PublishedRoundSchema>;

export const ScheduleRoundSchema = z.object({
	id: RoundSchema.shape.id,
	type: RoundSchema.shape.type,
	name: RoundSchema.shape.name,
	label: RoundSchema.shape.label,
	published: z.int().nullable(),
	post_primary: z.int().nullable(),
	start_time: z.iso.datetime().nullable(),
	Event: z.object({
		id: utils.id,
		name: z.string().nullable(),
		abbr: z.string().nullable(),
		type: EventSchema.shape.type,
		nsda_category: z.int().nullable(),
	}).strict(),
	Timeslot: z.object({
		id: utils.id,
		start: z.iso.datetime().nullable(),
		end: z.iso.datetime().nullable(),
	}).strict(),
}).strict().meta({
	id: 'ScheduleRound',
	description: 'A round in the tournament schedule with its event and timeslot',
}) satisfies ZodOpenApiSchemaObject;

export type ScheduleRound = z.infer<typeof ScheduleRoundSchema>;

// The results endpoint strips falsy values, so most fields are optional.
const idKey = z.coerce.number().int();
const scoreTag = z.enum(['winloss', 'rank', 'point', 'refute', 'po', 'speech']);

const RoundResultBallotSchema = z.object({
	winloss: z.enum(['W', 'L', 'Bye', 'Fft']).optional(),
	rank: z.number().optional(),
	point: z.number().optional().meta({ description: 'Points, including refutation points' }),
	po: z.number().optional(),
	speech: z.string().optional().meta({ description: 'Comma separated speech scores' }),
	Speakers: z.record(idKey, z.partialRecord(scoreTag, z.number()))
		.optional()
		.meta({ description: 'Secondary scores keyed by student id' }),
}).strict();

const RoundResultEntrySchema = z.object({
	id: utils.id,
	code: z.string().optional(),
	name: z.string().optional(),
	school: utils.id.optional(),
	schoolName: z.string().optional(),
	side: z.string().optional().meta({ description: 'The side label, e.g. Aff or Neg' }),
	speakerorder: z.int().optional(),
	Speakers: z.record(idKey, z.object({
		id: utils.id,
		first: z.string().optional(),
		last: z.string().optional(),
	}).strict()).optional().meta({ description: 'Students keyed by id, for events with more than one student per entry' }),
	Ballots: z.record(idKey, RoundResultBallotSchema).meta({ description: 'Ballot scores keyed by judge id' }),
}).strict();

export const RoundResultsSchema = z.object({
	id: utils.id,
	name: z.int(),
	label: z.string(),
	flighted: z.int().optional(),
	postPrimary: z.literal(true).optional().meta({ description: 'Present when primary results are public' }),
	postSecondary: z.literal(true).optional().meta({ description: 'Present when secondary results are public' }),
	Event: z.object({
		id: utils.id,
		abbr: z.string().optional(),
		name: z.string().optional(),
		type: EventSchema.shape.type,
		Settings: z.object({
			affLabel: z.string(),
			negLabel: z.string(),
			publishResults: z.string().nullable().optional(),
			maxEntrySize: z.string().nullable().optional(),
			primaryScore: z.enum(['winloss', 'rank']).optional(),
		}).strict(),
	}).strict(),
	Sections: z.record(idKey, z.object({
		id: utils.id,
		letter: z.string().optional(),
		bye: z.int().optional(),
		published: z.int().optional(),
		Judges: z.record(idKey, z.object({
			first: z.string().optional(),
			last: z.string().optional(),
			chair: z.int().optional(),
		}).strict()).meta({ description: 'Judges keyed by judge id' }),
		Entries: z.record(idKey, RoundResultEntrySchema)
			.meta({ description: 'Entries keyed by side, speaker order or entry id' }),
	}).strict()).meta({ description: 'Sections keyed by section id' }),
	scoreTypes: z.partialRecord(scoreTag, z.literal(true)),
}).strict().meta({
	id: 'RoundResults',
	description: 'Public results for a round, grouped by section',
}) satisfies ZodOpenApiSchemaObject;

export type RoundResults = z.infer<typeof RoundResultsSchema>;