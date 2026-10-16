// @ts-nocheck
import { Router } from '../../../../../_shims/express.js';
import z from 'zod';
import { CategorySchema } from '../../../../../../../types/index.js';
import controller from '../../../../../controllers/tab/categoryController.js';
import { requireAccess } from '../../../../../middleware/auth/authorization.js';
import { ValidateRequest } from '../../../../../middleware/validation.js';

const router = Router({ mergeParams: true });

const tournParams = z.object({
	tournId: z.coerce.number().int().positive(),
});
const categoryParams = tournParams.extend({
	categoryId: z.coerce.number().int().positive(),
});

router.route('/').get(requireAccess('tourn', 'read'), ValidateRequest, controller.getCategories).openapi = {
	path: '/tab/tourns/{tournId}/categories',
	summary: 'Get categories',
	tags: ['tab:category'],
	requestParams: { path: tournParams },
	responses: {
		200: {
			description: 'List of categories',
			content: {
				'application/json': {
					schema: z.array(CategorySchema),
				},
			},
		},
	},
};

router.route('/').post(requireAccess('tourn', 'write'), ValidateRequest, controller.createCategory).openapi = {
	path: '/tab/tourns/{tournId}/categories',
	summary: 'Create category',
	tags: ['tab:category'],
	requestParams: { path: tournParams },
};

router.route('/:categoryId').get(requireAccess('category', 'read'), ValidateRequest, controller.getCategory).openapi = {
	path: '/tab/tourns/{tournId}/categories/{categoryId}',
	summary: 'Get category',
	tags: ['tab:category'],
	requestParams: { path: categoryParams },
	responses: {
		200: {
			description: 'Category details',
			content: {
				'application/json': {
					schema: CategorySchema,
				},
			},
		},
		404: {$ref: '#/components/responses/NotFound'},
	},
};

router.route('/:categoryId').delete(requireAccess('category', 'write'), ValidateRequest, controller.deleteCategory).openapi = {
	path: '/tab/tourns/{tournId}/categories/{categoryId}',
	summary: 'Delete category',
	tags: ['tab:category'],
	requestParams: { path: categoryParams },
};

router.route('/:categoryId').put(requireAccess('category', 'write'), ValidateRequest, controller.updateCategory).openapi = {
	path: '/tab/tourns/{tournId}/categories/{categoryId}',
	summary: 'Update category',
	tags: ['tab:category'],
	requestParams: { path: categoryParams },
};

export default router;
