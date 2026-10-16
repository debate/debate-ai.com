// @ts-nocheck
import { z } from 'zod';
import type { ZodOpenApiSchemaObject } from 'zod-openapi';

export const id = z.coerce.number().int().positive() satisfies ZodOpenApiSchemaObject;
export const TwoLetterCode = z.string().regex(/^[A-Z]{2}$/, 'Must be a valid 2-letter code') satisfies ZodOpenApiSchemaObject;
export const limit = z.coerce.number().int().positive().meta({ description: 'The number of results to return.' })
export const offset = z.coerce.number().int().nonnegative().meta({ description: 'The number of results to skip when returning.' })
/** coerces an ISO datetime string to a JavaScript Date object */
export const datetime = () => z.iso.datetime().pipe(z.coerce.date()) satisfies ZodOpenApiSchemaObject;

/** MySQL DATETIME as serialized inside a JSON column, e.g. 2024-01-02 03:04:05 */
const sqlDatetime = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/, 'Must be a MySQL datetime');

/**
 * Settings attached by selectSettings in indexcards repos/utils/settings.
 * null when the owner has no settings, absent when settings were not selected.
 */
export const settings = z.record(
	z.string(),
	z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(z.string(), z.unknown()), z.array(z.unknown())]),
).nullish().meta({
	description: 'Settings keyed by tag',
}) satisfies ZodOpenApiSchemaObject;

/**
 * Setting timestamps attached by selectSettings in indexcards repos/utils/settings.
 * created_at is only present for setting tables that have that column.
 */
export const settingsTimestamps = z.record(
	z.string(),
	z.object({
		created_at: sqlDatetime.nullish(),
		timestamp: sqlDatetime.nullish(),
	}),
).nullish().meta({
	description: 'Setting created_at and timestamp values keyed by tag',
}) satisfies ZodOpenApiSchemaObject;