// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';
import { PersonSchema } from './Person.js';

export const ContactSchema = z.object({
	id: z.number().int(),
	schoolId: z.number().int(),
	personId: z.number().int(),
	official: z.int(),
	onsite: z.int(),
	email: z.int(),
	book: z.int(),
	nsda: z.number().int().optional(),
	first: z.string(),
	middleName: z.string().nullable().optional(),
	last: z.string(),
	state: z.string(),
	country: z.string(),
	tz: z.string(),
	createdAt: z.iso.datetime(),
	settings: z.record(z.string(),z.string()),
	metadata: z.record(z.string(),z.string()),
	Person: PersonSchema,
}) satisfies ZodOpenApiSchemaObject;
