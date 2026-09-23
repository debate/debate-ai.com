// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';
import { datetime } from './utils.js';
import { PersonSchema } from './Person.js';

export const ContactSchema = z.object({
	id: z.number().int(),
	schoolId: z.number().int(),
	personId: z.number().int(),
	official: z.boolean(),
	onsite: z.boolean(),
	email: z.boolean(),
	book: z.boolean(),
	nsda: z.number().int().optional(),
	first: z.string(),
	middleName: z.string().nullable().optional(),
	last: z.string(),
	state: z.string(),
	country: z.string(),
	tz: z.string(),
	createdAt: datetime(),
	settings: z.record(z.string(),z.string()),
	metadata: z.record(z.string(),z.string()),
	Person: PersonSchema,
}) satisfies ZodOpenApiSchemaObject;
