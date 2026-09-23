// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';
import { datetime } from './utils.js';

export const WebpageSchema = z.object({
	id: z.number().int(),
	title: z.string().max(63).nullable(),
	content: z.string().nullable(),
	published: z.boolean(),
	sitewide: z.boolean(),
	special: z.string().max(15).nullable(),
	slug: z.string().max(63).nullable(),
	pageOrder: z.number().int().nullable(),
	parentId: z.number().int().nullable(),
	updatedAt: datetime(),
}) satisfies ZodOpenApiSchemaObject;
