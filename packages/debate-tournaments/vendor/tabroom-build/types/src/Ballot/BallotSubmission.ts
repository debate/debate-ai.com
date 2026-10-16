// @ts-nocheck
import { z } from 'zod';
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import * as utils from '../utils.js';
import { EntrySchema } from '../Entry.js';
import { StudentSchema } from '../Student.js';
import { ProblemSchema } from '../Problem.js';
import { BallotEntrySchema } from './BallotContext.js';

// The judge's feedback, shaped like scoring.feedback.rfd and Entries[].comments in the context
const RfdSchema = z.string().nullable().meta({ description: 'Reason for decision, shared with everyone in the round (HTML)' });
const FeedbackEntriesSchema = z.array(z.object({
	ballot: BallotEntrySchema.shape.ballot,
	comments: z.string().nullable().meta({ description: 'Comments for only this entry and its coaches (HTML)' }),
}).strict()).meta({ description: 'Comments for each entry' });

// Feedback drafts, autosaved through PUT .../ballots/feedback so the judge doesn't lose work.
// In the body, a field left out stays as it is and null or empty text deletes it. The
// response has both fields as saved, after sanitizing
export const BallotFeedbackSchema = z.object({
	rfd: RfdSchema.optional(),
	Entries: FeedbackEntriesSchema.optional(),
}).strict().meta({
	id: 'BallotFeedback',
}) satisfies ZodOpenApiSchemaObject;
export type BallotFeedback = z.infer<typeof BallotFeedbackSchema>;

// What the judge enters on a ballot (PUT /rest/judges/{judgeId}/panels/{panelId}/ballots),
// discriminated on eventType like BallotContext.
// Values a judge can leave blank are nullable, so a blank gets a ballot error, not a 400.

export const DebateBallotSubmissionSchema = z.object({
	eventType: z.literal('debate'),
	winner: utils.id.nullable().meta({ description: 'The winning entry\'s ballot row. null when the judge hasn\'t picked one' }),
	lowPointWin: z.boolean().meta({ description: 'The judge confirms the winner has fewer points' }),
	points: z.array(z.object({
		student: StudentSchema.shape.id,
		points: z.number().nullable().meta({ description: 'null when left blank' }),
	}).strict()).meta({ description: 'Speaker points for every student on the ballot. Empty when the round has no points' }),
	feedback: z.object({
		rfd: RfdSchema,
		Entries: FeedbackEntriesSchema,
	}).strict().meta({ description: 'All of the judge\'s feedback, which replaces the autosaved drafts. An entry left out has no comments' }),
}).strict().meta({
	id: 'DebateBallotSubmission',
}) satisfies ZodOpenApiSchemaObject;
export type DebateBallotSubmission = z.infer<typeof DebateBallotSubmissionSchema>;

export const BallotSubmissionSchema = z.discriminatedUnion('eventType', [
	DebateBallotSubmissionSchema,
]).meta({
	id: 'BallotSubmission',
}) satisfies ZodOpenApiSchemaObject;
export type BallotSubmission = z.infer<typeof BallotSubmissionSchema>;

// The ballot as it was saved, for the judge to check before confirming
export const DebateBallotReviewSchema = z.object({
	eventType: z.literal('debate'),
	saved: z.boolean().meta({ description: 'false for a dry run, which only validates' }),
	winner: utils.id.nullable().meta({ description: 'The winning entry\'s ballot row. null when the round doesn\'t count wins' }),
	lowPointWin: z.boolean().meta({ description: 'Whether the winner has fewer points than another entry' }),
	Entries: z.array(z.object({
		ballot: utils.id.meta({ description: 'The judge\'s ballot row for this entry' }),
		entry: EntrySchema.shape.id,
		code: EntrySchema.shape.code,
		sideLabel: z.string().meta({ description: 'What the entry\'s side is called, e.g. Aff or Pro' }),
		Students: z.array(z.object({
			id: StudentSchema.shape.id,
			first: StudentSchema.shape.first,
			last: StudentSchema.shape.last,
			points: z.number().nullable().meta({ description: 'null when the round has no points' }),
		}).strict()).meta({ description: 'In speaking order' }),
	}).strict()).meta({ description: 'In side order' }),
}).strict().meta({
	id: 'DebateBallotReview',
}) satisfies ZodOpenApiSchemaObject;
export type DebateBallotReview = z.infer<typeof DebateBallotReviewSchema>;

export const BallotReviewSchema = z.discriminatedUnion('eventType', [
	DebateBallotReviewSchema,
]).meta({
	id: 'BallotReview',
}) satisfies ZodOpenApiSchemaObject;
export type BallotReview = z.infer<typeof BallotReviewSchema>;

// One reason a submission can't be saved
export const BallotErrorSchema = z.object({
	field: z.enum(['winner', 'points', 'lowPointWin', 'rfd', 'comments']).meta({ description: 'The part of the ballot the error is about' }),
	ballot: utils.id.optional().meta({ description: 'The ballot row the error is about, when it\'s about one entry' }),
	student: StudentSchema.shape.id.optional().meta({ description: 'The student the error is about, when it\'s about one student\'s points' }),
	message: z.string().meta({ description: 'Shown to the judge' }),
}).strict().meta({
	id: 'BallotError',
}) satisfies ZodOpenApiSchemaObject;
export type BallotError = z.infer<typeof BallotErrorSchema>;

// The 422 problem returned when a submission breaks the ballot's rules
export const BallotValidationProblemSchema = ProblemSchema.extend({
	errors: z.array(BallotErrorSchema).meta({ description: 'Every reason the ballot can\'t be saved' }),
}).meta({
	id: 'BallotValidationProblem',
}) satisfies ZodOpenApiSchemaObject;
export type BallotValidationProblem = z.infer<typeof BallotValidationProblemSchema>;
