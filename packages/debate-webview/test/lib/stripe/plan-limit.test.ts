/**
 * @fileoverview The fetch watcher behind the pricing dialog: only a `429`
 * carrying the plan-limit header raises it, the caller still gets the
 * response, and wrapping twice doesn't double-report.
 */

import { describe, expect, it, vi } from "vitest";
import { PLAN_LIMIT_HEADER } from "../../../src/lib/stripe/limits";
import { planLimitFromResponse, subscribeToPlanLimits, watchPlanLimits } from "../../../src/lib/stripe/plan-limit";

const respond = (status: number, headers: Record<string, string> = {}) => new Response("{}", { status, headers });

describe("planLimitFromResponse", () => {
  it("reads the refused metric off a 429", () => {
    expect(planLimitFromResponse(respond(429, { [PLAN_LIMIT_HEADER]: "cardSearches" }))).toBe("cardSearches");
  });

  it("ignores other statuses, other 429s and unknown metrics", () => {
    expect(planLimitFromResponse(respond(200, { [PLAN_LIMIT_HEADER]: "cardSearches" }))).toBeNull();
    expect(planLimitFromResponse(respond(429))).toBeNull();
    expect(planLimitFromResponse(respond(429, { [PLAN_LIMIT_HEADER]: "bogus" }))).toBeNull();
  });
});

describe("watchPlanLimits", () => {
  it("reports a plan-limit refusal and passes the response through", async () => {
    const limited = respond(429, { [PLAN_LIMIT_HEADER]: "llmRequests" });
    const target = { fetch: vi.fn(async () => limited) as unknown as typeof fetch };
    const seen: string[] = [];
    const unsubscribe = subscribeToPlanLimits((metric) => seen.push(metric));
    const unwatch = watchPlanLimits(target);
    watchPlanLimits(target);

    expect(await target.fetch("/api/reason-ai")).toBe(limited);
    await target.fetch("/api/other");
    expect(seen).toEqual(["llmRequests", "llmRequests"]);

    unwatch();
    unsubscribe();
    await target.fetch("/api/reason-ai");
    expect(seen).toHaveLength(2);
  });

  it("stays quiet on ordinary responses", async () => {
    const target = { fetch: vi.fn(async () => respond(200)) as unknown as typeof fetch };
    const listener = vi.fn();
    const unsubscribe = subscribeToPlanLimits(listener);
    const unwatch = watchPlanLimits(target);
    await target.fetch("/api/search");
    expect(listener).not.toHaveBeenCalled();
    unwatch();
    unsubscribe();
  });
});
