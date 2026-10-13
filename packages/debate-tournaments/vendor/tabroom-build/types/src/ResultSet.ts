// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import * as utils from './utils.js'
import z from "zod";

export const ResultSetEventSchema = z.object({
	id: utils.id,
	tag: z.string(),
	label: z.string(),
	entity: z.string(),
	createdAt: z.iso.datetime(),
}) satisfies ZodOpenApiSchemaObject;

export type ResultSetEvent = z.infer<typeof ResultSetEventSchema>;

export const ResultSetSchema = z.object({
	id: utils.id,
	tag: z.string(),
	label: z.string(),
	entity: z.string(),
	createdAt: z.iso.datetime(),
	noPlacement: z.boolean().optional(),
	headers: z.record(z.number(), z.object({
		tag: z.string(),
		description: z.string(),
		no_sort: z.boolean(),
		sort_desc: z.boolean(),
		Protocol: z.object({
			id: utils.id,
			name: z.string(),
		}).optional(),
	})),
	Event: z.object({
		id: utils.id,
		abbr: z.string(),
		level: z.string(),
		name: z.string(),
		nsdacategory: utils.id,
		type: z.string(),
	}),
	results: z.array(z.object({

	}))
}) satisfies ZodOpenApiSchemaObject;

export type ResultSet = z.infer<typeof ResultSetSchema>;

export const EventResultSetsSchema = z.object({
	id: utils.id,
	nsdacategory: utils.id,
	name: z.string(),
	abbr: z.string(),
	level: z.string(),
	type: z.string(),
	ResultSets: z.array(ResultSetEventSchema)
}) satisfies ZodOpenApiSchemaObject;

export type EventResultSets = z.infer<typeof EventResultSetsSchema>;
