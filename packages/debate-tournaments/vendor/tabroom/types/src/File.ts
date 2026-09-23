// @ts-nocheck
import z from 'zod';
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import * as utils from './utils.js';

export const FileSchema = z.object({
	id: utils.id.meta({ description: 'The unique identifier for the file' }),
	tag: z.string().nullable(),
	type: z.string().nullable(),
	label: z.string().nullable(),
	filename: z.string().max(255).nullable(),
	published: z.boolean(),
	page_order: z.number().int().nullable(),
	uploaded: z.iso.datetime().nullable(),
	timestamp: z.iso.datetime(),
}) satisfies ZodOpenApiSchemaObject;

export type File = z.infer<typeof FileSchema>;