// @ts-nocheck
import { Router } from '../../../../../_shims/express.js';
import { requireAccess } from '../../../../../middleware/auth/authorization.js';
import controller from '../../../../../controllers/tab/timeslotsController.js';
import { TimeslotRequestSchema, TimeslotResponseSchema } from '../../../../../../../types/index.js';
import { z } from 'zod';
import { ValidateRequest } from '../../../../../middleware/validation.js';

const router = Router({ mergeParams: true });

const tournParams = z.object({
	tournId: z.coerce.number().int().positive(),
});
const timeslotParams = tournParams.extend({
	timeslotId: z.coerce.number().int().positive(),
});

router.route('/').get(requireAccess('tourn', 'read'), ValidateRequest, controller.getTimeslots).openapi = {
	path: '/tab/tourns/{tournId}/timeslots',
	summary: 'Get all timeslots for a tournament',
	description: 'Returns an array of timeslot objects for the given tournament.',
	tags: ['tab:timeslots'],
	requestParams: { path: tournParams },
	responses: {
		200: {
			description: 'An array of timeslot objects',
			content: {
				'application/json': {
					schema: z.array(TimeslotResponseSchema),
					examples: {
						timeslotsResponse: {
							summary: 'Example response',
							value: [
								{
									id: 1,
									name: 'Round 1',
									start: '2023-01-01T09:00:00Z',
									end: '2023-01-01T10:00:00Z',
									tournId: 42,
									createdAt: '2023-01-01T00:00:00Z',
									updatedAt: '2023-01-02T00:00:00Z',
								},
								{
									id: 2,
									name: 'Round 2',
									start: '2023-01-01T10:30:00Z',
									end: '2023-01-01T11:30:00Z',
									tournId: 42,
									createdAt: '2023-01-01T00:00:00Z',
									updatedAt: '2023-01-02T00:00:00Z',
								},
							],
						},
					},
				},
			},
		},
		default: { $ref: '#/components/responses/ErrorResponse' },
	},
};

router.route('/').post(requireAccess('tourn', 'write'),ValidateRequest, controller.createTimeslot).openapi = {
	path: '/tab/tourns/{tournId}/timeslots',
	summary: 'Create a new timeslot',
	description: 'Creates a new timeslot with the provided data and returns the created object.',
	tags: ['tab:timeslots'],
	requestParams: { path: tournParams },
	requestBody: {
		required: true,
		content: {
			'application/json': {
				schema: TimeslotRequestSchema,
				examples: {
					timeslotRequest: {
						summary: 'Example request',
						value: {
							name: 'Round 1',
							start: '2023-01-01T09:00:00Z',
							end: '2023-01-01T10:00:00Z',
							tournId: 42,
						},
					},
				},
			},
		},
	},
	responses: {
		201: { description: 'Timeslot created successfully' },
		default: { $ref: '#/components/responses/ErrorResponse' },
	},
};

router.route('/:timeslotId').get(requireAccess('timeslot', 'read'), ValidateRequest, controller.getTimeslot).openapi = {
	path: '/tab/tourns/{tournId}/timeslots/{timeslotId}',
	summary: 'Get a timeslot by ID',
	description: 'Returns a timeslot object for the given ID.',
	tags: ['tab:timeslots'],
	requestParams: { path: timeslotParams },
	responses: {
		200: {
			description: 'A timeslot object',
			content: {
				'application/json': {
					schema: TimeslotResponseSchema,
					examples: {
						timeslotResponse: {
							summary: 'Example response',
							value: {
								id: 1,
								name: 'Round 1',
								start: '2023-01-01T09:00:00Z',
								end: '2023-01-01T10:00:00Z',
								tournId: 42,
								createdAt: '2023-01-01T00:00:00Z',
								updatedAt: '2023-01-02T00:00:00Z',
							},
						},
					},
				},
			},
		},
		default: { $ref: '#/components/responses/ErrorResponse' },
	},
};

router.route('/:timeslotId').put(requireAccess('timeslot', 'write'),ValidateRequest, controller.updateTimeslot).openapi = {
	path: '/tab/tourns/{tournId}/timeslots/{timeslotId}',
	summary: 'Update an existing timeslot',
	description: 'Updates the timeslot with the given ID using the provided data and returns the updated object.',
	tags: ['tab:timeslots'],
	requestParams: { path: timeslotParams },
	requestBody: {
		required: true,
		content: {
			'application/json': {
				schema: TimeslotRequestSchema,
				examples: {
					timeslotRequest: {
						summary: 'Example request',
						value: {
							name: 'Round 1 - Updated',
							start: '2023-01-01T09:30:00Z',
							end: '2023-01-01T10:30:00Z',
							tournId: 42,
						},
					},
				},
			},
		},
	},
	responses: {
		200: { description: 'Timeslot updated successfully' },
		default: { $ref: '#/components/responses/ErrorResponse' },
	},
};

router.route('/:timeslotId').delete(requireAccess('timeslot', 'write'), ValidateRequest, controller.deleteTimeslot).openapi = {
	path: '/tab/tourns/{tournId}/timeslots/{timeslotId}',
	summary: 'Delete a timeslot',
	description: 'Deletes the timeslot with the given ID and returns a success message.',
	tags: ['tab:timeslots'],
	requestParams: { path: timeslotParams },
	responses: {
		204: { description: 'Timeslot deleted successfully' },
		default: { $ref: '#/components/responses/ErrorResponse' },
	},
};

export default router;