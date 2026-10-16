// @ts-nocheck
import { Router } from '../../../../_shims/express.js';
import * as controller from '../../../../controllers/rest/roundController.js';
import config from '../../../../config.js';
import { PublishedRoundSchema } from '../../../../../../types/index.js';
import z from 'zod';
import { ValidateRequest } from '../../../../middleware/validation.js';

const router = Router({ mergeParams: true });

const roundParams = z.object({
	tournId: z.coerce.number().int().positive(),
	roundId: z.coerce.number().int().positive(),
});

// Bolted onto /tourns/:tournId/rounds

// NAMING CONVENTION:
// schemats == round assignments and pairings
// results  == round outcomes and scores
// brackets == primary results data up to this round
// records  == both!

router.route('/').get(ValidateRequest, controller.getPublishedRounds).openapi = {
	path: '/rest/tourns/{tournId}/rounds',
	summary: 'Get Tourn Published Rounds',
	description: 'Retrieve a list of published rounds for an entire tournament.',
	tags: ['Tournaments', 'Rounds'],
	requestParams: {
		path: z.object({ tournId: z.coerce.number().int().positive() }),
	},
	responses: {
		200: {
			description: 'List of published rounds',
			content: {
				'application/json': {
					schema: z.array(PublishedRoundSchema),
				},
			},
		},
		404: {
			$ref: '#/components/responses/NotFound',
		},
	},
};
if(!config.features.HIDE_DEV_ENDPOINTS) {
router.route('/:roundId').get(ValidateRequest, controller.getPublishedRound).openapi = {
	path: '/rest/tourns/{tournId}/rounds/{roundId}',
	summary     : 'Returns a single Round object an ID if it is published',
	operationId : 'getRound',
	requestParams: { path: roundParams },
	responses: {
		200: {
			description: 'Object of Round with public information on it',
			content: {
				'application/json': {
					schema: {
						type: 'object', // There is a schemat for it somewhere...urk.
					},
				},
			},
		},
		default: { $ref: '#/components/responses/ErrorResponse' },
	},
	tags: ['Invite', 'public', 'schematics', 'rounds', 'Pairings'],
};

router.route('/:roundId/schematic').get(ValidateRequest, controller.getPublishedSchematic).openapi = {
	path        : '/rest/tourns/{tournId}/rounds/{roundId}/schematic',
	summary     : 'Returns public round information necessary to create a full schematic',
	operationId : 'getSchematic',
	requestParams: { path: roundParams },
	responses: {
		200: {
			description: `Object of Round with public information on it for a schematic,
			 		which includes a list of entries or sections as appropriate.`,
			content: {
				'application/json': {
					schema: {
						type: 'object',
					},
				},
			},
		},
		default: { $ref: '#/components/responses/ErrorResponse' },
	},
	tags: ['Invite', 'public', 'schematics', 'rounds', 'Pairings'],
};

router.route('/:roundId/brackets').get(ValidateRequest, controller.getPublishedBrackets).openapi = {
	path        : '/rest/tourns/{tournId}/rounds/{roundId}/brackets',
	summary     : 'Get published primary results data leading up to this round for brackets',
	description : 'Gets the outcome scores of the present round if published',
	tags        : ['Events', 'Results', 'Records', 'Entries'],
	requestParams: { path: roundParams },
	responses :{
		200             : {
			description : 'Entries with Win Loss data attached',
		},
		404: {
			$ref: '#/components/responses/NotFound',
		},
	},
};

router.route('/:roundId/results').get(ValidateRequest, controller.getPublishedResults).openapi = {
	path        : '/rest/tourns/{tournId}/rounds/{roundId}/results',
	summary     : 'Get Published Results for a Round',
	description : 'Gets the outcome scores of the present round if published',
	tags        : ['Events', 'Results', 'Records', 'Entries'],
	requestParams: { path: roundParams },
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

export default router;