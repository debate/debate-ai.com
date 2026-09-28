// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import z from 'zod';
import * as utils from './utils.js';

export const TournSchema = z.object({
	id: utils.id,
	name: z.string().max(63),
	city: z.string().max(31).nullable(),
	state: z.string().max(6).nullable(),
	country: z.string().max(4).nullable(),
	tz: z.string().max(31),
	webname: z.string(),
	hidden: z.boolean(),
	start: utils.datetime(),
	end: utils.datetime(),
	regStart: utils.datetime(),
	regEnd: utils.datetime(),
}).strict().meta({
	id: 'Tourn',
}) satisfies ZodOpenApiSchemaObject;

export const PersonTournSummarySchema = z.object({
	id: TournSchema.shape.id,
	name: TournSchema.shape.name,
	webname: TournSchema.shape.webname,
	start: TournSchema.shape.start,
	end: TournSchema.shape.end,
	tz: TournSchema.shape.tz,
	roles: z.array(z.enum(['student','coach','judge'])),
	livedocs: z.array(z.object({
		url: z.string(),
		caption: z.string().nullable(),
	})),
	Judge: z.object({
		categoryName: z.string(),
		schoolName: z.string().nullable(),
	}).nullable(),
}).meta({
	id: 'PersonTournSummary',
	description: 'A summary of a tourn and a persons role in it for the user homepage'
}) satisfies ZodOpenApiSchemaObject;

export type PersonTournSummary = z.infer<typeof PersonTournSummarySchema>;

export type Tourn = z.infer<typeof TournSchema>;

export const TournRequestSchema = z.object({
		name: TournSchema.shape.name,
		city: TournSchema.shape.city,
		state: TournSchema.shape.state,
		country: TournSchema.shape.country,
		tz: TournSchema.shape.tz,
		webname: TournSchema.shape.webname,
		start: TournSchema.shape.start,
		end: TournSchema.shape.end,
		reg_start: TournSchema.shape.regStart.optional(),
		reg_end: TournSchema.shape.regEnd.optional(),
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