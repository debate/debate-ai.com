// @ts-nocheck
import type { Database } from '../data/database.js';
import type { Permission } from '../data/schema.js';
import type { Insertable } from 'kysely';

type CreatePermissionData = Omit<Insertable<Permission>, 'person'> & {
	person: NonNullable<Insertable<Permission>['person']>;
	tag: NonNullable<Insertable<Permission>['tag']>;
};

export const getPermission = async (db: Database, id: number) => {
	return db.selectFrom('permission')
		.selectAll()
		.where('id', '=', id)
		.executeTakeFirst();
};

export const getPermissions = async (db: Database, scope: {
	tourn?: number,
	chapter?: number,
	person?: number,
} = {}) => {
	let query = db.selectFrom('permission').selectAll();

	if (scope.tourn !== undefined) {
		query = query.where('tourn', '=', scope.tourn);
	}
	if (scope.chapter !== undefined) {
		query = query.where('chapter', '=', scope.chapter);
	}
	if (scope.person !== undefined) {
		query = query.where('person', '=', scope.person);
	}
	return await query.execute();
};

export const createPermission = async (db: Database, data: CreatePermissionData) => {
	const [row] = await db.insertInto('permission')
		.values(data)
		.returning('id')
		.execute();
	return row.id;
};

export default {
	getPermission,
	getPermissions,
	createPermission,
};