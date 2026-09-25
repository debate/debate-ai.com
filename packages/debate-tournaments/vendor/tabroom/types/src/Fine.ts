// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import z from 'zod';
import * as utils from './utils.js';

export const FineSchema = z.object({
	id: utils.id,
	reason: z.string().max(255).nullable(),
	amount: z.number().nullable(),
	school: utils.id,
	leviedAt: z.iso.datetime(),
}).strict().meta({
	id: 'Fine',
}) satisfies ZodOpenApiSchemaObject;

export type Fine = z.infer<typeof FineSchema>;
