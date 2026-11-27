/**
 * @fileoverview Loads the authors snapshot into the `authors`, `citations` and
 * `citation_authors` tables from inside the Worker.
 *
 * The CLI script (`.github/scripts/sync-authors.ts`) rebuilds the dataset from
 * the docs MDX and needs a checkout; the Worker has only the committed
 * snapshot, so this loads that against the request's own D1 binding, which
 * lets a deploy be seeded from the admin API. Both paths build their SQL with
 * `buildAuthorSeedStatements`, so they load identical data.
 *
 * @module lib/authors/seed-authors-to-db
 */
import { sql } from "drizzle-orm";
import { loadAuthorsSnapshot } from "./author-repository";
import { ensureAuthorTables } from "./ensure-tables";
import { buildAuthorSeedStatements } from "./seed-sql";

export interface AuthorSeedResult {
  authors: number;
  citations: number;
  links: number;
  /** SQL statements run (three deletes plus the insert batches). */
  statements: number;
  durationMs: number;
}

/**
 * Replaces the contents of the three tables with the snapshot. Safe to re-run:
 * the whole swap runs as one atomic batch, so a failure leaves the tables as
 * they were.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 */
export async function seedAuthorsIntoDb(db: any): Promise<AuthorSeedResult> {
  const startedAt = Date.now();
  const dataset = await loadAuthorsSnapshot();
  const statements = buildAuthorSeedStatements(dataset);
  await ensureAuthorTables(db);
  await db.batch(statements.map((statement) => db.run(sql.raw(statement))));
  return {
    authors: dataset.authors.length,
    citations: dataset.citations.length,
    links: dataset.citations.reduce((total, citation) => total + citation.authors.length, 0),
    statements: statements.length,
    durationMs: Date.now() - startedAt,
  };
}
