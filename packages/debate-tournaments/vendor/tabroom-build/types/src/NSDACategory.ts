// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';

export const NSDACategorySchema = z.object({
	id: z.number().int(),
	name: z.string().max(63).nullable(),
	type: z.enum(['c', 'd', 's']).nullable().meta({ description: 'Congress, debate or speech' }),
	code: z.number().int().nullable(),
	national: z.int(),
	timestamp: z.iso.datetime(),
}).strict().meta({
	id: 'NSDACategory',
}) satisfies ZodOpenApiSchemaObject;

export type NSDACategory = z.infer<typeof NSDACategorySchema>;
