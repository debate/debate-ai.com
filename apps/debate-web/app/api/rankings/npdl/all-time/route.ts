import { NextResponse } from "next/server";
import { NPDL_SEASONS, type NpdlSeasonRankings } from "@debate-ai/rankings/src/sync/sync-npdl-rankings";
import { buildNpdlAllTime, type NpdlAllTimeResponse } from "@debate-ai/rankings/src/sync/npdl-all-time";
import { currentSeasonYear } from "@debate-ai/rankings/src/leaderboard/leaderboardUtils";
import npdlSnapshot from "@debate-ai/rankings/data/npdl-rankings.json";
import { getDBFromContext } from "@/lib/database/context";
import { readSavedNpdlSeason } from "@/lib/rankings/npdl-rankings-store";

const snapshot = npdlSnapshot as Record<string, NpdlSeasonRankings>;

/**
 * `GET /api/rankings/npdl/all-time`: the greatest Parli (NPDL) teams and
 * schools of all time, over every finished season since 2017-18
 * (`buildNpdlAllTime`: the high school program-strength formula applied to the
 * league's published team ranks). Each season is read from D1
 * (`lib/rankings/npdl-rankings-store.ts`), falling back to the bundled
 * snapshot (`bun run sync-npdl`) when D1 cannot be read or does not have it.
 */
export async function GET() {
  let db: Awaited<ReturnType<typeof getDBFromContext>> | null = null;
  try {
    db = await getDBFromContext();
  } catch (error) {
    console.error("[npdl-all-time] D1 unavailable:", error instanceof Error ? error.message : String(error));
  }

  let fromDatabase = Boolean(db);
  const seasons: Record<string, NpdlSeasonRankings | null> = {};
  await Promise.all(
    NPDL_SEASONS.map(async (season) => {
      let saved: NpdlSeasonRankings | null = null;
      if (db) {
        try {
          saved = await readSavedNpdlSeason(db, season);
        } catch (error) {
          console.error(`[npdl-all-time] ${season} D1 read failed:`, error instanceof Error ? error.message : String(error));
        }
      }
      if (!saved?.teams.length) {
        if (snapshot[season]?.teams.length) fromDatabase = false;
        saved = snapshot[season] ?? null;
      }
      seasons[season] = saved;
    }),
  );

  const built = buildNpdlAllTime(seasons, { lastYear: currentSeasonYear() - 1 });
  const body: NpdlAllTimeResponse = { ...built, source: fromDatabase ? "database" : "snapshot" };
  if (!body.teams.length && !body.schools.length) {
    return NextResponse.json(body, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": fromDatabase
        ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
        : "public, max-age=300, s-maxage=300",
    },
  });
}
