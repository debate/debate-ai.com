// @ts-nocheck
import { Router } from '../../../../_shims/express.js';
import * as controller from '../../../../controllers/rest/resultSetController.js';
import z from 'zod';
import { ValidateRequest } from '../../../../middleware/validation.js';
import { ResultSetSchema, EventResultSetsSchema } from '../../../../../../types/index.js';

// Note that this endpoint is for the delivery of result sets, which are
// collated and calculated sets of results organized by tiebreakers, not for
// individual round outcomes like win/loss or points of Round 4.

// Bolted onto /tourns/:tournId/results

const router = Router({ mergeParams: true });

router.route('/').get(ValidateRequest, controller.getResultSets).openapi = {
	path        : '/rest/tourns/{tournId}/results',
	summary     : 'Get tourn public result sets',
	description : 'Returns public result information for a given tournament',
	operationId : 'getTournResultSets',
	requestParams: {
		path: z.object({
			tournId: z.coerce.number().int().meta({ description: 'ID of the tournament to get results for' }),
		}),
	},
	responses: {
		200: {
			description: 'Result Sets connected to a given event, with published aggregated result data attached',
			content: {
				'application/json': {
					schema: z.record(z.coerce.number().int(), EventResultSetsSchema),
				},
			},
		},
	},
	tags: ['invite', 'public', 'results', 'pairings', 'Orval'],
};

router.route('/:resultSetId').get(ValidateRequest, controller.getResultSet).openapi = {
	path        : '/rest/tourns/{tournId}/results/{resultSetId}',
	summary     : 'Get public result set',
	description : 'Returns result set with full display information given a result set ID if it is public',
	operationId : 'getResultSet',
	requestParams: {
		query: z.object({
			nocache: z.coerce.boolean().optional().meta({
				description: 'Admin only option on whether to invalidate the cache',
			}),
		}),
		path: z.object({
		tournId     : z.coerce.number().int().meta({ description: 'ID of the tournament to get results for' }),
		resultSetId : z.coerce.number().int().meta({ description: 'ID of the result set to get' }),
		}),
	},
	responses: {
		200: {
			description: 'Result Set with published aggregated result data attached',
			content: {
				'application/json': {
					schema: z.array(ResultSetSchema),
				},
			},
		},
	},
	tags: ['invite', 'public', 'results', 'pairings','Orval'],
};

router.route('/event/:eventId').get(ValidateRequest, controller.getResultSets).openapi = {
	path        : '/rest/tourns/{tournId}/results/event/{eventId}',
	summary     : "Get event results",
	description : 'Returns public result information for a given event',
	operationId : 'getEventResultSets',
	requestParams: {
		path: z.object({
		tournId: z.coerce.number().int().meta({ description: 'ID of the tournament to get results for' }),
		eventId: z.coerce.number().int().meta({ description: 'ID of the event to get results for' }),
		}),
	},
	responses: {
		200: {
			description: 'Result Sets connected to a given event, with published aggregated result data attached',
			content: {
				'application/json': {
					schema: {
						type: 'object',
					},
				},
			},
		},
	},
	tags: ['invite', 'public', 'results', 'pairings'],
};

export default router;
