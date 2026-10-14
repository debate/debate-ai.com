// @ts-nocheck

import { z } from 'zod';

export const SystemStatusSchema = z.object({
	message  : z.string(),
	name     : z.string(),
	version  : z.string(),
	commit   : z.string().meta({
		description: 'Commit hash of the current build',
	}),
	webhost  : z.string(),
	server   : z.string(),
	load     : z.array(z.number()),
	uptime   : z.number(),
	freemem  : z.number(),
	totalmem : z.number(),
	node     : z.string(),
	runtime  : z.string().optional(),
	database : z.string(),
});

export type SystemStatus = z.infer<typeof SystemStatusSchema>;