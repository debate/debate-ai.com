// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';

export const WebpageSchema = z.object({
	id: z.number().int(),
	title: z.string().max(63).nullable(),
	content: z.string().nullable(),
	published: z.int(),
	sitewide: z.int(),
	special: z.string().max(15).nullable(),
	slug: z.string().max(63).nullable(),
	page_order: z.number().int().nullable(),
	parent: z.number().int().nullable(),
	timestamp: z.iso.datetime(),
}) satisfies ZodOpenApiSchemaObject;

export type Webpage = z.infer<typeof WebpageSchema>;
