// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { FileSchema } from './File.js';
import { WebpageSchema } from './Webpage.js';
import { InviteEventSchema } from './Event.js';
import { TournSchema, TournContactSchema } from './Tourn.js';
import { z } from 'zod';

export const TournInviteSchema = z.object({
	...TournSchema.shape,
	inPerson: z.int().meta({ description: 'Count of non attendee events without an online mode' }),
	hybrid: z.int().meta({ description: 'Count of events with online hybrid set' }),
	Webpages: z.array(WebpageSchema),
	Files: z.array(FileSchema),
	Events: z.array(InviteEventSchema),
	Contacts: z.array(TournContactSchema),
}) satisfies ZodOpenApiSchemaObject;

export type TournInvite = z.infer<typeof TournInviteSchema>;
