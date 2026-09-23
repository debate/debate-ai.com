/**
 * A `D1DatabaseLike` over Node's built-in `node:sqlite`, so the vendored
 * upstream routes can be exercised against a real SQLite engine in tests.
 */
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1DatabaseLike, D1PreparedStatementLike, D1Result } from "../../src/db/d1-types";

export function createSqliteD1(db = new DatabaseSync(":memory:")): D1DatabaseLike & { raw: DatabaseSync } {
  const prepare = (query: string, params: unknown[] = []): D1PreparedStatementLike => ({
    bind: (...values: unknown[]) => prepare(query, values),
    async all<T>(): Promise<D1Result<T>> {
      for (const p of params) {
        if (p !== null && !["string", "number", "bigint"].includes(typeof p) && !ArrayBuffer.isView(p)) {
          throw new Error(`D1_TYPE_ERROR: Type '${typeof p}' not supported for value '${String(p)}'`);
        }
      }
      const stmt = db.prepare(query);
      if (stmt.columns().length > 0) {
        return { results: stmt.all(...(params as never[])) as T[], success: true, meta: {} };
      }
      const info = stmt.run(...(params as never[]));
      return {
        results: [],
        success: true,
        meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
      };
    },
  });
  return { raw: db, prepare: (query) => prepare(query) };
}

/** Applies a migration file (statements separated by drizzle breakpoints or `;\n`). */
export function applySqlFile(d1: { raw: DatabaseSync }, path: string) {
  d1.raw.exec(readFileSync(path, "utf8").replace(/--> statement-breakpoint/g, ""));
}
