// @ts-nocheck
import type { ZodOpenApiSecuritySchemeObject, ZodOpenApiObject } from 'zod-openapi';

import config from '../../config.js';

const schemes: Record<string, ZodOpenApiSecuritySchemeObject> = {
	cookieAuth: {
		type: 'apiKey',
		in: 'cookie',
		name: config.cookie.name,
		description: `send the session token as a cookie.`,
	},
};

// The default API security requirements. Default to no required authentication.
const defaultSecurity: ZodOpenApiObject['security'] = [];

/**
 * sets the security to require one of the auth schemes. Can be used in individual route definitions to override the default.
 */
export const requireAuth: ZodOpenApiObject['security'] = [{ cookieAuth: [] }];
/** 
 * sets the security to optional auth. should be used for route where you don't need to be logged in, but if you are, something is different.
 */
export const optionalAuth: ZodOpenApiObject['security'] = [{}, ...requireAuth ];

//this is for some weird TS thing with declarations
type ApiSecurityConfig = {
    schemes: Record<string, ZodOpenApiSecuritySchemeObject>;
    defaultSecurity: ZodOpenApiObject['security'];
};
const apiSecurityConfig: ApiSecurityConfig = {
	schemes,
	defaultSecurity,
};

export default apiSecurityConfig;
