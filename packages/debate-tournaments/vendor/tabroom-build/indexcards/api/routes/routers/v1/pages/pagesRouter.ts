// @ts-nocheck
import { Router } from '../../../../_shims/express.js';
import * as inviteController from '../../../../controllers/pages/invite/inviteController.js';
import * as schematController from '../../../../controllers/pages/invite/schematController.js';
import * as pageResultController from '../../../../controllers/pages/invite/resultsController.js';
import * as resultSetController from '../../../../controllers/rest/resultSetController.js';
import z from 'zod';
import { NSDACategorySchema, RoundResultsSchema, TournByWebnameSchema, UpcomingSchema } from '../../../../../../types/index.js';
import config from '../../../../config.js';

import { ValidateRequest } from '../../../../middleware/validation.js';
const router = Router();

// These paths are bolted onto /v1/pages

router.route('/invite/nsdaCategories').get(inviteController.getNSDACategories).openapi = {
	path: '/pages/invite/nsdaCategories',
	summary: 'Get NSDA Event Categories',
	description: 'Retrieve a list of NSDA event categories.',
	tags: ['Invite'],
	responses: {
		200: {
			description: 'List of NSDA event categories',
			content: { 'application/json': { schema: z.array(NSDACategorySchema) } },
		},
	},
};
router.route('/invite/upcoming').get(ValidateRequest, inviteController.getFutureTourns).openapi = {
	path: '/pages/invite/upcoming',
	summary     : 'Returns the public listing of upcoming tournaments',
	requestParams: {
		query: z.object({
			limit: z.coerce.number().int().positive().optional().meta({ description: 'Maximum number of tournaments to return' }),
			state: z.string().regex(/^[A-Za-z]{2}$/).optional().meta({ description: 'Two letter state code to filter tournaments by' }),
		}),
	},
	responses   : {
		200: {
			description: 'List of public upcoming tournaments',
			content: { 'application/json': { schema: z.array(UpcomingSchema) } },
		},
	},
	tags: ['futureTourns', 'Invite'],
};
router.route('/invite/webname/:webname').get(ValidateRequest, inviteController.getTournIdByWebname).openapi = {
	path: '/pages/invite/webname/{webname}',
	summary: 'Get Tournament ID by Webname',
	description: 'Retrieve the tournament ID and details by webname.',
	tags: ['Invite'],
	requestParams: {
		path: z.object({
			webname: z.string().meta({ description: 'The tournament webname, or a tournament id' }),
		}),
	},
	responses: {
		200: {
			description: 'Tournament information',
			content: { 'application/json': { schema: TournByWebnameSchema } },
		},
	},
};
if(!config.features.HIDE_DEV_ENDPOINTS) {
router.route('/invite/nextweek').get(inviteController.getThisWeekTourns).openapi = {
	path: '/pages/invite/nextweek',
	summary	 : 'Returns the public listing of upcoming tournaments in this week',
	operationId : 'listWeeksTourns',
	responses: {
		200: {
			description: "List of this week's tournaments, with some stats",
			content: { 'application/json': { schema: { $ref: '#/components/schemas/Tourn' } } },
		},
	},
	tags: ['Invite'],
};
router.route('/tiebreaks/:roundId').get(ValidateRequest, resultSetController.getTiebreaks).openapi = {
	path: '/pages/tiebreaks/{roundId}',
	summary: 'Get tiebreaks needed for a protocol id.  This is just for Palmer testing and will go poof.',
	description: 'for testing and dev',
	tags: ['Invite', 'Schematics', 'Rounds'],
	requestParams: {
		path: z.object({ roundId: z.coerce.number().int().positive() }),
	},
	responses: {
		200: {
			description: 'Round Information',
		},
	},
};

router.route('/protocol/round/:roundId').get(ValidateRequest, resultSetController.getTiebreaks).openapi = {
	path: '/pages/protocol/round/{roundId}',
	summary: 'Get tiebreaks needed for a protocol id',
	description: 'for testing and dev',
	tags: ['Invite', 'Schematics', 'Rounds'],
	requestParams: {
		path: z.object({ roundId: z.coerce.number().int().positive() }),
	},
	responses: {
		200: {
			description: 'Round Information',
		},
	},
};

router.route('/invite/:tournId/:eventAbbr/:roundName').get(ValidateRequest, schematController.getSchematic).openapi = {
	path: '/pages/invite/{tournId}/{eventAbbr}/{roundName}',
	summary: 'Round Schematic',
	description: 'Gives data for the display of a public round schematic',
	tags: ['Invite', 'Schematics', 'Rounds'],
	requestParams: {
		path: z.object({
			tournId   : z.coerce.number().int().positive(),
			eventAbbr : z.string(),
			roundName : z.coerce.number().int(),
		}),
	},
	responses: {
		200: {
			description: 'Round Information',
		},
	},
};
}

router.route('/invite/:tournId/:eventAbbr/:roundName/results').get(ValidateRequest, pageResultController.getRoundResults).openapi = {
	path        : '/pages/invite/{tournId}/{eventAbbr}/{roundName}/results',
	summary     : 'Round published results',
	description : 'Returns results display information for a given round',
	operationId : 'getRoundPublicResults',
	requestParams: {
		path: z.object({
			tournId   : z.coerce.number().int().meta({ description: 'ID of the tournament to get results for' }),
			eventAbbr : z.string().meta({ description: 'Event Abbreviation of the round' }),
			roundName : z.coerce.number().meta({ description: 'Number of the round' }),
		}),
	},
	responses: {
		200: {
			description: 'Aggregated section data with results if they are public',
			content: {
				'application/json': {
					schema: RoundResultsSchema,
				},
			},
		},
	},
	tags: ['Invite', 'Results', 'Pairings'],
};


export default router;
