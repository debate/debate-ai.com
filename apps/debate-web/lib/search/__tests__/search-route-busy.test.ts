/**
 * @fileoverview `/api/search` when D1 is overloaded: it answers 503 "busy"
 * with `Retry-After`, then stops sending D1 work for a few seconds instead of
 * trying fallback queries that would fail the same way.
 */
import { describe, expect, it, vi } from "vitest";

const overloaded = () =>
  new Error("Failed query: select ... from user_plans", {
    cause: new Error("D1_ERROR: D1 DB is overloaded. Too many resources consumed within a 10 second window"),
  });

let tierLookups = 0;
async function getUserTier(): Promise<never> {
  tierLookups++;
  throw overloaded();
}

vi.mock("@/lib/auth/session", () => ({ getUserId: async () => null }));
vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => ({}) }));
vi.mock("@/lib/stripe/usage", () => ({
  getUserTier,
  consumeDailyUsage: async () => ({ allowed: true }),
  limitMessage: () => "",
  planLimitHeaders: () => ({}),
  usageSubject: () => "ip:test",
}));

const { GET } = await import("@/app/api/search/route");

function search(query: string) {
  const url = new URL(`https://d.ebate.app/api/search?${query}`);
  return GET({ nextUrl: url } as never);
}

describe("/api/search under D1 overload", () => {
  it("answers busy, then holds off D1 for the retry window", async () => {
    const first = await search("q=china&searchQuotes=1&sort=year%3Aasc");
    expect(first.status).toBe(503);
    expect(first.headers.get("retry-after")).toBe("5");
    expect(await first.json()).toMatchObject({ results: [], total: 0, busy: true });
    expect(tierLookups).toBe(1);

    const second = await search("q=china&searchQuotes=1");
    expect(second.status).toBe(503);
    // The second search never reached the database.
    expect(tierLookups).toBe(1);
  });
});
