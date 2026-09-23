// @ts-nocheck
import { z } from 'zod';
import { datetime } from './utils.js';
import type { ZodOpenApiSchemaObject } from 'zod-openapi';

export const TimeslotResponseSchema = z.object({
	id: z.number().int(),
	name: z.string(),
	start: datetime(),
	end: datetime(),
	tournId: z.number().int(),
	updatedAt: datetime(),
	createdAt: datetime(),
}) satisfies ZodOpenApiSchemaObject;

export const TimeslotRequestSchema = z.object({
	name: z.string(),
	start: datetime(),
	end: datetime(),
	tourn: z.number().int(),
});