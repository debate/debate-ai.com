/**
 * Adds a table's schema columns that the live database is missing.
 *
 * `apps/debate-ai.com/drizzle/` is no longer tracked in git, so a CI or
 * Workers deploy has no app migrations to apply (`.github/scripts/migrate-d1.ts`
 * skips the folder when it is absent). A column added to `schema.ts` since —
 * `user_settings.flow_auto_save`, for one — therefore never reaches D1, and
 * because Drizzle names *every* column in an insert and a `select()`, a single
 * missing column fails the whole route with `no such column` / `has no column
 * named`. That is exactly how `PUT /api/settings` answered 500 on every save.
 *
 * This closes the gap for wide, append-only tables like `user_settings`: it
 * reads `PRAGMA table_info`, and `ALTER TABLE … ADD COLUMN`s each schema
 * column that is absent. Only columns SQLite can add to a populated table
 * without a rewrite are touched — nullable, or with a constant default — and
 * never a primary key; anything else still needs a real migration. The check
 * runs once per table per isolate, so a steady-state request pays nothing.
 */

import { sql } from "drizzle-orm";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";
import { describeError } from "./errors";
import { BENIGN_ALTER_ERROR } from "./migration-sql";

type ColumnLike = {
  name: string;
  primary: boolean;
  notNull: boolean;
  hasDefault: boolean;
  default?: unknown;
  getSQLType(): string;
};

/** A literal SQLite will accept as an `ADD COLUMN … DEFAULT`, or undefined. */
function defaultLiteral(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  return undefined;
}

/**
 * The `ALTER TABLE … ADD COLUMN` statements that bring `existing` up to the
 * table's schema. Pure, so it can be tested without a database.
 */
export function planMissingColumnAdds(
  tableName: string,
  columns: readonly ColumnLike[],
  existing: Iterable<string>,
): string[] {
  const present = new Set(Array.from(existing, (name) => name.toLowerCase()));
  const statements: string[] = [];
  for (const column of columns) {
    if (present.has(column.name.toLowerCase()) || column.primary) continue;
    let definition = `"${column.name}" ${column.getSQLType()}`;
    if (column.hasDefault) {
      const literal = defaultLiteral(column.default);
      // A default SQLite can't take in an ADD COLUMN (an expression, a $default
      // function) — leave it to a real migration.
      if (literal === undefined) continue;
      definition += ` DEFAULT ${literal}`;
      if (column.notNull) definition += " NOT NULL";
    } else if (column.notNull) {
      // NOT NULL without a default can't be added to a table that has rows.
      continue;
    }
    statements.push(`ALTER TABLE "${tableName}" ADD COLUMN ${definition}`);
  }
  return statements;
}

type RawDB = {
  all(query: ReturnType<typeof sql.raw>): Promise<unknown>;
  run(query: ReturnType<typeof sql.raw>): Promise<unknown>;
};

const ensured = new Map<string, Promise<void>>();

/**
 * Ensures every addable schema column of `table` exists in `db`. Memoized per
 * table for the life of the isolate; a failed attempt is forgotten so the next
 * request retries instead of caching the failure.
 */
export function ensureTableColumns(db: unknown, table: SQLiteTable): Promise<void> {
  const config = getTableConfig(table);
  const cached = ensured.get(config.name);
  if (cached) return cached;

  const attempt = (async () => {
    const raw = db as RawDB;
    const result = await raw.all(sql.raw(`PRAGMA table_info("${config.name}")`));
    const rows = (Array.isArray(result) ? result : ((result as { results?: unknown[] })?.results ?? [])) as {
      name?: unknown;
    }[];
    // No rows means the table itself is missing — not something to patch here.
    if (rows.length === 0) return;
    const names = rows.map((row) => String(row.name));
    for (const statement of planMissingColumnAdds(config.name, config.columns as ColumnLike[], names)) {
      try {
        await raw.run(sql.raw(statement));
      } catch (error) {
        // Another isolate may have added it between our PRAGMA and ALTER.
        if (!BENIGN_ALTER_ERROR.test(describeError(error))) throw error;
      }
    }
  })();

  ensured.set(config.name, attempt);
  attempt.catch(() => ensured.delete(config.name));
  return attempt;
}

/** Test-only: forget which tables were already checked. */
export function resetEnsuredColumns(): void {
  ensured.clear();
}
