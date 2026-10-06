import { describe, expect, it } from "vitest";
import { createTournamentsClient } from "../src/ui/client";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A fake of both APIs: hosted at `/api/tabroom`, live Tabroom at `/api/tabroom-beta`. */
function fakeApis({ hostedYear = [], liveYear = [], liveUpcoming = [] }: { hostedYear?: unknown[]; liveYear?: unknown[]; liveUpcoming?: unknown[] }) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/host/demo")) return json({ tournId: 90001, username: "demo.admin" });
    if (url === "/api/tabroom/pages/invite/upcoming") return json([]);
    if (url === "/api/tabroom-beta/pages/invite/upcoming") return json(liveUpcoming);
    if (url.startsWith("/api/tabroom/rest/tourns?")) return json(hostedYear);
    if (url.startsWith("/api/tabroom-beta/rest/tourns?")) return json(liveYear);
    return json({ detail: "nope" }, 404);
  }) as typeof fetch;
  return { calls, client: createTournamentsClient("/api/tabroom", fetchImpl, { liveApiBase: "/api/tabroom-beta" }) };
}

describe("createTournamentsClient.resolve", () => {
  it("finds an upcoming tournament by year and slug, and names its links", async () => {
    const { client, calls } = fakeApis({
      liveUpcoming: [{ id: "38436-0", tournId: 38436, name: "Yale Invitational", start: "2026-10-02T12:00:00.000Z" }],
    });
    await expect(client.resolve(2026, "yale-invitational")).resolves.toBe(38436);
    expect(calls.some((c) => c.includes("/rest/tourns?"))).toBe(false);
    expect(client.slugOf(38436)).toEqual({ year: 2026, slug: "yale-invitational" });
    expect(client.sourceOf(38436)).toBe("tabroom");
  });

  it("lists the year's tournaments for one that is not upcoming", async () => {
    const { client, calls } = fakeApis({
      liveYear: [{ id: 40242, name: "Heart of Texas Invitational", start: "2026-10-16T13:00:00.000Z" }],
    });
    await expect(client.resolve(2026, "heart-of-texas-invitational")).resolves.toBe(40242);
    const scan = calls.find((c) => c.startsWith("/api/tabroom-beta/rest/tourns?"));
    expect(scan).toContain("startBefore=2027-01-01T00%3A00%3A00.000Z");
    expect(client.sourceOf(40242)).toBe("tabroom");
  });

  it("prefers the hosted tournament, and leaves a same-named one on its id", async () => {
    const { client } = fakeApis({
      hostedYear: [{ id: 90001, name: "Bay Area Invitational", start: "2026-10-05T16:00:00.000Z" }],
      liveYear: [{ id: 41000, name: "Bay Area Invitational", start: "2026-03-01T16:00:00.000Z" }],
    });
    await expect(client.resolve(2026, "bay-area-invitational")).resolves.toBe(90001);
    expect(client.sourceOf(90001)).toBe("hosted");
  });

  it("rejects with a 404 when nothing by that name started that year", async () => {
    const { client } = fakeApis({ liveYear: [{ id: 1, name: "Other", start: "2026-01-02T00:00:00.000Z" }] });
    await expect(client.resolve(2026, "missing-classic")).rejects.toMatchObject({ status: 404 });
  });
});
