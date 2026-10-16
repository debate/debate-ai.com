// @ts-nocheck
import z from 'zod';
import controller from '../../../../controllers/rest/paradigmsController.js';
import { Unauthorized } from '../../../../helpers/problem.js';
import { ValidateRequest } from '../../../../middleware/validation.js';
import { JudgeRecordSchema, ParadigmDetailsSchema, ParadigmSearchResultSchema } from '../../../../../../types/index.js';
import { Router } from '../../../../_shims/express.js';

const router = Router();

//searching paradigms requires a user to be logged in
// debate-ai: a signed-in host user with no Tabroom person row still counts, so
// check the actor rather than requirePerson (which also demands req.person).
router.use((req, res, next) => {
	if (req.actor?.type !== 'person') {
		return Unauthorized(req, res, 'User not Authenticated');
	}
	next();
});

router.route('/').get(ValidateRequest, controller.getParadigms).openapi = {
	path: '/rest/paradigms',
	summary: 'Search paradigms',
	operationId: 'restParadigms',
	tags: ['Paradigms', 'Orval'],
	requestParams: {
		query: z.object({
			search: z.string().optional().meta({
				description: 'Search query for paradigms',
			}),
			limit: z.coerce.number().min(1).max(100).default(50).meta({
				description: 'Maximum number of paradigms to return',
			}),
			offset: z.coerce.number().min(0).default(0).meta({
				description: 'Number of paradigms to skip before starting to return results',
			}),
		}),
	},
	responses: {
		200: {
			description: 'List of paradigms matching the search query',
			content: {
				'application/json': {
					schema: z.array(ParadigmSearchResultSchema),
				},
			},
		},
	},
};
router.route('/:personId').get(ValidateRequest, controller.getParadigmByPersonId).openapi = {
	path: '/rest/paradigms/{personId}',
	summary: 'Get paradigm details by person ID',
	operationId: 'restParadigm',
	tags: ['Paradigms', 'Orval'],
	requestParams: {
		path: z.object({
			personId: z.coerce.number().positive().meta({
				description: 'ID of the person to get paradigm details for',
			}),
		}),
	},
	responses: {
		200: {
			description: 'Paradigm details for the specified person ID',
			content: {
				'application/json': {
					schema: ParadigmDetailsSchema,
				},
			},
		},
		404: { $ref: '#/components/responses/NotFound' },
		default: { $ref: '#/components/responses/ErrorResponse' },
	},
};
router.route('/:personId/record').get(ValidateRequest, controller.getJudgingRecord).openapi = {
	path: '/rest/paradigms/{personId}/record',
	summary: 'Get judging record by person ID',
	operationId: 'restParadigmsRecord',
	tags: ['Paradigms', 'Orval'],
	requestParams: {
		path: z.object({
			personId: z.coerce.number().positive().meta({
				description: 'ID of the person to get paradigm details for',
			}),
		}),
	},
	responses: {
		200: {
			description: 'Judging record for the specified person ID',
			content: {
				'application/json': {
					schema: z.array(JudgeRecordSchema),
				},
			},
		},
	},
};

export default router;