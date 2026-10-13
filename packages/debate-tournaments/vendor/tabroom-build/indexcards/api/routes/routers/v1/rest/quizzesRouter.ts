// @ts-nocheck
import { Router } from '../../../../_shims/express.js';
import con from '../../../../controllers/rest/QuizController.js';
import z from 'zod';
import { QuizSchema } from '../../../../../../types/index.js';
import { optionalAuth } from '../../../openapi/security.js';

const router = Router();

router.route('/')
  .get(con.getQuizzes).openapi = {
  	summary: 'Get all quizzes',
	path: '/rest/quizzes',
  	operationId: 'RestQuizzes',
  	description: 'Retrieve a list of all site wide quizzes.',
	tags: ['Quizzes','Orval'],
	security: optionalAuth,
	requestParams: {
		query: z.object({
			limit: z.coerce.number().optional().meta({ description: 'Number of quizzes to return' }),
			offset: z.coerce.number().optional().meta({ description: 'Number of quizzes to skip' }),
		}),
	},
	responses: {
		200: {
			description: 'List of quizzes',
			content: {
				'application/json': {
					schema: z.array(QuizSchema),
				},
			},
		},
	},
  };

  export default router;
