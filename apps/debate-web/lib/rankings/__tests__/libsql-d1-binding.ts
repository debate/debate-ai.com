/**
 * A D1 binding backed by in-memory libsql, so a store can be tested through
 * `drizzle-orm/d1` — the driver production uses — rather than only through
 * `drizzle-orm/libsql`. The two differ: D1's `batch()` binds each statement
 * through a prepared `stmt`, which raw `db.run(sql…)` queries do not have.
 * Statements over D1's 100 bound parameters are refused, as D1 does.
 */
import { createClient, type InArgs, type ResultSet } from "@libsql/client";
import { D1_MAX_BOUND_PARAMS } from "../../database/bound-params";

interface ShimStatement {
  sql: string;
  args: unknown[];
  bind(...values: unknown[]): ShimStatement;
  all(): Promise<{ results: Record<string, unknown>[]; success: true; meta: Record<string, unknown> }>;
  run(): Promise<{ results: []; success: true; meta: { changes: number } }>;
  raw(): Promise<unknown[][]>;
  first(column?: string): Promise<unknown>;
}

export function libsqlD1Binding() {
  const client = createClient({ url: ":memory:" });
  const objects = (rs: ResultSet) =>
    rs.rows.map((row) => Object.fromEntries(rs.columns.map((column, i) => [column, row[i]])));
  const execute = (sql: string, args: unknown[]) => {
    if (args.length > D1_MAX_BOUND_PARAMS) throw new Error(`D1_ERROR: too many SQL variables (${args.length})`);
    return client.execute({ sql, args: args as InArgs });
  };

  const statement = (sql: string, args: unknown[] = []): ShimStatement => ({
    sql,
    args,
    bind: (...values) => statement(sql, values),
    all: async () => ({ results: objects(await execute(sql, args)), success: true, meta: {} }),
    run: async () => ({ results: [], success: true, meta: { changes: (await execute(sql, args)).rowsAffected } }),
    raw: async () => {
      const rs = await execute(sql, args);
      return rs.rows.map((row) => rs.columns.map((_, i) => row[i]));
    },
    first: async (column) => {
      const row = objects(await execute(sql, args))[0];
      return row === undefined ? null : column ? row[column] : row;
    },
  });

  return {
    prepare: (sql: string) => statement(sql),
    async batch(statements: ShimStatement[]) {
      for (const s of statements) {
        if (typeof s?.sql !== "string") throw new TypeError("D1 batch() takes prepared statements only");
        if (s.args.length > D1_MAX_BOUND_PARAMS) throw new Error(`D1_ERROR: too many SQL variables (${s.args.length})`);
      }
      const results = await client.batch(
        statements.map((s) => ({ sql: s.sql, args: s.args as InArgs })),
        "write",
      );
      return results.map((rs) => ({ results: objects(rs), success: true, meta: { changes: rs.rowsAffected } }));
    },
  };
}
