/**
 * Value conversion between upstream's MariaDB conventions and D1.
 *
 * Going in, D1 only binds strings, numbers, null and byte arrays, so dates
 * become MySQL-style `YYYY-MM-DD HH:MM:SS` UTC strings (the format every
 * stored timestamp already has, so comparisons stay lexical-correct) and
 * booleans become 0/1.
 *
 * Coming out, upstream's MariaDB pool handed back `Date` objects for DATETIME
 * columns and booleans for `TINYINT(1)` ones, and its code and API responses
 * rely on that. {@link normalizeRow} restores both: any exact
 * `YYYY-MM-DD HH:MM:SS` string becomes a `Date`, and 0/1 in a known boolean
 * column becomes `false`/`true`.
 */

import { BOOLEAN_COLUMNS } from "./generated/columns";

const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const booleanColumns = new Set<string>(BOOLEAN_COLUMNS);

const pad = (n: number) => String(n).padStart(2, "0");

/** A `Date` as a MySQL/SQLite UTC DATETIME string. */
export function toSqlDateTime(date: Date): string {
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

/** A bind parameter as D1 accepts it. */
export function toD1Value(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : toSqlDateTime(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "bigint") return Number(value);
  if (value !== null && typeof value === "object" && !(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)) {
    return JSON.stringify(value);
  }
  return value;
}

/** A stored DATETIME string back as a `Date`; anything else unchanged. */
export function fromD1DateTime(value: unknown): unknown {
  if (typeof value === "string" && DATETIME_RE.test(value)) {
    const date = new Date(`${value.replace(" ", "T")}Z`);
    return Number.isNaN(date.getTime()) ? value : date;
  }
  return value;
}

/**
 * A result row as upstream's MariaDB driver would have returned it.
 * `booleans: false` skips the TINYINT(1) conversion, matching upstream's
 * Sequelize raw queries, which returned those as numbers.
 */
export function normalizeRow<T extends Record<string, unknown>>(row: T, { booleans = true } = {}): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (booleans && booleanColumns.has(key) && (value === 0 || value === 1)) {
      out[key] = value === 1;
    } else {
      out[key] = fromD1DateTime(value);
    }
  }
  return out as T;
}
