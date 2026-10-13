// @ts-nocheck

import categoryRepo from '../../repos/categoryRepo.js';
import eventRepo from '../../repos/eventRepo.js';
import panelRepo from '../../repos/panelRepo.js';
import roundRepo from '../../repos/roundRepo.js';
import timeslotRepo from '../../repos/timeslotRepo.js';

import { db } from '../../data/database.js';

export type Target = {
	id: number;
	resource: string;
	tournId?: number;
	categoryId?: number;
	eventId?: number;
	roundId?: number;
};

export async function buildTarget(resource: string, resourceId: number, targetCache: Map<string, Target>) {
	const key = `${resource}:${resourceId}`;
	if (targetCache.has(key)) return targetCache.get(key);

	let target: Target = { id: resourceId, resource };
	//no parents to build
	if(resource.startsWith('api_auth_')){
		targetCache.set(key, target);
		return target;
	}
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
					...await buildTarget('tourn', target.tournId, targetCache),
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
					...await buildTarget('tourn', target.tournId, targetCache),
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
					...await buildTarget('event', target.eventId, targetCache),
					...target,
				};
			}
			break;
		}
		case 'section': {
			const panel = await panelRepo.getPanel(db,resourceId);
			if (panel && panel.round) {
				target.roundId = panel.round;
				target ={
					...await buildTarget('round', target.roundId, targetCache),
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
					...await buildTarget('tourn', target.tournId, targetCache),
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