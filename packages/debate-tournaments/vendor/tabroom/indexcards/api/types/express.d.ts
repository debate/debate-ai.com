// @ts-nocheck
import type { ZodOpenApiOperationObject, ZodOpenApiPathItemObject } from 'zod-openapi';
import type { Person, Tourn } from '../data/schema.js';
import type { Selectable } from 'kysely';
import type { Perm } from '../../middleware/authorization/authContext.js';

export type RouteOpenApiConfig = (ZodOpenApiPathItemObject | ZodOpenApiOperationObject) & {
	path: string;
};

type SessionPerson = { 
	id: number,
	first: string | null,
	last: string | null,
	email: string,
	site_admin: number | null,
};

declare module 'express-serve-static-core' {
	interface IRoute<Route extends string = string> {
		openapi?: RouteOpenApiConfig;
	}
	interface Request {
		actor: {
			type: 'person' | 'anonymous';
			Person?: SessionPerson;
			can: (resource: string, action: string, resourceId: number) => Promise<boolean>;
			assert: (resource: string, action: string, resourceId: number) => Promise<void>;
			allowedIds: (resource: string, action: string, opts?: Record<string, unknown>) => { all: boolean; ids: number[] };
		}; 
		session?: {
			id: number | null;
			person: number;
			su: number | null;
			Person?: SessionPerson;
			Su: SessionPerson | null;
		}
		auth?: {
			perms: Perm[];
		};
		valid: {
			// oxlint-disable-next-line typescript/no-explicit-any
			body?:any;
			// oxlint-disable-next-line typescript/no-explicit-any
			params?:any;
			// oxlint-disable-next-line typescript/no-explicit-any
			query?:any;
		};
		tourn?: Selectable<Tourn>;
	}
}

