// @ts-nocheck
import type { Database } from '../data/database.js';

async function getTopic(db: Database, id: number) {
	return await db.selectFrom('topic')
		.where('topic.id', '=', id)
		.selectAll('topic')
		.executeTakeFirst();
}

export default {
	getTopic,
};
