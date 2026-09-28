/**
 * The slice of the Cloudflare Workers runtime this app names in type
 * positions. `@cloudflare/workers-types` is the complete article, but it
 * conflicts with the DOM lib this app also needs (both declare `Request`,
 * `Response`, `fetch`, …), so the two globals actually referenced here —
 * `D1Database` for the `debate_db` binding and `Fetcher` for the static-asset
 * binding — are declared structurally instead.
 *
 * These are deliberately loose: `lib/database/d1-session.ts` already models
 * the exact D1 surface it touches, and drizzle's own D1 driver types are what
 * every query is really checked against.
 */

interface D1Database {
  prepare(query: string): unknown;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
  dump?(): Promise<ArrayBuffer>;
  withSession?(constraintOrBookmark?: string): unknown;
}

interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}
