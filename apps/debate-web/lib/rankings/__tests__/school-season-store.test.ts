/**
 * The school-seasons table, built from saved Elo ratings files against a real
 * in-memory SQLite database. Nothing here touches the network.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { finishedSchoolSeasons, getSchoolElite, getSchoolSeasons, runDailySchoolSeasonsRefresh } from "../school-season-store";

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
      kind === "teams" ? { status: 200, body: teams("Zed Test") } : { status: 404, body: "" },
    );
    const first = await getSchoolSeasons(db, "zed-test", { now, budget: 4, fetchFile });
    expect(first.pending).toBe(2);
    expect(first.seasons).toHaveLength(4);

    const second = await getSchoolSeasons(db, "zed-test", { now, budget: 4, fetchFile });
    expect(second.pending).toBe(0);
    expect(second.seasons).toHaveLength(6);
    // Every season built: the school's rank comes back per event, never combined (2 seasons × #1 = 10 pts each).
    expect(second.ranks?.byEvent).toEqual({
      Policy: { allTime: { rank: 1, score: 10, of: 2 }, decade: { rank: 1, score: 10, of: 2 } },
      "Lincoln-Douglas": { allTime: { rank: 1, score: 10, of: 2 }, decade: { rank: 1, score: 10, of: 2 } },
      "Public Forum": { allTime: { rank: 1, score: 10, of: 2 }, decade: { rank: 1, score: 10, of: 2 } },
    });
    expect(second.ranks).not.toHaveProperty("allTime");
    // Ranks are there from the first request, over the seasons built so far (4 of 6).
    const firstScores = Object.values(first.ranks?.byEvent ?? {}).map((r) => r.allTime?.score ?? 0);
    expect(firstScores.reduce((a, b) => a + b, 0)).toBe(20);
    expect(second.seasons[0]).toMatchObject({ year: 2016, teams: [{ rank: 1, name: "Ant & Bee", bids: 0 }] });

    // Built seasons and saved files are not fetched again.
    const calls = fetchFile.mock.calls.length;
    await getSchoolSeasons(db, "other", { now, fetchFile });
    expect(fetchFile.mock.calls.length).toBe(calls);
    expect((await getSchoolSeasons(db, "nowhere", { now, fetchFile })).seasons).toEqual([]);
  });

  it("records a season that fails to build, and the daily run builds and ranks everything", async () => {
    // Two seasons later, so 2017-18 and 2018-19 are new (the store keeps one database per isolate).
    const later = new Date("2019-09-01T00:00:00Z");
    let broken = true;
    const fetchFile = vi.fn(async (kind: string, file: string) => {
      if (broken && file.startsWith("HSLD")) throw new Error("Ratings source returned 500");
      return kind === "teams" ? { status: 200, body: teams("Zed Test") } : { status: 404, body: "" };
    });
    const first = await getSchoolSeasons(db, "zed-test", { now: later, budget: 6, fetchFile });
    expect(first.pending).toBe(2);
    expect(first.failures.map((f) => [f.format, f.year])).toEqual([
      ["hsld", 2019],
      ["hsld", 2018],
    ]);

    broken = false;
    await runDailySchoolSeasonsRefresh(db, { now: later, fetchFile });
    const after = await getSchoolSeasons(db, "zed-test", { now: later, fetchFile });
    expect(after).toMatchObject({ pending: 0, failures: [] });
    // Each event: 4 seasons × #1 (5 pts each)
    expect(after.ranks?.byEvent.Policy?.allTime).toEqual({ rank: 1, score: 20, of: 2 });
    expect(after.ranks?.byEvent["Public Forum"]?.allTime).toEqual({ rank: 1, score: 20, of: 2 });
    expect(after.ranks?.decadeFrom).toBe(2011);
  });

  it("serves each event's Top 10 from the stored seasons and the TOC history", async () => {
    const later = new Date("2019-09-01T00:00:00Z");
    const fetchFile = vi.fn(async (kind: string) =>
      kind === "teams" ? { status: 200, body: teams("Zed Test") } : { status: 404, body: "" },
    );
    const chart = await getSchoolElite(db, "Public Forum", { now: later, fetchFile });
    expect(chart).toMatchObject({ event: "Public Forum", pending: 0, firstYear: 2010, lastYear: 2019 });
    expect(chart.schools).toHaveLength(10);
    for (const school of chart.schools) expect(school.seasons).toHaveLength(10);
  });
});
