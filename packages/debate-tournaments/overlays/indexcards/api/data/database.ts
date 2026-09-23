/**
 * debate-tournaments overlay — replaces upstream's `api/data/database.ts`.
 *
 * Upstream builds one Kysely instance over a MariaDB pool at import time. On
 * Cloudflare the database is the request's D1 binding, so `db` here is a proxy
 * that forwards to the Kysely instance of the current request (see
 * `src/db/runtime.ts`). Same exports, same `DB` schema types.
 */
import type { Kysely } from 'kysely';
import type { DB } from './schema.js';
import { createKyselyProxy } from '../../../../../src/db/runtime.js';

export const db: Kysely<DB> = createKyselyProxy<DB>();

export type Database = Kysely<DB>;
export type DBSchema = DB;
