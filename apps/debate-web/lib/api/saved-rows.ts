/**
 * @fileoverview Reads the JSON `data` column of account-saved rows without
 * letting one bad row take the rest down.
 *
 * Most account-sync tables (`saved_flows`, `saved_drill_sets`,
 * `saved_tool_records`, …) keep the whole client record as a JSON string in a
 * `data` column. Their list routes used to answer
 * `rows.map((row) => JSON.parse(row.data))`, so a single row that could not
 * be parsed — a truncated write, a hand edit, an old encoding — threw, and the
 * user got a 500 instead of every other drill set, judge decision or quick
 * card they had saved. `/api/word-count-rounds` and `/api/tool-records`
 * already skipped such a row; these helpers give every route that behaviour.
 *
 * @module lib/api/saved-rows
 */

/** Result of reading one row's `data` column. */
export type SavedRowParse<T = unknown> = { ok: true; value: T } | { ok: false };

/**
 * Parses one row's JSON `data`. Never throws: anything that is not a string,
 * or not valid JSON, reads as `{ ok: false }`.
 */
export function parseSavedRowData<T = unknown>(data: unknown): SavedRowParse<T> {
  if (typeof data !== "string") return { ok: false };
  try {
    return { ok: true, value: JSON.parse(data) as T };
  } catch {
    return { ok: false };
  }
}

/**
 * The parsed `data` of every row that can be read, in order, skipping the
 * ones that can't. `shape` builds the response item from the parsed value and
 * its row (for routes that add a column, e.g. `updatedAt`); it defaults to the
 * parsed value itself.
 */
export function parseSavedRows<Row extends { data: unknown }, Out = unknown>(
  rows: readonly Row[],
  shape?: (value: unknown, row: Row) => Out,
): Out[] {
  const out: Out[] = [];
  for (const row of rows) {
    const parsed = parseSavedRowData(row.data);
    if (!parsed.ok) continue;
    out.push(shape ? shape(parsed.value, row) : (parsed.value as Out));
  }
  return out;
}
