// @ts-nocheck
import z from 'zod';
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { QuizSchema } from './Quiz.js';
import * as utils from './utils.js';

export const PersonSchema = z.object({
	id: utils.id,
	email: z.email(),
	first: z.string(),
	middle: z.string().nullable(),
	last: z.string(),
	state: utils.TwoLetterCode.nullish(),
	country: z.string().nullish(),
	tz: z.string().nullish(),
	createdAt: z.iso.datetime(),
	settings: z.object().optional(),
	metadata: z.object().optional(),
}).meta({
	id: 'Person',
	description: 'A person (user) in tabroom',
}) satisfies ZodOpenApiSchemaObject;

export type Person = z.infer<typeof PersonSchema>;

export const SessionSchema = z.object({
	id: utils.id,
	person: utils.id,
	su: utils.id.nullable(),
	Su: PersonSchema.pick({
		id: true,
		email: true,
		first: true,
		last: true,
	}).nullable(),
	Person: PersonSchema.pick({
		id: true,
		email: true,
		first: true,
		last: true,
	}),
}).meta({
	id: 'Session',
	description: 'A user session',
}) satisfies ZodOpenApiSchemaObject;

export type Session = z.infer<typeof SessionSchema>;

export const ParadigmDetailsSchema = z.object({
	id: utils.id.meta({
		description: 'The id of the person associated with the paradigm',
	}),
	name: z.string().nullable().meta({
		description: 'The name of the person associated with the paradigm',
	}),
	lastReviewed: z.iso.datetime().nullable().meta({
		description: 'The last reviewed timestamp of the paradigm',
	}),
	paradigm: z.string().nullable().meta({
		description: 'The content of the paradigm',
	}),
	certifications: z.array(QuizSchema).optional().meta({ description: 'The list of certifications associated with the paradigm' }),
}) satisfies ZodOpenApiSchemaObject;

export type ParadigmDetails = z.infer<typeof ParadigmDetailsSchema>;