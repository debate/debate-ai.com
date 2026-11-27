/**
 * The school-seasons table, built from saved Elo ratings files against a real
 * in-memory SQLite database. Nothing here touches the network.
 */
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it, vi } from "vitest";
import {
  SCHOOL_SEASON_FORMATS,
  hsProgramStrength,
  type SchoolSeasonEvent,
  type SchoolSeasonPoints,
  type SchoolStrengthRank,
} from "@debate-ai/rankings";
import * as schema from "../../database/schema";
import { finishedSchoolSeasons, getSchoolElite, getSchoolSeasons, runDailySchoolSeasonsRefresh } from "../school-season-store";

const db = drizzle(createClient({ url: ":memory:" }), { schema }) as unknown as Parameters<
  typeof getSchoolSeasons
>[0];

/** Zed Test at #1 (5 pts) and Other at #2 in every event, `from`–`to`, as the store sums them. */
const zedRows = (from: number, to: number): SchoolSeasonPoints[] =>
  SCHOOL_SEASON_FORMATS.flatMap(({ event }) =>
    Array.from({ length: to - from + 1 }, (_, i) => [
      { school: "zed-test", year: from + i, points: 5, event },
      { school: "other", year: from + i, points: 4.95, event },
    ]).flat(),
  );

/** Programs ranked in `event` through `last`: every program with a national finish, plus Zed Test and Other. */
const programs = (event: SchoolSeasonEvent, last: number) => hsProgramStrength([], event, last).ranks.size + 2;

/** The school page's all-time rank is Zed Test's rank and points on the event's all-time Schools list. */
async function expectOnAllTimeList(
  event: SchoolSeasonEvent,
  now: Date,
  fetchFile: NonNullable<Parameters<typeof getSchoolElite>[2]>["fetchFile"],
  own: SchoolStrengthRank | null,
) {
  const { allTime = [] } = await getSchoolElite(db, event, { now, fetchFile });
  const row = allTime.find((r) => r.handle === "zed-test");
  if (row) expect({ rank: row.rank, score: row.score }).toEqual({ rank: own?.rank, score: own?.score });
  else expect(own!.rank).toBeGreaterThan(allTime.at(-1)!.rank);
}

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
    // Every season built: the school's rank comes back per event, never combined (2 seasons × #1 = 10 pts each),
    // ranked among every program with a national finish too, as the all-time Schools list ranks it.
    for (const { event } of SCHOOL_SEASON_FORMATS) {
      const own = second.ranks?.byEvent[event];
      expect(own?.allTime).toEqual({ rank: expect.any(Number), score: 10, of: programs(event, 2017) });
      await expectOnAllTimeList(event, now, fetchFile, own?.allTime ?? null);
    }
    expect(second.ranks).not.toHaveProperty("allTime");
    expect(second.ranks).not.toHaveProperty("version");
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
    // Each event: 4 seasons × #1 (5 pts each), at its place on the all-time Schools list.
    for (const { event } of SCHOOL_SEASON_FORMATS) {
      const own = after.ranks?.byEvent[event];
      expect(own?.allTime).toMatchObject({ score: 20, of: programs(event, 2019) });
      await expectOnAllTimeList(event, later, fetchFile, own?.allTime ?? null);
      // The decade is the same points from 2010-11 on.
      expect(own?.decade).toEqual(hsProgramStrength(zedRows(2016, 2019), event, 2019, { decadeFrom: 2011 }).ranks.get("zed-test")?.decade);
    }
    expect(after.ranks?.decadeFrom).toBe(2011);
  });

  it("recomputes stored ranks scored by an older version", async () => {
    const later = new Date("2019-09-01T00:00:00Z");
    const fetchFile = vi.fn(async (kind: string) =>
      kind === "teams" ? { status: 200, body: teams("Zed Test") } : { status: 404, body: "" },
    );
    const fresh = await getSchoolSeasons(db, "zed-test", { now: later, fetchFile });
    // A row from before ranks were the all-time list's: the build count still matches.
    await db.run(sql`UPDATE school_strength_ranks SET ranks = ${JSON.stringify({
      byEvent: { Policy: { allTime: { rank: 1, score: 20, of: 2 }, decade: null } },
      decadeFrom: 2011,
    })}`);
    const again = await getSchoolSeasons(db, "zed-test", { now: later, fetchFile });
    expect(again.ranks).toEqual(fresh.ranks);
    expect(again.ranks?.byEvent.Policy?.allTime?.of).toBeGreaterThan(2);
  });

  it("serves each event's Top 20 from the stored seasons and the TOC history", async () => {
    const later = new Date("2019-09-01T00:00:00Z");
    const fetchFile = vi.fn(async (kind: string) =>
      kind === "teams" ? { status: 200, body: teams("Zed Test") } : { status: 404, body: "" },
    );
    const chart = await getSchoolElite(db, "Public Forum", { now: later, fetchFile });
    // Picked and charted over 2000–2019 (twenty years; PF's TOC history starts later).
    expect(chart).toMatchObject({ event: "Public Forum", pending: 0, rankFromYear: 2000, lastYear: 2019 });
    expect(chart.firstYear).toBeGreaterThanOrEqual(2000);
    expect(chart.schools).toHaveLength(20);
    for (const school of chart.schools) expect(school.seasons).toHaveLength(2019 - chart.firstYear + 1);
  });
});
