// @ts-nocheck
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { z } from 'zod';
import * as utils from './utils.js';

export const QuizBadgeSchema = z.object({
	altText: z.string().nullable().meta({ description: 'The alt text for the badge image' }),
	link: z.url().nullable().meta({ description: 'The link to the badge' }),
	imageUrl: z.url().nullable().meta({ description: 'The URL of the badge image' }),
}).meta({
	id: 'QuizBadge',
	description: 'The badge associated with the certification'
}) satisfies ZodOpenApiSchemaObject;

export type QuizBadge = z.infer<typeof QuizBadgeSchema>;

export const PersonQuizSchema = z.object({
	id: utils.id,
	person: utils.id,
	quiz: utils.id,
	approvedBy: utils.id.nullable(),
	pending: z.int(),
	updatedAt: z.iso.datetime(),
}).meta({
	id: 'PersonQuiz',
}) satisfies ZodOpenApiSchemaObject;

export type PersonQuiz = z.infer<typeof PersonQuizSchema>;

export const QuizSchema = z.object({
	id: utils.id,
	tag: z.string().max(63).nullable(),
	label: z.string().max(255).nullable(),
	description: z.string().max(511).nullable(),
	sitewide: z.int().default(0),
	hidden: z.int().default(0),
	approval: z.int().default(0),
	show_answers: z.int().default(0),
	admin_only: z.int().default(0),
	circuit: utils.id.nullable(),
	Badge: QuizBadgeSchema,
	PersonQuizzes: z.array(PersonQuizSchema).optional(),
}).meta({
	id: 'Quiz',
}) satisfies ZodOpenApiSchemaObject;

export type Quiz = z.infer<typeof QuizSchema>;

export const PersonQuizWithQuizSchema = PersonQuizSchema.extend({
	Quiz: QuizSchema,
}) satisfies ZodOpenApiSchemaObject;

export type PersonQuizWithQuiz = z.infer<typeof PersonQuizWithQuizSchema>;