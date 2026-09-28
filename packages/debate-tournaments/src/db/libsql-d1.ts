/**
 * A `D1DatabaseLike` over a libSQL client (`@libsql/client`), for the host
 * app's local development, where the database is a libSQL file rather than a
 * D1 binding. Structural typing only — this package does not depend on libSQL.
 */

import type { D1DatabaseLike, D1PreparedStatementLike, D1Result } from "./d1-types";

export interface LibsqlClientLike {
  execute(stmt: { sql: string; args: unknown[] }): Promise<{
    columns: string[];
    rows: ArrayLike<unknown>[];
    rowsAffected: number;
    lastInsertRowid?: bigint | number;
  }>;
}

export function d1FromLibsql(client: LibsqlClientLike): D1DatabaseLike {
  const prepare = (sql: string, args: unknown[] = []): D1PreparedStatementLike => ({
    bind: (...values: unknown[]) => prepare(sql, values),
    async all<T>(): Promise<D1Result<T>> {
      const result = await client.execute({ sql, args });
      const results = result.rows.map((row) => {
        const obj: Record<string, unknown> = {};
        result.columns.forEach((col, i) => {
          const value = row[i];
          obj[col] = typeof value === "bigint" ? Number(value) : value;
        });
        return obj as T;
      });
      return {
        results,
        success: true,
        meta: {
          changes: result.rowsAffected,
          last_row_id: result.lastInsertRowid == null ? undefined : Number(result.lastInsertRowid),
        },
      };
    },
  });
  return { prepare: (sql) => prepare(sql) };
}
