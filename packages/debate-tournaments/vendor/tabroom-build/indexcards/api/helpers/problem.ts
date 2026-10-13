// @ts-nocheck
import type { Problem } from '../../../types/index.js';
import type { Request, Response } from '../_shims/express.js';
export function sendProblem(req: Request, res: Response, {
	type = 'about:blank',
	title,
	status,
	detail,
	instance = req.originalUrl ?? '',
	...extras
}: Partial<Problem> & Record<string, unknown>) {
	return res
	.status(status ?? 500)
	.type('application/problem+json')
	.json({
		type,
		title,
		status,
		detail,
		instance,
		...extras,
	});
}

export function BadRequest(req: Request, res: Response, detail?: string, issues = {}){
	return sendProblem(req, res, {
		title: 'Request Validation Failed',
		status: 400,
		detail,
		issues,
	});
}
//I hate that the 401 Unauthorized is technically for unauthenticated issues but we live in a society after all
export function Unauthorized(req: Request, res: Response, detail?: string, extras = {}) {
	return sendProblem(req, res, {
		title: 'Invalid or Missing Credentials',
		status: 401,
		detail,
		...extras,
	});
}
export function Forbidden(req: Request, res: Response, detail?: string, extras = {}){
	return sendProblem(req, res, {
		title: 'You Do Not Have Access to This Resource',
		status: 403,
		detail,
		...extras,
	});
}
export function NotFound(req: Request, res: Response, detail?: string, extras = {}){
	return sendProblem(req, res, {
		title: 'The specified resource was not found.',
		status: 404,
		detail,
		...extras,
	});
}
export function Conflict(req: Request, res: Response, detail?: string, extras = {}){
	return sendProblem(req, res, {
		title: 'The request conflicts with the current state of the resource.',
		status: 409,
		detail,
		...extras,
	});
}
// The request was well-formed but breaks the resource's rules. errors says how, e.g. BallotError[]
export function UnprocessableEntity(req: Request, res: Response, detail?: string, errors: unknown[] = [], extras = {}){
	return sendProblem(req, res, {
		title: 'The request could not be processed.',
		status: 422,
		detail,
		errors,
		...extras,
	});
}
export function UnexpectedError(req: Request, res: Response, detail?: string, extras = {}){
	return sendProblem(req, res, {
		title: 'The Server has encountered an unexpected error.',
		status: 500,
		detail,
		...extras,
	});
}
export function NotImplemented(req: Request, res: Response, detail?: string, extras = {}){
	return sendProblem(req, res, {
		title: 'This function is not yet implemented.',
		status: 501,
		detail,
		...extras,
	});
}
export function ServiceUnavailable(req: Request, res: Response, detail?: string, extras = {}){
	return sendProblem(req, res, {
		title: 'The Server is temporarily unable to handle the request.',
		status: 503,
		detail,
		...extras,
	});
}
export function RateLimitExceeded(req: Request, res: Response, detail?: string, extras = {}){
	return sendProblem(req, res, {
		title: 'Rate limit exceeded',
		status: 429,
		detail,
		...extras,
	});
}
