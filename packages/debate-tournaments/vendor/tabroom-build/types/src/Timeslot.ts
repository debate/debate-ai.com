// @ts-nocheck
import { z } from 'zod';
import { datetime } from './utils.js';
import type { ZodOpenApiSchemaObject } from 'zod-openapi';

export const TimeslotResponseSchema = z.object({
	id: z.number().int(),
	name: z.string(),
	start: z.iso.datetime(),
	end: z.iso.datetime(),
	tourn: z.number().int(),
	timestamp: z.iso.datetime(),
}) satisfies ZodOpenApiSchemaObject;

export const TimeslotRequestSchema = z.object({
	name: z.string(),
	start: datetime(),
	end: datetime(),
	tourn: z.number().int(),
});