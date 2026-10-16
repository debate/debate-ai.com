// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';

export const ProblemSchema = z.object({
	type: z.url().meta({ description: 'A URI reference that identifies the problem type.' }),
	title: z.string().meta({ description: 'A short, human-readable summary of the problem type.' }),
	status: z.number().int().meta({ description: 'The HTTP status code.' }),
	detail: z.string().optional().meta({ description: 'Human-readable explanation of the error.' }),
	instance: z.string().optional().meta({ description: 'A URI reference to the specific occurrence.' }),
	issues: z.record(z.any(),z.any()).optional().meta({ description: 'Additional details about the error, such as validation issues.' }),
}) satisfies ZodOpenApiSchemaObject;

export type Problem = z.infer<typeof ProblemSchema>;
