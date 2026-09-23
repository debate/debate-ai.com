// @ts-nocheck
import type { Database } from '../data/database.js';
import type { ChangeLog } from '../data/schema.js';
import type { Insertable } from 'kysely';

async function getChangeLog(db: Database, id: number) {
	return await db.selectFrom('change_log')
	.where('id', '=', id)
	.selectAll('change_log')
	.executeTakeFirst();
}
async function createChangeLog(db: Database, data: Insertable<ChangeLog>) {
	return await db.insertInto('change_log')
		.values(data)
		.returningAll()
		.executeTakeFirstOrThrow();
}

export default {
	getChangeLog,
	createChangeLog,
};
