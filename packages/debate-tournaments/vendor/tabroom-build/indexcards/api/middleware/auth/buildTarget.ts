// @ts-nocheck

import categoryRepo from '../../repos/categoryRepo.js';
import eventRepo from '../../repos/eventRepo.js';
import judgeRepo from '../../repos/judgeRepo.js';
import panelRepo from '../../repos/panelRepo.js';
import roundRepo from '../../repos/roundRepo.js';
import timeslotRepo from '../../repos/timeslotRepo.js';

import type { Database } from '../../data/database.js';
import type { ResourceId } from './types.js';

export type Target = {
	/** undefined for resources identified by more than one id (a ballot), which no perm is scoped to directly */
	id?: number;
	resource: string;
	tournId?: number;
	categoryId?: number;
	eventId?: number;
	roundId?: number;
	panelId?: number;
	judgeId?: number;
};

/** a stable cache key for a resource id: 12, or judgeId=12,panelId=34 */
export function resourceKey(resource: string, resourceId: ResourceId) {
	if (typeof resourceId === 'number') return `${resource}:${resourceId}`;
	const parts = Object.keys(resourceId).sort().map(name => `${name}=${resourceId[name]}`);
	return `${resource}:${parts.join(',')}`;
}

export async function buildTarget(db: Database, resource: string, resourceId: ResourceId, targetCache: Map<string, Target>): Promise<Target> {
	const key = resourceKey(resource, resourceId);
	const cached = targetCache.get(key);
	if (cached) return cached;

	// a judge's ballot rows on a panel, as one ballot. its parents are the judge and the panel
	if (resource === 'ballot') {
		if (typeof resourceId === 'number' || !resourceId.judgeId || !resourceId.panelId) {
			throw new Error('A ballot is identified by { judgeId, panelId }');
		}
		const { judgeId, panelId } = resourceId;
		const panelTarget = await buildTarget(db, 'panel', panelId, targetCache);
		const judgeTarget = await buildTarget(db, 'judge', judgeId, targetCache);
		const target: Target = {
			resource,
			judgeId,
			panelId,
			roundId: panelTarget.roundId,
			eventId: panelTarget.eventId,
			// category is a parent of the judge only. the panel's chain carries its event's category, which isn't
			categoryId: judgeTarget.categoryId,
			tournId: judgeTarget.tournId ?? panelTarget.tournId,
		};
		targetCache.set(key, target);
		return target;
	}

	if (typeof resourceId !== 'number') {
		throw new Error(`${resource} is identified by a single id`);
	}

	let target: Target = { id: resourceId, resource };
	//no parents to build
	if(resource === 'chapter'){
		targetCache.set(key, target);
		return target;
	}

	//build tourn target
	switch (resource) {
		case 'category': {
			const category = await categoryRepo.getCategory(db, resourceId);
			if (category && category.tourn) {
				target.tournId = category.tourn;
				target ={
					...await buildTarget(db, 'tourn', target.tournId, targetCache),
					...target,
				};
			}
			break;
		}
		case 'event': {
			const event = await eventRepo.getEvent(db,resourceId);
			if (event && event.tourn && event.category) {
				target.tournId = event.tourn;
				target.categoryId = event.category;
				target = {
					...await buildTarget(db, 'tourn', target.tournId, targetCache),
					...target,
				};
			}
			break;
		}
		case 'round': {
			const round = await roundRepo.getRound(db, resourceId);
			if (round && round.event) {
				target.eventId = round.event;
				target ={
					...await buildTarget(db, 'event', target.eventId, targetCache),
					...target,
				};
			}
			break;
		}
		case 'panel': {
			const panel = await panelRepo.getPanel(db,resourceId);
			if (panel && panel.round) {
				target.roundId = panel.round;
				target ={
					...await buildTarget(db, 'round', target.roundId, targetCache),
					...target,
				};
			}
			break;
		}
		case 'timeslot': {
			const timeslot = await timeslotRepo.getTimeslot(db, resourceId);
			if (timeslot && timeslot.tourn) {
				target.tournId = timeslot.tourn;
				target ={
					...await buildTarget(db, 'tourn', target.tournId, targetCache),
					...target,
				};
			}
			break;
		}
		case 'judge': {
			const judge = await judgeRepo.getJudge(db, resourceId);
			if (judge && judge.category) {
				target.categoryId = judge.category;
				target = {
					...await buildTarget(db, 'category', target.categoryId, targetCache),
					...target,
				};
			}
			break;
		}
		// no parent scopes to load
		case 'circuit':
		case 'tourn': {
			break;
		}
		default:
			throw new Error(`Unknown resource type: ${resource}`);
	}

	targetCache.set(key, target);
	return target;
}