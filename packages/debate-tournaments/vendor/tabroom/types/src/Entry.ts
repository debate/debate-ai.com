// @ts-nocheck
import z from 'zod';
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import * as utils from './utils.js';
export const EntrySchema = z.object({
	id: utils.id,
	code: z.string().nullable(),
	event: utils.id,
}).strict().meta({
	id: 'Entry',
}) satisfies ZodOpenApiSchemaObject;

export type Entry = z.infer<typeof EntrySchema>;