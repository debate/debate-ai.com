/**
 * A `D1DatabaseLike` over Node's built-in `node:sqlite`, so the vendored
 * upstream routes can be exercised against a real SQLite engine in tests.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { codegenSchemaStatements } from "./codegen-schema";

/** A path under the package root, whatever directory Vitest runs from. */
export const pkgPath = (rel: string) => resolve(import.meta.dirname, "../..", rel);

/**
 * The Tabroom schema migration. `migrations/` is gitignored, so a fresh
 * checkout (CI) has none and the suites that need it skip.
 */
export const TABROOM_SCHEMA = pkgPath("migrations/0001_tabroom_schema.sql");
export const hasTabroomMigration = existsSync(TABROOM_SCHEMA);

/**
 * Whether the suites that need the Tabroom tables can run. They always can:
 * without the real migration they run on {@link applyTabroomSchema}'s
 * stand-in derived from upstream's codegen types.
 */
export const hasTabroomSchema = true;

/**
 * Creates the Tabroom tables: the real migration when this checkout has one,
 * otherwise the stand-in from upstream's kysely-codegen types.
 */
export function applyTabroomSchema(d1: { raw: DatabaseSync }) {
  if (hasTabroomMigration) applySqlFile(d1, TABROOM_SCHEMA);
  else d1.raw.exec(codegenSchemaStatements().join("\n"));
}
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
