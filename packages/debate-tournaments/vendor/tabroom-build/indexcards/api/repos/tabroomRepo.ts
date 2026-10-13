// @ts-nocheck
import type { Database } from '../data/database.js';

async function getSettings(db: Database, settings: string[]) {
	return await db.selectFrom('tabroom_setting')
		.where('tag', 'in', settings)
		.selectAll()
		.execute();
}

export default {
	getSettings,
};