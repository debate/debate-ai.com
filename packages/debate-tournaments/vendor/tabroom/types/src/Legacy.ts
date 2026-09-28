// @ts-nocheck
// From https://coderwall.com/p/jmarug/regex-to-check-for-valid-mysql-datetime-format
// Accepts both YYYY-MM-DD and YYYY-MM-DD HH:mm:ss
import type { ZodOpenApiSchemaObject } from 'zod-openapi';

export const CaselistLinkSchema = {
	type : 'object',
	properties : {
		person_id    : { type : 'integer' },
		slug         : { type : ['string', 'null'] },
		caselist_key : { type : ['string', 'null'] },
		eventcode    : { type : ['integer', 'null'] },
	},
} as const satisfies ZodOpenApiSchemaObject;

export const ShareSchema = {
	type : 'object',
	properties : {
		panels      : { type : ['array', 'null'] },
		files       : { type : ['array', 'null'] },
		from        : { type : ['string', 'null'] },
	},
} as const satisfies ZodOpenApiSchemaObject;
export const InviteSchema = {
	type : 'object',
	properties : {
		name : { type : ['string', 'null'] },
	},
} as const satisfies ZodOpenApiSchemaObject;

export const SearchSchema = {
	type : 'object',
	properties : {
		result : { type : ['string', 'null'] },
	},
} as const satisfies ZodOpenApiSchemaObject;
