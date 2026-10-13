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

export async function ValidateRequest(req: Request, res: Response, next: NextFunction) {
	const openapi = getOpenApiForMethod(req.route?.openapi, req.method);
	const bodySchema = openapi?.requestBody?.content?.['application/json']?.schema;
	const paramsSchema = openapi?.requestParams;
	req.valid = {
		body: undefined,
		params: undefined,
		query: undefined
	};
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
				req.valid.params = result.data;
			}
			if (isZodType(querySchema)) {
				result = querySchema.safeParse(req.query);
				if (!result.success) {
					logger.debug('Validation failed for request query:', result.error.issues);
					return BadRequest(req,res, 'Invalid request query', result.error.issues);
				}
				req.valid.query = result.data;
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
			req.valid.body = result.data;
		} else {
			logger.debug('No schema found for request body');
		}
		next();
	} catch (error) {
		logger.error('Unexpected error during request validation:', error);
		return UnexpectedError(req, res, 'Unexpected error during request validation');
	}

}
