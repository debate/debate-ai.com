// @ts-nocheck
import { Router } from '../../../../../_shims/express.js';
import { SiteResponseSchema } from '../../../../../../../types/index.js';
import { requireAccess } from '../../../../../middleware/auth/authorization.js';
import controller from '../../../../../controllers/tab/siteController.js';
import { ValidateRequest } from '../../../../../middleware/validation.js';
import z from 'zod';

const router = Router({ mergeParams: true });

const tournParams = z.object({
	tournId: z.coerce.number().int().positive(),
});
const siteParams = tournParams.extend({
	siteId: z.coerce.number().int().positive(),
});
const roomParams = siteParams.extend({
	roomId: z.coerce.number().int().positive(),
});

router.route('/').get( requireAccess('tourn', 'read'),  ValidateRequest, controller.getSites).openapi = {
	requestParams: { path: tournParams },
	path: '/tab/tourns/{tournId}/sites',
	summary: 'Get sites',
	tags: ['tab:sites-rooms'],
	responses: {
		200: {
			description: 'A list of sites for the tourn',
			content: {
				'application/json': {
					schema: {
						type: 'array',
						items: SiteResponseSchema,
					},
					examples: {
						sites: {
							summary: 'Example response',
							value: [
								{
									id: 1,
									name: 'Lincoln High School',
									online: false,
									directions: '123 Main St, Anytown, USA',
									dropoff: 'Use the side entrance on 2nd Ave.',
									hostId: 5,
									circuitId: 2,
									createdAt: '2023-01-01T00:00:00Z',
									updatedAt: '2023-01-02T00:00:00Z',
								},
							],
						},
					},
				},
			},
		},
	},
};

router.route('/').post(requireAccess('tourn', 'write'), ValidateRequest, controller.createSite).openapi = {
	requestParams: { path: tournParams },
	path: '/tab/tourns/{tournId}/sites',
	summary: 'Create site',
	tags: ['tab:sites-rooms'],
};

router.route('/:siteId').get(   requireAccess('tourn', 'read'),  ValidateRequest, controller.getSite).openapi = {
	requestParams: { path: siteParams },
	path: '/tab/tourns/{tournId}/sites/{siteId}',
	summary: 'Get site',
	tags: ['tab:sites-rooms'],
	responses: {
		200: {
			description: 'A site object',
			content: {
				'application/json': {
					schema: SiteResponseSchema,
					examples: {
						site: {
							summary: 'Example response',
							value: {
								id: 1,
								name: 'Lincoln High School',
								online: false,
								directions: '123 Main St, Anytown, USA',
								dropoff: 'Use the side entrance on 2nd Ave.',
								hostId: 5,
								circuitId: 2,
								createdAt: '2023-01-01T00:00:00Z',
								updatedAt: '2023-01-02T00:00:00Z',
							},
						},
					},
				},
			},
		},
	},
};

router.route('/:siteId').put(   requireAccess('tourn', 'write'), ValidateRequest, controller.updateSite).openapi = {
	requestParams: { path: siteParams },
	path: '/tab/tourns/{tournId}/sites/{siteId}',
	summary: 'Update site',
	tags: ['tab:sites-rooms'],
};

router.route('/:siteId').delete(requireAccess('tourn', 'write'), ValidateRequest, controller.deleteSite).openapi = {
	requestParams: { path: siteParams },
	path: '/tab/tourns/{tournId}/sites/{siteId}',
	summary: 'Delete site',
	tags: ['tab:sites-rooms'],
};

router.route('/:siteId/rooms').get( requireAccess('tourn', 'read'),  ValidateRequest, controller.getRooms).openapi = {
	requestParams: { path: siteParams },
	path: '/tab/tourns/{tournId}/sites/{siteId}/rooms',
	summary: 'Get rooms',
	tags: ['tab:sites-rooms'],
};

router.route('/:siteId/rooms').post(requireAccess('tourn', 'write'), ValidateRequest, controller.createRoom).openapi = {
	requestParams: { path: siteParams },
	path: '/tab/tourns/{tournId}/sites/{siteId}/rooms',
	summary: 'Create room',
	tags: ['tab:sites-rooms'],
};

router.route('/:siteId/rooms/:roomId').get(   requireAccess('tourn', 'read'),  ValidateRequest, controller.getRoom).openapi = {
	requestParams: { path: roomParams },
	path: '/tab/tourns/{tournId}/sites/{siteId}/rooms/{roomId}',
	summary: 'Get room',
	tags: ['tab:sites-rooms'],
};

router.route('/:siteId/rooms/:roomId').put(   requireAccess('tourn', 'write'), ValidateRequest, controller.updateRoom).openapi = {
	requestParams: { path: roomParams },
	path: '/tab/tourns/{tournId}/sites/{siteId}/rooms/{roomId}',
	summary: 'Update room',
	tags: ['tab:sites-rooms'],
};

router.route('/:siteId/rooms/:roomId').delete(requireAccess('tourn', 'write'), ValidateRequest, controller.deleteRoom).openapi = {
	requestParams: { path: roomParams },
	path: '/tab/tourns/{tournId}/sites/{siteId}/rooms/{roomId}',
	summary: 'Delete room',
	tags: ['tab:sites-rooms'],
};

export default router;