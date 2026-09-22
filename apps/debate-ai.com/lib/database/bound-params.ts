/**
 * @fileoverview D1's per-statement bound-parameter ceiling, and the helper
 * that splits a value list into runs that fit under it.
 *
 * D1 rejects any statement carrying more than 100 bound parameters, and it
 * fails at the driver with a message that names neither the table nor the
 * column — so the caller sees a bare 500 with a stack that stops inside the
 * D1 client. The ceiling is easy to cross by accident: a single
 * `inArray(column, ids)` binds one parameter per id, so any `IN (...)` built
 * from an unbounded row set (a full queue, a whole page of results) works in
 * development against local SQLite — whose own limit is in the tens of
 * thousands — and only fails in production once the set grows past 100.
 *
 * Callers building such a list run it through {@link chunkBoundParams} and
 * issue one statement per chunk. `lib/admin/debate-card-import.ts` solves the
 * same ceiling for the multi-row-INSERT case, where the divisor is the column
 * count rather than one parameter per value.
 * @module lib/database/bound-params
 */

/** Bound parameters D1 accepts in a single statement. */
export const D1_MAX_BOUND_PARAMS = 100;

/**
 * Splits values bound one-per-parameter into chunks that fit one statement.
 *
 * @param values - Values destined for a single `IN (...)` list.
 * @param reservedParams - Parameters the same statement binds outside the
 *   list (each additional `eq`/`lt`/… comparison in the `WHERE` clause binds
 *   one), so the chunk leaves room for them.
 * @returns One array per statement, in the input's order. Empty input yields
 *   no chunks, so a caller looping over the result issues no statement at all.
 */
export function chunkBoundParams<T>(values: T[], reservedParams = 0): T[][] {
  const perChunk = Math.max(1, D1_MAX_BOUND_PARAMS - reservedParams);
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += perChunk) {
    chunks.push(values.slice(index, index + perChunk));
  }
  return chunks;
}
