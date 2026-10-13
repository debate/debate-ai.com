// @ts-nocheck
import z from 'zod';
import type { ZodOpenApiSchemaObject } from 'zod-openapi';
import { BallotSchema } from './Ballot.js';
import { JudgeSchema } from './Judge.js';
import { EventSchema } from './Event.js';
import { EntrySchema } from './Entry.js';
import { RoundSchema } from './Round.js';
import { TournSchema } from './Tourn.js';
import { RoomSchema } from './Room.js';
import * as utils from './utils.js';

export const CurrentBallotSchema = z.object({
	id: utils.id,
	name: RoundSchema.shape.name,
	label: RoundSchema.shape.label,
	flipStatus: z.enum(['done','winner','second','anyone']).nullable(),
	flight: z.int().positive().nullable().meta({ description: "null if not flighted. otherwise flight num."}),
	show_async: z.boolean(),
	onlineBallots: z.boolean().meta({ description: 'true if the tournament uses online ballots'}),
	legion: z.boolean(),
	start: utils.datetime(),
	deadline: utils.datetime(),
	roomId: RoomSchema.shape.id.nullable(),
	roomName: RoomSchema.shape.name.nullable(),
	roomUrl: RoomSchema.shape.url.nullable(),
	roomNotes: RoomSchema.shape.notes.nullable(),
	JudgeId: JudgeSchema.shape.id,
	RoundId: RoundSchema.shape.id,
	status: z.enum(['not_started','started','scored']),
	startText: z.string().max(127).nullable(),
	ballotText: z.string().max(127).nullable(),
	chair: z.boolean(),
	audited: z.boolean(),
	TournTz: TournSchema.shape.tz,
	eventType: EventSchema.shape.type,
	onlineMode: EventSchema.shape.settings.shape.online_mode,
	Entries: z.array(z.object({
		id: EntrySchema.shape.id,
		code: EntrySchema.shape.code,
		side: z.string().nullable(),
		speakerOrder: BallotSchema.shape.speakerOrder.nullable(),
	})),
}).strict().meta({
	id: 'CurrentBallot',
}) satisfies ZodOpenApiSchemaObject;
export type CurrentBallot = z.infer<typeof CurrentBallotSchema>;
