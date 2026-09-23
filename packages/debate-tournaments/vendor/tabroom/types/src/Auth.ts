// @ts-nocheck
import * as z from 'zod';
import type { ZodOpenApiSchemaObject } from 'zod-openapi';

export const LoginRequestSchema = z.object({
	username: z.string().meta({
		description: 'The username of the user',
	}),
	password: z.string().meta({
		description: 'The password of the user',
	}),
}).meta({
	id: 'LoginRequest',
	description: 'A request to log in a user',
}) satisfies ZodOpenApiSchemaObject;

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
	token: z.string(),
	Person: z.object({
		id: z.int(),
		email: z.string(),
	}),
}).meta({
	id: 'LoginResponse',
	description: 'A response for a login request',
}) satisfies ZodOpenApiSchemaObject;

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const RegisterRequestSchema = z.object({
	email: z.email().meta({
		description: 'The email address of the new user',
	}),
	password: z.string().meta({
		description: 'The password for the new user',
	}),
	first: z.string().meta({
		description: 'The first name of the new user',
	}),
	middleName: z.string().nullish().meta({
		description: 'The middle name of the new user',
	}),
	last: z.string().meta({
		description: 'The last name of the new user',
	}),
	phoneNumber: z.string().nullish().meta({
		description: 'The phone number of the new user',
	}),
	state: z.string().nullish().meta({
		description: 'The 2 letter state code of the new user',
		example: 'IA',
	}),
	country: z.string().nullish().meta({
		description: 'The 2 letter country code of the new user',
		example: 'US',
	}),
	tz: z.string().nullish().meta({
		description: 'The IANA timezone of the new user',
	}),

}).meta({
	id: 'RegisterRequest',
	description: 'A request to register a new user',
}) satisfies ZodOpenApiSchemaObject;

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
