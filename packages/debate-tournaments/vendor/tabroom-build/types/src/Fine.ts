// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';
import * as utils from './utils.js';

export const FineSchema = z.object({
	id: utils.id,
	reason: z.string().max(255).nullable(),
	amount: z.number().nullable(),
	currency: z.string().nullable().meta({ description: 'The currency symbol for the tournament, if it is set' }),
	school: utils.id,
	schoolName: z.string().nullable(),
	leviedAt: z.iso.datetime(),
}).strict().meta({
	id: 'Fine',
}) satisfies ZodOpenApiSchemaObject;

export type Fine = z.infer<typeof FineSchema>;
