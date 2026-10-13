// @ts-nocheck
import type { Database } from '../data/database.js';
import type { Insertable, Updateable } from 'kysely';
import type { Timeslot } from '../data/schema.js';

async function getTimeslot(db: Database, id: number){
	return await db.selectFrom('timeslot')
		.where('id', '=', id)
		.selectAll()
		.executeTakeFirst();
}
async function getTimeslots(db: Database, tournId: number) {
	return await db.selectFrom('timeslot')
		.where('tourn', '=', tournId)
		.selectAll()
		.execute();

}

async function createTimeslot(db: Database, data: Insertable<Timeslot>) {
	return await db.insertInto('timeslot')
		.values(data)
		.returningAll()
		.executeTakeFirstOrThrow();
}

async function updateTimeslot(db: Database, timeslotId: number, data: Updateable<Timeslot>) {
	return await db.updateTable('timeslot')
		.set(data)
		.where('id', '=', timeslotId)
		.executeTakeFirstOrThrow();
}

async function deleteTimeslot(db: Database, timeslotId: number) {
	const rows = await db.deleteFrom('timeslot')
		.where('id', '=', timeslotId)
		.executeTakeFirst();
	return rows.numDeletedRows > 0;
}

export default {
	getTimeslot,
	getTimeslots,
	createTimeslot,
	updateTimeslot,
	deleteTimeslot,
};