// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';
import { datetime } from './utils.js';
import { EventSchema } from './Event.js';
import { PersonSchema } from './Person.js';

export const TopicZodSchema = z.object({
	id: z.number().int(),
	tag: z.string(),
	source: z.enum(['NSDA', 'NCFL', 'CEDA', 'NFHS', 'CPFL', 'NFA', 'AFA']),
	schoolYear: z.number().int(),
	eventType: z.string(),
	pattern: z.string(),
	topicText: z.string(),
	createdAt: datetime(),
	createdBy: PersonSchema,
	Events: z.array(EventSchema),
}) satisfies ZodOpenApiSchemaObject;
