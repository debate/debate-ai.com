// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';
import { id, settings, settingsTimestamps } from './utils.js';

export const SchoolSchema = z.object({
	id: z.number().int(),
	name: z.string(),
	code: z.string(),
	onsite: z.int(),
	tournId: z.number().int(),
	chapterId: z.number().int(),
	state: z.string(),
	regionId: z.number().int(),
	districtId: z.number().int(),
	updatedAt: z.iso.datetime(),
	createdAt: z.iso.datetime(),
	settings,
	settingsTimestamps,
	metadata: z.record(z.string(), z.string()),
}) satisfies ZodOpenApiSchemaObject;

export const CreateSchoolSchema = z.object({
	name: z.string().optional(),
	code: z.string().optional(),
	onsite: z.int().optional(),
	chapterId: z.number().int(),
	state: z.string().optional(),
	regionId: z.number().int().optional(),
	settings: z.record(z.string(), z.string()).optional(),
}) satisfies ZodOpenApiSchemaObject;

export const UpdateSchoolSchema = z.object({
	name: z.string(),
	code: z.string(),
	onsite: z.int(),
	state: z.string(),
	regionId: z.number().int(),
	settings: z.record(z.string(), z.string()),
}) satisfies ZodOpenApiSchemaObject;

/** A school the logged in user can manage at a tournament, with its roster for registration */
export const MySchoolSchema = z.object({
	id: id,
	name: z.string(),
	code: z.string().nullable(),
	onsite: z.int(),
	chapter: id.nullable(),
	students: z.array(z.object({
		id: id,
		first: z.string().nullable(),
		middle: z.string().nullable(),
		last: z.string().nullable(),
		code: z.string().nullable().meta({ description: 'Code of the entry the student is in' }),
		chapter: id,
		event: id.meta({ description: 'Event of the entry the student is in' }),
	}).strict()),
	entries: z.record(z.coerce.number().int(), z.object({
		code: z.string().nullable(),
		name: z.string().nullable(),
		event: id,
		eventAbbr: z.string().nullable(),
	}).strict()).meta({ description: 'Active entries keyed by entry id' }),
	events: z.record(z.coerce.number().int(), z.object({
		name: z.string().nullable(),
		abbr: z.string().nullable(),
	}).strict()).meta({ description: 'Events the school has entries in, keyed by event id' }),
	judges: z.record(z.coerce.number().int(), z.object({
		id: id,
		first: z.string().nullable(),
		last: z.string().nullable(),
		code: z.string().nullable(),
		category: id,
		categoryAbbr: z.string().nullable(),
		categoryName: z.string().nullable(),
	}).strict()).meta({ description: 'Judges keyed by judge id' }),
}).strict().meta({
	id: 'MySchool',
	description: 'A school the logged in user can manage at a tournament, with its roster',
}) satisfies ZodOpenApiSchemaObject;

export type MySchool = z.infer<typeof MySchoolSchema>;