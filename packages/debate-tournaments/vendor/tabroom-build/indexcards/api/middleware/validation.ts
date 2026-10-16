// @ts-nocheck
import { BadRequest, UnexpectedError } from '../helpers/problem.js';
import logger from '../helpers/logger.js';
import type { Request, Response, NextFunction } from '../_shims/express.js';
import type { RouteOpenApiConfig } from '../types/express.js';
import type { ZodOpenApiOperationObject } from 'zod-openapi';
import type { ZodType } from 'zod';

function isZodType(schema: unknown): schema is ZodType {
	return (
		!!schema
		&& typeof schema === 'object'
		&& 'safeParse' in schema
		&& typeof (schema as { safeParse?: unknown }).safeParse === 'function'
	);
}

function isHttpMethodKey(key: string) {
	return ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'].includes(key);
}

function getOpenApiForMethod(openapi: RouteOpenApiConfig | undefined, method: string): ZodOpenApiOperationObject | undefined {
	if (!openapi || typeof openapi !== 'object') {
		return undefined;
	}

	const normalizedMethod = method?.toLowerCase();
	const operationByMethod = normalizedMethod
		? (openapi as unknown as Record<string, unknown>)[normalizedMethod]
		: undefined;
	if (!normalizedMethod || !operationByMethod || typeof operationByMethod !== 'object') {
		return openapi as unknown as ZodOpenApiOperationObject;
	}

	const shared = Object.fromEntries(
		Object.entries(openapi).filter(([key]) => !isHttpMethodKey(key))
	);

	return {
		...shared,
		...(operationByMethod as Record<string, unknown>),
	} as ZodOpenApiOperationObject;
}

/**
 * A request whose params, query and body have been validated and coerced in
 * place by ValidateRequest. They are typed loosely because the route's zod
 * schemas, not Express, define their shape.
 */
export type ValidatedRequest = Omit<Request, 'params' | 'query' | 'body'> & {
	// oxlint-disable-next-line typescript/no-explicit-any
	params: any;
	// oxlint-disable-next-line typescript/no-explicit-any
	query: any;
	// oxlint-disable-next-line typescript/no-explicit-any
	body: any;
};

export async function ValidateRequest(req: Request, res: Response, next: NextFunction) {
	const openapi = getOpenApiForMethod(req.route?.openapi, req.method);
	const bodySchema = openapi?.requestBody?.content?.['application/json']?.schema;
	const paramsSchema = openapi?.requestParams;
	try {
		if (paramsSchema) {
			const pathSchema = paramsSchema.path;
			const querySchema = paramsSchema.query;
			let result;
			if (isZodType(pathSchema)) {
				result = pathSchema.safeParse(req.params);
				if(!result.success){
					logger.debug('Validation failed for request parameters:', result.error.issues);
					return BadRequest(req,res, 'Invalid request parameters', result.error.issues);
				}
				(req as ValidatedRequest).params = result.data;
			}
			if (isZodType(querySchema)) {
				result = querySchema.safeParse(req.query);
				if (!result.success) {
					logger.debug('Validation failed for request query:', result.error.issues);
					return BadRequest(req,res, 'Invalid request query', result.error.issues);
				}
				// req.query is a getter in Express 5, so it has to be redefined to replace it
				Object.defineProperty(req, 'query', {
					value: result.data,
					writable: true,
					configurable: true,
					enumerable: true,
				});
			}
		} else {
			logger.debug('no schema found for RequestParams');
		}
		if (isZodType(bodySchema)) {
			const result = bodySchema.safeParse(req.body);
			if (!result.success) {
				logger.debug('Validation failed for request body:', result.error.issues);
				return BadRequest(req,res, 'Invalid request body',result.error.issues);
			}
			req.body = result.data;
		} else {
			logger.debug('No schema found for request body');
		}
		next();
	} catch (error) {
		logger.error('Unexpected error during request validation:', error);
		return UnexpectedError(req, res, 'Unexpected error during request validation');
	}

}
