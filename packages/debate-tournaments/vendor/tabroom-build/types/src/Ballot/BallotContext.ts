// @ts-nocheck
import { z } from 'zod';
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import * as utils from '../utils.js';
import { JudgeSchema } from '../Judge.js';
import { TournSchema } from '../Tourn.js';
import { EventSchema } from '../Event.js';
import { RoomSchema } from '../Room.js';
import { RoundSchema } from '../Round.js';
import { EntrySchema } from '../Entry.js';
import { StudentSchema } from '../Student.js';

// Everything needed to render one judge's ballot for one panel.
// Shared base + a details block per event type, discriminated on eventType.
// Scoring rules come from the tiebreak protocol, not the event type: a block
// being present in `scoring` turns that kind of scoring on.
// Fields are added one at a time, each with ballotRules support and tests.

export const BallotScoringSchema = z.object({
	winloss: z.object({
		lpw: z.enum(['forbid', 'confirm']).nullable().meta({ description: 'Whether low-point wins are forbidden or must be confirmed. null when the round has no points' }),
	}).strict().optional().meta({ description: 'Present when the judge picks a winner' }),
	points: z.object({
		min: z.number(),
		max: z.number(),
		step: z.number().positive().meta({ description: 'Points must be a multiple of this' }),
		ties: z.boolean().meta({ description: 'Whether two speakers on the ballot may get the same points' }),
		team: z.boolean().meta({ description: 'One score per entry instead of per speaker' }),
		ranksAgree: z.boolean().meta({ description: 'Whether points must agree with ranks, a better rank getting more points. false when there are no ranks' }),
		rubric: z.object({}).strict().optional().meta({ description: 'Present when the judge gives points through a rubric' }),
	}).strict().optional().meta({ description: 'Present when the judge gives points' }),
	ranks: z.object({}).strict().optional().meta({ description: 'Present when the judge gives ranks' }),
	feedback: z.object({
		rfd: z.string().nullable().meta({ description: 'Saved reason for decision, for everyone in the round (HTML)' }),
		minWords: z.object({
			rfd: z.int().positive().nullable().meta({ description: 'Words the reason for decision needs before the ballot can be submitted' }),
			comments: z.int().positive().nullable().meta({ description: 'Words each entry\'s comments need before the ballot can be submitted' }),
		}).strict(),
		editableUntil: z.iso.datetime().nullable().meta({ description: 'When feedback stops being editable, in UTC' }),
	}).strict().optional().meta({ description: 'Present when the judge writes feedback' }),
}).strict().meta({
	id: 'BallotScoring',
}) satisfies ZodOpenApiSchemaObject;
export type BallotScoring = z.infer<typeof BallotScoringSchema>;

export const BallotStudentSchema = z.object({
	id: StudentSchema.shape.id,
	first: StudentSchema.shape.first,
	middle: StudentSchema.shape.middle,
	last: StudentSchema.shape.last,
	pronoun: z.string().nullable().meta({ description: 'null when unknown or the tournament hides it' }),
	points: z.number().nullable().meta({ description: 'Saved speaker points' }),
}).strict().meta({
	id: 'BallotStudent',
}) satisfies ZodOpenApiSchemaObject;
export type BallotStudent = z.infer<typeof BallotStudentSchema>;

export const BallotEntrySchema = z.object({
	ballot: utils.id.meta({ description: 'The judge\'s ballot row for this entry' }),
	entry: EntrySchema.shape.id,
	code: EntrySchema.shape.code,
	side: z.int().meta({ description: '1 for Aff, 2 for Neg' }),
	notes: z.string().nullable().meta({ description: 'Accommodations note from the entry' }),
	doubled: z.int().nonnegative().meta({ description: 'How many other entries in the same time slot share a student with this one' }),
	comments: z.string().nullable().meta({ description: 'Saved comments for only this entry and its coaches (HTML)' }),
	points: z.number().nullable().meta({ description: 'Saved team points' }),
	Students: z.array(BallotStudentSchema).meta({ description: 'In speaking order' }),
}).strict().meta({
	id: 'BallotEntry',
}) satisfies ZodOpenApiSchemaObject;
export type BallotEntry = z.infer<typeof BallotEntrySchema>;

export const BallotStatusSchema = z.enum(['not_started', 'started', 'scored', 'confirmed']).meta({
	id: 'BallotStatus',
	description: 'Where the judge is with this ballot',
}) satisfies ZodOpenApiSchemaObject;
export type BallotStatus = z.infer<typeof BallotStatusSchema>;

// What the ballot page polls while it's open
export const BallotProgressSchema = z.object({
	status: BallotStatusSchema,
}).strict().meta({
	id: 'BallotProgress',
}) satisfies ZodOpenApiSchemaObject;
export type BallotProgress = z.infer<typeof BallotProgressSchema>;

// Shared by every event type's context
const BallotBaseSchema = z.object({
	eventType: EventSchema.shape.type.meta({ description: 'The type of event for this ballot' }),
	status: BallotStatusSchema,
	chair: z.boolean().meta({ description: 'Whether the judge chairs the panel' }),
	chairLabel: z.string().nullable().meta({ description: 'The event\'s own name for the chair, e.g. Chief Justice. null when it has none' }),
	tz: TournSchema.shape.tz.meta({ description: 'The tournament time zone, for showing times' }),
	Tourn: z.object({
		id: TournSchema.shape.id,
	}).strict(),
	Event: z.object({
		abbr: EventSchema.shape.abbr,
	}).strict(),
	Round: z.object({
		id: RoundSchema.shape.id,
		name: RoundSchema.shape.name.meta({ description: 'The round number' }),
		label: z.string().nullable().meta({ description: 'The round\'s label, e.g. Quarterfinals. null when it has none or it repeats the round number' }),
		notes: z.string().nullable().meta({ description: 'Notes from tab for this round (plain text)' }),
	}).strict(),
	flight: z.int().positive().nullable().meta({ description: 'The panel\'s flight. null when the round is not flighted' }),
	Room: z.object({
		name: RoomSchema.shape.name,
		url: RoomSchema.shape.url,
	}).strict().nullable().meta({ description: 'null when no room is assigned' }),
	Judge: z.object({
		code: JudgeSchema.shape.code,
		first: JudgeSchema.shape.first,
		middle: JudgeSchema.shape.middle,
		last: JudgeSchema.shape.last,
	}).strict(),
	topic: z.object({
		label: z.enum(['Topic', 'Motion', 'Resolution']),
		text: z.string().meta({ description: 'HTML' }),
	}).strict().nullable().meta({ description: 'The topic shown on the ballot. null when there is none' }),
	rules: z.array(z.string()).meta({ description: 'Ballot instructions from tab, in display order (HTML)' }),
	ballotHeader: z.string().nullable().meta({ description: 'Text to be displayed at the top of the ballot, typically the bias statement or header' }),
	roundStart: z.iso.datetime().meta({ description: 'The start time of the round in UTC' }),
	decisionDeadline: z.iso.datetime().nullable().meta({ description: 'The decision deadline in UTC' }),
	onlineMode: z.enum(['sync', 'async', 'nsda_campus', 'nsda_campus_observers', 'public_jitsi', 'public_jitsi_observers']).nullable().meta({ description: 'How the round is held online. null when in person' }),
	scoring: BallotScoringSchema,
	Entries: z.array(BallotEntrySchema).meta({ description: 'The entries on the judge\'s ballot, in side order' }),
	otherJudges: z.array(z.object({
		first: JudgeSchema.shape.first,
		middle: JudgeSchema.shape.middle,
		last: JudgeSchema.shape.last,
		chair: z.boolean(),
		pronoun: z.string().nullable(),
	}).strict()).meta({ description: 'The other judges on the panel, chair first. Empty unless the round has more than one judge' }),
	timers: z.object({
		speech: z.number().positive().meta({ description: 'Minutes on the speech timer' }),
		prep: z.number().positive().nullable().meta({ description: 'Minutes on each entry\'s prep timer. null when entries get no prep timer' }),
	}).strict().nullable().meta({ description: 'null when the event turns timers off' }),
	pointScale: z.array(z.object({
		points: z.string().nullable(),
		description: z.string(),
	}).strict()).meta({ description: 'The event\'s guide to what points mean, one line each' }),
	speechTimes: z.array(z.object({
		speech: z.string(),
		time: z.string().nullable(),
	}).strict()).meta({ description: 'The event\'s speech times, one line each' }),
	ballotTopics: z.string().nullable().meta({ description: 'Topics for this round (HTML)' }),
	docShare: z.url().nullable().meta({ description: 'Link to the panel\'s shared documents' }),
	logo: z.url().nullable().meta({ description: 'The tournament logo' }),
});

export const DebateDetailsSchema = z.object({
	affLabel: z.string().meta({ description: 'What side 1 is called, e.g. Aff or Pro' }),
	negLabel: z.string().meta({ description: 'What side 2 is called, e.g. Neg or Con' }),
	sides: z.enum(['locked', 'pick']).meta({ description: 'locked: the sides are set. pick: the judge picks them' }),
	winner: utils.id.nullable().meta({ description: 'The saved winner\'s ballot. null before a winner is saved' }),
}).strict().meta({
	id: 'DebateDetails',
}) satisfies ZodOpenApiSchemaObject;
export type DebateDetails = z.infer<typeof DebateDetailsSchema>;

export const DebateBallotContextSchema = BallotBaseSchema.extend({
	eventType: z.literal('debate'),
	debate: DebateDetailsSchema,
}).strict().meta({
	id: 'DebateBallotContext',
}) satisfies ZodOpenApiSchemaObject;
export type DebateBallotContext = z.infer<typeof DebateBallotContextSchema>;

export const MockTrialBallotContextSchema = BallotBaseSchema.extend({
	eventType: z.literal('mock_trial'),
}).strict().meta({
	id: 'MockTrialBallotContext',
}) satisfies ZodOpenApiSchemaObject;
export type MockTrialBallotContext = z.infer<typeof MockTrialBallotContextSchema>;

export const CongressBallotContextSchema = BallotBaseSchema.extend({
	eventType: z.literal('congress'),
}).strict().meta({
	id: 'CongressBallotContext',
}) satisfies ZodOpenApiSchemaObject;
export type CongressBallotContext = z.infer<typeof CongressBallotContextSchema>;

// Any ballot the beta can't render yet. Carries only what's needed to send
// the judge to the classic ballot.
export const OtherBallotContextSchema = z.object({
	eventType: z.literal('other'),
	judge: JudgeSchema.shape.id,
	panel: utils.id,
	tourn: TournSchema.shape.id,
	supported: z.literal(false),
}).strict().meta({
	id: 'OtherBallotContext',
}) satisfies ZodOpenApiSchemaObject;
export type OtherBallotContext = z.infer<typeof OtherBallotContextSchema>;

export const BallotContextSchema = z.discriminatedUnion('eventType', [
	DebateBallotContextSchema,
	MockTrialBallotContextSchema,
	CongressBallotContextSchema,
	OtherBallotContextSchema,
]).meta({
	id: 'BallotContext',
}) satisfies ZodOpenApiSchemaObject;
export type BallotContext = z.infer<typeof BallotContextSchema>;
