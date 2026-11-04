/**
 * The school-seasons table, built from Extinction.GG files against a real
 * in-memory SQLite database. Nothing here touches the network.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { finishedSchoolSeasons, getSchoolSeasons } from "../school-season-store";

const db = drizzle(createClient({ url: ":memory:" }), { schema }) as unknown as Parameters<
  typeof getSchoolSeasons
>[0];

const teams = (school: string) =>
  JSON.stringify({
    attribution: "x",
    teams: JSON.stringify([
      { SchoolTeamCode: `${school} AB: Ant & Bee`, FullName1: "A Ant", FullName2: "B Bee", OverallELO: "2300" },
      { SchoolTeamCode: "Other CD: Cat & Dog", FullName1: "C Cat", FullName2: "D Dog", OverallELO: "2200" },
    ]),
  });

describe("school season store", () => {
  // 2017-18 is the latest finished season, so 2015-16 to 2016-17 per format.
  const now = new Date("2017-09-01T00:00:00Z");

  it("lists every finished season of every event", () => {
    expect(finishedSchoolSeasons(now)).toHaveLength(2 * 3);
  });

  it("builds a few seasons per request, then serves the school's rows", async () => {
    const fetchFile = vi.fn(async (kind: string) =>
      kind === "teams" ? { status: 200, body: teams("Harker") } : { status: 404, body: "" },
    );
    const first = await getSchoolSeasons(db, "harker", { now, budget: 4, fetchFile });
    expect(first.pending).toBe(2);
    expect(first.seasons).toHaveLength(4);

    const second = await getSchoolSeasons(db, "harker", { now, budget: 4, fetchFile });
    expect(second.pending).toBe(0);
    expect(second.seasons).toHaveLength(6);
    expect(second.seasons[0]).toMatchObject({ year: 2016, teams: [{ rank: 1, name: "Ant & Bee", bids: 0 }] });

    // Built seasons and saved files are not fetched again.
    const calls = fetchFile.mock.calls.length;
    await getSchoolSeasons(db, "other", { now, fetchFile });
    expect(fetchFile.mock.calls.length).toBe(calls);
    expect((await getSchoolSeasons(db, "nowhere", { now, fetchFile })).seasons).toEqual([]);
  });
});
