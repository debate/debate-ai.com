// @ts-nocheck
import type { Database } from '../data/database.js';
import type { Room } from '../data/schema.js';
import type { Insertable } from 'kysely';
type queryOpts = {
	tourn?: number;
	site?: number;
}
function buildRoomQuery(db: Database, opts: queryOpts = {}) {
	let query = db.selectFrom('room'); 

	if (opts.tourn) {
		query = query.innerJoin('tourn_site', 'room.site', 'tourn_site.site')
		.where('tourn_site.tourn', '=', opts.tourn);
	}
	if (opts.site) {
		query = query.where('room.site', '=', opts.site);
	}

	return query;
}

async function getRoom(db: Database, id: number, opts: queryOpts = {}) {
	return await buildRoomQuery(db, opts)
	.where('room.id', '=', id)
	.selectAll('room')
	.executeTakeFirst();
}

async function getRooms(db: Database, opts: queryOpts = {}) {
	return await buildRoomQuery(db, opts)
	.selectAll('room')
	.execute();
}

async function createRoom(db: Database, data: Insertable<Room>) {
	return await db.insertInto('room')
	.values(data)
	.returningAll()
	.executeTakeFirst();
}

async function updateRoom(db: Database, id: number, data: Insertable<Room>) {
	return await db.updateTable('room')
	.set(data)
	.where('id', '=', id)
	.execute();
}

async function deleteRoom(db: Database, id: number) {
	return await db.deleteFrom('room')
	.where('id', '=', id)
	.execute();
}

export default {
	getRoom,
	getRooms,
	createRoom,
	updateRoom,
	deleteRoom,
};