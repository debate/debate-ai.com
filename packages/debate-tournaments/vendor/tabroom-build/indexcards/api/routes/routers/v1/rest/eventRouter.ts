// @ts-nocheck
import { Router } from '../../../../_shims/express.js';
import * as controller from '../../../../controllers/rest/eventController.js';
import config from '../../../../config.js';
import { EventFieldSchema } from '../../../../../../types/index.js';
import z from 'zod';
import { ValidateRequest } from '../../../../middleware/validation.js';

const router = Router({ mergeParams: true });
// Bolted onto /tourns/:tournId/events

// NAMING CONVENTION:
// field      == list of entries in that event and public info thereon.
// schemats   == round assignments and pairings
// results    == round outcomes and scores
// resultSets == calculated tables of results
// brackets   == primary results data up to this round
// records    == both schematis and results in one big ol blob of fun.
if(!config.features.HIDE_DEV_ENDPOINTS) {
router.route('/').get(ValidateRequest, controller.getEvents).openapi = {
	path: '/rest/tourns/{tournId}/events',
	summary: 'Get Tournament Events',
	description: 'Retrieve a list of events associated with a specific tournament.',
	tags: ['Tournaments'],
	requestParams: {
		path: z.object({ tournId: z.coerce.number().int().positive() }),
	},
	responses: {
		200: {
			description: 'List of tournament events',
		},
		404: {
			$ref: '#/components/responses/NotFound',
		},
	},
};
}

if(!config.features.HIDE_DEV_ENDPOINTS) {
router.route('/:eventId/results').get(ValidateRequest, controller.getResults).openapi = {
	path        : '/rest/tourns/{tournId}/events/{eventId}/results',
	summary     : 'Get Published Results by Event',
	description : 'Given an Event ID, get published result records of the entries therein',
	tags        : ['Events', 'Results', 'Records', 'Entries'],
	requestParams: {
		path: z.object({
			tournId: z.coerce.number().int().positive(),
			eventId: z.coerce.number().int().positive(),
		}),
	},
	responses :{
		200             : {
			description : 'Entries with Win Loss data attached',
		},
		404: {
			$ref: '#/components/responses/NotFound',
		},
	},
};
}

router.route('/:eventAbbr/field').get(ValidateRequest, controller.getField).openapi = {
	path: '/rest/tourns/{tournId}/events/{eventAbbr}/field',
	summary: 'Get Entry Field by Event',
	description: 'Retrieve entries in the field for a specific event.',
	tags: ['Events'],
	requestParams: {
		path: z.object({
			tournId: z.coerce.number().int().positive(),
			eventAbbr: z.string().meta({ description: 'Abbreviation of the event' }),
		}),
	},
	responses: {
		200: {
			description: 'List of entries',
			content: {
				'application/json': {
					schema: EventFieldSchema,
				},
			},
		},
		404: {
			$ref: '#/components/responses/NotFound',
		},
	},
};
if(!config.features.HIDE_DEV_ENDPOINTS) {
// router.get('/:eventId', controller.getEventById);
// Need to distinguish this from a normal request by event ID which will be needed
router.route('/byAbbr/:eventAbbr').get(ValidateRequest, controller.getEventByAbbr).openapi = {
	path        : '/rest/tourns/{tournId}/events/byAbbr/{eventAbbr}',
	summary     : 'Get Event and Round List by Abbr',
	description : 'Returns Event object with list of published rounds given an event abbreviation',
	operationId : 'getEventByAbbr',
	requestParams: {
		path: z.object({
			tournId: z.coerce.number().int().positive(),
			eventAbbr: z.string().meta({ description: 'Abbreviation of the event' }),
		}),
	},
	responses: {
		200: {
			description: 'Event and Round List',
			content: {
				'application/json': {
					schema: {
						type: 'object',
					},
				},
			},
		},
	},
	tags: ['Invite', 'public', 'event', 'eventAbbr', 'rounds'],
};
}

export default router;
