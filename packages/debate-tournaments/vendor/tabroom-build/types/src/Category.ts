// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';
import * as utils from './utils.js';

export const CategorySchema = z.object({
	id: utils.id,
	name: z.string(),
	abbr: z.string(),
	tourn: utils.id,
	pattern: z.int().nullable(),
	settings: utils.settings,
	settingsTimestamps: utils.settingsTimestamps,
	created_at: z.iso.datetime(),
	timestamp: z.iso.datetime(),
}).meta({ id: 'Category'}) satisfies ZodOpenApiSchemaObject;

export type Category = z.infer<typeof CategorySchema>;