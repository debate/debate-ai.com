// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { FileSchema } from './File.js';
import { WebpageSchema } from './Webpage.js';
import { EventSchema } from './Event.js';
import { TournSchema, TournContactSchema } from './Tourn.js';
import { z } from 'zod';

export const TournInviteSchema = z.object({
	...TournSchema.shape,
	Webpages: z.array(WebpageSchema),
	Files: z.array(FileSchema),
	Events: z.array(EventSchema),
	Contacts: z.array(TournContactSchema),
}) satisfies ZodOpenApiSchemaObject;
