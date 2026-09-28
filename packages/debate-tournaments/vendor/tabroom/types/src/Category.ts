// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import z from 'zod';
import * as utils from './utils.js';

export const CategorySchema = z.object({
	id: utils.id,
	name: z.string(),
	abbr: z.string(),
	tournId: utils.id,
	pattern: z.int().nullable(),
	settings: z.array(z.object()),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
}).meta({ id: 'Category'}) satisfies ZodOpenApiSchemaObject;

export type Category = z.infer<typeof CategorySchema>;