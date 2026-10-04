/**
 * The slice of Cloudflare's `D1Database` binding the tournaments package uses,
 * declared here so no package needs `@cloudflare/workers-types` for it. A real
 * binding satisfies it structurally.
 */

/** Metadata D1 returns with a result. */
export interface D1Meta {
  /** Rows changed by the statement. */
  changes?: number;
  /** Row id of the last insert. */
  last_row_id?: number;
  [key: string]: unknown;
}

/** The result of running a D1 statement. */
export interface D1Result<T = Record<string, unknown>> {
  /** Rows returned. */
  results: T[];
  /** Whether the statement succeeded. */
  success: boolean;
  /** Statement metadata. */
  meta: D1Meta;
}

/** A prepared D1 statement. */
export interface D1PreparedStatementLike {
  /** Bind values to the statement's placeholders. */
  bind(...values: unknown[]): D1PreparedStatementLike;
  /** Run the statement and return every row. */
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  /** Run the statement for its side effects. */
  run?(): Promise<D1Result>;
}

/** The subset of a D1 database binding the package calls. */
export interface D1DatabaseLike {
  /** Prepare a statement. */
  prepare(query: string): D1PreparedStatementLike;
  /** Run several statements in one transaction. */
  batch?(statements: D1PreparedStatementLike[]): Promise<D1Result[]>;
  /** Run raw SQL. */
  exec?(query: string): Promise<unknown>;
}
