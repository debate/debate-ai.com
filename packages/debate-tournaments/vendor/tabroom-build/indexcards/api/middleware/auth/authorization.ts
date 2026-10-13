// @ts-nocheck
import { buildTarget, resourceKey, type Target } from './buildTarget.js';
import { Unauthorized, Forbidden } from '../../helpers/problem.js';
import type { Request, Response, NextFunction } from '../../_shims/express.js';
import type { Actor, AuthError, Perm, ResourceId, SessionPerson } from './types.js';
import type { Database } from '../../data/database.js';

/** middleware that rejects anonymous requests. the OpenAPI spec marks routes behind one of these as requiring auth */
export const authMiddleware = new WeakSet<Function>();
/**
 * the person making the request. throws a 401 (handled by errorHandler) when there is none,
 * so handlers can use the result without null checks
 */
export function getPerson(req: Pick<Request, 'person'>): SessionPerson {
	if (!req.person) {
		const err = new Error('User not Authenticated') as AuthError;
		err.status = 401;
		err.code = 'AUTH_UNAUTHENTICATED';
		throw err;
	}
	return req.person;
}

//requires a logged in person - use before any route that acts as or on behalf of a person
export function requirePerson(req: Request, res: Response, next: NextFunction) {
	if (!req.person || req.actor?.type !== 'person') {
		return Unauthorized(req, res,'User not Authenticated');
	}
	next();
}
authMiddleware.add(requirePerson);

// should be rolled into the RBAC scheme at some point
export function requireSiteAdmin(req: Request, res: Response, next: NextFunction) {
	if (!req.actor) {
		return Unauthorized(req, res,'User not Authenticated');
	}
	if (!req.actor.Person?.site_admin){
		return Forbidden(req, res,'This Resource is Restricted to Site Administrators');
	}
	next();
}
authMiddleware.add(requireSiteAdmin);

/**
 * route middleware: 403 unless the actor can perform action on resource.
 * the resource id comes from the :<resource>Id path param, or from resolveId for
 * resources identified some other way (e.g. a ballot by its judge and panel)
 */
export function requireAccess(resource: string, action: string, resolveId?: (req: Request) => ResourceId) {
	const middleware = async (req: Request, res: Response, next: NextFunction) => {
		// anonymous actors can't be granted anything, so the answer is "log in", not "forbidden"
		if (!req.actor || req.actor.type === 'anonymous') {
			return Unauthorized(req, res,'User not Authenticated');
		}
		const resourceId = resolveId ? resolveId(req) : Number(req.params[resource + 'Id']);
		try{
			await req.actor.assert(resource, action, resourceId);
			next();
		}
		catch(err: unknown){
			if (err instanceof Error && (err as AuthError).code === 'AUTH_FORBIDDEN'){
				return Forbidden(req, res,`You do not have permission to ${action} on ${resource}: ${formatResourceId(resourceId)}`);
			}
			return next(err);
		}
	};
	authMiddleware.add(middleware);
	return middleware;
}

function formatResourceId(resourceId: ResourceId) {
	if (typeof resourceId === 'number') return String(resourceId);
	return Object.entries(resourceId).map(([key, id]) => `${key} ${id}`).join(', ');
}

/**
 * create an actor for the given person, or an anonymous actor if there is none.
 * the actor holds its own perms, which auth context loaders add with grant()
 */
export function createActor(db: Database, person?: SessionPerson | null): Actor {
	//if the request is scoped to a specific person
	if(person){
		return {
			id: person.id,
			Person: person,
			type: 'person',
			...createAuthContext(db, person),
		};
	}
	// unauthenticated
	return {
		type: 'anonymous',
		can: async () => false,
		assert: async () => {
			const err = new Error('Forbidden') as AuthError;
			err.status = 403;
			err.code = 'AUTH_FORBIDDEN';
			throw err;
		},
		allowedIds: () => ({ all: false, ids: [] }),
		grant: () => {},
	};
}
// this is a misnomer, I should rename it RT
function createAuthContext(db: Database, person: SessionPerson) {
	// Per-actor cache
	const targetCache = new Map();
	const permCache = new Map();
	const perms: Perm[] = [];

	function grant(newPerms: Perm[]) {
		perms.push(...newPerms);
		//cached decisions were made without these perms
		permCache.clear();
	}

	async function can(resource: string, action: string, resourceId: ResourceId) {
		if (!resource || !action) {
			throw new Error('Invalid auth call');
		}

		if(person.site_admin){
			return true;
		}

		// JS callers pass path params straight through, e.g. '12'
		if (typeof resourceId === 'string') resourceId = Number(resourceId);

		const key = resourceKey(resource, resourceId);

		// Build target once per request
		let target = targetCache.get(key);

		if (!target) {
			target = await buildTarget(db, resource, resourceId, targetCache);
			targetCache.set(key, target);
		}
		const permKey = `${key}:${action}`;

		if (permCache.has(permKey)) {
			return permCache.get(permKey);
		}

		const result = checkAccess(
			resource,
			action,
			target,
			perms,
		);

		permCache.set(permKey, result);

		return result;
	}

	async function assert(resource: string, action: string, resourceId: ResourceId) {
		const ok = await can(resource, action, resourceId);

		if (!ok) {
			const err = new Error('Forbidden') as AuthError;
			err.status = 403;
			err.code = 'AUTH_FORBIDDEN';
			throw err;
		}

		return;
	}

	function allowedIds(resource: string, action: string, opts: Record<string, unknown> = {}) {
		if (!resource || !action) {
			throw new Error('Invalid auth call');
		}
		if (person.site_admin) {
			return { all: true, ids: [] };
		}

		return getAllowedResourceIds(resource, action, perms, opts);
	}

	return {
		can,
		assert,
		allowedIds,
		grant,
	};
}

type RoleDef = {
	description: string;
	permissions: {
		actions: string[];
		notActions?: string[];
	}[];
	parentAccess?: Record<string, string[]>;
};
const ROLES: Record<string, RoleDef> = {
	owner: {
		description: 'Resource Owner - full access to resource and its children',
		permissions: [
			{
				actions: ['*/*'],
				notActions: [],
			},
		],
		parentAccess: {
			tourn: ['tourn/read'],
			category: ['category/read'],
		},
	},
	tabber: {
		description: 'Tabber - manage resource and its children except ownership',
		permissions: [
			{
				actions: ['*/*'],
				notActions: ['tourn/owner'],
			},
		],
		parentAccess: {
			tourn: ['timeslot/read'],
			category: ['category/read', 'jpool/read'],
		},
	},
	circuit: {
		description: 'Circuit administrator - manage a circuit and its tourns',
		permissions: [
			{
				actions: ['*/*'],// allow any action on any scoped resource
			},
		],
	},
	//used for things like ext auth where the role is a boolean check
	authorized: {
		description: 'External API authorization - scoped to specific API actions',
		permissions: [
			{
				actions: ['*/*'],
			},
		],
	},
	//the person a record belongs to (a judge, student, etc). only applies within the scope it's granted on
	self: {
		description: 'The person a record belongs to',
		permissions: [
			{
				actions: ['judge/read', 'ballot/*'],
			},
		],
	},
	//admin of the resource, used for chapters
	chapterAdmin: {
		description: 'resource administrator - manage a chapter and its resources',
		permissions: [
			{
				actions: ['chapter/*'],// allow any action on any scoped resource
				notActions: ['chapter/owner'], //disallow anything only owner can do.
			},
		],
	},
	//indicates an actor can do prefs for a given chapter
	prefs: {
		description: 'prefs - can manage prefs for a chapter',
		permissions: [
			{
				actions: ['chapter/prefs'],
			},
		],
	},
};
/**
 * Roles scoped to the parent resource can grant access to child resources. ex: action
 * *\/read on circuit scope grants read access to tourns in that circuit
 * Note: category and event are siblings under tourn, not parent-child (no inheritance)
 * but event can access category resources via parentAccess
 */
const CHILDREN: Record<string, string[]> = {
	tourn: ['category', 'event', 'timeslot'],   // Tourn has these direct children
	category: ['jpool', 'judge'],   // Category has jpools and judges as children
	event: ['round'],               // Event has these direct children
	round: ['panel'],
	judge: ['ballot'],              // a ballot has two parents: its judge and its panel
	panel: ['ballot'],
};

/**
 * Action hierarchy - higher actions grant lower actions
 * write > read > check
 *
 * Example: If a user has 'read' permission, they can also perform 'check' actions.
 * Note actionMatches only looks one level down: 'write' grants 'read' but not 'check'.
 */
const ACTION_HIERARCHY: Record<string, string[]> = {
	read: ['check'],
	write: ['read'],
};

/**
 * Get all actions that would grant the requested action (including itself)
 * e.g., for 'check' returns ['check', 'read', 'write', 'owner']
 */
function getActionChain(action: string) {
	const chain = [action];

	// Find which higher actions grant this action
	for (const [higherAction, grantsActions] of Object.entries(ACTION_HIERARCHY)) {
		if (grantsActions.includes(action)) {
			chain.push(higherAction);
			// Recursively add even higher actions
			const higher = getActionChain(higherAction);
			chain.push(...higher.filter(a => !chain.includes(a)));
		}
	}

	return chain;
}

export function checkAccess(resource: string, action: string, target: Target, perms: Perm[]){

	if (!perms || !Array.isArray(perms)) return false;

	return perms.some(perm => hasPermissionForResource(resource, action, target, perm));
}

function hasPermissionForResource(resource: string, action: string, target: Target, perm: Perm, visited = new Set(), targetResource = resource) {
	const roleDef = ROLES[perm.role];
	if (!roleDef) {
		throw new Error(`Role definition for '${perm.role}' is not implemented`);
	}

	//Check direct match on this resource
	if (!perm.id || (perm.scope === resource && perm.id === target.id)) {
		for (const p of roleDef.permissions) {
			// Denied takes precedence - check if any action in the chain is denied
			const actionChain = getActionChain(action);
			if (actionChain.some(act => p.notActions?.some(pattern => actionMatches(pattern, targetResource, act)))) {
				continue;
			}
			// Allowed patterns
			if (p.actions.some(pattern => actionMatches(pattern, targetResource, action))) {
				return true;
			}
		}
	}

	//Check parent resources recursively
	for (const parent of Object.keys(CHILDREN)) {
		if (!CHILDREN[parent].includes(resource)) continue;

		const idsKey = parent + 'Ids' as keyof Target;

		const parentIdKey = parent + (Array.isArray(target[idsKey]) ? 'Ids' : 'Id') as keyof Target;
		const parentIds = Array.isArray(target[parentIdKey]) ? target[parentIdKey] : [target[parentIdKey]];

		for (const id of parentIds) {
			const cacheKey = `${perm.role}:${parent}:${id}`;
			if (visited.has(cacheKey)) continue;
			visited.add(cacheKey);

			// Check if permission directly matches parent
			if (perm.scope === parent && perm.id === id) {
				for (const p of roleDef.permissions) {
					const actionChain = getActionChain(action);
					if (actionChain.some(act => p.notActions?.some(pattern => actionMatches(pattern, targetResource, act)))) continue;
					if (p.actions.some(pattern => actionMatches(pattern, targetResource, action))) return true;
				}
			}

			// Recurse to grandparents
			if (hasPermissionForResource(parent, action, { ...target, id }, perm, visited,targetResource)) {
				return true;
			}
		}
	}

	// Check parentAccess - child scope can access parent resources
	if (roleDef.parentAccess) {
		for (const [parentScope, allowedActions] of Object.entries(roleDef.parentAccess)) {
			const parentIdAttr = `${parentScope}Id` as keyof Perm & keyof Target;

			if (
				perm[parentIdAttr] &&
				target[parentIdAttr] &&
				perm[parentIdAttr] === target[parentIdAttr]
			) {
				if (allowedActions.some(pattern => actionMatches(pattern, targetResource, action))) {
					return true;
				}
			}
		}
	}

	return false;
}

function actionMatches(pattern: string, resource: string, action: string) {
	const [resPattern, actPattern] = pattern.split('/');
	const resMatch = resPattern === '*' || resPattern === resource;

	// Check exact match
	if (actPattern === '*' || actPattern === action) {
		return resMatch;
	}

	// Check if pattern action grants the requested action via hierarchy
	const grantsActions = ACTION_HIERARCHY[actPattern] || [];
	if (grantsActions.includes(action)) {
		return resMatch;
	}

	return false;
}

function roleAllowsAction(roleDef: RoleDef, resource: string, action: string) {
	for (const p of roleDef.permissions) {
		if (p.notActions?.some(pattern => actionMatches(pattern, resource, action))) {
			continue;
		}
		if (p.actions?.some(pattern => actionMatches(pattern, resource, action))) {
			return true;
		}
	}
	return false;
}

function getAllowedResourceIds(resource: string, action: string, perms: Perm[], opts: Record<string, unknown> = {}) {
	const ids = new Set<number>();
	let hasFullAccess = false;

	for (const perm of perms) {
		const roleDef = ROLES[perm.role];
		if (!roleDef) continue;

		// Check direct scope match
		if (perm.scope === resource && roleAllowsAction(roleDef, resource, action)) {
			ids.add(perm.id);
			continue;
		}

		// Check parent inheritance - can a parent scope grant access to this resource?
		for (const [parentScope, children] of Object.entries(CHILDREN)) {
			if (children.includes(resource) && perm.scope === parentScope) {
				if (roleAllowsAction(roleDef, resource, action)) {
					// Parent scope grants full access to this resource type
					hasFullAccess = true;
					break;
				}
			}
		}

		if (hasFullAccess) break;

		// Check parentAccess - can this child scope access parent resources?
		if (roleDef.parentAccess) {
			for (const [parentScope, allowedActions] of Object.entries(roleDef.parentAccess)) {
				if (resource === parentScope || (CHILDREN[parentScope]?.includes(resource))) {
					if (allowedActions.some(pattern => actionMatches(pattern, resource, action))) {
						// This child perm grants access to parent's resources
						const parentIdAttr = parentScope + 'Id' as keyof Perm;
						if (perm[parentIdAttr]) {
							// For resources under the parent scope, we'd need full access flag
							// For simplicity, mark as partial access requiring filtering
							if (resource === parentScope) {
								ids.add(perm[parentIdAttr] as number);
							}
						}
					}
				}
			}
		}
	}

	return { all: hasFullAccess, ids: Array.from(ids) };
}