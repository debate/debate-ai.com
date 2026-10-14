// @ts-nocheck
import type { ZodOpenApiOperationObject, ZodOpenApiPathItemObject } from 'zod-openapi';
import type { Tourn } from '../data/schema.js';
import type { Selectable } from 'kysely';
import type { Actor, AuthInfo, SessionPerson } from '../middleware/auth/types.js';
import type { Database } from '../data/database.js';

type OperationMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace' | 'query';

/** params are only declared with zod (requestParams), never as raw parameter objects */
export type RouteOperation = Omit<ZodOpenApiOperationObject, 'parameters'>;

type RoutePathItem = Omit<ZodOpenApiPathItemObject, 'parameters' | 'additionalOperations' | OperationMethod>
	& Partial<Record<OperationMethod, RouteOperation>>;

export type RouteOpenApiConfig = (RoutePathItem | RouteOperation) & {
	path: string;
};

declare module 'express-serve-static-core' {
	interface IRoute<Route extends string = string> {
		openapi?: RouteOpenApiConfig;
	}
	interface Request {
		db: Database;
		actor: Actor;
		auth: AuthInfo;
		/** the person acting, the su target when su'd (see auth.su). null for anonymous requests */
		person: SessionPerson | null;
		tourn?: Selectable<Tourn>;
	}
}
