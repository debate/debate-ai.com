// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';

export const NSDACategorySchema = z.object({
	id: z.number().int(),
	name: z.string().max(63),
	type: z.string().max(15),
	code: z.number().int(),
	nationals: z.boolean().optional(),
}) satisfies ZodOpenApiSchemaObject;