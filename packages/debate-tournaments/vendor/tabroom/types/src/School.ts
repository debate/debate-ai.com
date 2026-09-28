// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';
import { datetime } from './utils.js';

export const SchoolSchema = z.object({
	id: z.number().int(),
	name: z.string(),
	code: z.string(),
	onsite: z.boolean(),
	tournId: z.number().int(),
	chapterId: z.number().int(),
	state: z.string(),
	regionId: z.number().int(),
	districtId: z.number().int(),
	updatedAt: datetime(),
	createdAt: datetime(),
	settings: z.record(z.string(), z.string()),
	metadata: z.record(z.string(), z.string()),
}) satisfies ZodOpenApiSchemaObject;

export const CreateSchoolSchema = z.object({
	name: z.string().optional(),
	code: z.string().optional(),
	onsite: z.boolean().optional(),
	chapterId: z.number().int(),
	state: z.string().optional(),
	regionId: z.number().int().optional(),
	settings: z.record(z.string(), z.string()).optional(),
}) satisfies ZodOpenApiSchemaObject;

export const UpdateSchoolSchema = z.object({
	name: z.string(),
	code: z.string(),
	onsite: z.boolean(),
	state: z.string(),
	regionId: z.number().int(),
	settings: z.record(z.string(), z.string()),
}) satisfies ZodOpenApiSchemaObject;