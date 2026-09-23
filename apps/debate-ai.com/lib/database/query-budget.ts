/**
 * @fileoverview D1's per-invocation *query* ceiling, and the helper that keeps
 * a variable-length run of statements under it.
 *
 * Separate from `bound-params.ts`, which bounds how much one statement may
 * carry: this bounds how many statements one request may issue at all. D1
 * allows 1,000 queries per Worker invocation (50 on the Workers Free plan) and
 * every `db.select()`/`db.insert()`/`db.delete()` awaited on its own spends one
 * of them, so any handler that loops over an unbounded row set — a whole
 * publish queue, a whole table — grows its query count with the data and
 * eventually crosses the ceiling. It then fails at the driver, mid-loop, with a
 * message that names no table or column, exactly like the bound-parameter
 * ceiling next door: a bare 500 whose stack stops inside the D1 client, and
 * which never reproduces against local SQLite, where nothing counts the
 * statements at all.
 *
 * `db.batch()` is the way out. A batch is one D1 request carrying many
 * statements, so it spends one query from the budget however many statements it
 * holds — and it applies them as a single transaction, so a run that fails
 * partway leaves the table as it was. Callers build their statements as
 * unexecuted query builders, run them through {@link chunkStatements}, and
 * `await db.batch(chunk)` per chunk; `seed-videos-to-db.ts` batches its whole
 * seed the same way.
 *
 * @see https://developers.cloudflare.com/d1/platform/limits/
 * @module lib/database/query-budget
 */

/** Queries D1 accepts from a single Worker invocation (50 on the Free plan). */
export const D1_MAX_QUERIES_PER_INVOCATION = 1000;

/**
 * Statements per `db.batch()` call.
 *
 * The budget is spent per batch rather than per statement, so this cap is not
 * about the ceiling above — it keeps one request's payload bounded, since every
 * statement in a batch is sent together and a publish queue can hold thousands.
 * A hundred upserts is a few hundred KB on the wire and still turns a
 * thousand-round publish into ten queries rather than a thousand.
 */
export const DEFAULT_STATEMENTS_PER_BATCH = 100;

/**
 * Splits statements into runs small enough to send as one `db.batch()` call.
 *
 * @param statements - Unexecuted query builders, in the order they must run.
 * @param perBatch - Statements per batch. See {@link DEFAULT_STATEMENTS_PER_BATCH}.
 * @returns One array per batch, in the input's order. Empty input yields no
 *   batches, so a caller looping over the result issues no query at all —
 *   which matters, because `db.batch([])` is not a valid call.
 */
export function chunkStatements<T>(
  statements: T[],
  perBatch = DEFAULT_STATEMENTS_PER_BATCH,
): T[][] {
  const size = Math.max(1, perBatch);
  const batches: T[][] = [];
  for (let index = 0; index < statements.length; index += size) {
    batches.push(statements.slice(index, index + size));
  }
  return batches;
}
