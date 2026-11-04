/**
 * @fileoverview `fillTeamLongNames` against a real in-memory SQLite `videos`
 * table, with debatedata and Extinction.GG stubbed: which rows it reads,
 * what it writes, how it steps through seasons, and that Extinction.GG files
 * for finished seasons are saved and reused.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { videos } from "../../database/schema";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

type Db = Awaited<ReturnType<typeof freshDb>>;

async function insertRound(
  db: Db,
  id: string,
  values: { style: number; seasonYear: number; affTeam?: string; negTeam?: string; affTeamLong?: string; adminEdited?: boolean },
) {
  await db.insert(videos).values({ videoId: id, source: "round", publishedAt: "2019-01-01", ...values } as any);
}

const extinctionBody = (codes: string[]) =>
  JSON.stringify({ attribution: "Extinction.GG", teams: JSON.stringify(codes.map((SchoolTeamCode) => ({ SchoolTeamCode, OverallELO: "1800" }))) });

/** Extinction.GG with HS policy 2018-19 and 2019-20 and college 2019-20; everything else 404. */
function stubFetch() {
  const files: Record<string, string> = {
    "HSPolicy1819.json": extinctionBody(["Strath Haven YS: Smith & Yang"]),
    "HSPolicy1920.json": extinctionBody(["Whitney Young BM: Boss & Mohan"]),
    "CollegePolicy1920.json": extinctionBody(["Emory GS: Gallagher & Song"]),
  };
  return vi.fn(async (url: string | URL | Request) => {
    const file = String(url).split("/").pop()!;
    return files[file] ? new Response(files[file], { status: 200 }) : new Response("", { status: 404 });
  });
}

const loadCollege = vi.fn(async (season: number) => (season === 2020 ? [{ school: "University of Kansas", name: "Larson & Schultz" }] : []));
const now = new Date("2026-11-04T00:00:00Z");

let db: Db;
let fillTeamLongNames: typeof import("../fill-team-long-names").fillTeamLongNames;
beforeEach(async () => {
  // Fresh modules per test: the column check and the Extinction.GG store's
  // table check are memoized per isolate, and each test has its own database.
  vi.resetModules();
  ({ fillTeamLongNames } = await import("../fill-team-long-names"));
  loadCollege.mockClear();
  db = await freshDb();
});

async function longNames(id: string) {
  const [row] = await db.select({ aff: videos.affTeamLong, neg: videos.negTeamLong }).from(videos).where(eq(videos.videoId, id));
  return row;
}

describe("fillTeamLongNames", () => {
  it("steps through seasons oldest first, filling from that season and the one before", async () => {
    await insertRound(db, "hs2020", { style: 1, seasonYear: 2020, affTeam: "Whitney Young BM", negTeam: "Strath Haven YS" });
    await insertRound(db, "cp2020", { style: 4, seasonYear: 2020, affTeam: "KU LS", negTeam: "Emory GS" });
    await insertRound(db, "hs2019", { style: 1, seasonYear: 2019, affTeam: "Strath Haven YS", negTeam: "Nowhere ZZ" });
    const fetchImpl = stubFetch();

    const first = await fillTeamLongNames(db, { fetchImpl: fetchImpl as any, loadCollege, now });
    expect(first).toMatchObject({ season: 2019, rows: 1, updated: 1, unresolved: 1, nextSeason: 2020, seasons: [2019, 2020] });
    expect(await longNames("hs2019")).toEqual({ aff: "yang-smith", neg: null });

    const second = await fillTeamLongNames(db, { season: 2020, fetchImpl: fetchImpl as any, loadCollege, now });
    expect(second).toMatchObject({ season: 2020, rows: 2, updated: 2, unresolved: 0, nextSeason: null });
    // Strath Haven YS is only in 2018-19's table: found through the season before.
    expect(await longNames("hs2020")).toEqual({ aff: "boss-mohan", neg: "yang-smith" });
    // KU LS from debatedata, Emory GS from Extinction.GG's college ratings.
    expect(await longNames("cp2020")).toEqual({ aff: "larson-schultz", neg: "gallagher-song" });
  });

  it("saves finished seasons' Extinction.GG files and reads them back instead of refetching", async () => {
    await insertRound(db, "hs2019", { style: 1, seasonYear: 2019, affTeam: "Strath Haven YS" });
    const fetchImpl = stubFetch();
    await fillTeamLongNames(db, { fetchImpl: fetchImpl as any, loadCollege, now, overwrite: true });
    const calls = fetchImpl.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    await fillTeamLongNames(db, { fetchImpl: fetchImpl as any, loadCollege, now, overwrite: true });
    expect(fetchImpl.mock.calls.length).toBe(calls);
  });

  it("leaves stored names, admin-edited rows, LD and non-initials teams alone", async () => {
    await insertRound(db, "kept", { style: 1, seasonYear: 2019, affTeam: "Strath Haven YS", affTeamLong: "custom" });
    await insertRound(db, "edited", { style: 1, seasonYear: 2019, affTeam: "Strath Haven YS", adminEdited: true });
    await insertRound(db, "ld", { style: 3, seasonYear: 2019, affTeam: "Strath Haven YS" });
    await insertRound(db, "school", { style: 1, seasonYear: 2019, affTeam: "Strath Haven" });

    const result = await fillTeamLongNames(db, { fetchImpl: stubFetch() as any, loadCollege, now });
    expect(result).toMatchObject({ season: null, rows: 0, updated: 0, seasons: [], nextSeason: null });
    expect(await longNames("kept")).toEqual({ aff: "custom", neg: null });
    expect(await longNames("edited")).toEqual({ aff: null, neg: null });
    expect(await longNames("ld")).toEqual({ aff: null, neg: null });
  });

  it("reports a table that fails to load and carries on", async () => {
    await insertRound(db, "hs2019", { style: 1, seasonYear: 2019, affTeam: "Strath Haven YS" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response("down", { status: 500 }));
    const result = await fillTeamLongNames(db, { fetchImpl: fetchImpl as any, loadCollege, now });
    expect(result.updated).toBe(0);
    expect(result.missingTables).toEqual(["hspolicy 2019", "hspolicy 2018"]);
  });
});
