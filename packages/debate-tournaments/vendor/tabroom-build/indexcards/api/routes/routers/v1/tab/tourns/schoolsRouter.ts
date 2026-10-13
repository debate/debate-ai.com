// @ts-nocheck
import { Router } from '../../../../../_shims/express.js';
import { requireAccess } from '../../../../../middleware/auth/authorization.js';
import * as controller from '../../../../../controllers/tab/schoolController.js';
import { z } from 'zod';
import { CreateSchoolSchema, SchoolSchema, UpdateSchoolSchema } from '../../../../../../../types/index.js';
import { ValidateRequest } from '../../../../../middleware/validation.js';

const router = Router({ mergeParams: true });

const tournParams = z.object({
	tournId: z.coerce.number().int().positive(),
});
const schoolParams = tournParams.extend({
	schoolId: z.coerce.number().int().positive(),
});

router.route('/').get( requireAccess('tourn', 'read'), ValidateRequest, controller.getSchools).openapi = {
	path: '/tab/tourns/{tournId}/schools',
	summary: 'Get Schools for Tournament',
	description: 'Retrieves all schools associated with the specified tournament.',
	tags: ['tab:schools'],
	requestParams: { path: tournParams },
	responses: {
		200: {
			description: 'Schools retrieved successfully',
			content: {
				'application/json': {
					schema: z.array(SchoolSchema)
				},
			},
		},
		404 : { $ref: '#/components/responses/NotFound' },
	},
};

router.route('/').post(requireAccess('tourn', 'write'), ValidateRequest, controller.createSchool).openapi = {
	path: '/tab/tourns/{tournId}/schools',
	summary: 'Create School',
	description: 'Creates a new school within the specified tournament.',
	tags: ['tab:schools'],
	requestParams: { path: tournParams },
	requestBody: {
		required: true,
		content: {
			'application/json': {
				schema: CreateSchoolSchema,
			},
		},
	},
	responses: {
		201: {
			description: 'School created successfully',
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: {
							id: { type: 'integer', description: 'ID of the created school' },
						},
					},
				},
			},
		},
	},
};

router.route('/:schoolId').get(   requireAccess('tourn', 'read'), ValidateRequest, controller.getSchool).openapi = {
	path: '/tab/tourns/{tournId}/schools/{schoolId}',
	summary: 'Get School by ID',
	description: 'Retrieves a school by its ID within the specified tournament.',
	tags: ['tab:schools'],
	requestParams: { path: schoolParams },
	responses: {
		200: {
			description: 'School retrieved successfully',
			content: {
				'application/json': {
					schema: SchoolSchema
				},
			},
		},
		404 : { $ref: '#/components/responses/NotFound' },
	},
};

router.route('/:schoolId').put(   requireAccess('tourn', 'write'), ValidateRequest, controller.updateSchool).openapi = {
	path: '/tab/tourns/{tournId}/schools/{schoolId}',
	summary: 'Update School',
	description: 'Updates an existing school within the specified tournament.',
	tags: ['tab:schools'],
	requestParams: { path: schoolParams },
	requestBody: {
		required: true,
		content: {
			'application/json': {
				schema: UpdateSchoolSchema,
			},
		},
	},
	responses: {
		200: {
			description: 'School updated successfully',
		},
		404 : { $ref: '#/components/responses/NotFound' },
	},
};

router.route('/:schoolId').delete(requireAccess('tourn', 'write'), ValidateRequest, controller.deleteSchool).openapi = {
	path: '/tab/tourns/{tournId}/schools/{schoolId}',
	summary: 'Delete School',
	description: 'Deletes a school within the specified tournament.',
	tags: ['tab:schools'],
	requestParams: { path: schoolParams },
	responses: {
		204: {
			description: 'School deleted successfully',
		},
		404 : { $ref: '#/components/responses/NotFound' },
	},
};

export default router;