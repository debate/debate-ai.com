// @ts-nocheck
import { z } from 'zod';
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
	site_admin: z.int().nullish(),
	country: z.string().nullish(),
	tz: z.string().nullish(),
	createdAt: z.iso.datetime(),
	settings: utils.settings,
	settingsTimestamps: utils.settingsTimestamps,
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
		site_admin: true,
		tz: true,
	}).nullable(),
	Person: PersonSchema.pick({
		id: true,
		email: true,
		first: true,
		last: true,
		site_admin: true,
		tz: true,
	}),
}).strict().meta({
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

export const UserParadigmSchema = z.object({
	paradigm: z.string().max(65535).meta({ description: 'The paradigm for the logged in user' }),
}).meta({
	id: 'UserParadigm',
	description: 'The paradigm of the logged in user',
}) satisfies ZodOpenApiSchemaObject;

export type UserParadigm = z.infer<typeof UserParadigmSchema>;

export const ClaimResponseSchema = z.object({
	message: z.string().meta({ description: 'A message indicating the claim request was submitted' }),
	detail: z.string().meta({ description: 'Additional details about the claim request submission' }),
}).meta({
	id: 'ClaimResponse',
	description: 'The result of a person claiming a judge or student record',
}) satisfies ZodOpenApiSchemaObject;

export type ClaimResponse = z.infer<typeof ClaimResponseSchema>;

export const ParadigmSearchResultSchema = z.object({
	id: utils.id,
	name: z.string().meta({ description: 'Full name' }),
	tournJudged: z.coerce.number().int().nonnegative().meta({ description: 'Number of tournaments judged' }),
	schools: z.array(z.object({
		id: utils.id,
		name: z.string(),
	})),
}).meta({
	id: 'ParadigmSearchResult',
	description: 'A judge matching a paradigm search',
}) satisfies ZodOpenApiSchemaObject;

export type ParadigmSearchResult = z.infer<typeof ParadigmSearchResultSchema>;