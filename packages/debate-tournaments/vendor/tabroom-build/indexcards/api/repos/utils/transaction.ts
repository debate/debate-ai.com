// @ts-nocheck
import type { Database } from '../../data/database.js';

/**
 * Runs fn in the caller's transaction when db is one, else in a new transaction. Lets a repo
 * function that writes more than one table be called alone or inside a bigger transaction,
 * since Kysely can't start a transaction inside another. */
export async function withTransaction<T>(db: Database, fn: (trx: Database) => Promise<T>): Promise<T> {
	return db.isTransaction ? await fn(db) : await db.transaction().execute(fn);
}
