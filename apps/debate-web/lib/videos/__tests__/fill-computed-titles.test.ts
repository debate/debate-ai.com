/**
 * @fileoverview `fillComputedTitles` against a real in-memory SQLite `videos`
 * table, with debatedata and the Elo ratings stubbed.
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

const ratings = (teams: [string, string][]) =>
  JSON.stringify({
    attribution: "x",
    teams: JSON.stringify(teams.map(([SchoolTeamCode, OverallELO]) => ({ SchoolTeamCode, OverallELO }))),
  });

function stubFetch() {
  const files: Record<string, string> = {
    "CollegePolicy2526.json": ratings([
      ["Emory GY: Gallagher & Young", "2300"],
      ["Someone AB: Adams & Brown", "2100"],
      ["Iowa EW: Eltyeb & Weimar", "2000"],
    ]),
  };
  return vi.fn(async (url: string | URL | Request) => {
    const file = String(url).split("/").pop()!;
    return files[file] ? new Response(files[file], { status: 200 }) : new Response("", { status: 404 });
  });
}

const loadCollege = vi.fn(async () => []);
const now = new Date("2026-11-04T00:00:00Z");

let db: Db;
let fillComputedTitles: typeof import("../fill-computed-titles").fillComputedTitles;
beforeEach(async () => {
  vi.resetModules();
  ({ fillComputedTitles } = await import("../fill-computed-titles"));
  db = await freshDb();
});

async function computed(id: string) {
  const [row] = await db.select({ t: videos.computedTitle }).from(videos).where(eq(videos.videoId, id));
  return row?.t ?? null;
}

describe("fillComputedTitles", () => {
  it("titles rounds with their season's ranks and last names, leaving lectures alone", async () => {
    await db.insert(videos).values([
      {
        videoId: "r1",
        source: "round",
        title: "Harvard QF",
        publishedAt: "2026-02-20",
        style: 4,
        tournament: "Harvard",
        roundLevel: "Quarters",
        affTeam: "Iowa EW",
        negTeam: "Emory GY",
        seasonYear: 2026,
      },
      {
        videoId: "r2",
        source: "round",
        title: "Old round",
        publishedAt: "2026-01-10",
        style: 3,
        tournament: "Blake",
        roundLevel: "Finals",
        affTeam: "Harker AL",
        negTeam: "Strake JD",
        arg1ac: "Util",
        seasonYear: 2026,
      },
      { videoId: "l1", source: "lecture", title: "How to flow", publishedAt: "2026-01-01", category: "Lectures", seasonYear: 2026 },
    ] as any);

    const result = await fillComputedTitles(db, { fetchImpl: stubFetch() as any, loadCollege, now });
    expect(result).toMatchObject({ season: 2026, rows: 3, updated: 2, titled: 2, ranked: 2, nextSeason: null });
    expect(await computed("r1")).toBe("2026 Harvard Quarters: Iowa #3 Eltyeb & Weimar vs Emory #1 Gallagher & Young");
    expect(await computed("r2")).toBe("2026 Blake LD Final: Harker AL (Util) vs Strake JD");
    expect(await computed("l1")).toBeNull();

    // A re-run with nothing changed writes nothing.
    const again = await fillComputedTitles(db, { fetchImpl: stubFetch() as any, loadCollege, now });
    expect(again.updated).toBe(0);
  });

  it("falls back to the stored long names when no table knows the team", async () => {
    await db.insert(videos).values({
      videoId: "r3",
      source: "round",
      title: "x",
      publishedAt: "2026-02-20",
      style: 1,
      tournament: "TOC",
      roundLevel: "Octas",
      affTeam: "Strath Haven YS",
      affTeamLong: "yang-smith",
      seasonYear: 2026,
    } as any);
    await fillComputedTitles(db, { fetchImpl: stubFetch() as any, loadCollege, now });
    expect(await computed("r3")).toBe("2026 TOC HS Policy Octas: Strath Haven Yang & Smith");
  });
});
