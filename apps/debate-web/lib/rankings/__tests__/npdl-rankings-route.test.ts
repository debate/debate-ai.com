/**
 * @fileoverview `GET /api/rankings/npdl` when D1 can't be read: every season
 * the select offers is served from the bundled snapshot.
 */
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { NPDL_SEASONS } from "@debate-ai/rankings/src/sync/sync-npdl-rankings";

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => {
    throw new Error("no D1 binding");
  },
}));
vi.spyOn(console, "error").mockImplementation(() => {});

const { GET } = await import("@/app/api/rankings/npdl/route");

async function get(query = "") {
  const res = await GET(new NextRequest(`https://d.ebate.app/api/rankings/npdl${query}`));
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

describe("GET /api/rankings/npdl without D1", () => {
  it.each(NPDL_SEASONS)("serves %s from the snapshot", async (season) => {
    const { status, body } = await get(`?season=${season}`);
    expect(status).toBe(200);
    expect(body.source).toBe("snapshot");
    expect(body.seasons).toEqual(NPDL_SEASONS);
    expect(body.rankings.season).toBe(season);
    expect(body.rankings.teams.length).toBeGreaterThan(0);
    expect(body.rankings.schools.length).toBeGreaterThan(0);
  });

  it("serves the newest season when none is asked", async () => {
    const { body } = await get();
    expect(body.rankings.season).toBe(NPDL_SEASONS[0]);
  });

  it("rejects a season the league never ranked", async () => {
    expect((await get("?season=2015-16")).status).toBe(400);
  });
});
