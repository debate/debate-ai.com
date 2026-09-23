// @ts-nocheck
	import z from 'zod';
	import type { ZodOpenApiSchemaObject } from 'zod-openapi';
	import * as utils from './utils.js';
	export const BallotSchema = z.object({
		id: utils.id,
		side: z.boolean(),
		chair: z.boolean(),
		speakerOrder: z.int().nonnegative(),
	}).meta({
		id: 'Ballot',
	}) satisfies ZodOpenApiSchemaObject;
	export type Ballot = z.infer<typeof BallotSchema>;

