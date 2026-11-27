/**
 * @fileoverview Creates the `authors`, `citations` and `citation_authors`
 * tables on a live D1 that was deployed before they existed.
 *
 * The app ships no migrations folder (see lib/database/ensure-columns.ts), so
 * a table added to `schema.ts` never reaches D1 on its own. The authors
 * repository and the sync run this once per isolate before their first query.
 * Every statement is idempotent (`IF NOT EXISTS`), and `ensureTableColumns`
 * adds any column a later schema change brings to a table that already exists.
 *
 * The DDL matches the three table definitions in lib/database/schema.ts (a
 * test compares them); an operator can also run {@link AUTHORS_DDL} by hand
 * with `wrangler d1 execute`.
 *
 * @module lib/authors/ensure-tables
 */
import { sql } from "drizzle-orm";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { authors, citationAuthors, citations } from "@/lib/database/schema";
import { AUTHORS_DDL } from "./authors-ddl";

export { AUTHORS_DDL };

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> };

let ensured: Promise<void> | null = null;

/** Creates the three tables once per isolate; a failure is forgotten and retried. */
export function ensureAuthorTables(db: unknown): Promise<void> {
  ensured ??= (async () => {
    for (const statement of AUTHORS_DDL) await (db as RawDB).run(sql.raw(statement));
    for (const table of [authors, citations, citationAuthors]) await ensureTableColumns(db, table);
  })();
  ensured.catch(() => {
    ensured = null;
  });
  return ensured;
}

/** Test-only: forget that the tables were already created. */
export function resetEnsuredAuthorTables(): void {
  ensured = null;
}
