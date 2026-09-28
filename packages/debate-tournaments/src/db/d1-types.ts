/**
 * The slice of Cloudflare's `D1Database` binding this package uses, declared
 * here so the package does not depend on `@cloudflare/workers-types`. A real
 * binding satisfies it structurally, as do the local adapters in
 * `./libsql-d1.ts` (host-app dev) and the tests' `node:sqlite` shim.
 */

export interface D1Meta {
  changes?: number;
  last_row_id?: number;
  [key: string]: unknown;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run?(): Promise<D1Result>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch?(statements: D1PreparedStatementLike[]): Promise<D1Result[]>;
  exec?(query: string): Promise<unknown>;
}
