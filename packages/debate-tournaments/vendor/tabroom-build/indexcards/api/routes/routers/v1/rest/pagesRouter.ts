// @ts-nocheck
import { Router } from '../../../../_shims/express.js';
import * as controller from '../../../../controllers/rest/pageController.js';
import { z } from 'zod';
import { WebpageSchema } from '../../../../../../types/index.js';
import { ValidateRequest } from '../../../../middleware/validation.js';

const router = Router();

router.route('/').get(controller.getPublicPages).openapi = {
	summary: 'Get Public Pages',
	path: '/rest/pages',
	description: 'Retrieve a list of public, sitewide pages',
	tags: ['Webpages'],
	security: [],
	responses: {
		200: {
			description: 'List of public webpages',
			content: {
				'application/json': {
					schema: z.array(WebpageSchema)
				},
			},
		},
		404: {
			$ref: '#/components/responses/NotFound',
		},
	},
};

router.route('/:slug').get(ValidateRequest, controller.getPublicPages).openapi = {
	summary: 'Get Public Page By Slug',
	path: '/rest/pages/{slug}',
	description: "Retrieve a public, sitewide page by it's slug",
	tags: ['Webpages'],
	security: [],
	requestParams: {
		path: z.object({
			slug: z.string().max(63).meta({ description: 'The slug of the page' }),
		}),
	},
	responses: {
		200: {
			description: 'A public webpages',
			content: {
				'application/json': {
					schema: z.array(WebpageSchema),
				},
			},
		},
		404: {
			$ref: '#/components/responses/NotFound',
		},
	},
};

export default router;
