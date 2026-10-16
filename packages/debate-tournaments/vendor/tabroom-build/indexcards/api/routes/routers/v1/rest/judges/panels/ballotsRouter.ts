// @ts-nocheck
import { Router } from '../../../../../../_shims/express.js';
import type { Request, Response } from '../../../../../../_shims/express.js';
import { NotImplemented } from '../../../../../../helpers/problem.js';
import { ValidateRequest } from '../../../../../../middleware/validation.js';
import { requireAccess } from '../../../../../../middleware/auth/authorization.js';
import { getBallotContext, getBallotStatus, saveFeedback, startBallot, submitBallot } from '../../../../../../controllers/rest/judges/panels/ballotController.js';
import { BallotContextSchema, BallotFeedbackSchema, BallotProgressSchema, BallotReviewSchema, BallotSubmissionSchema, BallotValidationProblemSchema } from '../../../../../../../../types/index.js';
import z from 'zod';

// /v1/rest/judges/:judgeId/panels/:panelId/ballots
//
// A judge's ballot rows on a panel are one 'ballot', identified by (judgeId, panelId).
// panelsRouter has already checked that the judge has a ballot on the panel.
// Each route checks ballot/read or ballot/write; whether a change is allowed right now
// (confirmed, side disagreement) is up to the service.
const router = Router({ mergeParams: true });

const notImplemented = (req: Request, res: Response) => NotImplemented(req, res);

const ballot = (req: Request) => ({
	judgeId: Number(req.params.judgeId),
	panelId: Number(req.params.panelId),
});


const ballotParams = z.object({
	judgeId: z.coerce.number().int().positive().meta({ description: 'ID of the judge' }),
	panelId: z.coerce.number().int().positive().meta({ description: 'ID of the panel (section)' }),
});

// returned by the loaders, policy and access check in front of every ballot route.
// 401 and 500 are added to every route by createOpenApiSpec
const ballotErrors = {
	400: { $ref: '#/components/responses/BadRequest' },
	403: { $ref: '#/components/responses/Forbidden' },
	404: { $ref: '#/components/responses/NotFound' },
};

// ---- Core (all types) ----

// returns the BallotContext. all the params needed to render the correct ballot UI
router.route('/').get(requireAccess('ballot', 'read', ballot), ValidateRequest, getBallotContext).openapi = {
	summary: 'Get ballot context',
	description: 'Everything needed to render this judge\'s ballot for this panel',
	path: '/rest/judges/{judgeId}/panels/{panelId}/ballots',
	operationId: 'RestJudgesBallotContext',
	tags: ['Orval', 'Judges'],
	requestParams: {
		path: ballotParams,
	},
	responses: {
		200: {
			description: 'Successful response',
			content: {
				'application/json': {
					schema: BallotContextSchema,
				},
			},
		},
		...ballotErrors,
	},
};

// Validates the submission and writes ballot/score rows
router.route('/').put(requireAccess('ballot', 'write', ballot), ValidateRequest, submitBallot).openapi = {
	summary: 'Save ballot',
	description: 'Validates the ballot and writes its scores, which the judge then reviews and confirms. With dryRun, only validates',
	path: '/rest/judges/{judgeId}/panels/{panelId}/ballots',
	operationId: 'RestJudgesBallotSave',
	tags: ['Orval', 'Judges'],
	requestParams: {
		path: ballotParams,
		query: z.object({
			dryRun: z.stringbool().default(false).meta({ description: 'Validate without saving' }),
		}),
	},
	requestBody: {
		content: {
			'application/json': {
				schema: BallotSubmissionSchema,
			},
		},
	},
	responses: {
		200: {
			description: 'The ballot as saved, for the judge to review',
			content: {
				'application/json': {
					schema: BallotReviewSchema,
				},
			},
		},
		409: { $ref: '#/components/responses/Conflict' },
		422: {
			description: 'The ballot breaks its rules. errors lists every problem',
			content: {
				'application/problem+json': {
					schema: BallotValidationProblemSchema,
				},
			},
		},
		...ballotErrors,
	},
};

// Sets started_by/judge_started if empty. run when judge opens ballot
router.route('/start').post(requireAccess('ballot', 'write', ballot), ValidateRequest, startBallot).openapi = {
	summary: 'Start ballot',
	description: 'Marks the ballot as started by the judge, if it isn\'t already. Does nothing for someone entering it for the judge',
	path: '/rest/judges/{judgeId}/panels/{panelId}/ballots/start',
	operationId: 'RestJudgesBallotStart',
	tags: ['Orval', 'Judges'],
	requestParams: {
		path: ballotParams,
	},
	responses: {
		200: {
			description: 'The ballot\'s status after starting it',
			content: {
				'application/json': {
					schema: BallotProgressSchema,
				},
			},
		},
		...ballotErrors,
	},
};

// Light poll every 1-2 minutes while on the ballot, to notice it was confirmed elsewhere.
// Losing access shows up as a 403 or 404 from the guards
router.route('/status').get(requireAccess('ballot', 'read', ballot), ValidateRequest, getBallotStatus).openapi = {
	summary: 'Get ballot status',
	description: 'Polled while the ballot is open, to notice it was confirmed elsewhere. Lost access returns 403 or 404',
	path: '/rest/judges/{judgeId}/panels/{panelId}/ballots/status',
	operationId: 'RestJudgesBallotStatus',
	tags: ['Orval', 'Judges'],
	requestParams: {
		path: ballotParams,
	},
	responses: {
		200: {
			description: 'Where the judge is with the ballot',
			content: {
				'application/json': {
					schema: BallotProgressSchema,
				},
			},
		},
		...ballotErrors,
	},
};

// Replaces ballot_confirm.mhtml. Not built yet: after PUT / saves the ballot, the page sends
// the judge to classic's user/judge/ballot_confirm.mhtml, which audits the ballots and runs
// round_done.mas (notifications, backups, autoqueue). This comes with porting those.
router.route('/confirm').post(requireAccess('ballot', 'write', ballot), ValidateRequest, notImplemented).openapi = {
	summary: 'Confirm ballot',
	description: 'Makes the decision final and runs the round completion steps. Not built yet; confirm on classic',
	path: '/rest/judges/{judgeId}/panels/{panelId}/ballots/confirm',
	operationId: 'RestJudgesBallotConfirm',
	tags: ['Judges'],
	requestParams: {
		path: ballotParams,
	},
	responses: {
		200: { description: 'Ballot confirmed' },
		...ballotErrors,
	},
};

// Replaces comment_save, rfd_only_save and legion_comments_save.
// Autosaved drafts, so the judge doesn't lose work; PUT / saves the final feedback.
// Editable after confirm until the tournament ends. Resets comments_reviewed.
router.route('/feedback').put(requireAccess('ballot', 'write', ballot), ValidateRequest, saveFeedback).openapi = {
	summary: 'Save ballot feedback',
	description: 'Saves the RFD and per-entry comments as drafts. A field left out stays as it is, and null or empty text deletes it. Editable after confirm until the tournament ends',
	path: '/rest/judges/{judgeId}/panels/{panelId}/ballots/feedback',
	operationId: 'RestJudgesBallotFeedback',
	tags: ['Orval', 'Judges'],
	requestParams: {
		path: ballotParams,
	},
	requestBody: {
		content: {
			'application/json': {
				schema: BallotFeedbackSchema,
			},
		},
	},
	responses: {
		200: {
			description: 'The RFD and every entry\'s comments as saved',
			content: {
				'application/json': {
					schema: BallotFeedbackSchema,
				},
			},
		},
		409: { $ref: '#/components/responses/Conflict' },
		422: {
			description: 'The comments are for entries that aren\'t on the ballot',
			content: {
				'application/problem+json': {
					schema: BallotValidationProblemSchema,
				},
			},
		},
		...ballotErrors,
	},
};

export default router;
