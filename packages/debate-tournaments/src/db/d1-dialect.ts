/**
 * A Kysely dialect for Cloudflare D1 that runs upstream Tabroom's
 * MariaDB-targeted Kysely code.
 *
 * Queries compile with Kysely's SQLite compiler, then pass through
 * {@link translateMysqlToSqlite} (for MySQL-only raw `sql` fragments) and the
 * value conversions in `./values.ts` on their way to and from D1.
 *
 * D1 has no interactive transactions — it cannot hold `BEGIN … COMMIT` open
 * across round trips — so `transaction()` throws. Upstream's public read
 * routes never open one.
 */

import {
  CompiledQuery,
  Kysely,
  SafeNullComparisonPlugin,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type Driver,
  type QueryCompiler,
  type QueryResult,
} from "kysely";
import type { D1DatabaseLike } from "./d1-types";
import { translateMysqlToSqlite } from "./mysql-compat";
import { normalizeRow, toD1Value } from "./values";

class D1Connection implements DatabaseConnection {
  constructor(private readonly d1: D1DatabaseLike) {}

  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const sql = translateMysqlToSqlite(compiled.sql);
    const params = compiled.parameters.map(toD1Value);
    const { results, meta } = await this.d1.prepare(sql).bind(...params).all<Record<string, unknown>>();
    const changes = Number(meta?.changes ?? 0);
    const lastRowId = meta?.last_row_id;
    return {
      rows: (results ?? []).map((row) => normalizeRow(row)) as R[],
      numAffectedRows: BigInt(changes),
      ...(lastRowId != null && changes > 0 ? { insertId: BigInt(lastRowId) } : {}),
    };
  }

  // oxlint-disable-next-line require-yield
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("D1 does not support streaming queries.");
  }
}

class D1Driver implements Driver {
  constructor(private readonly d1: D1DatabaseLike) {}
  async init(): Promise<void> {}
  async acquireConnection(): Promise<DatabaseConnection> {
    return new D1Connection(this.d1);
  }
  async beginTransaction(): Promise<void> {
    throw new Error("D1 does not support interactive transactions; use batch() instead.");
  }
  async commitTransaction(): Promise<void> {}
  async rollbackTransaction(): Promise<void> {}
  async releaseConnection(): Promise<void> {}
  async destroy(): Promise<void> {}
}

export class D1Dialect implements Dialect {
  constructor(private readonly d1: D1DatabaseLike) {}
  createAdapter() {
    return new SqliteAdapter();
  }
  createDriver(): Driver {
    return new D1Driver(this.d1);
  }
  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }
  createIntrospector(db: Kysely<unknown>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }
}

/** A Kysely instance over `d1`, configured as upstream configured its MariaDB one. */
export function createTabroomKysely<DB>(d1: D1DatabaseLike): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new D1Dialect(d1),
    plugins: [new SafeNullComparisonPlugin()],
  });
}

export { CompiledQuery };
